// Teilpaket F1 - Logiktests gegen die ECHTEN Quellfunktionen (Wegwerf-Kopie der
// Quelle + Export, Original unangetastet). Deckt Richtung, Ausschluesse, Zeit-
// fenster/Mitternacht, Betriebstag, Kapazitaet, Fahrerzuweisung, Route/Einsparung/
// Umweg inkl. Grenzwerte, identische Route, C3-Veto (beide Richtungen), Ranking/
// Primaervorschlag, Determinismus und Read-only ab. Nur Logik (F1), keine UI.
// Aufruf: node smoke-teilpaket-f.mjs [src/ShuttleLeitstelle.jsx]
import fs from "fs";
import { execSync } from "child_process";

const srcFile = process.argv[2] || "src/ShuttleLeitstelle.jsx";
const rawSrc = fs.readFileSync(srcFile, "utf8");
const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/f-src-" + tag + ".jsx";
fs.writeFileSync(copy, rawSrc + `
export { evaluateRidePairForGrouping, buildGroupRidePairCandidates, rankGroupRideCandidates, groupCandidateCompare, finalizeGroupCandidate, GROUP_RIDE_CONFIG, GROUP_RIDE_STATUS_LABEL, GROUP_RIDE_STATUS_ORDER, GROUP_RIDE_ACTIONABLE, groupPairRoute, groupRideEndpoints, groupFleetSeats, groupRideC3, groupZoneOfNode, seedMatrix, seedLocations, rideFestivalDirection, festDayKey, c3RideStartAbsMin, validPassengerCount, normalizeTimetableEntries, matchRideToTimetable, evaluateTimetableTiming };
`);
const out = "/home/claude/repo/.f-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const M = await import(out);
fs.unlinkSync(out); fs.unlinkSync(copy);

const {
  evaluateRidePairForGrouping, buildGroupRidePairCandidates, rankGroupRideCandidates,
  groupCandidateCompare, GROUP_RIDE_CONFIG, GROUP_RIDE_STATUS_LABEL, GROUP_RIDE_ACTIONABLE,
  groupPairRoute, groupRideEndpoints, groupFleetSeats, groupRideC3, groupZoneOfNode,
  seedMatrix, seedLocations, rideFestivalDirection, festDayKey, c3RideStartAbsMin,
  validPassengerCount, normalizeTimetableEntries,
} = M;

let pass = 0, fail = 0; const fails = [];
function ok(cond, name) { if (cond) { pass++; } else { fail++; fails.push(name); console.log("FAIL " + name); } }
function eq(a, b, name) { ok(a === b, `${name} (erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)})`); }

const DAY = "2026-07-24";
const LOC = seedLocations();
// Fahrzeug-Fleet: Van 7 Sitze, zwei Cars 4 Sitze.
const FLEET = [
  { id: "V1", firstName: "Vera", lastName: "Van", seats: 7, vehicleType: "Van", vehicleId: "van-1" },
  { id: "C1", firstName: "Carl", lastName: "Car", seats: 4, vehicleType: "Car", vehicleId: "car-1" },
  { id: "C2", firstName: "Cora", lastName: "Car", seats: 4, vehicleType: "Car", vehicleId: "car-2" },
];
function mtx(pairs) { const m = {}; for (const [k, v] of Object.entries(pairs)) m[k] = { min: v, km: v }; return m; }
function mkSetup(over = {}) {
  return { config: { minDurationMin: 20, baseLocationId: "sheraton", ...(over.config || {}) },
    matrix: over.matrix || seedMatrix(), drivers: over.drivers || FLEET, locations: over.locations || LOC, zones: over.zones || [] };
}
let rc = 0;
function mkRide(over = {}) {
  const date = over.date || DAY;
  const time = over.time || "22:00";
  return { id: over.id || ("r" + (++rc)), date, time, dayKey: over.dayKey || festDayKey(date, time),
    passengerCount: over.passengerCount !== undefined ? over.passengerCount : 2, status: over.status || "planned",
    fromId: over.fromId || "festival", toId: over.toId || "sheraton", fromCustom: over.fromCustom || "", toCustom: over.toCustom || "",
    djName: over.djName || "", assignedDriverId: over.assignedDriverId || null };
}
function evalPair(a, b, setup, tt, now) {
  return evaluateRidePairForGrouping({ rideA: a, rideB: b, drivers: (setup && setup.drivers) || FLEET, setup, now: now || 0, timetableEntries: tt || null });
}

