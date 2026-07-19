// Teilpaket E – Smoke gegen VERBATIM extrahierte Funktionen (tmp-te-funcs.mjs).
// Aufruf: python3 extract-funcs-teilpaket-e.py src/ShuttleLeitstelle.jsx tmp-te-funcs.mjs
//         node smoke-teilpaket-e.mjs
import * as E from "./tmp-te-funcs.mjs";

let pass = 0, fail = 0; const fails = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; fails.push(msg); } }
function eq(a, b, msg) { ok(a === b, `${msg} (erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)})`); }

// ---- Fixtures ---------------------------------------------------------------
const DAY = "2026-07-24";
const baseMatrix = {
  "sheraton|festival": { min: 38, km: 20 },
  "airport|festival": { min: 25, km: 30 },
  "moevenpick|festival": { min: 30, km: 18 },
  "muc|festival": { min: 120, km: 180 },
};
function mkSetup(over = {}) {
  return {
    config: { baseLocationId: "sheraton", minDurationMin: 20, softHoursMin: 100000, ...(over.config || {}) },
    matrix: over.matrix || baseMatrix,
    drivers: over.drivers || [],
    locations: over.locations || [
      { id: "festival", short: "Festival" }, { id: "sheraton", short: "Sheraton" },
      { id: "moevenpick", short: "Mövenpick" }, { id: "airport", short: "Flughafen" },
    ],
  };
}
function mkDriver(over = {}) { return { id: "d1", firstName: "Anna", lastName: "Berg", seats: 6, vehicleType: "Van", ...over }; }
function mkRide(over = {}) {
  return { id: "r?", date: DAY, dayKey: DAY, time: "20:00", passengerCount: 2, status: "planned",
    fromId: "sheraton", toId: "festival", fromCustom: "", toCustom: "", ...over };
}
const HUB_REL = { node: "sheraton", reliable: true, source: "config_hub", requested: "sheraton" };

function evalCand(inb, ret, drv, setup, dyn, hub) {
  return E.evaluateWaitRideCandidate({ inboundRide: inb, returnRide: ret, driver: drv, setup, dyn, now: 0, comparisonHub: hub });
}
// Standard-Szenario: Fahrer d1, Hinfahrt sheraton->festival 20:00 (Ankunft 20:38).
function scenario(retTime, opts = {}) {
  const drv = mkDriver();
  const setup = mkSetup({ drivers: [drv], ...(opts.setupOver || {}) });
  const inb = mkRide({ id: "in1", time: "20:00", fromId: "sheraton", toId: "festival", assignedDriverId: "d1" });
  const ret = mkRide({ id: "re1", time: retTime, fromId: "festival", toId: opts.retTo || "moevenpick", assignedDriverId: opts.retDriver || null, ...(opts.retOver || {}) });
  const rides = [inb, ret, ...(opts.extraRides || [])];
  const dyn = { rides, driverState: {} };
  const c = evalCand(inb, ret, drv, setup, dyn, opts.hub);
  return { c, inb, ret, drv, setup, dyn };
}

// ============================================================================
// GRUPPE 1 – Richtungs-/Rueckfahrterkennung (zentrale Logik, kein zweiter Detektor)
// ============================================================================
eq(E.rideFestivalDirection(mkRide({ fromId: "sheraton", toId: "festival" })), "toFestival", "T1 sheraton->festival = toFestival");
eq(E.rideFestivalDirection(mkRide({ fromId: "festival", toId: "sheraton" })), "fromFestival", "T2 festival->sheraton = fromFestival");
eq(E.rideFestivalDirection(mkRide({ fromId: "leonardo", toId: "festival" })), "toFestival", "T3 leonardo->festival = toFestival (Richtung ueber IDs)");
eq(E.rideFestivalDirection(mkRide({ fromId: "sheraton", toId: "moevenpick" })), "other", "T4 hotel->hotel = other");
eq(E.rideFestivalDirection(mkRide({ fromId: "festival", toId: "festival" })), "other", "T5 festival->festival = other");
eq(E.rideFestivalDirection(mkRide({ fromId: "", toId: "" })), "other", "T6 leere IDs = other");
eq(E.rideFestivalDirection(mkRide({ fromId: "airport_muc", toId: "festival" })), "toFestival", "T7 muc->festival = toFestival");

