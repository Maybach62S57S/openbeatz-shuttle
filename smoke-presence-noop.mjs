// smoke-presence-noop.mjs
// Testet die drei Presence-No-op-Guards in MissionReturnsTab (setNoReturn,
// setManualPresence, addManualArtist): ein erneutes Setzen des bereits
// geltenden Zielzustands schreibt nicht mehr (kein rev-Bump), ein echter
// Wechsel schreibt weiter. Zwei Ebenen:
//   1. Verhaltenstest gegen ein Fake-updateDyn (repliziert die Mutator-Bodies
//      verbatim, guarded UND unguarded fuer die Gegenprobe).
//   2. Quell-Anker: die drei Guard-Zeilen muessen im echten JSX stehen.
// Aufruf: node smoke-presence-noop.mjs [pfad/zu/ShuttleLeitstelle.jsx]
import fs from "node:fs";

const SRC = process.argv[2] || "src/ShuttleLeitstelle.jsx";
let ok = 0, fail = 0;
const T = (name, cond) => { if (cond) { ok++; console.log("OK   " + name); } else { fail++; console.log("FAIL " + name); } };

// ---- Vertrag verbatim wie in der App ----
const NO_CHANGE = Symbol("dyn-no-change");
const isNoChange = (v) => v === NO_CHANGE;
const BY = "dispo:leit1";

// Fake-updateDyn: fuehrt den Mutator auf einer Kopie aus. NO_CHANGE -> nicht
// schreiben, rev unveraendert, unchanged:true. Sonst -> schreiben, rev+1.
function makeStore(initialPresence) {
  return { rev: 0, dyn: { artistPresence: structuredClone(initialPresence || {}) } };
}
async function updateDyn(store, mutator) {
  const cur = structuredClone(store.dyn);
  const out = mutator(cur);
  if (isNoChange(out)) return { ok: true, unchanged: true, wrote: false, rev: store.rev };
  store.dyn = out;
  store.rev += 1;
  return { ok: true, unchanged: false, wrote: true, rev: store.rev };
}

// ---- Mutator-Bodies VERBATIM (guarded = aktueller Stand) ----
const bodySetNoReturn = (name, value, by) => (d) => {
  d.artistPresence = d.artistPresence || {};
  const cur = d.artistPresence[name] || {};
  if (cur.noReturn === value) return NO_CHANGE;
  d.artistPresence[name] = { ...cur, noReturn: value, by, at: 111 };
  return d;
};
const bodySetManual = (name, value, by) => (d) => {
  d.artistPresence = d.artistPresence || {};
  const cur = d.artistPresence[name] || {};
  if (value === null ? cur.manual === undefined : cur.manual === value) return NO_CHANGE;
  if (value === null) { const { manual, ...rest } = cur; d.artistPresence[name] = { ...rest, by, at: 111 }; }
  else d.artistPresence[name] = { ...cur, manual: value, by, at: 111 };
  return d;
};
const bodyAddManual = (name, by) => (d) => {
  d.artistPresence = d.artistPresence || {};
  const cur = d.artistPresence[name] || {};
  if (cur.manual === "here") return NO_CHANGE;
  d.artistPresence[name] = { ...cur, manual: "here", by, at: 111 };
  return d;
};

// ---- Mutator-Bodies OHNE Guard (fuer die Gegenprobe) ----
const rawSetNoReturn = (name, value, by) => (d) => {
  d.artistPresence = d.artistPresence || {};
  const cur = d.artistPresence[name] || {};
  d.artistPresence[name] = { ...cur, noReturn: value, by, at: 111 };
  return d;
};
const rawSetManual = (name, value, by) => (d) => {
  d.artistPresence = d.artistPresence || {};
  const cur = d.artistPresence[name] || {};
  if (value === null) { const { manual, ...rest } = cur; d.artistPresence[name] = { ...rest, by, at: 111 }; }
  else d.artistPresence[name] = { ...cur, manual: value, by, at: 111 };
  return d;
};
const rawAddManual = (name, by) => (d) => {
  d.artistPresence = d.artistPresence || {};
  const cur = d.artistPresence[name] || {};
  d.artistPresence[name] = { ...cur, manual: "here", by, at: 111 };
  return d;
};

// ======================= 1) Verhaltenstest (guarded) =======================
console.log("\n--- setNoReturn ---");
{
  const s = makeStore({});
  let r = await updateDyn(s, bodySetNoReturn("DJ A", true, BY));
  T("erstmaliges noReturn=true schreibt (rev 0->1)", r.wrote && s.rev === 1);
  r = await updateDyn(s, bodySetNoReturn("DJ A", true, BY));
  T("gleiches noReturn=true erneut -> No-op (kein Write, rev bleibt 1)", !r.wrote && r.unchanged && s.rev === 1);
  r = await updateDyn(s, bodySetNoReturn("DJ A", false, BY));
  T("Wechsel true->false schreibt (rev 1->2)", r.wrote && s.rev === 2);
  r = await updateDyn(s, bodySetNoReturn("DJ A", false, BY));
  T("gleiches noReturn=false erneut -> No-op (rev bleibt 2)", !r.wrote && s.rev === 2);
  // undefined -> false ist ein echter erster Set (strikter === Vergleich)
  const s2 = makeStore({});
  r = await updateDyn(s2, bodySetNoReturn("DJ B", false, BY));
  T("undefined -> false schreibt einmal (strikter ===, kein Verschlucken)", r.wrote && s2.rev === 1);
}

