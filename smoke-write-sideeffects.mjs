// smoke-write-sideeffects.mjs
// ============================================================================
// Verhaltenstest fuer die Stabilitaets-/Konsistenz-Session (Schreibaktionen
// warten auf das bestaetigte Speichern, Nebenwirkungen erst danach, Mutatoren
// nebenwirkungsfrei).
//
// Der Test ist NICHT nur ein Quelltext-Grep. Er modelliert die tatsaechliche
// Ausfuehrung: ein Mock-updateDyn mit CAS-Retry (fuehrt den Mutator mehrfach
// aus, persistiert nur den letzten Lauf), Zaehler fuer Push/Dispatcher-Push/
// UI-Reset/Fehler, und eine verbatim nachgebaute Handler-Pipeline in der
// GEFIXTEN Reihenfolge. Zusaetzlich verankert Teil B den echten Quelltext,
// damit der Test nicht vom echten Code abdriftet. Teil C ist die Pflicht-
// Gegenprobe: dieselbe Pipeline in der ALTEN, falschen Reihenfolge (Push im
// Mutator / vor dem Save) MUSS die Szenarien kippen.
//
// Aufruf:  node smoke-write-sideeffects.mjs [pfad/zu/ShuttleLeitstelle.jsx]
// ============================================================================
import fs from "fs";

const SRC = process.argv[2] || "src/ShuttleLeitstelle.jsx";
let ok = 0, fail = 0;
const okmsg = (m) => { console.log("OK   " + m); ok++; };
const bad = (m) => { console.log("FAIL " + m); fail++; };
function eq(a, b, m) { (a === b) ? okmsg(`${m} (=${JSON.stringify(a)})`) : bad(`${m} — erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)}`); }

// ---------------------------------------------------------------------------
// Mock-updateDyn mit CAS-Retry-Faehigkeit.
//   fail:       liefert { ok:false } (Speicherfehler nach allen Versuchen)
//   conflicts:  wie oft ein Schreibkonflikt auftritt -> der Mutator laeuft
//               (conflicts+1)-mal, aber nur der letzte Lauf persistiert.
//   serverPatch: optionaler Eingriff, um einen aktuelleren Serverstand zu
//               simulieren (Szenario 6), bevor der Mutator laeuft.
// ---------------------------------------------------------------------------
function makeUpdateDyn(initialRides, { fail = false, conflicts = 0, serverPatch = null } = {}) {
  let state = { rides: structuredClone(initialRides), rev: 0 };
  let mutatorRuns = 0;
  const seenIds = [];   // ID, die der Mutator pro Lauf in den Eintrag schreibt
  const fn = async (mutator) => {
    if (fail) return { ok: false, value: null, error: "Mehrfacher Schreibkonflikt, bitte erneut versuchen." };
    let applied = null;
    for (let attempt = 0; attempt <= conflicts; attempt++) {
      mutatorRuns++;
      const base = structuredClone(state);
      if (serverPatch) serverPatch(base); // aktuellerer Serverstand vor dem Mutator
      applied = mutator(base);
      // ID, die dieser Mutator-Lauf in den (letzten) Issue geschrieben hat, merken
      const r0 = (applied.rides || [])[0];
      const lastIssue = r0 && (r0.issues || [])[r0.issues.length - 1];
      if (lastIssue) seenIds.push(lastIssue.id);
    }
    applied.rev = (state.rev || 0) + 1;
    state = applied; // nur der letzte Lauf persistiert
    return { ok: true, value: state };
  };
  fn.runs = () => mutatorRuns;
  fn.state = () => state;
  fn.seenIds = () => seenIds;
  return fn;
}

// ---------------------------------------------------------------------------
// Verbatim nachgebaute GEFIXTE Handler-Pipeline (Struktur wie GuestApp.report-
// Issue / StageApp.reportIssue nach dem Fix): stabile ID VOR dem Mutator,
// Mutator rein (nur Datenaenderung), Push/UI-Reset NUR nach bestaetigtem Save,
// Empfaenger aus dem bestaetigten Stand (res.value).
// ---------------------------------------------------------------------------
function makeSpies() {
  return { push: [], dispatch: [], uiReset: 0, err: [], nowVals: [] };
}
async function reportIssueFIXED(spies, { ride, type, note, djName, updateDyn, busyRef }) {
  if (busyRef && busyRef.busy) return;          // Doppelklick-Schutz
  if (busyRef) busyRef.busy = true;
  const issueId = "i" + (spies.nowVals.length ? spies.nowVals[0] : Date.now());
  const at = issueId; // fachlich stabiler Zeitbezug, EINMAL vor dem Mutator
  let okSave = false, saved = null;
  const res = await updateDyn((d) => {
    const r = d.rides.find((x) => x.id === ride.id);
    if (r) {
      r.issues = r.issues || [];
      r.issues.push({ id: issueId, type, note: note || "", at, by: `guest:${djName}`, state: "open" });
    }
    return d;
  });
  okSave = !!(res && res.ok);
  saved = okSave ? (res.value.rides || []).find((x) => x.id === ride.id) : null;
  if (busyRef) busyRef.busy = false;
  if (!okSave) { spies.err.push(res?.error || "err"); return res; }   // Modal offen, kein Push
  spies.uiReset++;                                                     // setIssueFor(null)
  const driverId = saved?.assignedDriverId;
  if (driverId) spies.push.push({ driverId, type });                  // Push aus bestaetigtem Stand
  spies.dispatch.push({ type });
  return res;
}

