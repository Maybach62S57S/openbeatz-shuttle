// Teilpaket E – Gegenproben. Jede Mutation der extrahierten Funktionen MUSS ein
// definiertes Verhalten kippen (beweist, dass die Tests etwas messen). Danach
// werden die mutierten Module verworfen (temporaere Dateien).
import fs from "node:fs";

const SRC = fs.readFileSync("./tmp-te-funcs.mjs", "utf8");
const DAY = "2026-07-24";
const baseMatrix = { "sheraton|festival": { min: 38 }, "moevenpick|festival": { min: 30 } };
const mkSetup = (o = {}) => ({ config: { baseLocationId: "sheraton", minDurationMin: 20, softHoursMin: 100000, ...(o.config || {}) }, matrix: o.matrix || baseMatrix, drivers: o.drivers || [], locations: [{ id: "festival", short: "F" }] });
const drv = { id: "d1", firstName: "A", lastName: "B", seats: 6, vehicleType: "Van" };
const mkRide = (o = {}) => ({ id: "r?", date: DAY, dayKey: DAY, time: "20:00", passengerCount: 2, status: "planned", fromId: "sheraton", toId: "festival", fromCustom: "", toCustom: "", ...o });

let n = 0, pass = 0, fail = 0; const fails = [];
async function proof(name, mutate, run, expectDiffers) {
  n++;
  const mutated = mutate(SRC);
  if (mutated === SRC) { fail++; fails.push(`GP${n} ${name}: Mutation griff nicht (Ankertext fehlt)`); return; }
  const file = `./tmp-gp-e-${n}.mjs`;
  fs.writeFileSync(file, mutated, "utf8");
  try {
    const M = await import(file + `?v=${Date.now()}`);
    const val = run(M);
    if (val.mut !== val.correct) { pass++; console.log(`GP${n} ${name}: OK (korrekt=${JSON.stringify(val.correct)} -> mutiert=${JSON.stringify(val.mut)})`); }
    else { fail++; fails.push(`GP${n} ${name}: Verhalten kippte NICHT (beide ${JSON.stringify(val.correct)})`); }
  } catch (e) { fail++; fails.push(`GP${n} ${name}: Fehler ${e.message}`); }
  finally { try { fs.unlinkSync(file); } catch {} }
}

// Referenz (korrektes Modul) fuer Soll-Werte:
const REF = await import("./tmp-te-funcs.mjs");
function evalWith(M, { retTime, setup, extra = [], hub, retTo = "moevenpick", retDriver = null }) {
  const inb = mkRide({ id: "in1", time: "20:00", assignedDriverId: "d1" });
  const ret = mkRide({ id: "re1", time: retTime, fromId: "festival", toId: retTo, assignedDriverId: retDriver });
  const dyn = { rides: [inb, ret, ...extra], driverState: {} };
  return M.evaluateWaitRideCandidate({ inboundRide: inb, returnRide: ret, driver: drv, setup, dyn, now: 0, comparisonHub: hub });
}

const hubSetup = () => mkSetup({ drivers: [drv], config: { driverHubLocationId: "sheraton" } });

// 1) recommendedWaitMaxMin 60 -> 50: wait=55 mit Hub war wait_recommended.
await proof("recommendedWaitMaxMin 60->50",
  (s) => s.replace("recommendedWaitMaxMin: 60,", "recommendedWaitMaxMin: 50,"),
  (M) => ({ correct: evalWith(REF, { retTime: "21:33", setup: hubSetup() }).status,
            mut: evalWith(M, { retTime: "21:33", setup: hubSetup() }).status }));

// 2) possibleWaitMaxMin 120 -> 90: wait=100 war wait_possible.
await proof("possibleWaitMaxMin 120->90",
  (s) => s.replace("possibleWaitMaxMin: 120,", "possibleWaitMaxMin: 90,"),
  (M) => ({ correct: evalWith(REF, { retTime: "22:18", setup: mkSetup({ drivers: [drv] }) }).status,
            mut: evalWith(M, { retTime: "22:18", setup: mkSetup({ drivers: [drv] }) }).status }));

// 3) minTurnaroundBufferMin 10 -> 5: wait=7 war not_evaluable.
await proof("minTurnaroundBufferMin 10->5",
  (s) => s.replace("minTurnaroundBufferMin: 10,", "minTurnaroundBufferMin: 5,"),
  (M) => ({ correct: evalWith(REF, { retTime: "20:45", setup: mkSetup({ drivers: [drv] }) }).status,
            mut: evalWith(M, { retTime: "20:45", setup: mkSetup({ drivers: [drv] }) }).status }));