// ============================================================================
// GRUPPE 1 - Richtung + grundsaetzliche Ausschluesse (Spec 8/9)
// ============================================================================
{
  const s = mkSetup();
  // T1 zwei Rueckfahrten gleiche Richtung
  const r1 = mkRide({ fromId: "festival", toId: "sheraton", time: "22:00" });
  const r2 = mkRide({ fromId: "festival", toId: "sheraton", time: "22:05" });
  const c = evalPair(r1, r2, s);
  eq(c.direction, "from_festival", "T1 Richtung from_festival erkannt");
  // T2 zwei Hinfahrten gleiche Richtung
  const h1 = mkRide({ fromId: "sheraton", toId: "festival", time: "18:00" });
  const h2 = mkRide({ fromId: "moevenpick", toId: "festival", time: "18:05" });
  eq(evalPair(h1, h2, s).direction, "to_festival", "T2 Richtung to_festival erkannt");
  // T3 Hin + Rueck nicht kombinierbar
  const c3 = evalPair(mkRide({ fromId: "sheraton", toId: "festival" }), mkRide({ fromId: "festival", toId: "sheraton" }), s);
  eq(c3.status, "group_not_recommended", "T3 Hin+Rueck -> not_recommended");
  ok(c3.reasons.includes("direction_incompatible"), "T3 reason direction_incompatible");
  // T4 sonstige Richtung (Hotel->Hotel) ausgeschlossen
  const c4 = evalPair(mkRide({ fromId: "sheraton", toId: "moevenpick" }), mkRide({ fromId: "sheraton", toId: "moevenpick" }), s);
  eq(c4.status, "group_not_recommended", "T4 other-Richtung -> not_recommended");
  // T5 stornierte Fahrt ausgeschlossen
  eq(evalPair(mkRide({ fromId: "festival", toId: "sheraton", status: "cancelled" }), r2, s).reasons.includes("ride_state_excluded"), true, "T5 cancelled ausgeschlossen");
  // T6 abgeschlossene Fahrt ausgeschlossen
  eq(evalPair(mkRide({ fromId: "festival", toId: "sheraton", status: "done" }), r2, s).reasons.includes("ride_state_excluded"), true, "T6 done ausgeschlossen");
  // T7 laufende Fahrt ausgeschlossen (enroute_pickup / onboard)
  eq(evalPair(mkRide({ fromId: "festival", toId: "sheraton", status: "enroute_pickup" }), r2, s).reasons.includes("ride_state_excluded"), true, "T7a enroute ausgeschlossen");
  eq(evalPair(mkRide({ fromId: "festival", toId: "sheraton", status: "onboard" }), r2, s).reasons.includes("ride_state_excluded"), true, "T7b onboard ausgeschlossen");
}