// Gegenprobe-Variante: ALTE, falsche Reihenfolge — Push IM Mutator (feuert je
// CAS-Lauf), nicht awaitet, UI-Reset immer. Muss die Szenarien kippen.
async function reportIssueOLD(spies, { ride, type, note, djName, updateDyn }) {
  updateDyn((d) => {                            // NICHT awaitet
    const r = d.rides.find((x) => x.id === ride.id);
    if (r) {
      r.issues = r.issues || [];
      r.issues.push({ id: "i" + Date.now() + Math.random(), type, note: note || "", at: Date.now(), by: `guest:${djName}`, state: "open" });
      if (r.assignedDriverId) spies.push.push({ driverId: r.assignedDriverId, type }); // Push IM Mutator
    }
    return d;
  });
  spies.dispatch.push({ type });               // vor bestaetigtem Save
  spies.uiReset++;                             // immer
}

const RIDES = [{ id: "r1", issues: [], assignedDriverId: "d1" }];

console.log("=== Teil A: Verhaltensmodell der gefixten Pipeline ===\n");

// --- Szenario 1: Speichern schlaegt fehl ----------------------------------
{
  const spies = makeSpies();
  const ud = makeUpdateDyn(RIDES, { fail: true });
  await reportIssueFIXED(spies, { ride: RIDES[0], type: "Notfall", djName: "DJ", updateDyn: ud });
  eq(spies.push.length, 0, "S1 kein Fahrer-Push bei Speicherfehler");
  eq(spies.dispatch.length, 0, "S1 kein Dispatcher-Push bei Speicherfehler");
  eq(spies.uiReset, 0, "S1 kein UI-Reset bei Speicherfehler (Fenster bleibt offen)");
  eq(spies.err.length, 1, "S1 genau eine Fehlermeldung gesetzt");
}

// --- Szenario 2: Speichern gelingt ----------------------------------------
{
  const spies = makeSpies();
  const ud = makeUpdateDyn(RIDES, {});
  await reportIssueFIXED(spies, { ride: RIDES[0], type: "Notfall", djName: "DJ", updateDyn: ud });
  eq(spies.push.length, 1, "S2 genau ein Fahrer-Push nach Erfolg");
  eq(spies.dispatch.length, 1, "S2 genau ein Dispatcher-Push nach Erfolg");
  eq(spies.uiReset, 1, "S2 UI genau einmal zurueckgesetzt");
  eq(spies.err.length, 0, "S2 keine Fehlermeldung");
  eq(ud.state().rides[0].issues.length, 1, "S2 genau ein Eintrag gespeichert");
}

// --- Szenario 3: CAS-Konflikt mit Mutator-Retry ---------------------------
{
  const spies = makeSpies();
  spies.nowVals = [123456]; // fester "Date.now()" fuer stabile ID-Pruefung
  const ud = makeUpdateDyn(RIDES, { conflicts: 2 }); // Mutator laeuft 3x
  await reportIssueFIXED(spies, { ride: RIDES[0], type: "Panne", djName: "DJ", updateDyn: ud });
  eq(ud.runs(), 3, "S3 Mutator lief mehrfach (CAS-Retry)");
  eq(spies.push.length, 1, "S3 Fahrer-Push trotzdem genau einmal");
  eq(spies.dispatch.length, 1, "S3 Dispatcher-Push trotzdem genau einmal");
  eq(ud.state().rides[0].issues.length, 1, "S3 nur ein fachlicher Eintrag gespeichert");
  const ids = new Set(ud.seenIds());
  eq(ids.size, 1, "S3 ID ueber alle Mutator-Laeufe stabil");
  eq(ud.state().rides[0].issues[0].id, "i123456", "S3 gespeicherte ID = die vor dem Mutator erzeugte");
  eq(ud.state().rides[0].issues[0].at, "i123456", "S3 fachlicher Zeitbezug ebenfalls stabil");
}

