// Session "GuestApp-/Gast-RPC-Haertung": sichert die oeffentliche GuestApp und
// alle Gast-RPC-Aktionen gegen Doppelklick, Netzfehler, uneindeutige
// RPC-Ergebnisse, Poll-Ueberlappung und Poll-vs-Mutation-Rennen ab.
//
// Ansatz wie die bestehenden Smokes (smoke-poll-absicherung / -write-sideeffects):
// - Entscheidungslogik, die pruefbar ist, wird MODELLIERT und ausgefuehrt.
// - dass der ECHTE Quelltext dieselbe Logik traegt, wird per Anker am Quelltext
//   belegt (sonst misst das Modell nur sich selbst).
// - drei Pflicht-Gegenproben kippen absichtlich je einen Guard und zeigen, dass
//   der Test das erkennt.
//
// Reiner Node-Test, keine Imports ausser node:fs.
import fs from "fs";

const src = fs.readFileSync(process.argv[2] || "src/ShuttleLeitstelle.jsx", "utf8");

let pass = 0, fail = 0; const fails = [];
function ok(cond, msg) { if (cond) { pass++; console.log("OK  " + msg); } else { fail++; fails.push(msg); console.log("FAIL " + msg); } }

// ---------------------------------------------------------------------------
// Helfer WOERTLICH aus dem Quelltext ausfuehrbar machen (nicht neu getippt).
// ---------------------------------------------------------------------------
const revFn = src.match(/function shouldAcceptRevision\([^)]*\) \{[\s\S]*?\n\}/);
ok(!!revFn, "shouldAcceptRevision im Quelltext gefunden");
const H = new Function(`${revFn[0]}\nreturn { shouldAcceptRevision };`)();
const { shouldAcceptRevision } = H;

// ===========================================================================
// TEIL 1: Vorpruefung - onExhausted-Revisionsrueckfall (Aenderung Ä1)
// ===========================================================================
// Modell des korrigierten onExhausted-Applys: setDyn/setSetup uebernehmen last
// nur, wenn nicht aelter als der aktuelle State (gleicher Helfer wie im Poll).
const applyOnExhausted = (prevRev, lastRev) =>
  shouldAcceptRevision(prevRev, lastRev) ? lastRev : prevRev;

// Szenario aus dem Auftrag: Poll setzt 105, Erschoepfungspfad haelt nur 104.
ok(applyOnExhausted(105, 104) === 105, "Vorpruefung: Poll 105, onExhausted last=104 -> bleibt 105 (kein Rueckfall)");
ok(applyOnExhausted(105, 106) === 106, "Vorpruefung: last=106 (echter Fortschritt) -> wird uebernommen");
ok(applyOnExhausted(105, 105) === 105, "Vorpruefung: gleiche rev -> bleibt/ersetzt gleichwertig 105");
ok(applyOnExhausted(null, 104) === 104, "Vorpruefung: kein Vorstand (null) -> last uebernommen");