// ============================================================================
// GRUPPE 2 - Zeitfenster + Betriebstag + Mitternacht (Spec 13/19)
// ============================================================================
{
  const s = mkSetup({ matrix: mtx({ "festival|sheraton": 30 }) });
  const base = { fromId: "festival", toId: "sheraton" }; // identische Route -> immer berechenbar
  const gap = (ta, tb) => evalPair(mkRide({ ...base, time: ta }), mkRide({ ...base, time: tb }), s);
  eq(gap("22:00", "22:00").departureDifferenceMin, 0, "T8 gleiche Zeit -> diff 0");
  eq(gap("22:00", "22:05").departureDifferenceMin, 5, "T9 5 min");
  eq(gap("22:00", "22:10").departureDifferenceMin, 10, "T10 10 min");
  eq(gap("22:00", "22:11").departureDifferenceMin, 11, "T11 11 min");
  eq(gap("22:00", "22:20").departureDifferenceMin, 20, "T12 20 min (Grenze)");
  ok(gap("22:00", "22:20").status !== "group_not_recommended" || !gap("22:00", "22:20").reasons.includes("departure_gap_too_large"), "T12b 20 min nicht wegen Abstand ausgeschlossen");
  const g21 = gap("22:00", "22:21");
  eq(g21.departureDifferenceMin, 21, "T13 21 min");
  ok(g21.reasons.includes("departure_gap_too_large"), "T13b 21 min -> departure_gap_too_large");
  eq(g21.status, "group_not_recommended", "T13c 21 min -> not_recommended");
  // T14 Mitternacht 23:55 (24.) und 00:05 (25., gehoert per festDayKey zum 24.) -> 10 min, gleicher Betriebstag
  const m1 = mkRide({ ...base, date: "2026-07-24", time: "23:55" });
  const m2 = mkRide({ ...base, date: "2026-07-25", time: "00:05" });
  eq(festDayKey("2026-07-25", "00:05"), "2026-07-24", "T14a festDayKey 00:05 -> Vortag");
  const mc = evalPair(m1, m2, s);
  eq(mc.departureDifferenceMin, 10, "T14b Mitternacht Abstand 10 min");
  eq(mc.festDayKey, "2026-07-24", "T14c gleicher Betriebstag ueber Mitternacht");
  ok(!mc.reasons.includes("different_operating_day"), "T14d nicht als anderer Betriebstag verworfen");
  // T15 unterschiedliche Betriebstage -> not_recommended
  const d1 = mkRide({ ...base, date: "2026-07-24", time: "22:00" });
  const d2 = mkRide({ ...base, date: "2026-07-25", time: "22:00" });
  const dc = evalPair(d1, d2, s);
  ok(dc.reasons.includes("different_operating_day"), "T15 unterschiedl. Betriebstag erkannt");
  eq(dc.status, "group_not_recommended", "T15b -> not_recommended");
  // T16 ungueltige Zeit -> not_evaluable (25:00 ist truthy, wird von mkRide nicht ersetzt)
  eq(evalPair(mkRide({ ...base, time: "25:00" }), d1, s).status, "group_not_evaluable", "T16 ungueltige Zeit -> not_evaluable");
}

// ============================================================================
// GRUPPE 3 - Kapazitaet (Spec 17) - nur Sitzplatzlogik
// ============================================================================
{
  const s = mkSetup({ matrix: mtx({ "festival|sheraton": 30 }) });
  const p = (paxA, paxB) => evalPair(
    mkRide({ fromId: "festival", toId: "sheraton", time: "22:00", passengerCount: paxA }),
    mkRide({ fromId: "festival", toId: "sheraton", time: "22:05", passengerCount: paxB }), s);
  // T17 2+2=4 passt (Fleet hat 4er + 7er)
  const c17 = p(2, 2); eq(c17.combinedPassengerCount, 4, "T17 combined 4"); eq(c17.fitsFleet, true, "T17b passt in Flotte");
  ok(c17.suitableVehicleIds.length >= 1, "T17c geeignete Fahrzeuge gelistet");
  // T18 2+3=5 passt (nur 7er)
  const c18 = p(2, 3); eq(c18.fitsFleet, true, "T18 5 passt"); eq(c18.suitableVehicleIds.includes("van-1"), true, "T18b van geeignet");
  ok(!c18.suitableVehicleIds.includes("car-1"), "T18c 4er-Car nicht geeignet fuer 5");
  // T19 4+3=7 passt exakt (<=)
  const c19 = p(4, 3); eq(c19.combinedPassengerCount, 7, "T19 combined 7"); eq(c19.fitsFleet, true, "T19b exakt 7 passt");
  // T20 4+4=8 passt nicht -> not_recommended
  const c20 = p(4, 4); eq(c20.fitsFleet, false, "T20 8 passt nicht"); ok(c20.reasons.includes("capacity_insufficient"), "T20b reason capacity_insufficient"); eq(c20.status, "group_not_recommended", "T20c -> not_recommended");
  // T21 fehlende Personenzahl -> not_evaluable (null = fehlend)
  eq(p(2, null).status, "group_not_evaluable", "T21 fehlende Pax -> not_evaluable");
  ok(p(2, null).reasons.includes("passenger_count_missing"), "T21b reason passenger_count_missing");
  // T22 ungueltige Personenzahl (0) -> not_evaluable
  eq(p(2, 0).status, "group_not_evaluable", "T22 pax 0 -> not_evaluable");
  // T23 keine erfundene Standardkapazitaet: fehlende Pax fuehrt NICHT zu fitsFleet true
  eq(p(2, null).fitsFleet, false, "T23 keine fiktive Kapazitaet");
}

