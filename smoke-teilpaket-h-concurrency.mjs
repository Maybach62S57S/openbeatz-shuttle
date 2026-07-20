// Teilpaket H - Client-Nebenlaeufigkeits-Haertetest der Schreibwege.
//
// Beweist die zwei zentralen Garantien des bestehenden updateDyn-CAS-Kerns
// gegen einen simulierten Konkurrenz-Schreiber:
//   (1) Kein verlorenes Update: kollidieren zwei Schreiber auf derselben
//       Ausgangsrevision, wird die Mutation auf den frischen Serverstand neu
//       angewendet statt ihn zu ueberschreiben -> beide Aenderungen bleiben.
//   (2) Kein blindes Ueberschreiben: nach erschoepften Retries wird die eigene
//       Aenderung NICHT gewaltsam geschrieben, sondern { ok:false } gemeldet.
// Zusaetzlich: mitSperre-Doppelklick-Guard (Fahrer-App-Statuswege).
//
// Die getestete Schleife ist ZEILENGETREU aus src/ShuttleLeitstelle.jsx
// (updateDyn, Z. 1031-1065) repliziert. Der Mock-sset bildet die Semantik der
// echten Supabase-RPC write_dyn_if_unchanged nach (bedingtes UPDATE auf
// dyn_rev, bei Konflikt aktueller Serverstand zurueck). Die statische
// Verifikation der RPC selbst folgt separat (SQL-Invarianten + Postgres).
//
// Aufruf: node smoke-teilpaket-h-concurrency.mjs