// ============================================================================
// GRUPPE 2 – waitInboundArrival (operative Ankunft, nur Matrixzeit, nie Schaetzung)
// ============================================================================
{
  const setup = mkSetup();
  const a1 = E.waitInboundArrival(mkRide({ fromId: "sheraton", toId: "festival", time: "20:00" }), setup);
  eq(a1.reason, null, "T8 sheraton->festival: kein Fehlergrund");
  eq(a1.travelMinutes, 38, "T9 Fahrzeit 38 aus Matrix");
  eq(E.c3AbsToParts(a1.arrivalAbs).hm, "20:38", "T10 Ankunft 20:38 (20:00+38)");
  const a2 = E.waitInboundArrival(mkRide({ fromId: "leonardo", toId: "festival", time: "19:00" }), setup);
  eq(a2.fromNode, "sheraton", "T11 leonardo->festival: operativer Pickup sheraton");
  eq(a2.travelMinutes, 38, "T12 leonardo->festival rechnet wie sheraton (38)");
  eq(E.c3AbsToParts(a2.arrivalAbs).hm, "19:38", "T13 Ankunft 19:38");
  const a3 = E.waitInboundArrival(mkRide({ fromId: "festival", toId: "sheraton" }), setup);
  eq(a3.reason, "not_inbound", "T14 Rueckfahrt: not_inbound");
  eq(a3.arrivalAbs, null, "T15 Rueckfahrt: keine Ankunft");
  const a4 = E.waitInboundArrival(mkRide({ fromId: "__custom", fromCustom: "Nirgendwo XY", toId: "festival" }), setup);
  eq(a4.reason, "no_matrix_edge", "T16 unbekannter Start: no_matrix_edge");
  eq(a4.arrivalAbs, null, "T17 unbekannter Start: keine Ankunft (nie 0)");
  const a5 = E.waitInboundArrival(mkRide({ fromId: "sheraton", toId: "festival", time: "99:99" }), setup);
  eq(a5.reason, "invalid_datetime", "T18 ungueltige Zeit: invalid_datetime");
  const a6 = E.waitInboundArrival(mkRide({ fromId: "sheraton", toId: "moevenpick" }), setup);
  eq(a6.reason, "not_inbound", "T19 Ziel nicht Festival: not_inbound");
  const a7 = E.waitInboundArrival(mkRide({ fromId: "sheraton", toId: "festival" }), mkSetup({ matrix: {} }));
  eq(a7.reason, "no_matrix_edge", "T20 leere Matrix: no_matrix_edge");
}

// ============================================================================
// GRUPPE 3 – Vergleichs-Hub (Sheraton wird nie pauschal erfunden)
// ============================================================================
{
  const noHub = E.resolveWaitComparisonHub(mkSetup());
  eq(noHub.reliable, false, "T21 ohne Konfig: kein verlaesslicher Hub");
  eq(noHub.node, null, "T22 ohne Konfig: kein Knoten (Sheraton NICHT erfunden)");
  const cfgHub = E.resolveWaitComparisonHub(mkSetup({ config: { driverHubLocationId: "sheraton" } }));
  eq(cfgHub.reliable, true, "T23 expliziter Hub: verlaesslich");
  eq(cfgHub.node, "sheraton", "T24 expliziter Hub: Knoten sheraton");
  eq(cfgHub.source, "config_hub", "T25 Quelle config_hub");
  const festHub = E.resolveWaitComparisonHub(mkSetup({ config: { driverHubLocationId: "festival" } }));
  eq(festHub.reliable, false, "T26 Hub=festival: nicht verlaesslich");
  const unk = E.resolveWaitComparisonHub(mkSetup({ config: { driverHubLocationId: "gibtsnicht" } }));
  eq(unk.reliable, false, "T27 unbekannter Hub: nicht verlaesslich");
  eq(unk.node, null, "T28 unbekannter Hub: kein Knoten");
  // baseLocationId=sheraton vorhanden, aber NICHT als Hub genutzt:
  const base = E.resolveWaitComparisonHub(mkSetup({ config: { baseLocationId: "sheraton" } }));
  eq(base.node, null, "T29 baseLocationId != Hub (Sheraton nicht pauschal)");
}

// ============================================================================
// GRUPPE 4 – computeWaitDrivingSaved (getrennte Richtungen, asymmetrie-sicher)
// ============================================================================
{
  const s = mkSetup();
  const d1 = E.computeWaitDrivingSaved(HUB_REL, s);
  eq(d1.reliable, true, "T30 verlaesslicher Hub: Einsparung berechenbar");
  eq(d1.legOut, 38, "T31 Festival->Hub 38");
  eq(d1.legBack, 38, "T32 Hub->Festival 38");
  eq(d1.savedMin, 76, "T33 Einsparung 76 (Rundlauf)");
  const asym = mkSetup({ matrix: { "festival|sheraton": { min: 40 }, "sheraton|festival": { min: 38 } } });
  const d2 = E.computeWaitDrivingSaved(HUB_REL, asym);
  eq(d2.legOut, 40, "T34 asymmetrisch: Hinweg 40");
  eq(d2.legBack, 38, "T35 asymmetrisch: Rueckweg 38");
  eq(d2.savedMin, 78, "T36 asymmetrische Summe 78");
  const noEdge = mkSetup({ matrix: { "moevenpick|festival": { min: 30 } } }); // kein sheraton
  const d3 = E.computeWaitDrivingSaved(HUB_REL, noEdge);
  eq(d3.reliable, false, "T37 fehlende Hub-Kante: nicht verlaesslich");
  eq(d3.savedMin, null, "T38 fehlende Hub-Kante: keine Einsparung");
  const d4 = E.computeWaitDrivingSaved({ node: null, reliable: false }, s);
  eq(d4.savedMin, null, "T39 kein Hub: keine Einsparung");
  eq(d4.reliable, false, "T40 kein Hub: nicht verlaesslich");
}