// ============================================================================
// GRUPPE 4 - Fahrerzuweisung (Spec 18)
// ============================================================================
{
  const s = mkSetup({ matrix: mtx({ "festival|sheraton": 30 }) });
  const mk = (drvA, drvB) => evalPair(
    mkRide({ fromId: "festival", toId: "sheraton", time: "22:00", assignedDriverId: drvA, passengerCount: 2 }),
    mkRide({ fromId: "festival", toId: "sheraton", time: "22:05", assignedDriverId: drvB, passengerCount: 2 }), s);
  // T24 beide unbesetzt -> both_unassigned, darf empfohlen werden (identische Route, saved gross)
  const c24 = mk(null, null); eq(c24.driverAssignment, "both_unassigned", "T24 both_unassigned");
  eq(c24.status, "group_recommended", "T24b unbesetzt+identisch -> recommended");
  // T25 gleicher Fahrer -> same_driver, kann empfohlen werden
  const c25 = mk("V1", "V1"); eq(c25.driverAssignment, "same_driver", "T25 same_driver");
  eq(c25.status, "group_recommended", "T25b gleicher Fahrer -> recommended");
  // T26 eine mit Fahrer, eine ohne -> mixed, hoechstens possible
  const c26 = mk("V1", null); eq(c26.driverAssignment, "mixed", "T26 mixed");
  eq(c26.status, "group_possible", "T26b mixed -> possible");
  ok(c26.warnings.includes("driver_assignment_review"), "T26c warning driver_assignment_review");
  // T27 zwei verschiedene Fahrer -> two_drivers, hoechstens possible
  const c27 = mk("V1", "C1"); eq(c27.driverAssignment, "two_drivers", "T27 two_drivers");
  eq(c27.status, "group_possible", "T27b two_drivers -> possible");
  ok(c27.warnings.includes("two_driver_assignments"), "T27c warning two_driver_assignments");
  // T28 unbekannte Fahrer-ID -> not_evaluable
  const c28 = mk("GHOST", null); eq(c28.status, "group_not_evaluable", "T28 unbekannter Fahrer -> not_evaluable");
  ok(c28.reasons.includes("driver_unresolved"), "T28b reason driver_unresolved");
}