// 4) minCalculatedDrivingSavedMin 25 -> 15: reliable saved=20 war return_recommended.
{
  const m20 = { "sheraton|festival": { min: 38 }, "festival|moevenpick": { min: 10 }, "moevenpick|festival": { min: 10 } };
  const s20 = () => mkSetup({ drivers: [drv], config: { driverHubLocationId: "moevenpick" }, matrix: m20 });
  await proof("minCalculatedDrivingSavedMin 25->15",
    (s) => s.replace("minCalculatedDrivingSavedMin: 25,", "minCalculatedDrivingSavedMin: 15,"),
    (M) => ({ correct: evalWith(REF, { retTime: "21:08", setup: s20() }).status,
              mut: evalWith(M, { retTime: "21:08", setup: s20() }).status }));
}

// 5) Konfliktpruefung deaktiviert: Konfliktszenario war return_recommended.
{
  const third = mkRide({ id: "x3", time: "21:10", fromId: "festival", toId: "sheraton", assignedDriverId: "d1" });
  await proof("Konfliktpruefung aus (overlap->false)",
    (s) => s.replace("const hasRideConflict = !!(ins.overlap || ins.lateToPickup > 0 || ins.lateToNext > 0);",
                     "const hasRideConflict = false;"),
    (M) => ({ correct: evalWith(REF, { retTime: "21:00", setup: mkSetup({ drivers: [drv] }), extra: [third] }).status,
              mut: evalWith(M, { retTime: "21:00", setup: mkSetup({ drivers: [drv] }), extra: [third] }).status }));
}

// 6) Fehlende Matrixkante als 0 behandelt: unbekannter Start war arrivalAbs=null.
await proof("fehlende Kante als 0 (?? 0)",
  (s) => s.replace("const tm = travelMin(setup.matrix, nodes.fromNode, nodes.toNode);",
                   "const tm = (travelMin(setup.matrix, nodes.fromNode, nodes.toNode) ?? 0);"),
  (M) => {
    const inb = mkRide({ fromId: "__custom", fromCustom: "Irgendwo", toId: "festival", time: "20:00" });
    const setup = mkSetup({ drivers: [drv] });
    return { correct: REF.waitInboundArrival(inb, setup).arrivalAbs === null,
             mut: M.waitInboundArrival(inb, setup).arrivalAbs === null };
  });

// 7) Rueckfahrt anderem Fahrer trotzdem vorschlagen: war not_evaluable/kein Vorschlag.
await proof("anderem Fahrer trotzdem vorschlagen",
  (s) => s.replace('return done(); // kein Vorschlag (Aufrufer filtert diesen Fall heraus)',
                   'return done({ status: "wait_possible", severity: "warning", label: WAIT_RIDE_STATUS_LABEL.wait_possible }); // MUT'),
  (M) => ({ correct: evalWith(REF, { retTime: "21:08", setup: mkSetup({ drivers: [drv] }), retDriver: "d2" }).status,
            mut: evalWith(M, { retTime: "21:08", setup: mkSetup({ drivers: [drv] }), retDriver: "d2" }).status }));

// 8) Comparator-Prioritaet invertiert: Ranking waehlt falsches Bestes.
await proof("Comparator invertiert (oa-ob -> ob-oa)",
  (s) => s.replace("if (oa !== ob) return oa - ob;", "if (oa !== ob) return ob - oa;"),
  (M) => {
    const rec = { status: "wait_recommended", hasRideConflict: false, driverAvailable: true, comparisonRouteReliable: false, estimatedDrivingSavedMin: null, waitMinutes: 30, returnDepartureAt: "2026-07-24 21:00", returnRideId: "r1", inboundRideId: "i1", driverId: "d1" };
    const nev = { ...rec, status: "not_evaluable" };
    return { correct: REF.rankWaitCandidates([nev, rec])[0].status,
             mut: M.rankWaitCandidates([nev, rec])[0].status };
  });

console.log(`\nGegenproben: ${pass}/${n} kippten wie erwartet, ${fail} Problem(e)`);
if (fail) { console.log("Probleme:\n- " + fails.join("\n- ")); process.exit(1); }