let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push(m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} (erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)})`);

const DYN_KEY = "obf:dyn:v5";
const emptyDyn = () => ({ rides: [], driverState: {}, rev: 0 });

// ---- Mock-Store mit echtem Compare-and-Swap (wie write_dyn_if_unchanged) ----
// server.rev ist die serverseitig gefuehrte Revision. Ein Schreibvorgang wird
// NUR akzeptiert, wenn baseRev == server.rev; dann wird server.rev serverseitig
// +1 gesetzt (nicht der clientseitige next.rev blind uebernommen). Bei Konflikt
// kommt { ok:false, value: aktueller-Serverstand } zurueck.
function makeStore(initial) {
  let server = structuredClone(initial);
  return {
    peek: () => structuredClone(server),
    sget: async () => structuredClone(server),
    // baseRev = erwartete Revision. Serverseitige rev-Erhoehung, nicht Client-Wert.
    sset: async (key, val, baseRev) => {
      if (baseRev === (server.rev || 0)) {
        const written = structuredClone(val);
        written.rev = (server.rev || 0) + 1; // SERVERSEITIG erhoeht
        server = written;
        return { ok: true, value: structuredClone(server) };
      }
      return { ok: false, value: structuredClone(server) };
    },
    // UNSICHER (nur fuer Gegenproben): unbedingter Schreibvorgang ohne rev-Pruefung
    // = last-write-wins, genau das Verhalten OHNE CAS-Schutz.
    unsafeSet: async (key, val) => { server = structuredClone(val); return { ok: true, value: structuredClone(server) }; },
    // fuer die Simulation: Konkurrenz-Schreiber, veraendert den Server direkt
    competitorWrite: (mutator) => { const n = mutator(structuredClone(server)); n.rev = (server.rev || 0) + 1; server = n; },
  };
}

// ---- updateDyn-Schleife: ZEILENGETREU aus der Quelle (Z. 1031-1065) ----------
// Nur die Umgebung (sget/sset/pushUndoEntry/setDyn) ist injiziert. Optional
// blindOverwrite=true schaltet den Schutz ab (fuer die Gegenprobe).
function makeUpdateDyn({ sget, sset, pushUndoEntry, setDyn, blindOverwrite = false, forceSet = null }) {
  return async (mutator) => {
    let last = null;
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        const cur = (await sget(DYN_KEY)) || emptyDyn();
        const baseRev = cur.rev || 0;
        const next = mutator(structuredClone(cur));
        next.rev = baseRev + 1;
        const result = await sset(DYN_KEY, next, baseRev);
        if (result.ok) {
          const applied = result.value || next;
          pushUndoEntry(cur.rides, applied.rides);
          setDyn(applied);
          return { ok: true, value: applied };
        }
        last = result.value;
      }
      if (blindOverwrite) {
        // GEGENPROBE-Variante: nach Retries doch blind (unbedingt) schreiben.
        const cur = (await sget(DYN_KEY)) || emptyDyn();
        const next = mutator(structuredClone(cur));
        next.rev = (cur.rev || 0) + 99;
        await (forceSet || sset)(DYN_KEY, next, cur.rev || 0);
        return { ok: true, value: next };
      }
      if (last) setDyn(last);
      return { ok: false, value: last, error: "Mehrfacher Schreibkonflikt, bitte erneut versuchen." };
    } catch (e) {
      return { ok: false, value: null, error: "Speicherfehler" };
    }
  };
}

// ===========================================================================
// Test 1: Einzel-Schreiber - normaler Erfolgsfall
// ===========================================================================
{
  const store = makeStore({ rides: [{ id: "r1", assignedDriverId: null }], driverState: {}, rev: 3 });
  let dynState = null;
  const upd = makeUpdateDyn({ sget: store.sget, sset: store.sset, pushUndoEntry: () => {}, setDyn: (v) => { dynState = v; } });
  const res = await upd((d) => { const r = d.rides.find((x) => x.id === "r1"); r.assignedDriverId = "finn"; return d; });
  ok(res.ok === true, "T1: Einzelschreiber ok=true");
  eq(res.value.rev, 4, "T1: rev serverseitig +1 (3 -> 4)");
  eq(res.value.rides[0].assignedDriverId, "finn", "T1: Fahrer gesetzt");
  eq(store.peek().rev, 4, "T1: Serverstand rev 4");
  ok(res.value && typeof res.value === "object" && "ok" in res, "T1: Rueckgabeform { ok, value }");
}

// ===========================================================================
// Test 2: KEIN verlorenes Update - Konkurrenz-Schreiber kollidiert einmal
//   Zwei Dispatcher lesen rev=5. B schreibt zuerst (Fahrer an r2). A schreibt
//   danach (Fahrer an r1) -> A kollidiert, laedt frisch, wendet neu an.
//   Erwartung: BEIDE Zuweisungen bleiben erhalten, rev am Ende 7.
// ===========================================================================
{
  const store = makeStore({ rides: [{ id: "r1", assignedDriverId: null }, { id: "r2", assignedDriverId: null }], driverState: {}, rev: 5 });
  let firstReadDone = false;
  const sgetHooked = async () => {
    const snap = store.peek();
    // Nach dem ERSTEN Lesen von A schiebt B seine Aenderung dazwischen (Race).
    if (!firstReadDone) { firstReadDone = true; store.competitorWrite((s) => { s.rides.find((x) => x.id === "r2").assignedDriverId = "bjoern"; return s; }); }
    return snap;
  };
  const upd = makeUpdateDyn({ sget: sgetHooked, sset: store.sset, pushUndoEntry: () => {}, setDyn: () => {} });
  const res = await upd((d) => { d.rides.find((x) => x.id === "r1").assignedDriverId = "finn"; return d; });
  ok(res.ok === true, "T2: A-Schreibvorgang letztlich ok");
  const final = store.peek();
  eq(final.rides.find((x) => x.id === "r1").assignedDriverId, "finn", "T2: A-Zuweisung (r1=finn) erhalten");
  eq(final.rides.find((x) => x.id === "r2").assignedDriverId, "bjoern", "T2: B-Zuweisung (r2=bjoern) NICHT verloren");
  eq(final.rev, 7, "T2: rev 5 -> 6 (B) -> 7 (A), beide Schreibvorgaenge gezaehlt");
}

// ===========================================================================
// Test 3: KEIN blindes Ueberschreiben - Konkurrent kollidiert bei JEDEM Versuch
//   Bei jedem sget schiebt der Konkurrent eine Aenderung dazwischen -> alle 6
//   Versuche kollidieren. Erwartung: ok=false, eigene Aenderung NICHT geschrieben,
//   Serverstand bleibt der des Konkurrenten (kein Overwrite).
// ===========================================================================
{
  const store = makeStore({ rides: [{ id: "r1", assignedDriverId: null, note: "" }], driverState: {}, rev: 0 });
  let competitorCount = 0;
  const sgetHooked = async () => {
    const snap = store.peek();
    store.competitorWrite((s) => { s.rides[0].note = "konkurrent-" + (++competitorCount); return s; });
    return snap;
  };
  const upd = makeUpdateDyn({ sget: sgetHooked, sset: store.sset, pushUndoEntry: () => {}, setDyn: () => {} });
  const res = await upd((d) => { d.rides[0].assignedDriverId = "finn"; return d; });
  ok(res.ok === false, "T3: nach 6 Kollisionen ok=false");
  ok(typeof res.error === "string" && res.error.length > 0, "T3: sprechende Fehlermeldung vorhanden");
  const final = store.peek();
  eq(final.rides[0].assignedDriverId, null, "T3: eigene Zuweisung NICHT blind geschrieben");
  ok(final.rides[0].note.startsWith("konkurrent-"), "T3: Serverstand ist der des Konkurrenten (kein Overwrite)");
}

// ===========================================================================
// Test 4: Rueckgabeform-Kontrakt bei Fehler (kein stilles Verschlucken)
// ===========================================================================
{
  const store = makeStore({ rides: [], driverState: {}, rev: 0 });
  const ssetThrow = async () => { throw new Error("network down"); };
  const upd = makeUpdateDyn({ sget: store.sget, sset: ssetThrow, pushUndoEntry: () => {}, setDyn: () => {} });
  const res = await upd((d) => d);
  ok(res.ok === false, "T4: Netzwerkfehler -> ok=false");
  ok("error" in res, "T4: Fehler ist im Rueckgabeobjekt (nicht nur console)");
}

// ===========================================================================
// Test 5: mitSperre-Doppelklick-Guard (Fahrer-App) - ZEILENGETREU nachgebildet
//   busyRef blockt den Zweitaufruf, Freigabe im finally.
// ===========================================================================
{
  // Nachbildung des Guards aus Z. 2821-2834 (busyRef + finally-Freigabe).
  let calls = 0;
  const busyRef = { current: null };
  const STATUS_LOCK_MS = 0;
  const arbeit = async () => { calls++; await new Promise((r) => setTimeout(r, 5)); return { ok: true }; };
  const mitSperre = async (ride, work) => {
    if (busyRef.current) return;                 // Guard
    busyRef.current = ride.id;
    try {
      const [ergebnis] = await Promise.all([work(), new Promise((f) => setTimeout(f, STATUS_LOCK_MS))]);
      return ergebnis;
    } finally { busyRef.current = null; }         // Freigabe
  };
  const ride = { id: "r1" };
  // zwei fast gleichzeitige Klicks
  const p1 = mitSperre(ride, arbeit);
  const p2 = mitSperre(ride, arbeit); // sollte durch Guard sofort abbrechen
  await Promise.all([p1, p2]);
  eq(calls, 1, "T5: Doppelklick -> nur EIN Schreibvorgang ausgefuehrt");
  ok(busyRef.current === null, "T5: Sperre im finally geloest (Button wieder frei)");
  // nach Freigabe ist ein neuer Klick wieder moeglich
  await mitSperre(ride, arbeit);
  eq(calls, 2, "T5: nach Freigabe ist erneuter Schreibvorgang moeglich");
}

// ===========================================================================
// GEGENPROBEN - der Schutz wird testweise entfernt, die Tests MUESSEN brechen.
// ===========================================================================
async function gegenprobe(name, fn) {
  let brach = false;
  try { await fn(); } catch { brach = true; }
  return { name, brach };
}

// GP1: Konfliktschutz aus (unbedingter Schreibvorgang) -> T2 verliert die B-Aenderung.
{
  const store = makeStore({ rides: [{ id: "r1", assignedDriverId: null }, { id: "r2", assignedDriverId: null }], driverState: {}, rev: 5 });
  let firstReadDone = false;
  const sgetHooked = async () => {
    const snap = store.peek();
    if (!firstReadDone) { firstReadDone = true; store.competitorWrite((s) => { s.rides.find((x) => x.id === "r2").assignedDriverId = "bjoern"; return s; }); }
    return snap;
  };
  const upd = makeUpdateDyn({ sget: sgetHooked, sset: store.unsafeSet, pushUndoEntry: () => {}, setDyn: () => {} });
  await upd((d) => { d.rides.find((x) => x.id === "r1").assignedDriverId = "finn"; return d; });
  const final = store.peek();
  const bLost = final.rides.find((x) => x.id === "r2").assignedDriverId !== "bjoern";
  ok(bLost, "GP1: ohne Konfliktschutz geht die B-Zuweisung verloren (Gegenprobe greift)");
}

// GP2: blindes Ueberschreiben aktiviert -> T3 schreibt die eigene Aenderung doch.
{
  const store = makeStore({ rides: [{ id: "r1", assignedDriverId: null, note: "" }], driverState: {}, rev: 0 });
  const sgetHooked = async () => { const snap = store.peek(); store.competitorWrite((s) => { s.rides[0].note = "konkurrent"; return s; }); return snap; };
  const upd = makeUpdateDyn({ sget: sgetHooked, sset: store.sset, pushUndoEntry: () => {}, setDyn: () => {}, blindOverwrite: true, forceSet: store.unsafeSet });
  await upd((d) => { d.rides[0].assignedDriverId = "finn"; return d; });
  const final = store.peek();
  ok(final.rides[0].assignedDriverId === "finn", "GP2: mit blindem Overwrite wird trotz Konflikt geschrieben (Gegenprobe greift)");
}

// GP3: Doppelklick-Guard entfernt -> T5 fuehrt zwei Schreibvorgaenge aus.
{
  let calls = 0;
  const arbeit = async () => { calls++; await new Promise((r) => setTimeout(r, 5)); return { ok: true }; };
  const ohneGuard = async (ride, work) => { await work(); }; // KEIN busyRef
  await Promise.all([ohneGuard({ id: "r1" }, arbeit), ohneGuard({ id: "r1" }, arbeit)]);
  ok(calls === 2, "GP3: ohne Guard fuehrt Doppelklick zwei Schreibvorgaenge aus (Gegenprobe greift)");
}

// ---- Ergebnis ------------------------------------------------------------
console.log(`\nTeilpaket H Client-Nebenlaeufigkeit: ${pass} OK, ${fail} FAIL`);
if (fail) { for (const f of fails) console.log("  FAIL:", f); process.exit(1); }