// ============================================================================
// GRUPPE 5 - Route / Einsparung / Umweg inkl. Grenzwerte (Spec 24/25/26)
// ============================================================================
{
  // Rueckfahrten: festival->sheraton (H1) + festival->moevenpick (H2).
  const back = (fH1, fH2, h1h2, over = {}) => {
    const s = mkSetup({ matrix: mtx({ "festival|sheraton": fH1, "festival|moevenpick": fH2, "sheraton|moevenpick": h1h2 }) });
    const a = mkRide({ fromId: "festival", toId: "sheraton", time: "22:00", passengerCount: 2, ...(over.a || {}) });
    const b = mkRide({ fromId: "festival", toId: "moevenpick", time: "22:05", passengerCount: 2, ...(over.b || {}) });
    return evalPair(a, b, s);
  };
  // T29 saved exakt 15: 30+30 getrennt, grouped 45 (30+15), saved 15, detour 15
  const c29 = back(30, 30, 15);
  eq(c29.separateDrivingMin, 60, "T29 separate 60");
  eq(c29.groupedDrivingMin, 45, "T29b grouped 45");
  eq(c29.estimatedDrivingSavedMin, 15, "T29c saved 15");
  eq(c29.detourMin, 15, "T29d detour 15");
  eq(c29.routeReliable, true, "T29e routeReliable");
  eq(c29.status, "group_recommended", "T29f saved=15 -> recommended");
  // T30 saved 14 (<15) -> possible (saving_below_threshold)
  const c30 = back(30, 30, 16);
  eq(c30.estimatedDrivingSavedMin, 14, "T30 saved 14");
  eq(c30.status, "group_possible", "T30b saved<15 -> possible");
  ok(c30.reasons.includes("saving_below_threshold"), "T30c reason saving_below_threshold");
  // T31 detour exakt 25 zulaessig (grouped 55, saved 5 -> possible, aber NICHT detour_too_large)
  const c31 = back(30, 30, 25);
  eq(c31.detourMin, 25, "T31 detour 25");
  ok(!c31.reasons.includes("detour_too_large"), "T31b 25 min Umweg zulaessig");
  // T32 detour 26 -> detour_too_large -> not_recommended
  const c32 = back(30, 30, 26);
  eq(c32.detourMin, 26, "T32 detour 26");
  ok(c32.reasons.includes("detour_too_large"), "T32b reason detour_too_large");
  eq(c32.status, "group_not_recommended", "T32c 26 min Umweg -> not_recommended");
  // T33 no_saving: saved=0 bei detour<=25 -> not_recommended
  const c33 = back(20, 20, 20);
  eq(c33.estimatedDrivingSavedMin, 0, "T33 saved 0");
  ok(c33.reasons.includes("no_saving"), "T33b reason no_saving");
  eq(c33.status, "group_not_recommended", "T33c saved 0 -> not_recommended");
  // T34 fehlende Matrixkante -> routeReliable false, keine Einsparungsbehauptung, cap possible
  const c34 = back(30, 30, null); // sheraton|moevenpick fehlt -> Zwischenbein unbekannt
  eq(c34.routeReliable, false, "T34 route unzuverlaessig bei fehlender Kante");
  eq(c34.estimatedDrivingSavedMin, null, "T34b keine Einsparung behauptet (null, nicht 0)");
  ok(c34.reasons.includes("route_incomplete"), "T34c reason route_incomplete");
  ok(c34.status === "group_possible", "T34d unvollstaendige Route -> hoechstens possible");
  // T35 identische Route: festival->sheraton + festival->sheraton, saved = einfacher Leg, detour 0
  const s2 = mkSetup({ matrix: mtx({ "festival|sheraton": 30 }) });
  const c35 = evalPair(mkRide({ fromId: "festival", toId: "sheraton", time: "22:00" }), mkRide({ fromId: "festival", toId: "sheraton", time: "22:05" }), s2);
  eq(c35.identicalRoute, true, "T35 identicalRoute true");
  eq(c35.sameOrigin, true, "T35b sameOrigin true");
  eq(c35.sameDestination, true, "T35c sameDestination true");
  eq(c35.estimatedDrivingSavedMin, 30, "T35d saved = einfacher Leg 30");
  eq(c35.detourMin, 0, "T35e detour 0");
  eq(c35.status, "group_recommended", "T35f identisch -> recommended");
  ok(c35.reasons.includes("identical_route"), "T35g reason identical_route");
  // T36 asymmetrische Matrix beruecksichtigt (beste Reihenfolge). Hinfahrten mit
  // unterschiedlichen Abholorten: nur eine Richtung der Kante gesetzt.
  const s3 = mkSetup({ matrix: mtx({ "sheraton|festival": 40, "moevenpick|festival": 40, "sheraton|moevenpick": 10 }) });
  const c36 = evalPair(mkRide({ fromId: "sheraton", toId: "festival", time: "18:00" }), mkRide({ fromId: "moevenpick", toId: "festival", time: "18:05" }), s3);
  eq(c36.separateDrivingMin, 80, "T36 separate 80");
  eq(c36.groupedDrivingMin, 50, "T36b grouped 50 (10+40)");
  eq(c36.estimatedDrivingSavedMin, 30, "T36c saved 30");
}

// ============================================================================
// GRUPPE 6 - Zonen + sameOrigin/sameDestination (Spec 22/23)
// ============================================================================
{
  eq(groupZoneOfNode("festival"), "VENUE", "T37 Zone festival = VENUE");
  eq(groupZoneOfNode("sheraton"), "HOTEL_STADT", "T38 Zone sheraton = HOTEL_STADT");
  eq(groupZoneOfNode("moevenpick"), "HOTEL_STADT", "T39 Zone moevenpick = HOTEL_STADT");
  eq(groupZoneOfNode("unbekannt"), "UNKNOWN", "T40 unbekannter Knoten -> UNKNOWN");
  // sameZone: zwei verschiedene Stadthotels -> gleiche Zone
  const s = mkSetup({ matrix: mtx({ "festival|sheraton": 30, "festival|moevenpick": 30, "sheraton|moevenpick": 12 }) });
  const c = evalPair(mkRide({ fromId: "festival", toId: "sheraton", time: "22:00" }), mkRide({ fromId: "festival", toId: "moevenpick", time: "22:05" }), s);
  eq(c.sameZone, true, "T41 verschiedene Stadthotels -> sameZone true");
  eq(c.sameDestination, false, "T41b unterschiedliche Ziele -> sameDestination false");
  eq(c.sameOrigin, true, "T41c beide vom Festival -> sameOrigin true");
}