// ============================================================================
// GRUPPE 5 – Wendezeit-Schwellen (9/10/14/15) und Ankunfts-/Wartemathematik
// ============================================================================
// Ankunft 20:38. Rueckfahrtzeit steuert Wartezeit.
eq(scenario("20:47").c.waitMinutes, 9, "T41 wait=9 berechnet");
eq(scenario("20:47").c.status, "not_evaluable", "T42 wait=9 -> not_evaluable (zu kurz)");
ok(scenario("20:47").c.reasons.includes("turnaround_too_short"), "T43 wait=9 Grund turnaround_too_short");
eq(scenario("20:48").c.waitMinutes, 10, "T44 wait=10 berechnet");
eq(scenario("20:48").c.status, "direct_connection", "T45 wait=10 -> direkter Anschluss");
eq(scenario("20:52").c.waitMinutes, 14, "T46 wait=14 berechnet");
eq(scenario("20:52").c.status, "direct_connection", "T47 wait=14 -> direkter Anschluss");
eq(scenario("20:53").c.waitMinutes, 15, "T48 wait=15 berechnet");
eq(scenario("20:53").c.status, "wait_possible", "T49 wait=15 ohne Hub -> wait_possible");
eq(scenario("20:38").c.waitMinutes, 0, "T50 wait=0 berechnet");
eq(scenario("20:38").c.status, "not_evaluable", "T51 wait=0 -> not_evaluable");
eq(scenario("20:30").c.waitMinutes, -8, "T52 Rueckfahrt vor Ankunft: negativ");
eq(scenario("20:30").c.status, "not_evaluable", "T53 Rueckfahrt vor Ankunft -> not_evaluable");
ok(scenario("20:30").c.reasons.includes("return_before_arrival"), "T54 Grund return_before_arrival");

// ============================================================================
// GRUPPE 6 – Statusfenster (wait_recommended / wait_possible / return_recommended)
// ============================================================================
// Ohne verlaesslichen Hub:
eq(scenario("21:38").c.status, "wait_possible", "T55 wait=60 ohne Hub -> wait_possible");
eq(scenario("21:39").c.waitMinutes, 61, "T56 wait=61 berechnet");
eq(scenario("21:39").c.status, "wait_possible", "T57 wait=61 -> wait_possible (>60)");
eq(scenario("22:38").c.waitMinutes, 120, "T58 wait=120 berechnet");
eq(scenario("22:38").c.status, "wait_possible", "T59 wait=120 -> wait_possible");
eq(scenario("22:39").c.waitMinutes, 121, "T60 wait=121 berechnet");
eq(scenario("22:39").c.status, "return_recommended", "T61 wait=121 -> return_recommended (>120)");
eq(scenario("23:30").c.status, "return_recommended", "T62 sehr lange Wartezeit -> return_recommended");
// Mit verlaesslichem Hub (config sheraton, Einsparung 76):
const hubSetupOver = { config: { driverHubLocationId: "sheraton" } };
eq(scenario("20:53", { setupOver: hubSetupOver }).c.status, "wait_recommended", "T63 wait=15 + Hub76 -> wait_recommended");
eq(scenario("21:08", { setupOver: hubSetupOver }).c.status, "wait_recommended", "T64 wait=30 + Hub76 -> wait_recommended");
eq(scenario("21:38", { setupOver: hubSetupOver }).c.status, "wait_recommended", "T65 wait=60 + Hub76 -> wait_recommended (<=60)");
eq(scenario("21:39", { setupOver: hubSetupOver }).c.status, "wait_possible", "T66 wait=61 + Hub -> wait_possible (>60)");
eq(scenario("21:08", { setupOver: hubSetupOver }).c.waitMinutes, 30, "T67 wait=30 im empfohlenen Fenster");
{
  const c = scenario("21:08", { setupOver: hubSetupOver }).c;
  eq(c.comparisonRouteReliable, true, "T68 Hub: comparisonRouteReliable true");
  eq(c.estimatedDrivingSavedMin, 76, "T69 Hub: Einsparung 76 im Ergebnis");
}

// Einsparungsschwelle exakt 25 / 24 (Hub moevenpick mit getunter Matrix):
{
  const m25 = { "sheraton|festival": { min: 38 }, "festival|moevenpick": { min: 13 }, "moevenpick|festival": { min: 12 } };
  const s25 = scenario("21:08", { setupOver: { config: { driverHubLocationId: "moevenpick" }, matrix: m25 } });
  eq(s25.c.estimatedDrivingSavedMin, 25, "T70 Einsparung exakt 25");
  eq(s25.c.status, "wait_recommended", "T71 Einsparung 25 erfuellt Schwelle -> wait_recommended");
  const m24 = { "sheraton|festival": { min: 38 }, "festival|moevenpick": { min: 12 }, "moevenpick|festival": { min: 12 } };
  const s24 = scenario("21:08", { setupOver: { config: { driverHubLocationId: "moevenpick" }, matrix: m24 } });
  eq(s24.c.estimatedDrivingSavedMin, 24, "T72 Einsparung 24");
  eq(s24.c.status, "return_recommended", "T73 Einsparung 24 < Schwelle -> return_recommended (Spec 19)");
}