// Anker: beide onExhausted-Pfade nutzen wirklich den Guard mit shouldAcceptRevision.
ok(/\(last\) => setDyn\(\(prev\) => shouldAcceptRevision\(/.test(src),
  "Anker: dyn-onExhausted nutzt shouldAcceptRevision-Guard");
ok(/\(last\) => setSetup\(\(prev\) => shouldAcceptRevision\(/.test(src),
  "Anker: setup-onExhausted nutzt shouldAcceptRevision-Guard");

// ===========================================================================
// TEIL 2: RPC-Ergebnis-Auswertung (Aenderung Ä3, Block B)
// ===========================================================================
// Modell des korrigierten okSave: error -> false; sonst nur ok===true.
const okSave = (rpc, errorGuard = true) => {
  const { data: okv, error } = rpc;
  if (errorGuard && error) return false;
  return okv === true;
};

// Szenario 1: eindeutiger Erfolg.
ok(okSave({ data: true, error: null }) === true, "S1: RPC {data:true} -> Erfolg");
// Szenario 2: RPC gibt error zurueck.
ok(okSave({ data: null, error: { message: "boom" } }) === false, "S2: RPC error -> kein Erfolg");
// Szenario 3: uneindeutige Antwort (null/undefined) NICHT als Erfolg.
ok(okSave({ data: null, error: null }) === false, "S3: data=null ohne error -> kein Erfolg");
ok(okSave({ data: undefined, error: null }) === false, "S3: data=undefined -> kein Erfolg");
ok(okSave({ data: { anything: 1 }, error: null }) === false, "S3: Objekt statt true -> kein Erfolg (Boolean-Vertrag)");

// Anker: alle drei Gast-RPCs destrukturieren error UND werten ok===true aus.
for (const rpcName of ["guest_confirm_pickup", "guest_at_pickup", "guest_report_issue"]) {
  const re = new RegExp(`const \\{ data: ok, error \\} = await sb\\.rpc\\("${rpcName}"`);
  ok(re.test(src), `Anker: ${rpcName} destrukturiert { data: ok, error }`);
}
ok((src.match(/okSave = ok === true/g) || []).length >= 3, "Anker: okSave = ok === true in allen drei Aktionen");
// Kein Push bei Fehler: der push-Aufruf haengt in allen drei am okSave-Zweig.
ok(!/okSave = !!ok/.test(src), "Anker: altes okSave = !!ok ist entfernt");

// ===========================================================================
// TEIL 3: Busy-/Ref-Doppelklickschutz (Aenderung Ä4, Block C, Szenario 4)
// ===========================================================================
// Modell: zwei sehr schnelle Klicks teilen sich einen synchronen inFlight-Ref.
// busy (React-State) ist beim zweiten Klick noch der alte Wert (Closure), taugt
// also allein NICHT -> der Ref muss den zweiten Aufruf blocken.
async function doubleClickSim({ refGuard }) {
  const refState = { inFlight: false };
  let rpcCalls = 0, pushes = 0;
  const busyClosureStale = false; // simuliert: 2. Klick sieht noch busy===false
  async function action() {
    if (refGuard ? (busyClosureStale || refState.inFlight) : busyClosureStale) return;
    if (refGuard) refState.inFlight = true;
    rpcCalls++;
    await Promise.resolve(); // RPC
    pushes++;
    if (refGuard) refState.inFlight = false;
  }
  // Zwei Klicks praktisch gleichzeitig (der zweite startet bevor der erste fertig ist).
  const p1 = action();
  const p2 = action();
  await Promise.all([p1, p2]);
  return { rpcCalls, pushes };
}
{
  const r = await doubleClickSim({ refGuard: true });
  ok(r.rpcCalls === 1, "S4: Doppelklick mit Ref-Guard -> genau ein RPC");
  ok(r.pushes === 1, "S4: Doppelklick mit Ref-Guard -> genau ein Push");
}

// Anker: alle drei Aktionen haben den Ref-Guard + setzen/loeschen den Ref.
ok((src.match(/if \(busy \|\| inFlightRef\.current\) return;/g) || []).length >= 3,
  "Anker: Ref-Guard (busy || inFlightRef.current) in allen drei Aktionen");
ok((src.match(/inFlightRef\.current = true;/g) || []).length >= 3, "Anker: inFlightRef.current = true 3x");
ok((src.match(/inFlightRef\.current = false;/g) || []).length >= 3, "Anker: inFlightRef.current = false (Reset) 3x");
ok(/const inFlightRef = useRef\(false\)/.test(src), "Anker: inFlightRef deklariert");

// ===========================================================================
// TEIL 4: Poll-vs-Mutation-Rennen + Generationszaehler (Ä5, Block F/G, S6)
// ===========================================================================
// Modell: ein alter Poll (Generation g0) ist unterwegs; eine Mutation gelingt,
// erhoeht die Generation und laedt frisch nach. Ein zurueckkehrender Poll darf
// nur uebernehmen, wenn seine Start-Generation noch aktuell ist.
async function pollRaceSim({ genGuard }) {
  const gen = { cur: 0 };
  let session = { status: "old" };
  const applyIfCurrent = (g, value) => { if (!genGuard || g === gen.cur) session = value; };

  const pollGen = gen.cur;                 // alter Poll startet bei g0
  // ... Poll laeuft, kehrt aber erst spaeter zurueck ...
  // Mutation gelingt:
  gen.cur++;                               // Generation entwerten
  applyIfCurrent(gen.cur, { status: "new" });  // frischer Reload (neue Generation)
  // Jetzt kehrt der ALTE Poll mit altem Status zurueck:
  applyIfCurrent(pollGen, { status: "old" });
  return session.status;
}
{
  const status = await pollRaceSim({ genGuard: true });
  ok(status === "new", "S6: alter Poll nach erfolgreicher Mutation -> UI bleibt beim neuen Status");
}

// Anker: Generation wird bei Erfolg hochgezaehlt + Reload mit neuer Generation;
// loadSupabase verwirft veraltete Generation.
ok((src.match(/pollGenRef\.current\+\+;/g) || []).length >= 3, "Anker: pollGenRef.current++ in allen drei Aktionen");
ok(/await loadSupabase\(pollGenRef\.current\)/.test(src), "Anker: Reload mit aktueller Generation");
ok(/g !== pollGenRef\.current\) return/.test(src), "Anker: loadSupabase verwirft veraltete Generation");
ok(/const pollGenRef = useRef\(0\)/.test(src), "Anker: pollGenRef deklariert");

// ===========================================================================
// TEIL 5: Poll ist rekursiv/abbrechbar, kein setState nach Unmount (Ä5, S7)
// ===========================================================================
ok(/const run = async \(\) => \{[\s\S]*?setTimeout\(run, POLL_MS\)/.test(src),
  "Anker: rekursiver setTimeout-Poll (naechster Poll erst nach Abschluss)");
ok(!/setInterval\(loadSupabase/.test(src), "Anker: altes setInterval(loadSupabase) ist entfernt");
ok(/const mountedRef = useRef\(true\)/.test(src), "Anker: mountedRef deklariert");
ok(/mountedRef\.current = false;/.test(src), "Anker: Cleanup setzt mountedRef auf false (kein setState nach Unmount)");
ok(/!mountedRef\.current \|\| g !== pollGenRef\.current\) return/.test(src),
  "Anker: loadSupabase prueft mountedRef UND Generation vor setState");
ok(/let stopped = false;[\s\S]*?stopped = true;/.test(src), "Anker: stopped-Flag bricht die Poll-Kette ab");

// ===========================================================================
// TEIL 6: Token- vs Netzfehler unterscheiden (Ä2, Block E, S8/S9/S10)
// ===========================================================================
// Modell der korrigierten Ladeentscheidung: nur ein erfolgreicher RPC mit
// valid:false ist "Link ungueltig"; error/Exception -> Verbindungsfehler
// (loadErr), Session NICHT auf {valid:false} setzen.
function loadDecision(rpc) {
  const st = { session: null, loadErr: false };
  const { data, error } = rpc;
  if (error) { st.loadErr = true; return st; }          // Netz/RPC-Fehler
  st.loadErr = false;
  st.session = (data && typeof data === "object") ? data : { valid: false };
  return st;
}
{
  const inv = loadDecision({ data: { valid: false }, error: null });
  ok(inv.session && inv.session.valid === false && inv.loadErr === false,
    "S9: unbekannter Token (valid:false, kein error) -> Link ungueltig, kein Netzfehler");
  const net = loadDecision({ data: null, error: { message: "network" } });
  ok(net.session === null && net.loadErr === true,
    "S10: Netzfehler -> loadErr, NICHT als {valid:false} dargestellt");
  const good = loadDecision({ data: { valid: true, djName: "Alok", rides: [] }, error: null });
  ok(good.session && good.session.valid === true && good.loadErr === false,
    "S8: spaeterer erfolgreicher Poll -> gueltige Session, loadErr weg");
}

// Anker: loadSupabase setzt bei error/catch loadErr statt {valid:false};
// Verbindungs-Fehlerseite existiert; kein Token im Log.
ok(/setLoadErr\(true\)/.test(src) && /setLoadErr\(false\)/.test(src), "Anker: loadErr wird gesetzt/zurueckgesetzt");
ok(!/setSession\(\{ valid: false \}\); \} catch/.test(src), "Anker: catch setzt NICHT mehr pauschal {valid:false}");
ok(/Connection problem/.test(src), "Anker: Verbindungs-Fehlerseite (statt 'link isn't valid') vorhanden");
ok(/effective === null && loadErr/.test(src), "Anker: Verbindungs-Fehlerseite nur bei fehlender Session + loadErr");
// guest_session-Fehler loggt error.message, nicht das ganze error-Objekt (kein Token).
ok(/console\.error\("guest_session RPC-Fehler:", error\.message/.test(src),
  "Anker: guest_session-Fehler loggt nur message (kein Token/rohes Objekt)");

// ===========================================================================
// TEIL 7: Session-2-/Session-3-Invarianten bleiben (Block I, Szenario 13)
// ===========================================================================
// Fallback-Pfad idempotent: No-op bei bereits gesetztem Status (kein 2. Push).
ok((src.match(/if \(r\.guestConfirmedAt\) return NO_CHANGE;/g) || []).length >= 1,
  "S13: confirm - bereits bestaetigt -> NO_CHANGE (kein 2. Push, Session 3)");
ok((src.match(/if \(r\.guestAtPickupAt\) return NO_CHANGE;/g) || []).length >= 1,
  "S13: atPickup - bereits gemeldet -> NO_CHANGE");
ok((src.match(/dynConflict\("RIDE_GONE"/g) || []).length >= 3,
  "S13: alle drei Aktionen behandeln fehlende Fahrt als Konflikt (kein blindes Schreiben)");
// Stabile Issue-ID VOR dem Mutator (Retry-fest, Session 3).
ok(/const issueId = "i" \+ Date\.now\(\);/.test(src), "S13: stabile issueId vor dem Mutator (retry-fest)");
// Push erst nach bestaetigtem Save: die triggerPush-Aufrufe stehen NACH setBusy(false)
// und dem okSave-Gate.
const confirmBody = src.slice(src.indexOf("const confirmPickup = async"), src.indexOf("const atPickup = async"));
ok(confirmBody.indexOf("if (!okSave)") < confirmBody.indexOf("triggerPush"),
  "S13: confirm - Push erst nach okSave-Gate (Session 2)");
ok(confirmBody.indexOf("setBusy(false)") < confirmBody.indexOf("triggerPush"),
  "S13: confirm - Push erst nach setBusy(false)");

// ===========================================================================
// TEIL 8: Problemtext bleibt bei Fehler erhalten (Block J, Szenario 12)
// ===========================================================================
// GuestIssueModal haelt note/type als lokalen State; bei Fehler wird das Modal
// NICHT geschlossen (setIssueFor(null) erst nach dem okSave-Gate).
// Es gibt weitere reportIssue-Funktionen in anderen Komponenten (Driver/Stage).
// Die GuestApp-Variante ist die letzte VOR confirmPickup (nur in GuestApp).
const _cpIdx = src.indexOf("const confirmPickup = async");
const reportBody = src.slice(src.lastIndexOf("const reportIssue = async", _cpIdx), _cpIdx);
ok(reportBody.indexOf("if (!okSave)") < reportBody.indexOf("setIssueFor(null)"),
  "S12: reportIssue - Modal (setIssueFor(null)) erst NACH okSave-Gate -> Text bleibt bei Fehler erhalten");
ok(/const \[note, setNote\] = useState\(""\)/.test(src), "S12: GuestIssueModal haelt note lokal (bleibt beim Reoeffnen)");

// ===========================================================================
// TEIL 9: Zwei Fenster / Lost-Response - dokumentiertes Server-Restrisiko (S5/S11)
// ===========================================================================
// Datenseitig sind confirm/at_pickup Feld-Setzungen (idempotent im Wert), aber
// die Boolean-RPC signalisiert kein "unchanged" -> ein zweiter Aufruf (2. Fenster
// oder Retry nach verlorener Antwort) pusht im Supabase-Pfad erneut. Das ist ein
// bekanntes Server-Restrisiko (Fix braucht RPC-Aenderung, separate SQL-Session).
// Der Test HAELT das fest, damit es nicht unbemerkt "grün" aussieht.
const sql = fs.existsSync("supabase-schema.sql") ? fs.readFileSync("supabase-schema.sql", "utf8") : "";
ok(/create or replace function guest_confirm_pickup\(p_token text, p_ride text\)\nreturns boolean/.test(sql),
  "S5/S11: guest_confirm_pickup ist boolean-RPC (kein 'unchanged'-Signal) -> Push-Doppelung ist Server-Restrisiko");
ok(/'id', 'i' \|\| v_now/.test(sql),
  "S5/S11: guest_report_issue erzeugt Issue-ID serverseitig -> Retry legt Duplikat an (Server-Restrisiko, dokumentiert)");

// ===========================================================================
// PFLICHT-GEGENPROBEN: jeweils einen Guard kippen, Test MUSS kippen.
// ===========================================================================
let gp = 0, gpFail = 0;
function gegen(cond, msg) { if (cond) { gp++; console.log("GP-OK  " + msg); } else { gpFail++; console.log("GP-FAIL " + msg); } }

// GP1: Ref-Guard aus -> Doppelklick loest ZWEI RPCs aus.
{
  const r = await doubleClickSim({ refGuard: false });
  gegen(r.rpcCalls === 2 && r.pushes === 2, "GP1: ohne Ref-Guard -> 2 RPC/2 Push (Schutz greift also nachweislich)");
}
// GP2: Generations-Guard aus -> alter Poll ueberschreibt neuen Status.
{
  const status = await pollRaceSim({ genGuard: false });
  gegen(status === "old", "GP2: ohne Generations-Guard -> alter Poll dreht Status zurueck (Schutz greift also nachweislich)");
}
// GP3: error-Auswertung aus -> RPC-Fehler faelschlich als Erfolg.
{
  const wrong = okSave({ data: true, error: { message: "boom" } }, /*errorGuard*/ false);
  const right = okSave({ data: true, error: { message: "boom" } }, /*errorGuard*/ true);
  gegen(wrong === true && right === false, "GP3: ohne error-Auswertung -> Fehler wird Erfolg (Schutz greift also nachweislich)");
}

// ---------------------------------------------------------------------------
console.log("");
console.log(`GuestApp-/Gast-RPC-Haertung: ${pass} OK, ${fail} FAIL  |  Gegenproben: ${gp} kippten wie erwartet, ${gpFail} unerwartet`);
if (fail > 0) { console.log("Fehlgeschlagen:"); fails.forEach((m) => console.log("  - " + m)); }
if (fail > 0 || gpFail > 0) process.exit(1);
