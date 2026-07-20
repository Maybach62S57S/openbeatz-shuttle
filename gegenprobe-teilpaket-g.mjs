// Teilpaket G1 - Gegenproben. Jede Mutation der ECHTEN Quelle MUSS ein
// definiertes Verhalten kippen (beweist, dass die Smoke-Tests etwas messen).
// Vollkopie der Quelle + Export, Sabotage per String-Ersatz, neu bauen, Flip
// pruefen. Danach werden die mutierten Dateien verworfen. Original unberuehrt.
// Aufruf: node gegenprobe-teilpaket-g.mjs [src/ShuttleLeitstelle.jsx]
import fs from "node:fs";
import { execSync } from "node:child_process";

const srcFile = process.argv[2] || "src/ShuttleLeitstelle.jsx";
const RAW = fs.readFileSync(srcFile, "utf8");
const EXPORTS = `
export { travelMin, deriveDriverPlannedPosition, repositionRideEndAbs, repositionDemandScore, evaluateDriverRepositionSuggestion, rankRepositionSuggestions };
`;
async function build(src) {
  const tag = Math.random().toString(36).slice(2);
  const copy = "/tmp/gpg-src-" + tag + ".jsx";
  const out = "/home/claude/repo/.gpg-" + tag + ".mjs";
  fs.writeFileSync(copy, src + EXPORTS);
  execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
  const M = await import(out + `?v=${tag}`);
  fs.unlinkSync(out); fs.unlinkSync(copy);
  return M;
}
function mutate(find, repl) {
  const n = RAW.split(find).length - 1;
  if (n !== 1) throw new Error(`Anker nicht eindeutig (${n}x): ${find.slice(0, 50)}`);
  return RAW.replace(find, repl);
}

let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push(m); } };

// ---- Mini-Harness --------------------------------------------------------
const M = {
  "airport|festival": { min: 30, km: 26 }, "sheraton|festival": { min: 38, km: 28 },
  "moevenpick|festival": { min: 30, km: 26 }, "airport|sheraton": { min: 18, km: 10 },
  "airport|moevenpick": { min: 3, km: 1 }, "moevenpick|sheraton": { min: 18, km: 10 },
  "muc|festival": { min: 105, km: 185 }, "muc|sheraton": { min: 105, km: 185 },
};
const LOCS = [
  { id: "festival", short: "Festival", venue: true, type: "festival" },
  { id: "sheraton", short: "Sheraton", type: "hotel" }, { id: "moevenpick", short: "Mövenpick", type: "hotel" },
  { id: "airport", short: "Flughafen", type: "airport" },
];
const CFG = { baseLocationId: "sheraton", minDurationMin: 20, softHoursMin: 210, arrivalOnTimeBufferMin: 30, arrivalTightBufferMin: 10 };
const setup = { matrix: M, locations: LOCS, config: CFG, drivers: [] };
const D = "2026-07-25";
const NODE = { festival: "festival", sheraton: "sheraton", moevenpick: "moevenpick", airport: "airport", muc: "muc" };
const trav = (a, b, mod) => mod.travelMin(M, NODE[a], NODE[b]);
let seq = 0;
const R = (o, mod) => ({
  id: o.id || ("r" + (++seq)), date: o.date || D, time: o.time, dayKey: o.dayKey || (o.date || D),
  fromId: o.fromId, toId: o.toId, fromCustom: "", toCustom: "", djName: "Act",
  status: o.status || "planned", assignedDriverId: o.assignedDriverId != null ? o.assignedDriverId : null,
  passengerCount: o.passengerCount !== undefined ? o.passengerCount : 2,
  estDurationMin: o.estDurationMin != null ? o.estDurationMin : (mod ? trav(o.fromId, o.toId, mod) : 20), issues: [],
});
const drv = (id, seats = 6) => ({ id, firstName: id, lastName: "T", seats, vehicleType: "Van", vehicleId: "V" + id });
const dyn = (rides) => ({ rides, driverState: {} });
const vm = (ride, group, m, assigned = false) => ({ ride, op: { group, minutesUntilDeparture: m, driverAssigned: assigned } });

const CORR = await build(RAW);

