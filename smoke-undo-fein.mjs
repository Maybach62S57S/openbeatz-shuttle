// smoke-undo-fein.mjs
// Block A (letzte Freigabesession): feldbezogenes Undo.
//
// Beweiskette:
//  (1) undoChangedFields wird ECHT aus der Quelle extrahiert (export angehaengt,
//      esbuild, import) - kein Nachbau. Diff-Verhalten direkt geprueft.
//  (2) Der undo-Mutator-Body wird VERBATIM aus der Quelle gelesen (Anker-Grep)
//      und in einer Zwei-Client-Simulation (getrennte Undo-Stacks pro Geraet,
//      ein gemeinsamer CAS-"Server") gegen die 10 Auftrags-Testfaelle gefahren.
//  (3) Gegenprobe: ein Mutator OHNE Feldpruefung (altes Ganzobjekt-Ersetzen)
//      muss den kritischen Fall (B's Fremdfeld) nachweisbar ueberschreiben.
//  (4) Quell-Anker: die feldbezogene Pruefung + UNDO_STALE stehen im echten JSX.
//
// Aufruf: node smoke-undo-fein.mjs [pfad/zu/ShuttleLeitstelle.jsx]
import fs from "node:fs";
import { execSync } from "node:child_process";

const SRC = process.argv[2] || "src/ShuttleLeitstelle.jsx";
const rawSrc = fs.readFileSync(SRC, "utf8");
let ok = 0, fail = 0;
const T = (name, cond) => { if (cond) { ok++; console.log("OK   " + name); } else { fail++; console.log("FAIL " + name); } };

// ---------------------------------------------------------------------------
// (1) undoChangedFields ECHT aus der Quelle
// ---------------------------------------------------------------------------
async function build(exportLine) {
  const tag = Math.random().toString(36).slice(2);
  const copy = "/tmp/undofein-" + tag + ".jsx";
  const out = "/home/claude/repo/.undofein-" + tag + ".mjs";
  fs.writeFileSync(copy, rawSrc + "\n" + exportLine + "\n");
  execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
  const mod = await import(out);
  fs.unlinkSync(out); fs.unlinkSync(copy);
  return mod;
}
const { undoChangedFields } = await build("export { undoChangedFields };");

T("A1. undoChangedFields: nur veraendertes Feld (time)",
  JSON.stringify(undoChangedFields({ id: "X", time: "10:00", d: null }, { id: "X", time: "11:00", d: null })) === JSON.stringify(["time"]));
T("A2. undoChangedFields: mehrere Felder",
  JSON.stringify(undoChangedFields({ a: 1, b: 2 }, { a: 9, b: 8 }).sort()) === JSON.stringify(["a", "b"]));
T("A3. undoChangedFields: rev wird ignoriert",
  JSON.stringify(undoChangedFields({ a: 1, rev: 1 }, { a: 1, rev: 2 })) === JSON.stringify([]));
T("A4. undoChangedFields: prev==null -> null (Sonderfall Erstellung)",
  undoChangedFields(null, { a: 1 }) === null);
T("A5. undoChangedFields: neu hinzugekommenes Feld erkannt",
  JSON.stringify(undoChangedFields({ a: 1 }, { a: 1, neu: 5 })) === JSON.stringify(["neu"]));

// ---------------------------------------------------------------------------
// (2) Zwei-Client-Simulation mit echtem undo-Mutator-Body
// ---------------------------------------------------------------------------
// Gemeinsamer CAS-Server (eine dyn-Zeile mit rev, atomares Compare-and-Swap).
let server = { rides: [], rev: 0 };
async function sgetDyn() { return structuredClone(server); }
async function ssetDyn(next, baseRev) {
  if ((server.rev || 0) !== baseRev) return { ok: false, value: structuredClone(server) };
  server = structuredClone(next); return { ok: true, value: structuredClone(server) };
}
const DYN_CONFLICT = Symbol("dyn-conflict");
function dynConflict(code, message) { return { [DYN_CONFLICT]: true, code, message }; }
function isDynConflict(v) { return !!(v && typeof v === "object" && v[DYN_CONFLICT]); }