// ============================================================================
// GRUPPE 7 – Konflikte (bestehender Motor evaluateInsertion wiederverwendet)
// ============================================================================
{
  // Dritte Fahrt ueberschneidet die Rueckfahrt (21:00-21:20 vs 21:10-21:30).
  const third = mkRide({ id: "x3", time: "21:10", fromId: "festival", toId: "sheraton", assignedDriverId: "d1" });
  const s = scenario("21:00", { extraRides: [third] }); // wait=22 -> Fenster, aber Konflikt
  eq(s.c.hasRideConflict, true, "T74 zeitlicher Konflikt erkannt (evaluateInsertion)");
  ok(s.c.conflictRideIds.includes("x3"), "T75 Konflikt-Ride-ID enthalten");
  eq(s.c.status, "return_recommended", "T76 Konflikt im Wartefenster -> return_recommended");
  // Ohne Konflikt derselbe Slot:
  const s2 = scenario("21:00");
  eq(s2.c.hasRideConflict, false, "T77 kein Konflikt ohne dritte Fahrt");
  ok(["wait_possible", "wait_recommended"].includes(s2.c.status), "T78 ohne Konflikt -> Warteoption");
  // Konflikt auch bei sonst empfohlenem Fenster + Hub:
  const s3 = scenario("21:00", { extraRides: [third], setupOver: hubSetupOver });
  eq(s3.c.status, "return_recommended", "T79 Konflikt schlaegt Hub-Empfehlung -> return_recommended");
}

// ============================================================================
// GRUPPE 8 – Verfuegbarkeit (availableFrom als harter Filter)
// ============================================================================
{
  const drv = mkDriver({ availableFrom: "2026-07-24 22:00" }); // erst ab 22:00
  const setup = mkSetup({ drivers: [drv], config: { ...hubSetupOver.config } });
  const inb = mkRide({ id: "in1", time: "20:00", fromId: "sheraton", toId: "festival", assignedDriverId: "d1" });
  const ret = mkRide({ id: "re1", time: "21:08", fromId: "festival", toId: "moevenpick" }); // 21:08 < 22:00
  const dyn = { rides: [inb, ret], driverState: {} };
  const c = evalCand(inb, ret, drv, setup, dyn, HUB_REL);
  eq(c.driverAvailable, false, "T80 Fahrer nicht verfuegbar (availableFrom)");
  eq(c.status, "return_recommended", "T81 nicht verfuegbar -> return_recommended");
}

// ============================================================================
// GRUPPE 9 – Rueckfahrt-Belegung / -Status (Spec 11/17)
// ============================================================================
{
  // Rueckfahrt bereits demselben Fahrer zugeteilt -> already_planned
  const s = scenario("21:08", { retDriver: "d1" });
  eq(s.c.status, "already_planned", "T82 Rueckfahrt schon d1 -> already_planned");
  eq(s.c.returnRideUnassigned, false, "T83 belegt -> nicht unassigned");
  // Anderem Fahrer zugeteilt -> kein Vorschlag (not_evaluable, spezieller Grund)
  const s2 = scenario("21:08", { retDriver: "d2" });
  eq(s2.c.status, "not_evaluable", "T84 Rueckfahrt anderem Fahrer -> kein Vorschlag");
  ok(s2.c.reasons.includes("return_assigned_other_driver"), "T85 Grund return_assigned_other_driver");
  // Storniert / erledigt / laufend
  eq(scenario("21:08", { retOver: { status: "cancelled" } }).c.status, "not_evaluable", "T86 stornierte Rueckfahrt -> not_evaluable");
  eq(scenario("21:08", { retOver: { status: "done" } }).c.status, "not_evaluable", "T87 erledigte Rueckfahrt -> not_evaluable");
  eq(scenario("21:08", { retOver: { status: "onboard" } }).c.status, "not_evaluable", "T88 laufende Rueckfahrt -> not_evaluable");
  ok(scenario("21:08", { retOver: { status: "done" } }).c.reasons.includes("return_completed"), "T89 Grund return_completed");
}

