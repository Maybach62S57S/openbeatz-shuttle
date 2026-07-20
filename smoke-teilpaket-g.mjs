// Teilpaket G1 - Smoke gegen VERBATIM extrahierte Funktionen (tmp-tg-funcs.mjs).
// Aufruf: python3 extract-funcs-teilpaket-g.py src/ShuttleLeitstelle.jsx tmp-tg-funcs.mjs
//         node smoke-teilpaket-g.mjs
import * as G from "./tmp-tg-funcs.mjs";

let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push(m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} (erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)})`);

// ---- Setup ---------------------------------------------------------------
const M = {
  "airport|festival": { min: 30, km: 26 }, "sheraton|festival": { min: 38, km: 28 },
  "moevenpick|festival": { min: 30, km: 26 }, "airport|sheraton": { min: 18, km: 10 },
  "airport|moevenpick": { min: 3, km: 1 }, "moevenpick|sheraton": { min: 18, km: 10 },
  "muc|festival": { min: 105, km: 185 }, "muc|sheraton": { min: 105, km: 185 },
  // muc|moevenpick ABSICHTLICH fehlend (Test fehlende Kante)
};
const LOCS = [
  { id: "festival", name: "Open Beatz Festival", short: "Festival", venue: true, type: "festival" },
  { id: "sheraton", name: "Sheraton Carlton", short: "Sheraton", type: "hotel" },
  { id: "moevenpick", name: "Mövenpick", short: "Mövenpick", type: "hotel" },
  { id: "airport", name: "Flughafen Nürnberg", short: "Flughafen", type: "airport" },
  { id: "leonardo", name: "Leonardo Hotel", short: "Leonardo", type: "hotel" },
  { id: "hbf_nue", name: "HBF Nürnberg", short: "HBF", type: "hbf" },
];
const CFG = { baseLocationId: "sheraton", minDurationMin: 20, softHoursMin: 210, arrivalOnTimeBufferMin: 30, arrivalTightBufferMin: 10 };
const mkSetup = (extra = {}) => ({ matrix: M, locations: LOCS, config: CFG, drivers: [], ...extra });

const NODE = { festival: "festival", sheraton: "sheraton", moevenpick: "moevenpick", airport: "airport", muc: "muc", leonardo: "sheraton", hbf_nue: "sheraton" };
const travMin = (a, b) => G.travelMin(M, NODE[a] || a, NODE[b] || b);

const D_FUT = "2026-07-25";     // Zukunftstag -> dayNowMin = -99999 (nichts gestartet)
const D_PAST = "2020-01-01";    // Vergangenheit -> dayNowMin = 99999 (alles erledigt)
let seq = 0;
const mkRide = (o) => {
  const dur = o.estDurationMin != null ? o.estDurationMin : travMin(o.fromId, o.toId);
  return {
    id: o.id || ("r" + (++seq)), date: o.date || D_FUT, time: o.time,
    dayKey: o.dayKey || (o.date || D_FUT),
    fromId: o.fromId, toId: o.toId, fromCustom: o.fromCustom || "", toCustom: o.toCustom || "",
    djName: o.djName || "Act", status: o.status || "planned",
    assignedDriverId: o.assignedDriverId != null ? o.assignedDriverId : null,
    passengerCount: o.passengerCount !== undefined ? o.passengerCount : 2,
    estDurationMin: dur, issues: o.issues || [],
  };
};
const mkDriver = (id, seats = 6, extra = {}) => ({ id, firstName: id, lastName: "T", seats, vehicleType: "Van", vehicleId: "V" + id, ...extra });
const mkDyn = (rides, driverState = {}) => ({ rides, driverState });
const mkVM = (ride, group, minutesUntil, assigned = false) => ({ ride, op: { group, minutesUntilDeparture: minutesUntil, driverAssigned: assigned } });
const abs = (date, time) => G.c3RideStartAbsMin(date, time);

// =========================================================================
// 1. Planungsposition
// =========================================================================
{
  const setup = mkSetup();
  const d = mkDriver("d1");
  // 1. ohne Fahrt -> unbekannt
  let p = G.deriveDriverPlannedPosition({ driver: d, dyn: mkDyn([]), setup, now: 0, dayKey: D_FUT });
  eq(p.confidence, "unknown", "1. ohne Fahrt -> confidence unknown");
  eq(p.locationNode, null, "1. ohne Fahrt -> keine Position");
  ok(p.reasons.includes("no_plan_position"), "1. Grund no_plan_position");
  // 2. abgeschlossene Fahrt (Vergangenheit) -> Ziel als Position
  const r2 = mkRide({ id: "a2", fromId: "airport", toId: "sheraton", time: "10:00", status: "done", assignedDriverId: "d1", dayKey: D_PAST, date: D_PAST });
  p = G.deriveDriverPlannedPosition({ driver: d, dyn: mkDyn([r2]), setup, now: 0, dayKey: D_PAST });
  eq(p.locationId, "sheraton", "2. Position = Ziel der beendeten Fahrt");
  eq(p.sourceType, "planned_ride_end", "2. sourceType planned_ride_end");
  eq(p.confidence, "planned", "2. confidence planned");
  eq(p.availableAt, abs(D_PAST, "10:00") + 18, "2. availableAt = Start + Matrix (18)");
  // 3. geplante (nicht aktive) Fahrt in der Vergangenheit -> Position nach Ende
  const r3 = mkRide({ id: "a3", fromId: "festival", toId: "moevenpick", time: "11:00", status: "accepted", assignedDriverId: "d1", dayKey: D_PAST, date: D_PAST });
  p = G.deriveDriverPlannedPosition({ driver: d, dyn: mkDyn([r3]), setup, now: 0, dayKey: D_PAST });
  eq(p.locationId, "moevenpick", "3. Position nach geplantem Ende");
  // 4. aktive Fahrt (onboard) -> Kennzeichnung active
  const r4 = mkRide({ id: "a4", fromId: "festival", toId: "sheraton", time: "20:00", status: "onboard", assignedDriverId: "d1", dayKey: D_FUT });
  p = G.deriveDriverPlannedPosition({ driver: d, dyn: mkDyn([r4]), setup, now: 0, dayKey: D_FUT });
  eq(p.confidence, "active", "4. aktive Fahrt -> confidence active");
  eq(p.sourceType, "active_ride_end", "4. sourceType active_ride_end");
  eq(p.locationId, "sheraton", "4. Position = Ziel der aktiven Fahrt");
  // 5. stornierte Fahrt beeinflusst Position nicht
  const r5 = mkRide({ id: "a5", fromId: "airport", toId: "festival", time: "10:00", status: "cancelled", assignedDriverId: "d1", dayKey: D_PAST, date: D_PAST });
  p = G.deriveDriverPlannedPosition({ driver: d, dyn: mkDyn([r5]), setup, now: 0, dayKey: D_PAST });
  eq(p.confidence, "unknown", "5. nur stornierte Fahrt -> Position unbekannt");
  // 6. spaeteste relevante Fahrt gewinnt
  const r6a = mkRide({ id: "b1", fromId: "airport", toId: "moevenpick", time: "10:00", status: "done", assignedDriverId: "d1", dayKey: D_PAST, date: D_PAST });
  const r6b = mkRide({ id: "b2", fromId: "moevenpick", toId: "sheraton", time: "14:00", status: "done", assignedDriverId: "d1", dayKey: D_PAST, date: D_PAST });
  p = G.deriveDriverPlannedPosition({ driver: d, dyn: mkDyn([r6a, r6b]), setup, now: 0, dayKey: D_PAST });
  eq(p.locationId, "sheraton", "6. spaeteste Fahrt (14:00) bestimmt Position");
  // 7. Tie-Break ueber Ride-ID bei gleicher Zeit
  const r7a = mkRide({ id: "z9", fromId: "airport", toId: "moevenpick", time: "12:00", status: "done", assignedDriverId: "d1", dayKey: D_PAST, date: D_PAST });
  const r7b = mkRide({ id: "z1", fromId: "airport", toId: "sheraton", time: "12:00", status: "done", assignedDriverId: "d1", dayKey: D_PAST, date: D_PAST });
  const p7 = G.deriveDriverPlannedPosition({ driver: d, dyn: mkDyn([r7a, r7b]), setup, now: 0, dayKey: D_PAST });
  const p7b = G.deriveDriverPlannedPosition({ driver: d, dyn: mkDyn([r7b, r7a]), setup, now: 0, dayKey: D_PAST });
  eq(p7.sourceRideId, p7b.sourceRideId, "7. Tie-Break stabil unabhaengig von Eingabereihenfolge");
  eq(p7.sourceRideId, "z9", "7. hoechste id gewinnt bei gleicher Zeit");
  // 8. keine Live-Position behauptet
  ok(["unknown", "active_ride_end", "planned_ride_end"].includes(p.sourceType), "8. sourceType nur planbasiert (keine gps/live)");
}

// =========================================================================
// 2. Fahrtende (repositionRideEndAbs)
// =========================================================================
{
  const setup = mkSetup();
  // 9. Ende = Start + Matrix
  const r = mkRide({ fromId: "festival", toId: "sheraton", time: "20:00", estDurationMin: 38 });
  let e = G.repositionRideEndAbs(r, setup);
  eq(e.abs, abs(D_FUT, "20:00") + 38, "9. Fahrtende = Start + Matrixzeit");
  eq(e.reliable, true, "9. reliable true bei bekannter Kante");
  // 10. fehlende Kante -> nicht bewertbar
  const r10 = mkRide({ fromId: "moevenpick", toId: "airport_muc_unknown_place", toCustom: "München Flughafen", time: "20:00" });
  // toId muc-Custom ohne Kante moevenpick|muc:
  const r10b = mkRide({ fromId: "moevenpick", toId: "muc", time: "20:00", estDurationMin: 999 });
  e = G.repositionRideEndAbs(r10b, setup);
  eq(e.reliable, false, "10. fehlende Kante (moevenpick|muc) -> reliable false");
  eq(e.abs, null, "10. fehlende Kante -> abs null (nie 0)");
  // 11. Kante nie 0
  ok(G.travelMin(M, "airport", "festival") === 30, "11. bekannte Kante > 0 (30)");
  // 12. estDurationMin NICHT verbindliche Quelle
  const r12 = mkRide({ fromId: "festival", toId: "sheraton", time: "20:00", estDurationMin: 999 });
  e = G.repositionRideEndAbs(r12, setup);
  eq(e.abs, abs(D_FUT, "20:00") + 38, "12. estDurationMin=999 ignoriert, Matrix 38 verwendet");
  // 14. Richtung/Knoten korrekt (toNode = Ziel)
  eq(e.node, "sheraton", "14. Endknoten = operatives Ziel");
}

// =========================================================================
// 3. Naechste Fahrt (repositionNextAssignedRide)
// =========================================================================
{
  const setup = mkSetup();
  const d = mkDriver("d1");
  const availAbs = abs(D_FUT, "20:38");
  // 15. naechste zugewiesene Fahrt korrekt
  const n1 = mkRide({ id: "n1", fromId: "airport", toId: "festival", time: "21:20", status: "accepted", assignedDriverId: "d1" });
  let nx = G.repositionNextAssignedRide({ driver: d, dyn: mkDyn([n1]), setup, dayKey: D_FUT, availableAt: availAbs });
  eq(nx && nx.id, "n1", "15. naechste zugewiesene Fahrt gefunden");
  // 16. stornierte uebersprungen
  const c1 = mkRide({ id: "c1", fromId: "airport", toId: "festival", time: "21:00", status: "cancelled", assignedDriverId: "d1" });
  nx = G.repositionNextAssignedRide({ driver: d, dyn: mkDyn([c1, n1]), setup, dayKey: D_FUT, availableAt: availAbs });
  eq(nx && nx.id, "n1", "16. stornierte Fahrt uebersprungen");
  // 17. abgeschlossene uebersprungen
  const dn = mkRide({ id: "dn", fromId: "airport", toId: "festival", time: "21:00", status: "done", assignedDriverId: "d1" });
  nx = G.repositionNextAssignedRide({ driver: d, dyn: mkDyn([dn, n1]), setup, dayKey: D_FUT, availableAt: availAbs });
  eq(nx && nx.id, "n1", "17. abgeschlossene Fahrt uebersprungen");
  // 18. Fahrt vor Verfuegbarkeit uebersprungen
  const before = mkRide({ id: "bf", fromId: "airport", toId: "festival", time: "20:00", status: "accepted", assignedDriverId: "d1" });
  nx = G.repositionNextAssignedRide({ driver: d, dyn: mkDyn([before, n1]), setup, dayKey: D_FUT, availableAt: availAbs });
  eq(nx && nx.id, "n1", "18. Fahrt vor availableAt uebersprungen");
  // 19. nach Mitternacht korrekt
  const mid = mkRide({ id: "mid", fromId: "airport", toId: "festival", time: "00:20", date: "2026-07-26", dayKey: D_FUT, status: "accepted", assignedDriverId: "d1" });
  nx = G.repositionNextAssignedRide({ driver: d, dyn: mkDyn([mid]), setup, dayKey: D_FUT, availableAt: abs(D_FUT, "23:50") });
  eq(nx && nx.id, "mid", "19. Fahrt nach Mitternacht korrekt gefunden");
  // 20. anderer Betriebstag ausgeschlossen
  const other = mkRide({ id: "ot", fromId: "airport", toId: "festival", time: "21:20", dayKey: "2026-07-24", date: "2026-07-24", status: "accepted", assignedDriverId: "d1" });
  nx = G.repositionNextAssignedRide({ driver: d, dyn: mkDyn([other]), setup, dayKey: D_FUT, availableAt: availAbs });
  eq(nx, null, "20. anderer Betriebstag -> keine naechste Fahrt");
  // 21. identische Zeiten stabil (kleinste id zuerst)
  const t1 = mkRide({ id: "y9", fromId: "airport", toId: "festival", time: "21:20", status: "accepted", assignedDriverId: "d1" });
  const t2 = mkRide({ id: "y1", fromId: "sheraton", toId: "festival", time: "21:20", status: "accepted", assignedDriverId: "d1" });
  const nA = G.repositionNextAssignedRide({ driver: d, dyn: mkDyn([t1, t2]), setup, dayKey: D_FUT, availableAt: availAbs });
  const nB = G.repositionNextAssignedRide({ driver: d, dyn: mkDyn([t2, t1]), setup, dayKey: D_FUT, availableAt: availAbs });
  eq(nA.id, nB.id, "21. gleiche Zeit -> stabile Auswahl");
  eq(nA.id, "y1", "21. kleinste id gewinnt bei gleicher Zeit");
}

// =========================================================================
// 4. Direkte Leerfahrt + Keine Bewegung (evaluateDriverRepositionSuggestion)
// =========================================================================
// Position aus aktiver Fahrt (onboard) festival->sheraton, frei 20:38.
const mkDirectScenario = (nextTime, nextFrom = "airport", seats = 6, pax = 2) => {
  const setup = mkSetup();
  const d = mkDriver("d1", seats);
  const r1 = mkRide({ id: "r1", fromId: "festival", toId: "sheraton", time: "20:00", estDurationMin: 38, status: "onboard", assignedDriverId: "d1" });
  const r2 = mkRide({ id: "r2", fromId: nextFrom, toId: "festival", time: nextTime, status: "accepted", assignedDriverId: "d1", passengerCount: pax });
  const dyn = mkDyn([r1, r2]);
  return G.evaluateDriverRepositionSuggestion({ driver: d, dyn, setup, now: 0, dayKey: D_FUT, returnRideViewModels: [], waitRideSuggestions: [], groupRideSuggestions: [], driverPlannedPositions: [] });
};
{
  // 22./30. unterschiedliche Orte -> direct_to_next_pickup
  let s = mkDirectScenario("21:20");   // Puffer 24
  eq(s.status, "direct_to_next_pickup", "22./30. unterschiedliche Orte -> direct_to_next_pickup");
  eq(s.severity, "info", "22. severity info");
  eq(s.toLocationId, "airport", "22. Ziel = Pickup der naechsten Fahrt");
  eq(s.bufferBeforeNextRideMin, 24, "24. Puffer korrekt (24)");
  ok(s.routeReliable, "28. Route zuverlaessig");
  ok(!s.hasConflict, "29. kein Konflikt");
  // 25. exakt 15 min Puffer -> positiv
  s = mkDirectScenario("21:11");       // 20:56 + 15
  eq(s.status, "direct_to_next_pickup", "25. exakt 15 min Puffer -> positive Empfehlung");
  eq(s.bufferBeforeNextRideMin, 15, "25. Puffer 15");
  // 26. 14 min Puffer -> keine positive Empfehlung
  s = mkDirectScenario("21:10");       // 14 min
  eq(s.status, "not_evaluable", "26. 14 min Puffer -> keine positive Empfehlung");
  ok(s.reasons.includes("buffer_below_min"), "26. Grund buffer_below_min");
  // 27. 25 min Puffer -> positiv
  s = mkDirectScenario("21:21");       // 25 min
  eq(s.status, "direct_to_next_pickup", "27. 25 min Puffer -> positiv");
  eq(s.bufferBeforeNextRideMin, 25, "27. Puffer 25");
  // 23./31. naechste Fahrt am gleichen Ort -> keine Bewegung
  const setup = mkSetup();
  const d = mkDriver("d1");
  const r1 = mkRide({ id: "r1", fromId: "festival", toId: "sheraton", time: "20:00", estDurationMin: 38, status: "onboard", assignedDriverId: "d1" });
  const r2same = mkRide({ id: "r2", fromId: "sheraton", toId: "festival", time: "22:00", status: "accepted", assignedDriverId: "d1" });
  let s2 = G.evaluateDriverRepositionSuggestion({ driver: d, dyn: mkDyn([r1, r2same]), setup, now: 0, dayKey: D_FUT, returnRideViewModels: [], waitRideSuggestions: [], groupRideSuggestions: [], driverPlannedPositions: [] });
  eq(s2.status, "stay_at_current_location", "23./31. naechste Fahrt am gleichen Ort -> keine Bewegung");
  ok(s2.reasons.includes("next_ride_same_location"), "31. Grund next_ride_same_location");
  // 35. keine naechste Fahrt + kein Bedarf -> stay
  const rOnly = mkRide({ id: "r1", fromId: "festival", toId: "sheraton", time: "20:00", estDurationMin: 38, status: "onboard", assignedDriverId: "d1" });
  let s3 = G.evaluateDriverRepositionSuggestion({ driver: d, dyn: mkDyn([rOnly]), setup, now: 0, dayKey: D_FUT, returnRideViewModels: [], waitRideSuggestions: [], groupRideSuggestions: [], driverPlannedPositions: [] });
  // Position sheraton, kein next, kein Bedarf -> stay
  eq(s3.status, "stay_at_current_location", "33./35. keine naechste Fahrt und kein Bedarf -> stay");
}

// =========================================================================
// 5. Rueckstellung Festival + Demand + Coverage + Erreichbarkeit
// =========================================================================
// Fahrer onboard X->moevenpick (Position moevenpick, 30 min zum Festival).
const mkReposScenario = (opts = {}) => {
  const setup = mkSetup();
  const d = mkDriver("d1", opts.seats || 6);
  const posRide = mkRide({ id: "pos", fromId: "festival", toId: opts.posTo || "moevenpick", time: "20:00", status: "onboard", assignedDriverId: "d1" });
  // offene Festival-Rueckfahrten (unbesetzt)
  const _pax = opts.pax !== undefined ? opts.pax : 2;
  const open1 = mkRide({ id: "o1", fromId: "festival", toId: "sheraton", time: "22:00", status: "planned", assignedDriverId: null, passengerCount: _pax });
  const open2 = mkRide({ id: "o2", fromId: "festival", toId: "moevenpick", time: "22:10", status: "planned", assignedDriverId: null, passengerCount: _pax });
  const rides = [posRide, open1, open2];
  const dyn = mkDyn(rides);
  const vms = [mkVM(open1, opts.g1 || "driver_missing", opts.m1 != null ? opts.m1 : 30, false),
               mkVM(open2, opts.g2 || "driver_missing", opts.m2 != null ? opts.m2 : 40, false)];
  return G.evaluateDriverRepositionSuggestion({
    driver: d, dyn, setup, now: 0, dayKey: D_FUT,
    returnRideViewModels: opts.vms || vms, waitRideSuggestions: opts.wait || [], groupRideSuggestions: opts.groups || [],
    driverPlannedPositions: opts.dpp || [],
  });
};
{
  // 36./43. Fahrer am Hotel, Bedarf am Festival -> reposition_to_festival
  let s = mkReposScenario();
  eq(s.status, "reposition_to_festival", "36./43. Hotel + Festival-Bedarf -> reposition_to_festival");
  eq(s.severity, "attention", "36. severity attention (starke Empfehlung)");
  eq(s.toLocationId, "festival", "36. Ziel Festival");
  eq(s.travelMinutes, 30, "37. Fahrzeit 30 (<35)");
  ok(s.demandScore >= 2, "40. Demand Score >= 2");
  ok(s.demandRideIds.length >= 1, "41. mindestens eine Bedarfsfahrt");
  eq(s.nextRideId, null, "42. keine konkrete naechste Fahrt");
  // 38. exakt 35 min -> noch bewertbar (posTo sheraton = 38 > 35, also airport 30; nutze eigene Kante)
  //     Test 35-Grenze ueber kuenstliche Position mit 35er Kante: nutze sheraton(38) -> weak; airport(30) -> strong.
  //     Grenzfall 36 vs 35 direkt: posTo sheraton -> 38 (>35) -> weak.
  let sFar = mkReposScenario({ posTo: "sheraton" }); // 38 > 35
  eq(sFar.status, "reposition_to_festival", "39. weite Rueckstellung bleibt reposition_to_festival");
  eq(sFar.severity, "neutral", "39. 38 min (>35) -> nur neutral/pruefbar (keine starke Empfehlung)");
  ok(sFar.warnings.includes("travel_over_max"), "39. Warnung travel_over_max");
  // 33/16. kein ausreichender Bedarf -> stay
  let sNo = mkReposScenario({ g1: "due_soon", g2: "completed", m1: 30 }); // nur due_soon=1 < 2
  eq(sNo.status, "stay_at_current_location", "16. Demand < 2 -> keine Rueckstellung, stay");
  ok(sNo.reasons.includes("no_sufficient_demand"), "16. Grund no_sufficient_demand");
  // 32. bereits am Festival mit Bedarf -> stay
  let sAt = mkReposScenario({ posTo: "festival" });
  eq(sAt.status, "stay_at_current_location", "32. bereits am Festival -> keine Bewegung");
  ok(sAt.reasons.includes("already_at_festival"), "32. Grund already_at_festival");
}

// Demand Score (repositionDemandScore) --------------------------------------
{
  const setup = mkSetup();
  const rO = mkRide({ id: "dO", fromId: "festival", toId: "sheraton", time: "22:00" });
  const rM = mkRide({ id: "dM", fromId: "festival", toId: "sheraton", time: "22:00" });
  const rS = mkRide({ id: "dS", fromId: "festival", toId: "sheraton", time: "22:00" });
  // 50. overdue +3
  eq(G.repositionDemandScore({ node: "festival", returnRideViewModels: [mkVM(rO, "overdue", -5)], setup }).score, 3, "50. overdue -> +3");
  // 51. driver_missing +2
  eq(G.repositionDemandScore({ node: "festival", returnRideViewModels: [mkVM(rM, "driver_missing", 20)], setup }).score, 2, "51. driver_missing -> +2");
  // 52. due_soon +1
  eq(G.repositionDemandScore({ node: "festival", returnRideViewModels: [mkVM(rS, "due_soon", 60)], setup }).score, 1, "52. due_soon -> +1");
  // 53./100. completed zaehlt nicht
  eq(G.repositionDemandScore({ node: "festival", returnRideViewModels: [mkVM(rO, "completed", 10)], setup }).score, 0, "53./100. completed -> 0");
  // 54./101. cancelled zaehlt nicht
  eq(G.repositionDemandScore({ node: "festival", returnRideViewModels: [mkVM(rO, "cancelled", 10)], setup }).score, 0, "54./101. cancelled -> 0");
  // 55./102. in_progress zaehlt nicht
  eq(G.repositionDemandScore({ node: "festival", returnRideViewModels: [mkVM(rO, "in_progress", 10)], setup }).score, 0, "55./102. in_progress -> 0");
  // 56. bereits zugeteilt zaehlt nicht
  eq(G.repositionDemandScore({ node: "festival", returnRideViewModels: [mkVM(rM, "driver_missing", 20, true)], setup }).score, 0, "56. driverAssigned -> nicht gezaehlt");
  // 57. mehrere passende +1 Bonus
  const multi = G.repositionDemandScore({ node: "festival", returnRideViewModels: [mkVM(rO, "overdue", -5), mkVM(rM, "driver_missing", 20)], setup });
  eq(multi.score, 3 + 2 + 1, "57. mehrere passende -> +1 Bonus (6)");
  eq(multi.count, 2, "57. count 2");
  // 103. return_before_set_end (needs_review) erzeugt keinen sicheren Bedarf
  eq(G.repositionDemandScore({ node: "festival", returnRideViewModels: [mkVM(rO, "needs_review", 20)], setup }).score, 0, "103. needs_review -> kein Bedarf");
  // 59. deterministisch
  const a = G.repositionDemandScore({ node: "festival", returnRideViewModels: [mkVM(rO, "overdue", -5)], setup });
  const b = G.repositionDemandScore({ node: "festival", returnRideViewModels: [mkVM(rO, "overdue", -5)], setup });
  eq(a, b, "59. Demand Score deterministisch");
  // Lookahead-Grenze: >90 zaehlt nicht
  eq(G.repositionDemandScore({ node: "festival", returnRideViewModels: [mkVM(rM, "driver_missing", 91)], setup }).score, 0, "52b. ausserhalb Lookahead (91) -> 0");
  // Knoten-Filter: Bedarf an anderem Knoten zaehlt nicht fuer festival
  const rHotel = mkRide({ id: "dH", fromId: "sheraton", toId: "airport", time: "22:00" });
  eq(G.repositionDemandScore({ node: "festival", returnRideViewModels: [mkVM(rHotel, "driver_missing", 20)], setup }).score, 0, "Knoten-Filter: Nicht-Festival-Bedarf zaehlt nicht");
}

// Bereits vorhandene Fahrer (Coverage, Spec 30) -----------------------------
{
  const dpp = (n) => Array.from({ length: n }, (_, i) => ({ driverId: "f" + i, locationNode: "festival", availableAt: 1000, confidence: "planned" }));
  // 60. Bedarf 2, 0 freie -> stark
  let s = mkReposScenario({ dpp: [] });
  eq(s.severity, "attention", "60. Bedarf ohne Deckung -> starke Empfehlung");
  // 61. Bedarf 2, 1 freier -> weiter stark (Deckung < Bedarf)
  s = mkReposScenario({ dpp: dpp(1) });
  eq(s.severity, "attention", "61. Deckung(1) < Bedarf(2) -> weiter stark");
  // 62./63. Deckung >= Bedarf -> schwach (keine Ueberbewertung)
  s = mkReposScenario({ dpp: dpp(2) });
  eq(s.severity, "neutral", "62./63. Deckung(2) >= Bedarf(2) -> nur pruefbar");
  ok(s.warnings.includes("sufficient_coverage"), "62. Warnung sufficient_coverage");
  // 64. geplante Position statt Live: eigener Fahrer wird nicht mitgezaehlt
  const cov = G.repositionFreeDriverCoverage({ node: "festival", driverPlannedPositions: [{ driverId: "d1", locationNode: "festival", availableAt: 1, confidence: "planned" }, ...dpp(2)], excludeDriverId: "d1" });
  eq(cov, 2, "64. eigener Fahrer ausgeschlossen, nur andere gezaehlt");
  // unknown/kein availableAt zaehlt nicht als Deckung
  const cov2 = G.repositionFreeDriverCoverage({ node: "festival", driverPlannedPositions: [{ driverId: "x", locationNode: "festival", availableAt: null, confidence: "unknown" }], excludeDriverId: "d1" });
  eq(cov2, 0, "Coverage: unbekannte Position zaehlt nicht");
}

// Erreichbare Fahrt (repositionReachableOpenRides, Spec 31/32) ---------------
{
  // 67. Sitzplaetze ausreichend -> erreichbar; 68. nicht ausreichend -> stay
  let s = mkReposScenario({ seats: 6, pax: 2 });
  eq(s.status, "reposition_to_festival", "67. genug Sitze -> Bedarfsfahrt erreichbar, reposition");
  let s2 = mkReposScenario({ seats: 1, pax: 4 });   // Fahrer 1 Sitz < 4
  eq(s2.status, "stay_at_current_location", "68. zu wenig Sitze -> keine erreichbare Fahrt -> stay");
  ok(s2.reasons.includes("no_reachable_open_ride"), "68. Grund no_reachable_open_ride");
  // 69. Personenzahl unbekannt -> nicht erreichbar zurechenbar
  let s3 = mkReposScenario({ seats: 6, pax: null });
  eq(s3.status, "stay_at_current_location", "69. Personenzahl unbekannt -> Bedarf nicht sicher erreichbar");
  // direkte Pruefung reachable-IDs
  const setup = mkSetup();
  const d = mkDriver("d1", 6);
  const open = mkRide({ id: "ok1", fromId: "festival", toId: "sheraton", time: "23:00", status: "planned", assignedDriverId: null, passengerCount: 2 });
  const posR = mkRide({ id: "p", fromId: "festival", toId: "moevenpick", time: "20:00", status: "onboard", assignedDriverId: "d1" });
  const reach = G.repositionReachableOpenRides({ driver: d, demandRideIds: ["ok1"], dyn: mkDyn([posR, open]), setup });
  eq(reach, ["ok1"], "73. evaluateInsertion-Wiederverwendung: erreichbare Fahrt gelistet");
}

// =========================================================================
// 6. Konflikte
// =========================================================================
{
  const setup = mkSetup();
  const d = mkDriver("d1", 6);
  // 74. Ueberschneidende Folgefahrt blockiert direkte Leerfahrt
  const r1 = mkRide({ id: "r1", fromId: "festival", toId: "sheraton", time: "20:00", estDurationMin: 38, status: "onboard", assignedDriverId: "d1" });
  const conflictNext = mkRide({ id: "r2", fromId: "airport", toId: "festival", time: "20:10", status: "accepted", assignedDriverId: "d1" }); // startet waehrend r1 laeuft
  let s = G.evaluateDriverRepositionSuggestion({ driver: d, dyn: mkDyn([r1, conflictNext]), setup, now: 0, dayKey: D_FUT, returnRideViewModels: [], waitRideSuggestions: [], groupRideSuggestions: [], driverPlannedPositions: [] });
  ok(s.status !== "direct_to_next_pickup", "74./78. Konflikt/zu knapp -> keine positive Leerfahrt");
  // 80. kein Konflikt -> positiv
  s = mkDirectScenario("21:20");
  eq(s.hasConflict, false, "80. kein Konflikt");
  eq(s.status, "direct_to_next_pickup", "80. ohne Konflikt -> positive Leerfahrt");
}

// =========================================================================
// 7. Leonardo / HBF / Sheraton (Spec 20)
// =========================================================================
{
  const setup = mkSetup();
  const d = mkDriver("d1", 6);
  // 81. Leonardo -> Festival: operativer Pickup Sheraton. Fahrer steht am Sheraton -> gleicher Knoten -> stay.
  const posSheraton = mkRide({ id: "p", fromId: "festival", toId: "sheraton", time: "20:00", estDurationMin: 38, status: "onboard", assignedDriverId: "d1" });
  const leoNext = mkRide({ id: "leo", fromId: "leonardo", toId: "festival", time: "22:00", status: "accepted", assignedDriverId: "d1" });
  let s = G.evaluateDriverRepositionSuggestion({ driver: d, dyn: mkDyn([posSheraton, leoNext]), setup, now: 0, dayKey: D_FUT, returnRideViewModels: [], waitRideSuggestions: [], groupRideSuggestions: [], driverPlannedPositions: [] });
  eq(s.status, "stay_at_current_location", "81. Leonardo->Festival nutzt operativen Pickup Sheraton (= Position) -> stay");
  ok(s.reasons.includes("next_ride_same_location"), "81. gleicher operativer Knoten erkannt");
  // 82. HBF -> Festival ebenso Sheraton
  const hbfNext = mkRide({ id: "hbf", fromId: "hbf_nue", toId: "festival", time: "22:00", status: "accepted", assignedDriverId: "d1" });
  s = G.evaluateDriverRepositionSuggestion({ driver: d, dyn: mkDyn([posSheraton, hbfNext]), setup, now: 0, dayKey: D_FUT, returnRideViewModels: [], waitRideSuggestions: [], groupRideSuggestions: [], driverPlannedPositions: [] });
  eq(s.status, "stay_at_current_location", "82. HBF->Festival nutzt operativen Pickup Sheraton -> stay");
  // 83. Leerfahrt zum operativen Pickup: Fahrer am Flughafen, naechste Leonardo->Festival -> Ziel Sheraton-Pickup
  const posAir = mkRide({ id: "pa", fromId: "festival", toId: "airport", time: "20:00", estDurationMin: 30, status: "onboard", assignedDriverId: "d1" });
  const leoNext2 = mkRide({ id: "leo2", fromId: "leonardo", toId: "festival", time: "22:00", status: "accepted", assignedDriverId: "d1" });
  s = G.evaluateDriverRepositionSuggestion({ driver: d, dyn: mkDyn([posAir, leoNext2]), setup, now: 0, dayKey: D_FUT, returnRideViewModels: [], waitRideSuggestions: [], groupRideSuggestions: [], driverPlannedPositions: [] });
  eq(s.status, "direct_to_next_pickup", "83. Leerfahrt zum operativen Pickup (Leonardo->Sheraton)");
  eq(s.travelMinutes, 18, "83. Fahrzeit Flughafen->Sheraton (operativer Pickup) = 18");
  // 84. Festival -> Leonardo endet am Leonardo (Anzeige-Ziel, nicht Sheraton)
  const posLeo = mkRide({ id: "pl", fromId: "festival", toId: "leonardo", time: "20:00", status: "onboard", assignedDriverId: "d1" });
  let p = G.deriveDriverPlannedPosition({ driver: d, dyn: mkDyn([posLeo]), setup, now: 0, dayKey: D_FUT });
  eq(p.locationId, "leonardo", "84. Festival->Leonardo: geplante Endposition Leonardo (Anzeige)");
  eq(p.locationNode, "sheraton", "84. Matrix-Knoten Leonardo == sheraton (Fahrzeit), Anzeige bleibt Leonardo");
  // 85. Festival -> HBF endet am HBF
  const posHbf = mkRide({ id: "ph", fromId: "festival", toId: "hbf_nue", time: "20:00", status: "onboard", assignedDriverId: "d1" });
  p = G.deriveDriverPlannedPosition({ driver: d, dyn: mkDyn([posHbf]), setup, now: 0, dayKey: D_FUT });
  eq(p.locationId, "hbf_nue", "85. Festival->HBF: geplante Endposition HBF");
  // 86./87. kein automatischer Rueckweg zum Sheraton, Sheraton nicht als Basis
  //   Fahrer endet am Leonardo, kein next, kein Festival-Bedarf -> stay, kein Ziel Sheraton.
  let sLeo = G.evaluateDriverRepositionSuggestion({ driver: d, dyn: mkDyn([posLeo]), setup, now: 0, dayKey: D_FUT, returnRideViewModels: [], waitRideSuggestions: [], groupRideSuggestions: [], driverPlannedPositions: [] });
  ok(sLeo.status === "stay_at_current_location" || sLeo.status === "not_evaluable", "86. kein automatischer Rueckweg zum Sheraton");
  ok(sLeo.toLocationId !== "sheraton", "86. Ziel nicht Sheraton");
  // 87. Fahrer ohne Fahrt -> unbekannt (nicht 'am Sheraton'), obwohl baseLocationId=sheraton
  let pNo = G.deriveDriverPlannedPosition({ driver: d, dyn: mkDyn([]), setup, now: 0, dayKey: D_FUT });
  eq(pNo.confidence, "unknown", "87. Sheraton nicht als Basis (Fahrer ohne Fahrt = unbekannt)");
}

// =========================================================================
// 8. Teilpaket E (Vorrang)
// =========================================================================
{
  // 88./90. wait_recommended -> G tritt zurueck (stay), keine widerspruechliche Empfehlung
  let s = mkReposScenario({ wait: [{ driverId: "d1", status: "wait_recommended", hasRideConflict: false }] });
  eq(s.status, "stay_at_current_location", "88./90. wait_recommended -> G weicht (stay)");
  ok(s.reasons.includes("e_wait_recommended_priority"), "88. Grund e_wait_recommended_priority");
  ok(s.status !== "reposition_to_festival", "90. keine Rueckstellung entgegen E");
  // 89. wait_possible -> unterdrueckt G NICHT
  let s2 = mkReposScenario({ wait: [{ driverId: "d1", status: "wait_possible", hasRideConflict: false }] });
  eq(s2.status, "reposition_to_festival", "89. wait_possible -> G-Vorschlag bleibt sichtbar");
  // wait_recommended MIT Konflikt greift nicht als Vorrang
  let s3 = mkReposScenario({ wait: [{ driverId: "d1", status: "wait_recommended", hasRideConflict: true }] });
  eq(s3.status, "reposition_to_festival", "88b. wait_recommended mit Konflikt -> kein Vorrang");
  // 91./92. E fuer ANDEREN Fahrer beeinflusst diesen nicht (E-Ergebnis nur konsumiert)
  let s4 = mkReposScenario({ wait: [{ driverId: "andererFahrer", status: "wait_recommended", hasRideConflict: false }] });
  eq(s4.status, "reposition_to_festival", "91./92. E fuer anderen Fahrer -> kein Einfluss");
}

// =========================================================================
// 9. Teilpaket F (kein Umsetzen, nur Hinweis)
// =========================================================================
{
  // 95. optionaler F-Hinweis neutral
  const setup = mkSetup();
  const d = mkDriver("d1", 6);
  const posRide = mkRide({ id: "pos", fromId: "festival", toId: "moevenpick", time: "20:00", status: "onboard", assignedDriverId: "d1" });
  const open1 = mkRide({ id: "o1", fromId: "festival", toId: "sheraton", time: "22:00", status: "planned", assignedDriverId: null, passengerCount: 2 });
  const open2 = mkRide({ id: "o2", fromId: "festival", toId: "moevenpick", time: "22:10", status: "planned", assignedDriverId: null, passengerCount: 2 });
  const vms = [mkVM(open1, "driver_missing", 30), mkVM(open2, "driver_missing", 40)];
  const groups = [{ status: "group_recommended", rideIds: ["o1", "o2"] }];
  const groupsFrozen = JSON.parse(JSON.stringify(groups));
  let s = G.evaluateDriverRepositionSuggestion({ driver: d, dyn: mkDyn([posRide, open1, open2]), setup, now: 0, dayKey: D_FUT, returnRideViewModels: vms, waitRideSuggestions: [], groupRideSuggestions: groups, driverPlannedPositions: [] });
  eq(s.status, "reposition_to_festival", "93./94. F-Vorschlag aendert Position/Status nicht");
  ok(s.warnings.includes("group_suggestion_exists"), "95. neutraler F-Hinweis vorhanden");
  // 96. F-Ergebnis nicht mutiert
  eq(groups, groupsFrozen, "96. groupRideSuggestions unveraendert");
  // ohne actionable F-Status -> kein Hinweis
  let s2 = G.evaluateDriverRepositionSuggestion({ driver: d, dyn: mkDyn([posRide, open1, open2]), setup, now: 0, dayKey: D_FUT, returnRideViewModels: vms, waitRideSuggestions: [], groupRideSuggestions: [{ status: "group_not_recommended", rideIds: ["o1", "o2"] }], driverPlannedPositions: [] });
  ok(!s2.warnings.includes("group_suggestion_exists"), "95b. nicht-actionabler F-Status -> kein Hinweis");
}

// =========================================================================
// 10. Teilpaket D (Bedarfsstaerke)
// =========================================================================
{
  const setup = mkSetup();
  const r = mkRide({ id: "d", fromId: "festival", toId: "sheraton", time: "22:00" });
  // 97. overdue hoch, 98. driver_missing, 99. due_soon schwaecher
  const so = G.repositionDemandScore({ node: "festival", returnRideViewModels: [mkVM(r, "overdue", -5)], setup }).score;
  const sm = G.repositionDemandScore({ node: "festival", returnRideViewModels: [mkVM(r, "driver_missing", 20)], setup }).score;
  const sd = G.repositionDemandScore({ node: "festival", returnRideViewModels: [mkVM(r, "due_soon", 60)], setup }).score;
  ok(so > sm && sm > sd, "97./98./99. overdue > driver_missing > due_soon");
}

// =========================================================================
// 11. Mitternacht
// =========================================================================
{
  const setup = mkSetup();
  const d = mkDriver("d1", 6);
  // 110./111./112. Fahrer onboard bis 23:50, naechste 00:20 -> Puffer korrekt
  const r1 = mkRide({ id: "r1", fromId: "airport", toId: "sheraton", time: "23:32", estDurationMin: 18, status: "onboard", assignedDriverId: "d1", dayKey: D_FUT }); // endet 23:50
  const r2 = mkRide({ id: "r2", fromId: "airport", toId: "festival", time: "00:20", date: "2026-07-26", dayKey: D_FUT, status: "accepted", assignedDriverId: "d1" });
  let s = G.evaluateDriverRepositionSuggestion({ driver: d, dyn: mkDyn([r1, r2]), setup, now: 0, dayKey: D_FUT, returnRideViewModels: [], waitRideSuggestions: [], groupRideSuggestions: [], driverPlannedPositions: [] });
  // Position sheraton frei 23:50, Ziel airport (18), Ankunft 00:08, naechste 00:20 -> Puffer 12 (<15) -> not_evaluable
  eq(s.bufferBeforeNextRideMin, 12, "110./112. Puffer ueber Mitternacht korrekt (12)");
  eq(s.status, "not_evaluable", "111. 12 min Puffer -> keine positive Empfehlung");
  // 115./116. 02:00 gehoert zum vorherigen Betriebstag: availableAt-Abs korrekt sortiert
  eq(abs("2026-07-26", "02:00") > abs("2026-07-25", "23:00"), true, "115. 02:00 (Folgetag) liegt nach 23:00 (Vortag) in Absolutminuten");
}

// =========================================================================
// 12. Nicht bewertbar
// =========================================================================
{
  const setup = mkSetup();
  const d = mkDriver("d1", 6);
  // 118. Position unbekannt -> not_evaluable
  let s = G.evaluateDriverRepositionSuggestion({ driver: d, dyn: mkDyn([]), setup, now: 0, dayKey: D_FUT, returnRideViewModels: [], waitRideSuggestions: [], groupRideSuggestions: [], driverPlannedPositions: [] });
  eq(s.status, "not_evaluable", "118. Position unbekannt -> not_evaluable");
  // 121. Matrixkante fehlt (Position ok, naechste Fahrt ohne Kante) -> not_evaluable
  //   Fahrer onboard nach muc (Position muc), naechste muc->moevenpick (Kante fehlt).
  const posMuc = mkRide({ id: "pm", fromId: "festival", toId: "muc", time: "18:00", estDurationMin: 105, status: "onboard", assignedDriverId: "d1" });
  const nextNoEdge = mkRide({ id: "ne", fromId: "moevenpick", toId: "sheraton", time: "23:00", status: "accepted", assignedDriverId: "d1" });
  // Fahrzeit muc->moevenpick fehlt -> empty_route_unknown
  s = G.evaluateDriverRepositionSuggestion({ driver: d, dyn: mkDyn([posMuc, nextNoEdge]), setup, now: 0, dayKey: D_FUT, returnRideViewModels: [], waitRideSuggestions: [], groupRideSuggestions: [], driverPlannedPositions: [] });
  eq(s.status, "not_evaluable", "121. fehlende Matrixkante zur naechsten Fahrt -> not_evaluable");
  ok(s.reasons.includes("empty_route_unknown"), "121. Grund empty_route_unknown");
  eq(s.routeReliable, false, "121. routeReliable false");
  // 125. not_evaluable traegt Gruende
  ok(s.reasons.length > 0, "125. not_evaluable mit Gruenden");
}

// =========================================================================
// 13. Ranking (buildRepositionSuggestions)
// =========================================================================
{
  const setup = mkSetup();
  // Fahrer A: direkte Leerfahrt; Fahrer B: reposition_to_festival
  const dA = mkDriver("dA", 6), dB = mkDriver("dB", 6);
  const aPos = mkRide({ id: "aPos", fromId: "festival", toId: "sheraton", time: "20:00", estDurationMin: 38, status: "onboard", assignedDriverId: "dA" });
  const aNext = mkRide({ id: "aNext", fromId: "airport", toId: "festival", time: "21:20", status: "accepted", assignedDriverId: "dA" });
  const bPos = mkRide({ id: "bPos", fromId: "festival", toId: "moevenpick", time: "20:00", status: "onboard", assignedDriverId: "dB" });
  const open1 = mkRide({ id: "o1", fromId: "festival", toId: "sheraton", time: "22:00", status: "planned", assignedDriverId: null, passengerCount: 2 });
  const open2 = mkRide({ id: "o2", fromId: "festival", toId: "moevenpick", time: "22:10", status: "planned", assignedDriverId: null, passengerCount: 2 });
  const dyn = mkDyn([aPos, aNext, bPos, open1, open2]);
  const vms = [mkVM(open1, "driver_missing", 30), mkVM(open2, "driver_missing", 40)];
  const res = G.buildRepositionSuggestions({ drivers: [dB, dA], dyn, setup, now: 0, dayKey: D_FUT, returnRideViewModels: vms, waitRideSuggestions: [], groupRideSuggestions: [] });
  // 126./127. direct vor reposition
  eq(res.ranked[0].driverId, "dA", "126./127. direkte Leerfahrt vor Rueckstellung");
  eq(res.ranked[0].status, "direct_to_next_pickup", "126. erster Vorschlag ist direct");
  eq(res.ranked[1].status, "reposition_to_festival", "126. zweiter ist reposition");
  // 132. genau ein Vorschlag je Fahrer
  eq(Object.keys(res.byDriver).length, 2, "132. genau ein Vorschlag je Fahrer");
  eq(res.counts.direct_to_next_pickup, 1, "132. Zaehler direct=1");
  eq(res.counts.reposition_to_festival, 1, "132. Zaehler reposition=1");
  // 129. hoeherer Demand zuerst innerhalb reposition (zwei reposition-Fahrer)
  const cmp = G.repositionCompare(
    { status: "reposition_to_festival", sortScore: 1000 - 50 + 0.3, demandScore: 5, travelMinutes: 30, driverId: "x" },
    { status: "reposition_to_festival", sortScore: 1000 - 20 + 0.3, demandScore: 2, travelMinutes: 30, driverId: "y" });
  ok(cmp < 0, "129. hoeherer Demand Score zuerst");
  // 131. stabiler Fahrer-Identifier
  const cmp2 = G.repositionCompare(
    { status: "stay_at_current_location", sortScore: 3000, demandScore: 0, travelMinutes: null, driverId: "a" },
    { status: "stay_at_current_location", sortScore: 3000, demandScore: 0, travelMinutes: null, driverId: "b" });
  ok(cmp2 < 0, "131. stabiler Tie-Break ueber driverId");
}

// =========================================================================
// 14. Read-only
// =========================================================================
{
  const setup = mkSetup();
  const d = mkDriver("d1", 6);
  const posRide = mkRide({ id: "pos", fromId: "festival", toId: "moevenpick", time: "20:00", status: "onboard", assignedDriverId: "d1" });
  const open1 = mkRide({ id: "o1", fromId: "festival", toId: "sheraton", time: "22:00", status: "planned", assignedDriverId: null, passengerCount: 2 });
  const rides = [posRide, open1];
  const dyn = mkDyn(rides);
  const vms = [mkVM(open1, "driver_missing", 30)];
  // Tiefes Einfrieren aller Eingaben -> jede Mutation wirft (ESM strict mode).
  const deepFreeze = (o) => { if (o && typeof o === "object") { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };
  deepFreeze(setup); deepFreeze(dyn); deepFreeze(vms); deepFreeze(d);
  let threw = false;
  try {
    G.buildRepositionSuggestions({ drivers: [d], dyn, setup, now: 0, dayKey: D_FUT, returnRideViewModels: vms, waitRideSuggestions: [], groupRideSuggestions: [] });
  } catch (e) { threw = true; }
  ok(!threw, "133.-138. keine Mutation eingefrorener Eingaben (Fahrer/Ride/Setup/D)");
  // 139. Sortierung mutiert Eingabe nicht
  const list = [{ status: "not_evaluable", sortScore: 4000, demandScore: 0, driverId: "b" }, { status: "direct_to_next_pickup", sortScore: 0, demandScore: 0, driverId: "a" }];
  const before = JSON.stringify(list);
  const ranked = G.rankRepositionSuggestions(list);
  eq(JSON.stringify(list), before, "139. rankRepositionSuggestions mutiert Eingabe nicht");
  ok(ranked[0].status === "direct_to_next_pickup", "139. Kopie korrekt sortiert");
  // 140.-143. keine Schreibwege im G-Quelltext
  const fs = await import("node:fs");
  const src = fs.readFileSync("tmp-tg-funcs.mjs", "utf8");
  const gStart = src.indexOf("REPOSITION_CONFIG");
  const gSrc = src.slice(gStart);
  ok(!/updateDyn|window\.storage|supabase|localStorage/i.test(gSrc), "140.-143. G-Quelltext ohne updateDyn/Storage/Supabase");
  // GEGENPROBE: injizierter Schreibweg wuerde erkannt
  ok(/updateDyn/i.test("const x = updateDyn(1)"), "GEGENPROBE: Schreibweg-Erkennung funktioniert");
}

// ---- Ergebnis ------------------------------------------------------------
console.log(`\nTeilpaket G1 Smoke: ${pass} OK, ${fail} FAIL`);
if (fail) { console.log("FEHLGESCHLAGEN:"); fails.forEach((f) => console.log("  - " + f)); process.exit(1); }