// undoChangedFields (echt, oben importiert) + der undo-Mutator-Body verbatim aus
// der Quelle. Wir extrahieren den Mutator-Text zwischen zwei Ankern und fuehren
// ihn in einer Funktion mit (d, entry, dynConflict, undoChangedFields, structuredClone).
const anchorStart = "const res = await updateDyn((d) => {";
const iStart = rawSrc.indexOf(anchorStart);
const iBodyOpen = rawSrc.indexOf("{", rawSrc.indexOf("(d) =>", iStart)) ;
// Klammer-Matching ab iBodyOpen, um den Mutator-Body sauber zu greifen
function matchBrace(s, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") { depth--; if (depth === 0) return i; }
  }
  return -1;
}
const iBodyClose = matchBrace(rawSrc, iBodyOpen);
const mutatorBody = rawSrc.slice(iBodyOpen + 1, iBodyClose); // Inhalt zwischen { }
T("B0. undo-Mutator-Body aus Quelle extrahiert", iStart >= 0 && iBodyClose > iBodyOpen && /UNDO_STALE/.test(mutatorBody) && /undoChangedFields/.test(mutatorBody));

// Baue eine ausfuehrbare Mutator-Funktion aus dem echten Body.
const runUndoMutator = new Function("d", "entry", "dynConflict", "undoChangedFields", "structuredClone", mutatorBody);

function makeClient() {
  let undoStack = [];
  function pushUndoEntry(curRides, nextRides) {
    const prevById = new Map((curRides || []).map((r) => [r.id, r]));
    const changed = [];
    (nextRides || []).forEach((nr) => {
      const pr = prevById.get(nr.id);
      if (!pr || JSON.stringify(pr) !== JSON.stringify(nr)) changed.push({ id: nr.id, prev: pr ? structuredClone(pr) : null, next: structuredClone(nr) });
    });
    if (changed.length === 0) return;
    undoStack = [...undoStack, { at: Date.now(), changed }].slice(-15);
  }
  async function updateDyn(mutator) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const cur = await sgetDyn();
      const baseRev = cur.rev || 0;
      const out = mutator(structuredClone(cur));
      if (isDynConflict(out)) return { ok: false, conflict: true, code: out.code, error: out.message, value: cur };
      const next = out; next.rev = baseRev + 1;
      const result = await ssetDyn(next, baseRev);
      if (result.ok) { pushUndoEntry(cur.rides, result.value.rides); return { ok: true, value: result.value }; }
    }
    return { ok: false, conflict: true, code: "MAX_RETRIES" };
  }
  async function undo() {
    const entry = undoStack[undoStack.length - 1];
    if (!entry) return { ok: false, code: "NOTHING" };
    const res = await updateDyn((d) => runUndoMutator(d, entry, dynConflict, undoChangedFields, structuredClone));
    if (res && res.ok) undoStack = undoStack.filter((e) => e !== entry);
    return res;
  }
  return { updateDyn, undo, stackLen: () => undoStack.length };
}

// 1. Undo ohne Konkurrenz -> erfolgreich
{ server = { rides: [{ id: "X", time: "10:00" }], rev: 1 };
  const A = makeClient();
  await A.updateDyn(d => { d.rides.find(x => x.id === "X").time = "11:00"; return d; });
  const r = await A.undo();
  T("1. Undo ohne Konkurrenz -> erfolgreich", r.ok && server.rides[0].time === "10:00"); }