// Direktes Leerfahrt-Szenario mit gegebener naechster Fahrtzeit.
const directStatus = (mod, nextTime) => {
  const r1 = R({ id: "r1", fromId: "festival", toId: "sheraton", time: "20:00", estDurationMin: 38, status: "onboard", assignedDriverId: "d1" }, mod);
  const r2 = R({ id: "r2", fromId: "airport", toId: "festival", time: nextTime, status: "accepted", assignedDriverId: "d1" }, mod);
  return mod.evaluateDriverRepositionSuggestion({ driver: drv("d1"), dyn: dyn([r1, r2]), setup, now: 0, dayKey: D, returnRideViewModels: [], waitRideSuggestions: [], groupRideSuggestions: [], driverPlannedPositions: [] });
};
// Rueckstellungs-Szenario (moevenpick, 30 zum Festival) mit Bedarf.
const reposStatus = (mod, opts = {}) => {
  const posTo = opts.posTo || "moevenpick";
  const p = R({ id: "p", fromId: "festival", toId: posTo, time: "20:00", status: "onboard", assignedDriverId: "d1" }, mod);
  const o1 = R({ id: "o1", fromId: "festival", toId: "sheraton", time: "22:00", status: "planned", assignedDriverId: null }, mod);
  const o2 = R({ id: "o2", fromId: "festival", toId: "moevenpick", time: "22:10", status: "planned", assignedDriverId: null }, mod);
  const vms = opts.vms || [vm(o1, "driver_missing", 30), vm(o2, "driver_missing", 40)];
  return mod.evaluateDriverRepositionSuggestion({ driver: drv("d1"), dyn: dyn([p, o1, o2]), setup, now: 0, dayKey: D, returnRideViewModels: vms, waitRideSuggestions: opts.wait || [], groupRideSuggestions: opts.groups || [], driverPlannedPositions: opts.dpp || [] });
};