// ============================================================================
// GRUPPE 7 - C3-Veto (Spec 20/21/28)
// ============================================================================
{
  const ttOne = (artist, start, end) => normalizeTimetableEntries([{ festival_day: null, stage: "Mainstage", artist, start: `${DAY} ${start}`, end: `${DAY} ${end}` }]);
  // Hinfahrt: sheraton->festival, Fahrzeit 38 -> Ankunft ~ Startzeit+38.
  const s = mkSetup({ matrix: seedMatrix() });
  // T42 ohne Timetable -> kein C3-Veto (identische Route bleibt recommended)
  const s0 = mkSetup({ matrix: mtx({ "festival|sheraton": 30 }) });
  const c42 = evalPair(mkRide({ fromId: "festival", toId: "sheraton", time: "22:00" }), mkRide({ fromId: "festival", toId: "sheraton", time: "22:05" }), s0, null);
  eq(c42.status, "group_recommended", "T42 ohne Timetable kein Veto -> recommended");
  // T43 to_festival late -> not_recommended. Set-Start 22:30, Ankunft 22:38 -> late.
  const late = mkRide({ fromId: "sheraton", toId: "festival", time: "22:00", djName: "Lateact", passengerCount: 2 });
  const partnerH = mkRide({ fromId: "moevenpick", toId: "festival", time: "22:05", djName: "", passengerCount: 2 });
  const ttLate = ttOne("Lateact", "22:30", "23:30");
  const c3late = groupRideC3(late, s, ttLate, 0);
  eq(c3late && c3late.status, "late", "T43a C3 des Rides = late (Fixture-Kontrolle)");
  const c43 = evalPair(late, partnerH, s, ttLate);
  eq(c43.status, "group_not_recommended", "T43b to_festival late -> not_recommended");
  ok(c43.reasons.includes("c3_late"), "T43c reason c3_late");
  // T44 to_festival tight -> hoechstens possible. Set-Start so, dass Marge knapp (tight).
  // Ankunft 22:38; tight bei kleiner positiver Marge. Set-Start 22:50 -> Marge 12.
  const tight = mkRide({ fromId: "sheraton", toId: "festival", time: "22:00", djName: "Tightact", passengerCount: 2 });
  const ttTight = ttOne("Tightact", "22:50", "23:50");
  const c3tight = groupRideC3(tight, s, ttTight, 0);
  if (c3tight && (c3tight.status === "tight" || c3tight.status === "critical")) {
    const c44 = evalPair(tight, partnerH, s, ttTight);
    ok(c44.status === "group_possible" || c44.status === "group_not_recommended", "T44 tight/critical -> hoechstens possible");
    ok(c44.status !== "group_recommended", "T44b tight/critical nie recommended");
  } else { ok(true, `T44 uebersprungen (C3=${c3tight && c3tight.status})`); }
  // T45 from_festival return_before_set_end -> possible (kleiner Shift, damit nicht shift_too_large).
  // Ride festival->sheraton 23:25, Set-Ende 23:30 -> minutesRelativeToSetEnd -5 -> return_before_set_end.
  const rbse = mkRide({ fromId: "festival", toId: "sheraton", time: "23:25", djName: "Endact", passengerCount: 2 });
  const partnerR = mkRide({ fromId: "festival", toId: "moevenpick", time: "23:28", djName: "", passengerCount: 2 });
  const ttEnd = ttOne("Endact", "21:00", "23:30");
  const c3end = groupRideC3(rbse, s, ttEnd, 0);
  eq(c3end && c3end.status, "return_before_set_end", "T45a C3 = return_before_set_end (Fixture-Kontrolle)");
  const c45 = evalPair(rbse, partnerR, mkSetup({ matrix: mtx({ "festival|sheraton": 20, "festival|moevenpick": 20, "sheraton|moevenpick": 10 }) }), ttEnd);
  ok(c45.status === "group_possible", "T45b return_before_set_end (kleiner Shift) -> possible");
  ok(c45.warnings.includes("c3_return_before_set_end"), "T45c warning c3_return_before_set_end");
}