// 2. Andere Fahrt geaendert -> Undo weiter moeglich, andere Fahrt bleibt
{ server = { rides: [{ id: "X", time: "10:00" }, { id: "Y", time: "20:00" }], rev: 1 };
  const A = makeClient(), B = makeClient();
  await A.updateDyn(d => { d.rides.find(x => x.id === "X").time = "11:00"; return d; });
  await B.updateDyn(d => { d.rides.find(x => x.id === "Y").time = "21:00"; return d; });
  const r = await A.undo();
  T("2. Andere Fahrt geaendert -> Undo weiter moeglich", r.ok && server.rides.find(x => x.id === "X").time === "10:00");
  T("2b. B's andere Fahrt bleibt", server.rides.find(x => x.id === "Y").time === "21:00"); }

// 3. Dieselbe Fahrt, anderes Feld -> feldbezogenes Undo, B bleibt
{ server = { rides: [{ id: "X", time: "10:00", assignedDriverId: null }], rev: 1 };
  const A = makeClient(), B = makeClient();
  await A.updateDyn(d => { d.rides.find(x => x.id === "X").time = "11:00"; return d; });
  await B.updateDyn(d => { d.rides.find(x => x.id === "X").assignedDriverId = "driver-7"; return d; });
  const r = await A.undo();
  T("3. Dieselbe Fahrt, anderes Feld -> Undo erfolgreich", r.ok);
  T("3b. A's Feld (Zeit) zurueckgesetzt", server.rides[0].time === "10:00");
  T("3c. KRITISCH: B's Fahrer bleibt erhalten", server.rides[0].assignedDriverId === "driver-7"); }

// 4. Dasselbe Feld spaeter geaendert -> Konflikt, kein Ueberschreiben
{ server = { rides: [{ id: "X", time: "10:00" }], rev: 1 };
  const A = makeClient(), B = makeClient();
  await A.updateDyn(d => { d.rides.find(x => x.id === "X").time = "11:00"; return d; });
  await B.updateDyn(d => { d.rides.find(x => x.id === "X").time = "12:00"; return d; });
  const r = await A.undo();
  T("4. Selbes Feld spaeter geaendert -> Konflikt", !r.ok && r.code === "UNDO_STALE");
  T("4b. B's Wert (12:00) nicht ueberschrieben", server.rides[0].time === "12:00");
  T("4c. Eintrag bleibt (erneut versuchbar)", A.stackLen() === 1); }

// 5. Fahrt geloescht -> kontrollierter Konflikt
{ server = { rides: [{ id: "X", time: "10:00" }], rev: 1 };
  const A = makeClient(), B = makeClient();
  await A.updateDyn(d => { d.rides.find(x => x.id === "X").time = "11:00"; return d; });
  await B.updateDyn(d => { const i = d.rides.findIndex(x => x.id === "X"); d.rides.splice(i, 1); return d; });
  const r = await A.undo();
  T("5. Fahrt geloescht -> Konflikt", !r.ok && r.code === "UNDO_STALE");
  T("5b. Fahrt bleibt geloescht", server.rides.length === 0); }

// 6. Fahrt neu erstellt + fremdgeaendert -> kein falsches Undo
{ server = { rides: [], rev: 1 };
  const A = makeClient(), B = makeClient();
  await A.updateDyn(d => { d.rides.push({ id: "N", time: "09:00" }); return d; });
  await B.updateDyn(d => { d.rides.find(x => x.id === "N").time = "09:30"; return d; });
  const r = await A.undo();
  T("6. Erstellt+fremdgeaendert -> Konflikt", !r.ok && r.code === "UNDO_STALE");
  T("6b. Fahrt bleibt mit B's Aenderung", server.rides.length === 1 && server.rides[0].time === "09:30"); }

// 6c. Fahrt erstellt, KEINER aendert -> Undo loescht sie sauber
{ server = { rides: [], rev: 1 };
  const A = makeClient();
  await A.updateDyn(d => { d.rides.push({ id: "N", time: "09:00" }); return d; });
  const r = await A.undo();
  T("6c. Erstellt, unveraendert -> Undo loescht", r.ok && server.rides.length === 0); }