// ============================================================================
// GRUPPE 10 – not_evaluable Randfaelle (Spec 20)
// ============================================================================
{
  // Hinfahrt ohne Fahrer
  const drv = mkDriver();
  const setup = mkSetup({ drivers: [drv] });
  const inbNoDrv = mkRide({ id: "in1", fromId: "sheraton", toId: "festival" }); // kein assignedDriverId
  const ret = mkRide({ id: "re1", time: "21:08", fromId: "festival", toId: "moevenpick" });
  const c1 = evalCand(inbNoDrv, ret, drv, setup, { rides: [ret], driverState: {} });
  eq(c1.status, "not_evaluable", "T90 Hinfahrt ohne Fahrer -> not_evaluable");
  ok(c1.reasons.includes("inbound_no_driver"), "T91 Grund inbound_no_driver");
  // Fahrerobjekt passt nicht zur Hinfahrt
  const inb = mkRide({ id: "in1", fromId: "sheraton", toId: "festival", assignedDriverId: "dX" });
  const c2 = evalCand(inb, ret, drv, setup, { rides: [inb, ret], driverState: {} });
  eq(c2.status, "not_evaluable", "T92 Fahrer passt nicht -> not_evaluable");
  ok(c2.reasons.includes("inbound_driver_unresolved"), "T93 Grund inbound_driver_unresolved");
  // Hinfahrt keine Hinfahrt
  const notInb = mkRide({ id: "in1", fromId: "moevenpick", toId: "sheraton", assignedDriverId: "d1" });
  const c3 = evalCand(notInb, ret, drv, setup, { rides: [notInb, ret], driverState: {} });
  eq(c3.status, "not_evaluable", "T94 Hinfahrt hat keinen Festivalbezug -> not_evaluable");
  // Rueckfahrt keine Rueckfahrt
  const inb2 = mkRide({ id: "in1", fromId: "sheraton", toId: "festival", assignedDriverId: "d1" });
  const notRet = mkRide({ id: "re1", time: "21:08", fromId: "moevenpick", toId: "airport" });
  const c4 = evalCand(inb2, notRet, drv, setup, { rides: [inb2, notRet], driverState: {} });
  eq(c4.status, "not_evaluable", "T95 Rueckfahrt hat keinen Festivalbezug -> not_evaluable");
  // Ungueltige Rueckfahrtzeit
  const badRet = mkRide({ id: "re1", time: "99:99", fromId: "festival", toId: "moevenpick" });
  const c5 = evalCand(inb2, badRet, drv, setup, { rides: [inb2, badRet], driverState: {} });
  eq(c5.status, "not_evaluable", "T96 ungueltige Rueckfahrtzeit -> not_evaluable");
  ok(c5.reasons.includes("return_invalid_datetime"), "T97 Grund return_invalid_datetime");
  // Fehlende Matrixkante der Hinfahrt
  const inbNoEdge = mkRide({ id: "in1", fromId: "__custom", fromCustom: "Irgendwo", toId: "festival", assignedDriverId: "d1" });
  const c6 = evalCand(inbNoEdge, mkRide({ id: "re1", time: "21:08", fromId: "festival", toId: "moevenpick" }), drv, setup, { rides: [inbNoEdge], driverState: {} });
  eq(c6.status, "not_evaluable", "T98 fehlende Matrixkante Hinfahrt -> not_evaluable");
  ok(c6.reasons.some((r) => r.startsWith("arrival_")), "T99 Grund arrival_* bei fehlender Kante");
}

// ============================================================================
// GRUPPE 11 – Mitternacht (Spec 14): absolute Minuten, festDayKey stabil
// ============================================================================
{
  const drv = mkDriver();
  const setup = mkSetup({ drivers: [drv] });
  const inb = mkRide({ id: "in1", date: "2026-07-24", dayKey: DAY, time: "23:30", fromId: "sheraton", toId: "festival", assignedDriverId: "d1" });
  // Ankunft 23:30 + 38 = 00:08 am 25.07.
  const arr = E.waitInboundArrival(inb, setup);
  eq(E.c3AbsToParts(arr.arrivalAbs).iso, "2026-07-25 00:08", "T100 Ankunft ueber Mitternacht 00:08 am Folgetag");
  const ret = mkRide({ id: "re1", date: "2026-07-25", dayKey: DAY, time: "00:38", fromId: "festival", toId: "moevenpick" });
  const c = evalCand(inb, ret, drv, setup, { rides: [inb, ret], driverState: {} });
  eq(c.waitMinutes, 30, "T101 Wartezeit ueber Mitternacht = 30 min");
  eq(c.inboundArrivalAtFestival, "2026-07-25 00:08", "T102 Ankunftsfeld korrekt (Folgetag)");
  eq(c.returnDepartureAt, "2026-07-25 00:38", "T103 Abfahrtsfeld korrekt");
  eq(c.status, "wait_possible", "T104 Mitternacht, 30 min, ohne Hub -> wait_possible");
}

