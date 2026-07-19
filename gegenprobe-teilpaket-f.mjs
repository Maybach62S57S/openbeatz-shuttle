// Teilpaket F1 - Gegenproben. Jede Mutation der ECHTEN Quelle MUSS ein definiertes
// Verhalten kippen (beweist, dass die Smoke-Tests etwas messen). Vollkopie der
// Quelle + Export, Sabotage per String-Ersatz, neu bauen, Flip pruefen. Danach
// werden die mutierten Dateien verworfen. Original bleibt unangetastet.
// Aufruf: node gegenprobe-teilpaket-f.mjs [src/ShuttleLeitstelle.jsx]
import fs from "node:fs";
import { execSync } from "node:child_process";

const srcFile = process.argv[2] || "src/ShuttleLeitstelle.jsx";
const RAW = fs.readFileSync(srcFile, "utf8");
const EXPORTS = `
export { evaluateRidePairForGrouping, buildGroupRidePairCandidates, rankGroupRideCandidates, groupPairRoute, groupRideEndpoints, seedMatrix, seedLocations, festDayKey, groupRideC3, normalizeTimetableEntries };
`;
async function build(src) {
  const tag = Math.random().toString(36).slice(2);
  const copy = "/tmp/gpf-src-" + tag + ".jsx";
  const out = "/home/claude/repo/.gpf-" + tag + ".mjs";
  fs.writeFileSync(copy, src + EXPORTS);
  execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
  const M = await import(out + `?v=${tag}`);
  fs.unlinkSync(out); fs.unlinkSync(copy);
  return M;
}

const DAY = "2026-07-24";
const FLEET = [
  { id: "V1", firstName: "V", lastName: "V", seats: 7, vehicleType: "Van", vehicleId: "van-1" },
  { id: "C1", firstName: "C", lastName: "C", seats: 4, vehicleType: "Car", vehicleId: "car-1" },
];
const mtx = (pairs) => { const m = {}; for (const [k, v] of Object.entries(pairs)) m[k] = { min: v, km: v }; return m; };
let rc = 0;
function mkRide(o = {}) {
  const date = o.date || DAY, time = o.time || "22:00";
  return { id: o.id || ("r" + (++rc)), date, time, dayKey: o.dayKey, passengerCount: o.passengerCount !== undefined ? o.passengerCount : 2,
    status: o.status || "planned", fromId: o.fromId || "festival", toId: o.toId || "sheraton", fromCustom: "", toCustom: "",
    djName: o.djName || "", assignedDriverId: o.assignedDriverId || null };
}
function setDayKeys(M, rides) { for (const r of rides) if (!r.dayKey) r.dayKey = M.festDayKey(r.date, r.time); return rides; }
function mkSetup(matrix, drivers = FLEET) { return { config: { minDurationMin: 20, baseLocationId: "sheraton" }, matrix, drivers, locations: [], zones: [] }; }
function evalPair(M, a, b, setup, tt) {
  setDayKeys(M, [a, b]);
  return M.evaluateRidePairForGrouping({ rideA: a, rideB: b, drivers: setup.drivers, setup, now: 0, timetableEntries: tt || null });
}

const REF = await build(RAW);
let pass = 0, fail = 0; const fails = [];
async function proof(name, mutate, run) {
  const mutated = mutate(RAW);
  if (mutated === RAW) { fail++; fails.push(`${name}: Ankertext fehlt, Mutation griff nicht`); return; }
  try {
    const M = await build(mutated);
    const { correct, mut } = run(M);
    if (JSON.stringify(correct) !== JSON.stringify(mut)) { pass++; console.log(`OK   ${name}: korrekt=${JSON.stringify(correct)} -> mutiert=${JSON.stringify(mut)}`); }
    else { fail++; fails.push(`${name}: Verhalten kippte NICHT (beide ${JSON.stringify(correct)})`); }
  } catch (e) { fail++; fails.push(`${name}: Fehler ${e.message}`); }
}

// 1) maxDepartureDifferenceMin 20->15: Paar mit 20 min Abstand war zulaessig.
await proof("GP1 maxDepartureDifferenceMin 20->15",
  (s) => s.replace("maxDepartureDifferenceMin: 20,", "maxDepartureDifferenceMin: 15,"),
  (M) => {
    const setup = mkSetup(mtx({ "festival|sheraton": 30 }));
    const run = (mod) => evalPair(mod, mkRide({ id: "A", time: "22:00" }), mkRide({ id: "B", time: "22:20" }), setup).status;
    return { correct: run(REF), mut: run(M) };
  });

// 2) maxTotalDetourMin 25->15: Umweg 20 war zulaessig (kein detour_too_large).
await proof("GP2 maxTotalDetourMin 25->15",
  (s) => s.replace("maxTotalDetourMin: 25,", "maxTotalDetourMin: 15,"),
  (M) => {
    const setup = mkSetup(mtx({ "festival|sheraton": 30, "festival|moevenpick": 30, "sheraton|moevenpick": 20 }));
    const run = (mod) => evalPair(mod, mkRide({ id: "A", toId: "sheraton", time: "22:00" }), mkRide({ id: "B", toId: "moevenpick", time: "22:05" }), setup).reasons.includes("detour_too_large");
    return { correct: run(REF), mut: run(M) };
  });