console.log("\n--- setManualPresence ---");
{
  const s = makeStore({});
  let r = await updateDyn(s, bodySetManual("DJ A", "here", BY));
  T("erstmaliges manual='here' schreibt (rev 0->1)", r.wrote && s.rev === 1);
  r = await updateDyn(s, bodySetManual("DJ A", "here", BY));
  T("gleiches manual='here' erneut -> No-op (rev bleibt 1)", !r.wrote && s.rev === 1);
  r = await updateDyn(s, bodySetManual("DJ A", "away", BY));
  T("Wechsel 'here'->'away' schreibt (rev 1->2)", r.wrote && s.rev === 2);
  r = await updateDyn(s, bodySetManual("DJ A", null, BY));
  T("clear (value=null) bei gesetztem manual schreibt (rev 2->3)", r.wrote && s.rev === 3);
  T("clear entfernt manual-Feld", s.dyn.artistPresence["DJ A"].manual === undefined);
  r = await updateDyn(s, bodySetManual("DJ A", null, BY));
  T("clear erneut wenn schon leer -> No-op (rev bleibt 3)", !r.wrote && s.rev === 3);
}

console.log("\n--- addManualArtist ---");
{
  const s = makeStore({});
  let r = await updateDyn(s, bodyAddManual("Walk-In X", BY));
  T("erstmaliges add schreibt (rev 0->1)", r.wrote && s.rev === 1);
  r = await updateDyn(s, bodyAddManual("Walk-In X", BY));
  T("erneutes add desselben -> No-op (rev bleibt 1)", !r.wrote && s.rev === 1);
  // add bei bereits vorhandenem Eintrag mit anderem manual-Wert schreibt
  const s2 = makeStore({ "Walk-In Y": { manual: "away", by: "x", at: 1 } });
  r = await updateDyn(s2, bodyAddManual("Walk-In Y", BY));
  T("add bei manual!='here' schreibt (setzt auf 'here')", r.wrote && s2.rev === 1 && s2.dyn.artistPresence["Walk-In Y"].manual === "here");
}

console.log("\n--- by/at bleibt beim No-op erhalten (Nuance) ---");
{
  const s = makeStore({ "DJ A": { noReturn: true, by: "dispo:erst", at: 999 } });
  const before = JSON.stringify(s.dyn.artistPresence["DJ A"]);
  const r = await updateDyn(s, bodySetNoReturn("DJ A", true, "dispo:zweit"));
  T("No-op laesst by/at unveraendert (kein Ueberschreiben durch zweiten Setzer)",
    !r.wrote && JSON.stringify(s.dyn.artistPresence["DJ A"]) === before);
}

// ======================= 2) Gegenproben (ohne Guard MUSS kippen) ============
console.log("\n--- Gegenproben (Guard entfernt -> No-op-Fall schreibt doch) ---");
{
  const s = makeStore({});
  await updateDyn(s, rawSetNoReturn("DJ A", true, BY)); // rev 1
  const r = await updateDyn(s, rawSetNoReturn("DJ A", true, BY)); // wuerde erneut schreiben
  T("GP1 ohne Guard: gleiches noReturn schreibt doch (rev 1->2) -> Test misst wirklich den Guard", r.wrote && s.rev === 2);
}
{
  const s = makeStore({});
  await updateDyn(s, rawSetManual("DJ A", "here", BY)); // rev 1
  const r = await updateDyn(s, rawSetManual("DJ A", "here", BY));
  T("GP2 ohne Guard: gleiches manual schreibt doch (rev 1->2)", r.wrote && s.rev === 2);
}
{
  const s = makeStore({});
  await updateDyn(s, rawAddManual("Walk-In X", BY)); // rev 1
  const r = await updateDyn(s, rawAddManual("Walk-In X", BY));
  T("GP3 ohne Guard: erneutes add schreibt doch (rev 1->2)", r.wrote && s.rev === 2);
}

// ======================= 3) Quell-Anker im echten JSX =======================
console.log("\n--- Quell-Anker (Guards stehen im echten Code) ---");
{
  const src = fs.readFileSync(SRC, "utf8");
  T("Anker setNoReturn-Guard vorhanden", src.includes('if (cur.noReturn === value) return NO_CHANGE;'));
  T("Anker setManualPresence-Guard vorhanden", src.includes('if (value === null ? cur.manual === undefined : cur.manual === value) return NO_CHANGE;'));
  T("Anker addManualArtist-Guard vorhanden", src.includes('if (cur.manual === "here") return NO_CHANGE;'));
  // Gegenprobe zum Anker: ein bewusst falscher Anker darf NICHT treffen
  T("Anker-Gegenprobe: nicht existierender Guard trifft nicht", !src.includes('if (cur.noReturn === "nonsense-xyz") return NO_CHANGE;'));
}

console.log(`\nPresence-No-op Smoke: ${ok} OK, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