// ============================================================================
// GRUPPE 12 – Comparator / Ranking (deterministisch, Spec 29)
// ============================================================================
{
  const base = { status: "wait_possible", hasRideConflict: false, driverAvailable: true, comparisonRouteReliable: false, estimatedDrivingSavedMin: null, waitMinutes: 30, returnDepartureAt: "2026-07-24 21:00", returnRideId: "r1", inboundRideId: "i1", driverId: "d1" };
  const rec = { ...base, status: "wait_recommended" };
  eq(E.waitCandidateCompare(rec, base) < 0, true, "T105 wait_recommended vor wait_possible");
  const conflictA = { ...base, hasRideConflict: true }, cleanB = { ...base, hasRideConflict: false };
  eq(E.waitCandidateCompare(cleanB, conflictA) < 0, true, "T106 konfliktfrei zuerst");
  const availA = { ...base, driverAvailable: true }, notAvailB = { ...base, driverAvailable: false };
  eq(E.waitCandidateCompare(availA, notAvailB) < 0, true, "T107 verfuegbar zuerst");
  const hi = { ...base, comparisonRouteReliable: true, estimatedDrivingSavedMin: 80 };
  const lo = { ...base, comparisonRouteReliable: true, estimatedDrivingSavedMin: 40 };
  eq(E.waitCandidateCompare(hi, lo) < 0, true, "T108 hoehere Einsparung zuerst");
  const shortW = { ...base, waitMinutes: 20 }, longW = { ...base, waitMinutes: 40 };
  eq(E.waitCandidateCompare(shortW, longW) < 0, true, "T109 kuerzere Wartezeit zuerst");
  const early = { ...base, returnDepartureAt: "2026-07-24 20:00" }, late = { ...base, returnDepartureAt: "2026-07-24 23:00" };
  eq(E.waitCandidateCompare(early, late) < 0, true, "T110 fruehere Rueckfahrt zuerst");
  // Vollstaendig gleich bis auf IDs -> stabile ID-Ordnung, nie 0 bei versch. IDs
  const idA = { ...base, returnRideId: "aaa" }, idB = { ...base, returnRideId: "bbb" };
  eq(E.waitCandidateCompare(idA, idB) < 0, true, "T111 stabile ID-Tiebreak (aaa < bbb)");
  eq(E.waitCandidateCompare(base, { ...base }), 0, "T112 identische Kandidaten -> 0");
  // rankWaitCandidates: sortierte KOPIE, Eingabe unveraendert
  const input = [base, rec, conflictA];
  const inputCopy = JSON.stringify(input);
  const ranked = E.rankWaitCandidates(input);
  eq(ranked[0].status, "wait_recommended", "T113 Ranking: bestes zuerst");
  eq(JSON.stringify(input), inputCopy, "T114 Ranking mutiert Eingabe nicht");
  ok(ranked !== input, "T115 Ranking gibt neue Liste zurueck");
}

// ============================================================================
// GRUPPE 13 – buildWaitRideCandidates (Vorfilter, mehrere Fahrer/Rueckfahrten)
// ============================================================================
{
  const d1 = mkDriver({ id: "d1", firstName: "Anna" });
  const d2 = mkDriver({ id: "d2", firstName: "Ben" });
  const setup = mkSetup({ drivers: [d1, d2] });
  const in1 = mkRide({ id: "in1", time: "20:00", fromId: "sheraton", toId: "festival", assignedDriverId: "d1" }); // Ankunft 20:38
  const in2 = mkRide({ id: "in2", time: "20:05", fromId: "airport", toId: "festival", assignedDriverId: "d2" });  // Ankunft 20:30
  const re1 = mkRide({ id: "re1", time: "21:00", fromId: "festival", toId: "moevenpick" }); // unbesetzt
  const dyn = { rides: [in1, in2, re1], driverState: {} };
  const model = E.buildWaitRideCandidates({ dyn, setup, now: 0, day: DAY });
  ok(model.byReturn.has("re1"), "T116 Kandidaten fuer unbesetzte Rueckfahrt re1");
  const entry = model.byReturn.get("re1");
  eq(entry.candidates.length, 2, "T117 zwei Fahrer als Kandidaten (d1, d2)");
  ok(["d1", "d2"].includes(entry.best.driverId), "T118 bester Kandidat hat gueltigen Fahrer");
  // Rueckfahrt mit Fahrer -> kein Eintrag (nicht unbesetzt)
  const re1b = mkRide({ id: "re1", time: "21:00", fromId: "festival", toId: "moevenpick", assignedDriverId: "d1" });
  const model2 = E.buildWaitRideCandidates({ dyn: { rides: [in1, in2, re1b], driverState: {} }, setup, now: 0, day: DAY });
  const e2 = model2.byReturn.get("re1");
  eq(e2 && e2.best.status, "already_planned", "T119 besetzte Rueckfahrt (gleicher Fahrer) -> already_planned");
  // Zwei unbesetzte Rueckfahrten, ein Fahrer bester fuer beide -> multiBestDrivers
  const reA = mkRide({ id: "reA", time: "21:00", fromId: "festival", toId: "moevenpick" });
  const reB = mkRide({ id: "reB", time: "21:05", fromId: "festival", toId: "moevenpick" });
  const model3 = E.buildWaitRideCandidates({ dyn: { rides: [in1, reA, reB], driverState: {} }, setup: mkSetup({ drivers: [d1] }), now: 0, day: DAY });
  eq(model3.byReturn.size, 2, "T120 zwei Rueckfahrten mit Kandidaten");
  ok(model3.multiBestDrivers.has("d1"), "T121 d1 als bester fuer mehrere gekennzeichnet");
  // Vorfilter: Wartezeit > 120 -> keine Kandidaten
  const reLate = mkRide({ id: "reLate", time: "23:59", fromId: "festival", toId: "moevenpick" });
  const model4 = E.buildWaitRideCandidates({ dyn: { rides: [in1, reLate], driverState: {} }, setup: mkSetup({ drivers: [d1] }), now: 0, day: DAY });
  ok(!model4.byReturn.has("reLate"), "T122 Vorfilter: >120 min ausgeschlossen");
  // Vorfilter: falscher Betriebstag -> ignoriert
  const reOtherDay = mkRide({ id: "reX", time: "21:00", fromId: "festival", toId: "moevenpick", dayKey: "2026-07-25" });
  const model5 = E.buildWaitRideCandidates({ dyn: { rides: [in1, reOtherDay], driverState: {} }, setup: mkSetup({ drivers: [d1] }), now: 0, day: DAY });
  ok(!model5.byReturn.has("reX"), "T123 anderer Betriebstag ausgeschlossen");
  // Hinfahrt ohne gueltigen Fahrer -> kein Kandidat
  const inNoDrv = mkRide({ id: "inX", time: "20:00", fromId: "sheraton", toId: "festival" });
  const model6 = E.buildWaitRideCandidates({ dyn: { rides: [inNoDrv, re1], driverState: {} }, setup: mkSetup({ drivers: [d1] }), now: 0, day: DAY });
  ok(!model6.byReturn.has("re1"), "T124 Hinfahrt ohne Fahrer -> kein Kandidat");
}