// 3) minSavedDrivingMin 15->5: saved 14 war unter Schwelle (nur possible).
await proof("GP3 minSavedDrivingMin 15->5",
  (s) => s.replace("minSavedDrivingMin: 15,", "minSavedDrivingMin: 5,"),
  (M) => {
    const setup = mkSetup(mtx({ "festival|sheraton": 30, "festival|moevenpick": 30, "sheraton|moevenpick": 16 })); // saved 14
    const run = (mod) => evalPair(mod, mkRide({ id: "A", toId: "sheraton", time: "22:00" }), mkRide({ id: "B", toId: "moevenpick", time: "22:05" }), setup).status;
    return { correct: run(REF), mut: run(M) };
  });

// 4) Kapazitaet >= -> >: exakt passende 7 in 7 Sitze war zulaessig.
await proof("GP4 Kapazitaet >= -> >",
  (s) => s.replace("base.fitsFleet = fleet.maxSeats >= combined;", "base.fitsFleet = fleet.maxSeats > combined;"),
  (M) => {
    const setup = mkSetup(mtx({ "festival|sheraton": 30 }));
    const run = (mod) => evalPair(mod, mkRide({ id: "A", passengerCount: 4, time: "22:00" }), mkRide({ id: "B", passengerCount: 3, time: "22:05" }), setup).fitsFleet;
    return { correct: run(REF), mut: run(M) };
  });

// 5) fehlende Kante als 0 statt null: Route war unzuverlaessig ohne Einsparung.
await proof("GP5 fehlende Kante als 0",
  (s) => s.replace("function travelMin(matrix, a, b) { const t = travel(matrix, a, b); return t ? t.min : null; }",
                   "function travelMin(matrix, a, b) { const t = travel(matrix, a, b); return t ? t.min : 0; }"),
  (M) => {
    const setup = mkSetup(mtx({ "festival|sheraton": 30, "festival|moevenpick": 30 })); // sheraton|moevenpick FEHLT
    const run = (mod) => evalPair(mod, mkRide({ id: "A", toId: "sheraton", time: "22:00" }), mkRide({ id: "B", toId: "moevenpick", time: "22:05" }), setup).routeReliable;
    return { correct: run(REF), mut: run(M) };
  });

// 6) Rueckfahrt vor Set-Ende trotzdem empfehlen: war auf possible gedeckelt.
await proof("GP6 return_before_set_end nicht deckeln",
  (s) => s.replace(`warnings.push("c3_return_before_set_end"); cap = "group_possible";`,
                   `warnings.push("c3_return_before_set_end");`),
  (M) => {
    // Identische Route (beide Festival->Sheraton) mit grosser Einsparung + beide
    // unbesetzt: ohne das Set-Ende-Veto waere das recommended. Nur das Veto deckelt.
    const setup = mkSetup(mtx({ "festival|sheraton": 30 }));
    const tt = REF.normalizeTimetableEntries([{ festival_day: null, stage: "M", artist: "Endact", start: `${DAY} 21:00`, end: `${DAY} 23:30` }]);
    const a = mkRide({ id: "A", toId: "sheraton", time: "23:25", djName: "Endact" });
    const b = mkRide({ id: "B", toId: "sheraton", time: "23:28", djName: "" });
    const run = (mod) => evalPair(mod, a, b, setup, tt).status;
    return { correct: run(REF), mut: run(M) };
  });

// 7) zwei verschiedene Fahrer als starke Empfehlung: war auf possible gedeckelt.
await proof("GP7 two_drivers nicht deckeln",
  (s) => s.replace(`warnings.push("two_driver_assignments"); if (cap === "group_recommended") cap = "group_possible";`,
                   `warnings.push("two_driver_assignments");`),
  (M) => {
    const setup = mkSetup(mtx({ "festival|sheraton": 30 }));
    const run = (mod) => evalPair(mod, mkRide({ id: "A", time: "22:00", assignedDriverId: "V1" }), mkRide({ id: "B", time: "22:05", assignedDriverId: "C1" }), setup).status;
    return { correct: run(REF), mut: run(M) };
  });

// 8) mutierende Sortierung: Ranking-Eingabe-Array wurde bisher NICHT mutiert.
await proof("GP8 mutierende Sortierung",
  (s) => s.replace("const list = Array.isArray(cands) ? cands.slice() : [];", "const list = Array.isArray(cands) ? cands : [];"),
  (M) => {
    const hi = { status: "group_recommended", rideIds: ["a", "b"], sortScore: 5000, routeReliable: true, estimatedDrivingSavedMin: 10, detourMin: 5, departureDifferenceMin: 5 };
    const lo = { status: "group_recommended", rideIds: ["c", "d"], sortScore: 1000, routeReliable: true, estimatedDrivingSavedMin: 10, detourMin: 5, departureDifferenceMin: 5 };
    const check = (mod) => { const arr = [hi, lo]; const snap = arr.map((c) => c.rideIds[0]).join(""); mod.rankGroupRideCandidates(arr); return arr.map((c) => c.rideIds[0]).join("") === snap; };
    return { correct: check(REF), mut: check(M) }; // correct: unveraendert (true); mutiert: umsortiert (false)
  });

console.log(`\nTeilpaket F1 Gegenproben: ${pass} OK, ${fail} FAIL`);
if (fail) { console.log("Fehlgeschlagen:\n - " + fails.join("\n - ")); process.exit(1); }