// 7. Doppelklick -> definierter Zustand, kein Absturz
{ server = { rides: [{ id: "X", time: "10:00" }], rev: 1 };
  const A = makeClient();
  await A.updateDyn(d => { d.rides.find(x => x.id === "X").time = "11:00"; return d; });
  const [r1, r2] = await Promise.all([A.undo(), A.undo()]);
  T("7. Doppel-Undo -> definierter Zustand", (r1.ok || r2.ok) && (server.rides[0].time === "10:00" || server.rides[0].time === "11:00")); }

// 9. Konflikt -> kein falscher Erfolg
{ server = { rides: [{ id: "X", time: "10:00" }], rev: 1 };
  const A = makeClient(), B = makeClient();
  await A.updateDyn(d => { d.rides.find(x => x.id === "X").time = "11:00"; return d; });
  await B.updateDyn(d => { d.rides.find(x => x.id === "X").time = "12:00"; return d; });
  const r = await A.undo();
  T("9. Konflikt -> res.ok=false", !r.ok); }

// 10. Nach Konflikt bleibt Undo erneut versuchbar
{ server = { rides: [{ id: "X", time: "10:00" }], rev: 1 };
  const A = makeClient(), B = makeClient();
  await A.updateDyn(d => { d.rides.find(x => x.id === "X").time = "11:00"; return d; });
  await B.updateDyn(d => { d.rides.find(x => x.id === "X").time = "12:00"; return d; });
  await A.undo();
  T("10. Nach Konflikt bleibt Eintrag erhalten", A.stackLen() === 1); }

// ---------------------------------------------------------------------------
// (3) GEGENPROBE: Mutator OHNE Feldpruefung (altes Ganzobjekt-Ersetzen) muss
//     im kritischen Fall B's Fremdfeld nachweisbar ueberschreiben.
// ---------------------------------------------------------------------------
{ server = { rides: [{ id: "X", time: "10:00", assignedDriverId: null }], rev: 1 };
  let stack = [];
  const upd = async (m) => {
    const cur = await sgetDyn(); const base = cur.rev || 0;
    const out = m(structuredClone(cur)); out.rev = base + 1;
    const res = await ssetDyn(out, base);
    if (res.ok) { const pv = new Map(cur.rides.map(r => [r.id, r])); const ch = [];
      res.value.rides.forEach(nr => { const p = pv.get(nr.id); if (!p || JSON.stringify(p) !== JSON.stringify(nr)) ch.push({ id: nr.id, prev: p ? structuredClone(p) : null }); });
      if (ch.length) stack.push({ changed: ch }); return { ok: true }; }
    return { ok: false };
  };
  await upd(d => { d.rides.find(x => x.id === "X").time = "11:00"; return d; });          // A
  await upd(d => { d.rides.find(x => x.id === "X").assignedDriverId = "driver-7"; return d; }); // B
  const e = stack[0]; // A's Eintrag
  await upd(d => { e.changed.forEach(({ id, prev }) => { const i = d.rides.findIndex(x => x.id === id); if (i >= 0) d.rides[i] = structuredClone(prev); }); return d; });
  T("GEGENPROBE: ohne Feldpruefung wird B's Fahrer ueberschrieben (kippt zu null)", server.rides[0].assignedDriverId === null); }

// ---------------------------------------------------------------------------
// (4) Quell-Anker
// ---------------------------------------------------------------------------
T("Q1. undoChangedFields im Quelltext definiert", /function undoChangedFields\(prev, next\)/.test(rawSrc));
T("Q2. UNDO_STALE-Konflikt im undo-Mutator", /dynConflict\("UNDO_STALE"/.test(rawSrc));
T("Q3. pushUndoEntry speichert next", /changed\.push\(\{ id: nr\.id, prev:.*next: structuredClone\(nr\) \}\)/.test(rawSrc));
T("Q4. feldbezogene Vorpruefung vorhanden", /undoChangedFields\(prev, next\)/.test(rawSrc));

console.log(`\n=== smoke-undo-fein: ${ok} OK, ${fail} FAIL ===`);
if (fail > 0) process.exit(1);