// ============================================================================
// GRUPPE 14 – Read-only / Determinismus (Spec 15/39): keine Mutation, kein Schreiben
// ============================================================================
{
  const drv = Object.freeze(mkDriver());
  const setup = mkSetup({ drivers: [drv], config: { driverHubLocationId: "sheraton", baseLocationId: "sheraton", minDurationMin: 20, softHoursMin: 100000 } });
  Object.freeze(setup); Object.freeze(setup.config); Object.freeze(setup.matrix);
  const inb = Object.freeze(mkRide({ id: "in1", time: "20:00", fromId: "sheraton", toId: "festival", assignedDriverId: "d1" }));
  const ret = Object.freeze(mkRide({ id: "re1", time: "21:08", fromId: "festival", toId: "moevenpick" }));
  const rides = Object.freeze([inb, ret]);
  const dyn = Object.freeze({ rides, driverState: Object.freeze({}) });
  let threw = false, c1, c2;
  try { c1 = evalCand(inb, ret, drv, setup, dyn, HUB_REL); c2 = evalCand(inb, ret, drv, setup, dyn, HUB_REL); }
  catch (e) { threw = true; fails.push("T125 Ausnahme bei eingefrorenen Eingaben: " + e.message); }
  ok(!threw, "T125 keine Mutation eingefrorener Eingaben (kein Wurf)");
  eq(JSON.stringify(c1), JSON.stringify(c2), "T126 deterministisch: gleiche Eingabe, gleiches Ergebnis");
  // buildWaitRideCandidates auf eingefrorenen Daten
  let threw2 = false;
  try { E.buildWaitRideCandidates({ dyn, setup, now: 0, day: DAY }); }
  catch (e) { threw2 = true; fails.push("T127 build wirft bei frozen: " + e.message); }
  ok(!threw2, "T127 buildWaitRideCandidates mutiert eingefrorene Daten nicht");
  // Ergebnisobjekt-Felder vollstaendig vorhanden (Vertragspruefung)
  const req = ["status", "severity", "label", "inboundRideId", "returnRideId", "driverId",
    "inboundDepartureAt", "inboundArrivalAtFestival", "returnDepartureAt", "waitMinutes",
    "turnaroundBufferMin", "estimatedDrivingSavedMin", "comparisonRouteReliable",
    "hasRideConflict", "conflictRideIds", "driverAvailable", "returnRideUnassigned",
    "reasons", "warnings", "sortScore"];
  const missing = req.filter((k) => !(k in c1));
  eq(missing.length, 0, "T128 Ergebnis enthaelt alle Vertragsfelder (" + missing.join(",") + ")");
}

// ============================================================================
// GRUPPE 15 – Fahrzeitquelle: NUR Matrix, estDurationMin beeinflusst Ankunft nicht
// ============================================================================
{
  const setup = mkSetup();
  const inbHiEst = mkRide({ fromId: "sheraton", toId: "festival", time: "20:00", estDurationMin: 999 });
  const arr = E.waitInboundArrival(inbHiEst, setup);
  eq(arr.travelMinutes, 38, "T129 Ankunft nutzt Matrix (38), nicht estDurationMin");
  eq(E.c3AbsToParts(arr.arrivalAbs).hm, "20:38", "T130 Ankunft trotz estDurationMin=999 -> 20:38");
}