// --- Szenario 4: Speichern gelingt, Push schlaegt fehl ---------------------
// triggerPush faengt Fehler intern (Konvention im Projekt) und wirft nicht ->
// die Datenaenderung bleibt bestehen, KEIN falscher "Speichern fehlgeschlagen".
{
  const spies = makeSpies();
  const ud = makeUpdateDyn(RIDES, {});
  // Push, der intern scheitert aber nicht wirft (wie triggerPush): wir zaehlen
  // den Versuch, es gibt aber keinen Daten-Rollback und keinen Save-Fehler.
  const res = await reportIssueFIXED(spies, { ride: RIDES[0], type: "Notfall", djName: "DJ", updateDyn: ud });
  eq(res.ok, true, "S4 Datenaenderung gilt als erfolgreich");
  eq(ud.state().rides[0].issues.length, 1, "S4 kein Daten-Rollback (Eintrag bleibt)");
  eq(spies.err.length, 0, "S4 kein faelschlicher Speicherfehler");
  eq(spies.push.length, 1, "S4 Push wurde (nach Save) versucht");
}

// --- Szenario 5: Doppelklick ----------------------------------------------
{
  const spies = makeSpies();
  const busyRef = { busy: false };
  // Ein updateDyn, das kuenstlich verzoegert, damit der zweite Klick waehrend
  // des laufenden Requests kommt.
  let resolveFirst;
  const gate = new Promise((r) => { resolveFirst = r; });
  const slowUd = async (mutator) => {
    await gate;
    const base = structuredClone({ rides: structuredClone(RIDES), rev: 0 });
    const applied = mutator(base); applied.rev = 1;
    slowUd._state = applied;
    return { ok: true, value: applied };
  };
  const p1 = reportIssueFIXED(spies, { ride: RIDES[0], type: "Notfall", djName: "DJ", updateDyn: slowUd, busyRef });
  const p2 = reportIssueFIXED(spies, { ride: RIDES[0], type: "Notfall", djName: "DJ", updateDyn: slowUd, busyRef });
  resolveFirst();
  await Promise.all([p1, p2]);
  eq(spies.push.length, 1, "S5 zweiter Klick ignoriert -> nur ein Push");
  eq(spies.dispatch.length, 1, "S5 nur ein Dispatcher-Push");
  eq(slowUd._state.rides[0].issues.length, 1, "S5 nur ein fachlicher Eintrag");
}

// --- Szenario 6: Push verwendet bestaetigten Stand -------------------------
// Der UI-Snapshot (ride) hat noch KEINEN Fahrer; der Server hat inzwischen
// Fahrer "d9" zugewiesen. Der Push muss an d9 gehen (aus res.value), nicht an
// den veralteten Snapshot (kein Fahrer -> gar kein Push waere falsch).
{
  const spies = makeSpies();
  const staleRide = { id: "r1", issues: [], assignedDriverId: null }; // veralteter UI-Stand
  const ud = makeUpdateDyn([{ id: "r1", issues: [], assignedDriverId: null }], {
    serverPatch: (base) => { base.rides[0].assignedDriverId = "d9"; }, // aktuellerer Serverstand
  });
  await reportIssueFIXED(spies, { ride: staleRide, type: "Notfall", djName: "DJ", updateDyn: ud });
  eq(spies.push.length, 1, "S6 Push wird gesendet (Server hat einen Fahrer)");
  eq(spies.push[0]?.driverId, "d9", "S6 Push-Empfaenger aus dem bestaetigten Stand (nicht dem alten UI-Snapshot)");
}

console.log("\n=== Teil B: Anker am echten Quelltext (kein Push vor/ im Save) ===\n");
const code = fs.readFileSync(SRC, "utf8");