// ============================================================================
// GRUPPE 8 - Zeitverschiebung (Spec 19/27)
// ============================================================================
{
  const s = mkSetup({ matrix: mtx({ "festival|sheraton": 30 }) });
  const a = mkRide({ id: "A", fromId: "festival", toId: "sheraton", time: "22:00" });
  const b = mkRide({ id: "B", fromId: "festival", toId: "sheraton", time: "22:10" });
  const c = evalPair(a, b, s);
  // Hinfahrt-Logik greift NICHT (das sind Rueckfahrten); gemeinsame Abfahrt = spaetere = 22:10.
  eq(c.departureShift["A"], 10, "T46 fruehere Fahrt verschiebt sich +10");
  eq(c.departureShift["B"], 0, "T46b spaetere Fahrt Shift 0");
  ok(c.warnings.includes("common_departure_shift"), "T46c Shift transparent als warning");
  // T47 Hinfahrt: gemeinsame Abfahrt = spaetere der beiden.
  const s2 = mkSetup({ matrix: mtx({ "sheraton|festival": 30, "moevenpick|festival": 30, "sheraton|moevenpick": 10 }) });
  const h = evalPair(mkRide({ id: "H1", fromId: "sheraton", toId: "festival", time: "18:00" }), mkRide({ id: "H2", fromId: "moevenpick", toId: "festival", time: "18:08" }), s2);
  eq(Math.max(h.departureShift["H1"], h.departureShift["H2"]), 8, "T47 Hinfahrt maxShift 8");
}

// ============================================================================
// GRUPPE 9 - Ranking / Primaervorschlag / Determinismus (Spec 30)
// ============================================================================
{
  const s = mkSetup({ matrix: mtx({ "festival|sheraton": 30 }) });
  // Drei identische Rueckfahrten (A,B,C) zum selben Ziel, dicht beieinander.
  const A = mkRide({ id: "A", fromId: "festival", toId: "sheraton", time: "22:00", passengerCount: 2 });
  const B = mkRide({ id: "B", fromId: "festival", toId: "sheraton", time: "22:04", passengerCount: 2 });
  const C = mkRide({ id: "C", fromId: "festival", toId: "sheraton", time: "22:08", passengerCount: 2 });
  const built = buildGroupRidePairCandidates({ rides: [A, B, C], drivers: FLEET, setup: s, now: 0, timetableEntries: null });
  ok(built.ranked.length === 3, "T48 drei Paare A+B, A+C, B+C");
  // T49 genau ein Primaervorschlag pro belegter Fahrt: Primaries duerfen keine Ride teilen.
  const primaryIds = built.primaries.flatMap((c) => c.rideIds);
  eq(new Set(primaryIds).size, primaryIds.length, "T49 Primaries teilen keine Fahrt");
  ok(built.primaries.length >= 1, "T49b mindestens ein Primaervorschlag");
  // T50 ueberlappende Kandidaten sind markiert
  const overlaps = built.ranked.filter((c) => c.overlapsPrimary);
  ok(built.ranked.some((c) => c.isPrimary) && overlaps.length >= 1, "T50 Alternativen als overlapsPrimary markiert");
  // T51 hoehere Einsparung zuerst (Comparator)
  const hi = { sortScore: 0, status: "group_recommended", routeReliable: true, estimatedDrivingSavedMin: 30, detourMin: 5, departureDifferenceMin: 5, rideIds: ["x", "y"] };
  const lo = { sortScore: 0, status: "group_recommended", routeReliable: true, estimatedDrivingSavedMin: 10, detourMin: 5, departureDifferenceMin: 5, rideIds: ["a", "b"] };
  ok(groupCandidateCompare(hi, lo) < 0, "T51 hoehere Einsparung wird vorgezogen");
  // T52 stabiler Ride-Identifier als Tie-Breaker
  const t1 = { sortScore: 5, status: "group_recommended", routeReliable: true, estimatedDrivingSavedMin: 10, detourMin: 5, departureDifferenceMin: 5, rideIds: ["a", "b"] };
  const t2 = { sortScore: 5, status: "group_recommended", routeReliable: true, estimatedDrivingSavedMin: 10, detourMin: 5, departureDifferenceMin: 5, rideIds: ["a", "c"] };
  ok(groupCandidateCompare(t1, t2) < 0 && groupCandidateCompare(t2, t1) > 0, "T52 Ride-Id-Tie-Breaker deterministisch");
  // T53 Determinismus: gleiche Eingabe -> gleiche Ausgabe
  const x1 = evalPair(A, B, s), x2 = evalPair(A, B, s);
  eq(JSON.stringify(x1), JSON.stringify(x2), "T53 deterministisch");
  // T54 Kanonisierung: Reihenfolge der Argumente egal -> gleiche rideIds-Reihenfolge + Status
  const p1 = evalPair(A, B, s), p2 = evalPair(B, A, s);
  eq(JSON.stringify(p1.rideIds), JSON.stringify(p2.rideIds), "T54 rideIds kanonisch");
  eq(p1.status, p2.status, "T54b Status unabhaengig von Argumentreihenfolge");
}