// (1) minArrivalBufferMin 15 -> 10: 14-min-Puffer wird faelschlich positiv.
{
  const MUT = await build(mutate("minArrivalBufferMin: 15,", "minArrivalBufferMin: 10,"));
  const c = directStatus(CORR, "21:10").status;   // 14 min
  const m = directStatus(MUT, "21:10").status;
  ok(c === "not_evaluable" && m === "direct_to_next_pickup", `GP1 minArrivalBufferMin: korrekt=${c} -> mutiert=${m}`);
}
// (2) demandLookaheadMin 90 -> 60: Fahrt bei m=75 faellt raus.
{
  const MUT = await build(mutate("demandLookaheadMin: 90,", "demandLookaheadMin: 60,"));
  const r = R({ id: "x", fromId: "festival", toId: "sheraton", time: "23:00" }, CORR);
  const c = CORR.repositionDemandScore({ node: "festival", returnRideViewModels: [vm(r, "driver_missing", 75)], setup }).score;
  const m = MUT.repositionDemandScore({ node: "festival", returnRideViewModels: [vm(r, "driver_missing", 75)], setup }).score;
  ok(c === 2 && m === 0, `GP2 demandLookaheadMin: korrekt=${c} -> mutiert=${m}`);
}
// (3) maxRepositionTravelMin 35 -> 25: 30-min-Rueckstellung verliert starke Empfehlung.
{
  const MUT = await build(mutate("maxRepositionTravelMin: 35,", "maxRepositionTravelMin: 25,"));
  const c = reposStatus(CORR).severity;   // 30 <= 35 -> attention
  const m = reposStatus(MUT).severity;    // 30 > 25 -> neutral
  ok(c === "attention" && m === "neutral", `GP3 maxRepositionTravelMin: korrekt=${c} -> mutiert=${m}`);
}
// (4) minDemandScoreForReposition 2 -> 1: schwacher Bedarf (1) wird faelschlich empfohlen.
{
  const MUT = await build(mutate("minDemandScoreForReposition: 2,", "minDemandScoreForReposition: 1,"));
  const o1 = R({ id: "o1", fromId: "festival", toId: "moevenpick", time: "22:00", status: "planned", assignedDriverId: null }, CORR);
  const opts = { vms: [vm(o1, "due_soon", 60)] };   // score 1
  const c = reposStatus(CORR, opts).status;
  const m = reposStatus(MUT, opts).status;
  ok(c === "stay_at_current_location" && m === "reposition_to_festival", `GP4 minDemandScoreForReposition: korrekt=${c} -> mutiert=${m}`);
}
// (5) abgeschlossene Fahrten in den Demand Score aufnehmen.
{
  const MUT = await build(
    mutate('const REPOSITION_DEMAND_GROUPS = new Set(["overdue", "driver_missing", "due_soon"]);',
           'const REPOSITION_DEMAND_GROUPS = new Set(["overdue", "driver_missing", "due_soon", "completed"]);')
      .replace("const REPOSITION_DEMAND_WEIGHT = { overdue: 3, driver_missing: 2, due_soon: 1 };",
               "const REPOSITION_DEMAND_WEIGHT = { overdue: 3, driver_missing: 2, due_soon: 1, completed: 3 };"));
  const r = R({ id: "x", fromId: "festival", toId: "sheraton", time: "22:00" }, CORR);
  const c = CORR.repositionDemandScore({ node: "festival", returnRideViewModels: [vm(r, "completed", 10)], setup }).score;
  const m = MUT.repositionDemandScore({ node: "festival", returnRideViewModels: [vm(r, "completed", 10)], setup }).score;
  ok(c === 0 && m === 3, `GP5 completed im Demand: korrekt=${c} -> mutiert=${m}`);
}
// (6) Sheraton als Basis hardcoden (Fahrer ohne Fahrt).
{
  const MUT = await build(mutate(
    '  reasons.push("no_plan_position");\n  return out;',
    '  reasons.push("no_plan_position");\n  out.locationNode = "sheraton"; out.confidence = "planned";\n  return out;'));
  const c = CORR.deriveDriverPlannedPosition({ driver: drv("d1"), dyn: dyn([]), setup, now: 0, dayKey: D }).confidence;
  const m = MUT.deriveDriverPlannedPosition({ driver: drv("d1"), dyn: dyn([]), setup, now: 0, dayKey: D }).confidence;
  ok(c === "unknown" && m === "planned", `GP6 Sheraton-Basis: korrekt=${c} -> mutiert=${m}`);
}
// (7) E-Warteempfehlung ignorieren.
{
  const MUT = await build(mutate('w.status === "wait_recommended"', 'w.status === "__never__"'));
  const wait = [{ driverId: "d1", status: "wait_recommended", hasRideConflict: false }];
  const c = reposStatus(CORR, { wait }).status;
  const m = reposStatus(MUT, { wait }).status;
  ok(c === "stay_at_current_location" && m === "reposition_to_festival", `GP7 E-Vorrang ignoriert: korrekt=${c} -> mutiert=${m}`);
}
// (8) fehlende Matrixkante als 0 behandeln.
{
  const MUT = await build(mutate(
    "if (t == null) return { abs: null, reliable: false, node: nodes.toNode || null };",
    "if (t == null) return { abs: startAbs + 0, reliable: true, node: nodes.toNode || null };"));
  const r = R({ id: "x", fromId: "moevenpick", toId: "muc", time: "20:00", estDurationMin: 999 }, CORR); // Kante fehlt
  const c = CORR.repositionRideEndAbs(r, setup).reliable;
  const m = MUT.repositionRideEndAbs(r, setup).reliable;
  ok(c === false && m === true, `GP8 fehlende Kante als 0: korrekt=${c} -> mutiert=${m}`);
}
// (9) F-Actionable-Gate aushebeln (nicht-actionabler F-Status loest Hinweis aus).
{
  const MUT = await build(mutate(
    "  return !!(g && typeof GROUP_RIDE_ACTIONABLE !== \"undefined\" && GROUP_RIDE_ACTIONABLE.has && GROUP_RIDE_ACTIONABLE.has(g.status));",
    "  return true;"));
  const groups = [{ status: "group_not_recommended", rideIds: ["o1", "o2"] }];
  const c = reposStatus(CORR, { groups }).warnings.includes("group_suggestion_exists");
  const m = reposStatus(MUT, { groups }).warnings.includes("group_suggestion_exists");
  ok(c === false && m === true, `GP9 F-Actionable-Gate: korrekt=${c} -> mutiert=${m}`);
}
// (10) Sortierung mutierend ausfuehren.
{
  const MUT = await build(mutate(
    "  return (Array.isArray(list) ? list.slice() : []).sort(repositionCompare);",
    "  return (Array.isArray(list) ? list : []).sort(repositionCompare);"));
  const list = () => [
    { status: "not_evaluable", sortScore: 4000, demandScore: 0, driverId: "b" },
    { status: "direct_to_next_pickup", sortScore: 0, demandScore: 0, driverId: "a" },
  ];
  const lc = list(); CORR.rankRepositionSuggestions(lc);
  const lm = list(); MUT.rankRepositionSuggestions(lm);
  const cKept = lc[0].status === "not_evaluable";   // Eingabe unveraendert
  const mKept = lm[0].status === "not_evaluable";   // mutiert: in-place sortiert -> veraendert
  ok(cKept === true && mKept === false, `GP10 mutierende Sortierung: korrekt(kept)=${cKept} -> mutiert(kept)=${mKept}`);
}

console.log(`\nTeilpaket G1 Gegenproben: ${pass} OK, ${fail} FAIL`);
if (fail) { console.log("FEHLGESCHLAGEN:"); fails.forEach((f) => console.log("  - " + f)); process.exit(1); }