// ============================================================================
// GRUPPE 16 – Konflikt ueber knappe Folgefahrt (lateToNext), Direktanschluss+Konflikt
// ============================================================================
{
  // Folgefahrt d1 direkt nach der Rueckfahrt am Flughafen -> Hop festival->... zu knapp?
  // Rueckfahrt 21:00 festival->moevenpick (dur 20 -> Ende 21:20). Folgefahrt 21:15 moevenpick->airport.
  const next = mkRide({ id: "nx", time: "21:15", fromId: "moevenpick", toId: "airport", assignedDriverId: "d1" });
  const s = scenario("21:00", { extraRides: [next] });
  ok(s.c.hasRideConflict === true || s.c.status === "return_recommended", "T131 knappe Folgefahrt fuehrt zu Konflikt/Rueckfahrt");
  // Direktanschluss (wait 12) mit Konflikt -> return_recommended
  const third = mkRide({ id: "cf", time: "20:45", fromId: "festival", toId: "sheraton", assignedDriverId: "d1" });
  const sd = scenario("20:50", { extraRides: [third] }); // wait 12, aber 20:45-21:05 ueberlappt 20:50-21:10
  eq(sd.c.hasRideConflict, true, "T132 Direktanschluss-Fenster mit Konflikt erkannt");
  eq(sd.c.status, "return_recommended", "T133 Direktanschluss + Konflikt -> return_recommended");
}

// ============================================================================
// GRUPPE 17 – Severity-/Label-Zuordnung pro Status
// ============================================================================
{
  eq(scenario("20:53", { setupOver: hubSetupOver }).c.severity, "success", "T134 wait_recommended -> severity success");
  eq(scenario("20:53").c.severity, "warning", "T135 wait_possible -> severity warning");
  eq(scenario("20:48").c.severity, "info", "T136 direct_connection -> severity info");
  eq(scenario("22:39").c.severity, "neutral", "T137 return_recommended -> severity neutral");
  eq(scenario("21:08", { retDriver: "d1" }).c.severity, "muted", "T138 already_planned -> severity muted");
  eq(scenario("20:53", { setupOver: hubSetupOver }).c.label, "Warten sinnvoll", "T139 Label wait_recommended");
  eq(scenario("20:48").c.label, "Direkter Anschluss", "T140 Label direct_connection");
  eq(scenario("22:39").c.label, "Zurückfahren wahrscheinlich sinnvoller", "T141 Label return_recommended");
}

// ============================================================================
// GRUPPE 18 – sortScore/Vertrag + Hub im Build-Modell + Warnungen
// ============================================================================
{
  const recCand = scenario("20:53", { setupOver: hubSetupOver }).c;
  const posCand = scenario("20:53").c;
  ok(recCand.sortScore < posCand.sortScore, "T142 wait_recommended kleinerer sortScore als wait_possible");
  ok(typeof recCand.sortScore === "number", "T143 sortScore ist Zahl");
  // Warnung bei fehlender Vergleichsroute
  ok(posCand.warnings.some((w) => /Vergleichsroute/.test(w)), "T144 Warnung: keine sichere Vergleichsroute");
  eq(posCand.comparisonRouteReliable, false, "T145 ohne Hub: comparisonRouteReliable false");
  eq(posCand.estimatedDrivingSavedMin, null, "T146 ohne Hub: keine Einsparung");
  // build liefert Hub-Info
  const d1 = mkDriver({ id: "d1" });
  const in1 = mkRide({ id: "in1", time: "20:00", fromId: "sheraton", toId: "festival", assignedDriverId: "d1" });
  const re1 = mkRide({ id: "re1", time: "21:00", fromId: "festival", toId: "moevenpick" });
  const model = E.buildWaitRideCandidates({ dyn: { rides: [in1, re1], driverState: {} }, setup: mkSetup({ drivers: [d1], config: { driverHubLocationId: "sheraton" } }), now: 0, day: DAY });
  eq(model.hub.reliable, true, "T147 Build-Modell enthaelt verlaesslichen Hub");
  eq(model.byReturn.get("re1").best.estimatedDrivingSavedMin, 76, "T148 Build: Einsparung im besten Kandidaten");
  // ID-Felder korrekt gesetzt
  const c = scenario("21:08").c;
  eq(c.inboundRideId, "in1", "T149 inboundRideId gesetzt");
  eq(c.returnRideId, "re1", "T150 returnRideId gesetzt");
  eq(c.driverId, "d1", "T151 driverId gesetzt");
  eq(c.turnaroundBufferMin, 10, "T152 turnaroundBufferMin = 10 (Konfig)");
}

// ---- Ergebnis ---------------------------------------------------------------
console.log(`\nTeilpaket E Smoke: ${pass} OK, ${fail} FEHLER`);
if (fail) { console.log("Fehlgeschlagen:\n- " + fails.join("\n- ")); process.exit(1); }