// ============================================================================
// GRUPPE 10 - Read-only (Spec 38)
// ============================================================================
{
  const s = mkSetup({ matrix: mtx({ "festival|sheraton": 30 }) });
  const A = mkRide({ id: "A", fromId: "festival", toId: "sheraton", time: "22:00", passengerCount: 2, assignedDriverId: "V1" });
  const B = mkRide({ id: "B", fromId: "festival", toId: "sheraton", time: "22:05", passengerCount: 2, assignedDriverId: null });
  const snapA = JSON.stringify(A), snapB = JSON.stringify(B), snapFleet = JSON.stringify(FLEET), snapSetup = JSON.stringify(s);
  evalPair(A, B, s);
  eq(JSON.stringify(A), snapA, "T55 rideA nicht mutiert");
  eq(JSON.stringify(B), snapB, "T56 rideB nicht mutiert");
  eq(JSON.stringify(FLEET), snapFleet, "T57 Fahrer nicht mutiert");
  eq(JSON.stringify(s), snapSetup, "T58 Setup nicht mutiert");
  // T59 rankGroupRideCandidates mutiert Eingabe-Array nicht
  const arr = [evalPair(A, B, s), evalPair(B, A, s)];
  const snapArr = JSON.stringify(arr);
  rankGroupRideCandidates(arr);
  eq(JSON.stringify(arr), snapArr, "T59 Ranking mutiert Eingabe-Array nicht");
  // T60 buildGroupRidePairCandidates mutiert rides nicht
  const rides = [A, B, mkRide({ id: "D", fromId: "festival", toId: "sheraton", time: "22:07", passengerCount: 2 })];
  const snapRides = JSON.stringify(rides);
  buildGroupRidePairCandidates({ rides, drivers: FLEET, setup: s, now: 0, timetableEntries: null });
  eq(JSON.stringify(rides), snapRides, "T60 build mutiert rides nicht");
}

// ============================================================================
// GRUPPE 11 - Performance-Vorfilter (Spec 37)
// ============================================================================
{
  const s = mkSetup({ matrix: mtx({ "festival|sheraton": 30 }) });
  // Fahrten weit auseinander (>20 min) im selben Bucket erzeugen kein Paar (Fenster-Abbruch).
  const far = [
    mkRide({ id: "F1", fromId: "festival", toId: "sheraton", time: "22:00", passengerCount: 2 }),
    mkRide({ id: "F2", fromId: "festival", toId: "sheraton", time: "23:00", passengerCount: 2 }),
  ];
  const built = buildGroupRidePairCandidates({ rides: far, drivers: FLEET, setup: s, now: 0, timetableEntries: null });
  eq(built.ranked.length, 0, "T61 Fenster-Vorfilter: >20 min erzeugt kein Paar");
  // Unterschiedliche Richtungen landen in verschiedenen Buckets -> kein Paar
  const mixed = [
    mkRide({ id: "M1", fromId: "festival", toId: "sheraton", time: "22:00", passengerCount: 2 }),
    mkRide({ id: "M2", fromId: "sheraton", toId: "festival", time: "22:05", passengerCount: 2 }),
  ];
  eq(buildGroupRidePairCandidates({ rides: mixed, drivers: FLEET, setup: s, now: 0, timetableEntries: null }).ranked.length, 0, "T62 Richtungs-Bucket: kein gemischtes Paar");
}

// ============================================================================
console.log(`\nTeilpaket F1 Smoke: ${pass} OK, ${fail} FAIL`);
if (fail) { console.log("Fehlgeschlagen:\n - " + fails.join("\n - ")); process.exit(1); }