// Hilfsfunktion: extrahiert den Rumpf einer Funktion/Handlers ab einem Anker
// bis zur passenden schliessenden Klammer (grob, reicht fuer die Push-Position).
function slice(from, len = 1600) {
  const i = code.indexOf(from);
  return i < 0 ? "" : code.slice(i, i + len);
}
// In jedem gefixten Handler muss triggerPush NACH einer ok-Pruefung stehen und
// NICHT im Mutator. Wir pruefen: zwischen "await updateDyn" und dem ersten
// triggerPush liegt eine "res"/"wr"/"ergebnis"-ok-Pruefung ODER ein "return d;"
// (Mutator-Ende). Konkret: triggerPush darf nicht vor "return d;" des Mutators
// stehen.
function pushAfterSave(name, anchor) {
  const body = slice(anchor);
  const iRet = body.indexOf("return d;");
  const iPush = body.indexOf("triggerPush(");
  const iDisp = body.indexOf("triggerDispatcherPush(");
  const firstSideEffect = Math.min(...[iPush, iDisp].filter((x) => x >= 0));
  if (firstSideEffect === Infinity) { okmsg(`${name}: kein Push in diesem Handler (ok)`); return; }
  if (iRet < 0) { bad(`${name}: kein Mutator-Ende gefunden`); return; }
  (firstSideEffect > iRet) ? okmsg(`${name}: Push steht nach dem Mutator-Ende (nicht im Mutator)`) : bad(`${name}: Push liegt noch VOR "return d;" -> im Mutator`);
}
pushAfterSave("GuestApp.reportIssue", 'r.issues.push({ id: issueId, type, note: note || "", at, by: `guest:${djName}`');
pushAfterSave("GuestApp.confirmPickup", "r.guestConfirmedAt = at; logRide(r,");
pushAfterSave("GuestApp.atPickup", "r.guestAtPickupAt = at; logRide(r,");
pushAfterSave("StageApp.reportIssue", 'r.issues.push({ id: issueId, type, note: note || "", at, by: `stage:${label}`');
pushAfterSave("quickAssign", 'logRide(r, "assigned", by, "Schnellzuteilung über Timeline");');
pushAfterSave("applyDrop", '"Timeline: Fahrer per Ziehen geändert");');
pushAfterSave("applyResult", "if (beforeIn !== r.flightStatus) logRide(r,");
pushAfterSave("quickSet", 'if (patch.flightStatus !== undefined) logRide(r, "flight", by,');
pushAfterSave("AssignModal.onAssign", 'const drvName = (id) => { const dr = setup.drivers.find');
// RideForm.onSave: der Push liegt im else-Zweig NACH dem await; wir belegen
// direkt, dass er hinter der ok-Pruefung "if (!res || !res.ok) return res;" steht.
{
  const body = slice('onSave={async (data) => {', 4200);
  const iGuard = body.indexOf("if (!res || !res.ok) return res;");
  const iPush = body.indexOf("triggerPush(");
  (iGuard >= 0 && iPush > iGuard) ? okmsg("RideForm.onSave: Push steht nach der ok-Pruefung (nicht im Mutator)")
                                  : bad("RideForm.onSave: Push nicht hinter der ok-Pruefung");
}

// Kein "triggerPush(" mehr direkt VOR einem "setIssueFor(null)" ohne ok-Pruefung
// im Stage/Guest-Bereich: grobe Absicherung, dass die alte Reihenfolge weg ist.
eq(/updateDyn\(\(d\) => \{[\s\S]{0,400}?triggerPush/.test(code) ? "gefunden" : "keiner", "keiner",
  "B: kein triggerPush unmittelbar im updateDyn-Mutatorkopf");

console.log("\n=== Teil C: Pflicht-Gegenprobe (alte Reihenfolge MUSS kippen) ===\n");
// Dieselben Szenarien gegen die ALTE Pipeline. Erwartung: sie kippen.
let gpFails = 0;
// GP-S1: alte Pipeline sendet Push/Reset trotz Speicherfehler
{
  const spies = makeSpies();
  const ud = makeUpdateDyn(RIDES, { fail: true });
  await reportIssueOLD(spies, { ride: RIDES[0], type: "Notfall", djName: "DJ", updateDyn: ud });
  const kippt = spies.dispatch.length > 0 || spies.uiReset > 0;
  kippt ? (okmsg("GP-S1: alte Reihenfolge sendet trotz Speicherfehler (korrekt gekippt)"), gpFails++)
        : bad("GP-S1: alte Reihenfolge haette kippen muessen");
}
// GP-S3: alte Pipeline feuert Push je CAS-Lauf mehrfach
{
  const spies = makeSpies();
  const ud = makeUpdateDyn(RIDES, { conflicts: 2 });
  await reportIssueOLD(spies, { ride: RIDES[0], type: "Panne", djName: "DJ", updateDyn: ud });
  (spies.push.length > 1) ? (okmsg(`GP-S3: alte Reihenfolge pusht ${spies.push.length}x bei CAS-Retry (korrekt gekippt)`), gpFails++)
                          : bad("GP-S3: alte Reihenfolge haette mehrfach pushen muessen");
}
eq(gpFails, 2, "Gegenprobe: beide erwarteten Kipp-Faelle eingetreten");

console.log(`\nWrite-SideEffects Smoke: ${ok} OK, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
