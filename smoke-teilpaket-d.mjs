// Teilpaket D - Logiktests gegen die ECHTEN Quellfunktionen (Wegwerf-Kopie der
// Quelle + Export, Original bleibt unangetastet). Deckt die Entscheidungskette,
// Grenzwerte (overdue/due-soon/driver-missing), needs_review-Gruende, Mitternacht,
// C2/C3-Wiederverwendung, echte-Rueckfahrt-Erkennung, Sortierung und Read-only ab.
import fs from "fs";
import { execSync } from "child_process";

const srcFile = process.argv[2] || "src/ShuttleLeitstelle.jsx";
const rawSrc = fs.readFileSync(srcFile, "utf8");
const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/d-src-" + tag + ".jsx";
fs.writeFileSync(copy, rawSrc + `
export { deriveReturnRideOperationalState, returnDepartureTs, returnGroupSort,
  RETURN_CONTROL_CONFIG, RETURN_OPERATIONAL_GROUP_ORDER, RETURN_GROUP_META,
  RETURN_GROUPS_IN_ORDER, matchRideToTimetable, evaluateTimetableTiming,
  normalizeTimetableEntries, seedMatrix, seedLocations, ttAbsMin, festDayKey,
  c3AbsToParts, classify };
`);
const out = "/home/claude/repo/.d-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const M = await import(out);
fs.unlinkSync(out); fs.unlinkSync(copy);

const {
  deriveReturnRideOperationalState, returnDepartureTs, returnGroupSort,
  RETURN_CONTROL_CONFIG, RETURN_OPERATIONAL_GROUP_ORDER, RETURN_GROUP_META,
  RETURN_GROUPS_IN_ORDER, matchRideToTimetable, evaluateTimetableTiming,
  normalizeTimetableEntries, seedMatrix, seedLocations, ttAbsMin, festDayKey,
  c3AbsToParts, classify,
} = M;

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log("OK   " + name); } else { fail++; console.log("FAIL " + name); } }
function eq(a, b, name) { ok(a === b, `${name} (erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)})`); }

const setup = { matrix: seedMatrix(), locations: seedLocations() };
const cfg = RETURN_CONTROL_CONFIG;
const DRIVER = { id: "d1", firstName: "Max", lastName: "M", vehicleType: "Van", vehicleId: "V1" };

// Basis-Rueckfahrt festival->sheraton. Datum/Uhrzeit ergeben den Abfahrts-Timestamp.
function retRide(o = {}) {
  const date = o.date !== undefined ? o.date : "2026-07-24";
  const time = o.time !== undefined ? o.time : "23:30";
  return {
    id: o.id || "r-" + Math.random().toString(36).slice(2, 7),
    date, time, dayKey: o.dayKey !== undefined ? o.dayKey : festDayKey(date, time),
    fromId: o.fromId !== undefined ? o.fromId : "festival",
    toId: o.toId !== undefined ? o.toId : "sheraton",
    fromCustom: o.fromCustom || "", toCustom: o.toCustom || "",
    djName: o.djName !== undefined ? o.djName : "",
    status: o.status || "planned",
    assignedDriverId: o.assignedDriverId !== undefined ? o.assignedDriverId : null,
    issues: o.issues || [],
  };
}
// now (ms) so, dass minutesUntilDeparture ~ minutesUntil ergibt.
function nowFor(ride, minutesUntil) { return returnDepartureTs(ride) - minutesUntil * 60000; }

// Standard-Mocks fuer C2-Match / C3-Timing (isolieren die Klassifizierung).
const M_EXACT = { status: "exact", selected: { id: "s1", artist: "A", startAt: "2026-07-24 22:00", endAt: "2026-07-25 01:00" } };
const T_RETURN_OK = { status: "return_ok", severity: "ok", direction: "from_festival", setEndAt: "2026-07-25 01:00", minutesRelativeToSetEnd: 30 };
const T_BEFORE = { status: "return_before_set_end", severity: "critical", direction: "from_festival", setEndAt: "2026-07-25 01:00", minutesRelativeToSetEnd: -30 };
const T_UNKNOWN = { status: "timing_unknown", severity: "info", direction: "from_festival", setEndAt: null, minutesRelativeToSetEnd: null };

function derive(ride, { driver = null, match = M_EXACT, timing = T_RETURN_OK, minutesUntil } = {}) {
  const now = minutesUntil === undefined ? Date.now() : nowFor(ride, minutesUntil);
  return deriveReturnRideOperationalState({ ride, driver, timetableMatch: match, timingEvaluation: timing, now, setup });
}

// =====================================================================
// 1) Statuspriorität (Spec 31 Tests 1-5)
// =====================================================================
eq(derive(retRide({ status: "done", assignedDriverId: null }), { minutesUntil: -300 }).group, "completed", "1. done -> completed");
eq(derive(retRide({ status: "onboard" }), { driver: DRIVER, minutesUntil: -300 }).group, "in_progress", "2. onboard -> in_progress");
eq(derive(retRide({ status: "enroute_pickup" }), { driver: DRIVER, minutesUntil: -300 }).group, "in_progress", "2b. enroute_pickup -> in_progress");
eq(derive(retRide({ status: "onboard" }), { driver: DRIVER, minutesUntil: -50 }).group, "in_progress", "3. aktive Fahrt trotz vergangener Planzeit NICHT overdue");
eq(derive(retRide({ status: "done", assignedDriverId: null }), { minutesUntil: 5 }).group, "completed", "4. done trotz fehlendem Fahrer NICHT driver_missing");
{ const o = derive(retRide({ status: "planned", assignedDriverId: "d1" }), { driver: DRIVER, minutesUntil: 30 });
  ok(typeof o.group === "string" && RETURN_GROUPS_IN_ORDER.includes(o.group), "5. genau eine primaere Gruppe (gueltig)"); }

// =====================================================================
// 2) Später / not_due (Tests 6-10)
// =====================================================================
eq(derive(retRide({ assignedDriverId: "d1" }), { driver: DRIVER, minutesUntil: 180 }).group, "driver_assigned", "6. 180 min + Fahrer -> driver_assigned");
eq(derive(retRide({ assignedDriverId: "d1" }), { driver: DRIVER, minutesUntil: 61 }).group, "driver_assigned", "7. 61 min + Fahrer -> driver_assigned (nicht due_soon)");
eq(derive(retRide({ assignedDriverId: null }), { minutesUntil: 120 }).group, "not_due", "8. kein Fahrer, 120 min (ausserhalb 90) -> not_due");
eq(derive(retRide({ assignedDriverId: null }), { minutesUntil: 200 }).group, "not_due", "9. kein Fahrer, 200 min -> not_due");
ok(derive(retRide({ assignedDriverId: null }), { minutesUntil: 200 }).severity === "neutral", "10. not_due ist nicht kritisch");
ok(derive(retRide({ assignedDriverId: null }), { minutesUntil: 120 }).secondaryInfo.includes("Kein Fahrer zugeteilt"), "10b. not_due ohne Fahrer -> Zusatzhinweis");

// =====================================================================
// 3) Bald fällig / due_soon (Tests 11-15) - mit Fahrer
// =====================================================================
eq(derive(retRide({ assignedDriverId: "d1" }), { driver: DRIVER, minutesUntil: 60 }).group, "due_soon", "11. 60 min + Fahrer -> due_soon");
eq(derive(retRide({ assignedDriverId: "d1" }), { driver: DRIVER, minutesUntil: 30 }).group, "due_soon", "12. 30 min + Fahrer -> due_soon");
eq(derive(retRide({ assignedDriverId: "d1" }), { driver: DRIVER, minutesUntil: 0 }).group, "due_soon", "13. exakt jetzt + Fahrer -> due_soon");
ok(derive(retRide({ assignedDriverId: "d1" }), { driver: DRIVER, minutesUntil: 28 }).driverAssigned === true, "14. Fahrer vorhanden");
eq(derive(retRide({ assignedDriverId: "d1" }), { driver: DRIVER, minutesUntil: 60 }).severity, "warning", "15. due_soon -> warning");

// =====================================================================
// 4) Fahrer fehlt / driver_missing (Tests 16-20)
// =====================================================================
eq(derive(retRide({ assignedDriverId: null }), { minutesUntil: 90 }).group, "driver_missing", "16. kein Fahrer, 90 min -> driver_missing");
eq(derive(retRide({ assignedDriverId: null }), { minutesUntil: 60 }).group, "driver_missing", "17. kein Fahrer, 60 min -> driver_missing");
eq(derive(retRide({ assignedDriverId: null }), { minutesUntil: 1 }).group, "driver_missing", "18. kein Fahrer, 1 min -> driver_missing");
eq(derive(retRide({ assignedDriverId: null }), { minutesUntil: 91 }).group, "not_due", "19. kein Fahrer, 91 min -> not_due (Fenstergrenze)");
ok(derive(retRide({ assignedDriverId: null }), { minutesUntil: 45 }).secondaryInfo.includes("Kein Fahrer zugeteilt"), "20. Fahrer-fehlt-Hinweis sichtbar");

// =====================================================================
// 5) Überfällig / overdue (Tests 21-28), Grace exakt bei 10
// =====================================================================
eq(derive(retRide({ assignedDriverId: "d1" }), { driver: DRIVER, minutesUntil: -9 }).group, "due_soon", "21. 9 min vorbei (Grace) -> NICHT overdue");
eq(derive(retRide({ assignedDriverId: "d1" }), { driver: DRIVER, minutesUntil: -10 }).group, "due_soon", "22. exakt 10 min vorbei -> NICHT overdue (Grace-Grenze)");
eq(derive(retRide({ assignedDriverId: "d1" }), { driver: DRIVER, minutesUntil: -11 }).group, "overdue", "23. 11 min vorbei -> overdue");
eq(derive(retRide({ assignedDriverId: "d1" }), { driver: DRIVER, minutesUntil: -60 }).group, "overdue", "24. 60 min vorbei -> overdue");
eq(derive(retRide({ status: "planned", assignedDriverId: "d1" }), { driver: DRIVER, minutesUntil: -30 }).rideStarted, false, "25. overdue: nicht gestartet");
eq(derive(retRide({ status: "planned", assignedDriverId: "d1" }), { driver: DRIVER, minutesUntil: -30 }).rideCompleted, false, "26. overdue: nicht abgeschlossen");
eq(derive(retRide({ assignedDriverId: null }), { minutesUntil: -9 }).group, "driver_missing", "27. 9 min vorbei ohne Fahrer (Grace) -> driver_missing, nicht overdue");
eq(derive(retRide({ assignedDriverId: "d1" }), { driver: DRIVER, minutesUntil: -30 }).minutesOverdue, 30, "28. minutesOverdue korrekt");
ok(derive(retRide({ assignedDriverId: null }), { minutesUntil: -40 }).secondaryInfo.includes("Kein Fahrer zugeteilt"), "28b. overdue ohne Fahrer -> Zusatzhinweis kein Fahrer");

// =====================================================================
// 6) Prüfen / needs_review (Tests 29-36)
// =====================================================================
eq(derive(retRide({ djName: "A", assignedDriverId: "d1" }), { driver: DRIVER, timing: T_BEFORE, minutesUntil: 40 }).group, "needs_review", "29. Rueckfahrt vor Set-Ende -> needs_review");
ok(derive(retRide({ djName: "A" }), { timing: T_BEFORE, minutesUntil: 40 }).reasons.includes("return_before_set_end"), "29b. reason return_before_set_end");
eq(derive(retRide({ time: "" }), { minutesUntil: 40 }).group, "needs_review", "30. fehlende Abfahrtzeit -> needs_review");
ok(derive(retRide({ time: "" })).reasons.includes("planned_departure_missing"), "30b. reason planned_departure_missing");
eq(derive(retRide({ date: "" })).group, "needs_review", "31. fehlendes Datum -> needs_review");
eq(derive(retRide({ dayKey: "" })).group, "needs_review", "32. unbekannter Betriebstag -> needs_review");
ok(derive(retRide({ dayKey: "" })).reasons.includes("festival_day_unknown"), "32b. reason festival_day_unknown");
eq(derive(retRide({ assignedDriverId: "dX" }), { driver: null, minutesUntil: 40 }).group, "needs_review", "33. unbekannte Fahrerreferenz -> needs_review");
ok(derive(retRide({ assignedDriverId: "dX" }), { driver: null, minutesUntil: 40 }).reasons.includes("driver_unresolved"), "33b. reason driver_unresolved");
eq(derive(retRide({ djName: "A" }), { match: { status: "multiple_candidates", selected: null }, timing: { status: "multiple_candidates", severity: "info" }, minutesUntil: 40 }).group, "needs_review", "34. uneindeutiges Artist-Match (mit Artist) -> needs_review");
ok(derive(retRide({ djName: "A" }), { match: { status: "multiple_candidates", selected: null }, timing: { status: "multiple_candidates", severity: "info" } }).reasons.includes("multiple_timetable_candidates"), "35. reason multiple_timetable_candidates");
ok(derive(retRide({ time: "" })).requiresReview === true, "36. requiresReview-Flag gesetzt");
eq(derive(retRide({ djName: "A" }), { match: { status: "invalid_artist" }, timing: { status: "invalid_artist" }, minutesUntil: 40 }).group, "needs_review", "36b. invalid_artist -> needs_review");

// =====================================================================
// 7) Timetable-Wiederverwendung (Tests 37-42)
// =====================================================================
eq(derive(retRide({ djName: "A", assignedDriverId: "d1" }), { driver: DRIVER, timing: T_RETURN_OK, minutesUntil: 200 }).group, "driver_assigned", "37. return_ok allein erzeugt KEIN needs_review");
ok(!derive(retRide({ djName: "A" }), { timing: T_RETURN_OK, minutesUntil: 200 }).reasons.includes("return_before_set_end"), "37b. return_ok -> kein Prueflauf-Reason");
eq(derive(retRide({ djName: "A" }), { timing: T_BEFORE, minutesUntil: 40 }).group, "needs_review", "38. return_before_set_end erzeugt Prueflauf");
{ const o = derive(retRide({ djName: "A" }), { match: { status: "multiple_candidates", selected: null }, timing: { status: "multiple_candidates" }, minutesUntil: 40 });
  ok(o.timetableStatus === "multiple_candidates", "39. multiple_candidates wird nicht automatisch zugeordnet (Status durchgereicht)"); }
{ const o = derive(retRide({ djName: "A" }), { match: { status: "no_match" }, timing: { status: "no_match" }, minutesUntil: 40 });
  ok(o.group !== "needs_review" && o.secondaryInfo.includes("Kein passendes Timetable-Set gefunden"), "40. no_match erfindet keine Set-Zeit, kein erzwungenes review"); }
// 41/42: echtes C3-Ergebnis wird wiederverwendet (kein zweiter Set-Ende-Rechenweg)
{ const tt = normalizeTimetableEntries([{ festival_day: null, stage: "Main", artist: "TestAct", start: "2026-07-24 23:00", end: "2026-07-25 01:00" }]);
  const ride = retRide({ djName: "TestAct", time: "00:30", date: "2026-07-25" }); // Abfahrt 30 min VOR Set-Ende
  const match = matchRideToTimetable({ ride, timetableEntries: tt });
  const timing = evaluateTimetableTiming({ ride, matchResult: match, setup, now: Date.now() });
  const o = deriveReturnRideOperationalState({ ride, driver: null, timetableMatch: match, timingEvaluation: timing, now: nowFor(ride, 40), setup });
  eq(timing.status, "return_before_set_end", "41. echtes C3 liefert return_before_set_end");
  eq(o.group, "needs_review", "42. D nutzt C3-Ergebnis -> needs_review"); }

// =====================================================================
// 8) Mitternacht (Tests 43-48)
// =====================================================================
{ const r2350 = retRide({ date: "2026-07-24", time: "23:50" });
  const r0010 = retRide({ date: "2026-07-25", time: "00:10" });
  ok(returnDepartureTs(r2350) < returnDepartureTs(r0010), "43/44/47. 23:50 vor 00:10 (Folgetag) korrekt sortiert ueber Mitternacht");
  eq(festDayKey("2026-07-25", "00:10"), "2026-07-24", "45/46. 00:10 gehoert zum Betriebstag 24.07.");
  // Ueberfaellig-Berechnung nach Mitternacht: 00:10-Fahrt, now 00:30 -> 20 min vorbei
  const o = deriveReturnRideOperationalState({ ride: r0010, driver: null, timetableMatch: M_EXACT, timingEvaluation: T_RETURN_OK, now: returnDepartureTs(r0010) + 20 * 60000, setup });
  eq(o.group, "overdue", "48. overdue-Berechnung nach Mitternacht korrekt"); }

// =====================================================================
// 9) Fahrer (Tests 49-54)
// =====================================================================
{ const o = derive(retRide({ assignedDriverId: "d1" }), { driver: DRIVER, minutesUntil: 200 });
  ok(o.driverAssigned && o.driverResolved, "49. gueltiger Fahrer: assigned + resolved"); }
{ const o = derive(retRide({ assignedDriverId: null }), { minutesUntil: 200 });
  ok(!o.driverAssigned && !o.driverResolved, "50. fehlender Fahrer: nicht assigned"); }
{ const o = derive(retRide({ assignedDriverId: "dX" }), { driver: null, minutesUntil: 200 });
  ok(o.driverAssigned && !o.driverResolved, "51. unbekannte Fahrer-ID: assigned, aber nicht resolved"); }
{ const springer = { id: "sp1", firstName: "Springer", lastName: "S", vehicleType: "Van", isSpringer: true };
  eq(derive(retRide({ assignedDriverId: "sp1" }), { driver: springer, minutesUntil: 30 }).group, "due_soon", "52. Springer-Fahrer zaehlt als gueltiger Fahrer"); }
{ const team = { id: "t1", firstName: "Timmy", lastName: "T", vehicleType: "Van", teamGroup: "TT" };
  ok(derive(retRide({ assignedDriverId: "t1" }), { driver: team, minutesUntil: 30 }).driverResolved, "53. Team-Fahrer bleibt aufloesbar"); }
{ const r = retRide({ assignedDriverId: "d1" }); const before = JSON.stringify(r);
  derive(r, { driver: { ...DRIVER, availableFrom: "20:00" }, minutesUntil: 30 });
  eq(JSON.stringify(r), before, "54. availableFrom / Ride unveraendert"); }

// =====================================================================
// 10) Echte Rückfahrten-Erkennung (Tests 55-61)
// =====================================================================
const isReturn = (r) => r.status !== "cancelled" && (r.type === "return" || r.fromId === "festival");
const withType = (o) => ({ ...o, type: classify(o.fromId, o.toId, o.fromCustom || "", o.toCustom || "") });
ok(isReturn(withType({ fromId: "festival", toId: "sheraton", status: "planned" })), "55. Festival -> Hotel enthalten");
ok(isReturn(withType({ fromId: "festival", toId: "leonardo", status: "planned" })), "56. Festival -> Leonardo enthalten (via fromId)");
ok(isReturn(withType({ fromId: "festival", toId: "hbf", status: "planned" })), "57. Festival -> HBF enthalten (via fromId)");
ok(!isReturn(withType({ fromId: "sheraton", toId: "festival", status: "planned" })), "58. Hotel -> Festival NICHT enthalten");
ok(!isReturn(withType({ fromId: "leonardo", toId: "festival", status: "planned" })), "59. Leonardo -> Festival NICHT enthalten");
ok(!isReturn(withType({ fromId: "hbf", toId: "festival", status: "planned" })), "60. HBF -> Festival NICHT enthalten");
ok(!isReturn(withType({ fromId: "festival", toId: "sheraton", status: "cancelled" })), "61. Sheraton-Regel/Storno: cancelled nicht enthalten");

// =====================================================================
// 11) Sortierung (Tests 62-66)
// =====================================================================
{ const a = { ride: retRide({ id: "a", time: "23:00" }), timing: T_RETURN_OK };
  const b = { ride: retRide({ id: "b", time: "23:30" }), timing: T_RETURN_OK };
  ok(returnGroupSort("overdue", a, b) < 0, "62. overdue: frueheste (staerkste) zuerst");
  ok(returnGroupSort("driver_missing", a, b) < 0, "63. driver_missing: naechste Abfahrt zuerst");
  ok(returnGroupSort("due_soon", a, b) < 0, "64. due_soon: naechste Abfahrt zuerst"); }
{ const a = { ride: retRide({ id: "a", time: "23:00" }), timing: T_RETURN_OK };
  const b = { ride: retRide({ id: "b", time: "23:00" }), timing: T_RETURN_OK };
  ok(returnGroupSort("due_soon", a, b) < 0, "65. stabile Reihenfolge bei gleicher Zeit (id-Tie-Break)"); }
{ const a = { ride: retRide({ id: "a", time: "23:00" }), timing: T_RETURN_OK };
  const b = { ride: retRide({ id: "b", time: "23:30" }), timing: T_RETURN_OK };
  ok(returnGroupSort("completed", a, b) > 0, "66. completed: neueste (spaeteste) zuerst"); }
{ const a = { ride: retRide({ id: "a", time: "23:00" }), timing: { ...T_BEFORE, minutesRelativeToSetEnd: -10 } };
  const b = { ride: retRide({ id: "b", time: "23:30" }), timing: { ...T_BEFORE, minutesRelativeToSetEnd: -45 } };
  ok(returnGroupSort("needs_review", a, b) > 0, "66b. needs_review: groesste Set-Ende-Abweichung zuerst"); }

// =====================================================================
// 12) Read-only / Determinismus (Tests 83-91)
// =====================================================================
{ const ride = retRide({ djName: "A", assignedDriverId: "d1" });
  const driver = { ...DRIVER }; const match = JSON.parse(JSON.stringify(M_EXACT)); const timing = JSON.parse(JSON.stringify(T_BEFORE));
  const rs = JSON.stringify(ride), ds = JSON.stringify(driver), ms = JSON.stringify(match), ts = JSON.stringify(timing);
  const now = nowFor(ride, 40);
  const o1 = deriveReturnRideOperationalState({ ride, driver, timetableMatch: match, timingEvaluation: timing, now, setup });
  eq(JSON.stringify(ride), rs, "83. Ride nicht mutiert");
  eq(JSON.stringify(driver), ds, "84. Driver nicht mutiert");
  eq(JSON.stringify(match), ms, "85. Match nicht mutiert");
  eq(JSON.stringify(timing), ts, "86. C3-Ergebnis nicht mutiert");
  const o2 = deriveReturnRideOperationalState({ ride, driver, timetableMatch: match, timingEvaluation: timing, now, setup });
  eq(JSON.stringify(o1), JSON.stringify(o2), "91. gleiche Eingabe + gleiches now -> identisches Ergebnis"); }
// 87-90: keine Schreibfunktionen im Quellcode der D-Klassifizierung
{ const body = rawSrc.slice(rawSrc.indexOf("function deriveReturnRideOperationalState"), rawSrc.indexOf("function returnGroupSort"));
  ok(!/updateDyn|storage\.set|supabase|localStorage|\.push_subscription|advanceStatus|assignRide/.test(body), "87-90. deriveReturnRideOperationalState enthaelt keinen Schreibweg"); }

// =====================================================================
// 13) Diagnose-Vollstaendigkeit (Spec 30)
// =====================================================================
{ const o = derive(retRide({ djName: "A", assignedDriverId: "d1" }), { driver: DRIVER, timing: T_RETURN_OK, minutesUntil: 30 });
  const keys = ["group", "severity", "label", "sortPriority", "scheduledDepartureAt", "minutesUntilDeparture", "minutesOverdue", "driverAssigned", "driverResolved", "rideStarted", "rideCompleted", "timetableStatus", "requiresReview", "reasons", "secondaryInfo"];
  ok(keys.every((k) => k in o), "Diag. alle Pflichtfelder vorhanden");
  ok(Array.isArray(o.reasons) && Array.isArray(o.secondaryInfo), "Diag. reasons/secondaryInfo sind Arrays");
  eq(o.sortPriority, RETURN_OPERATIONAL_GROUP_ORDER[o.group], "Diag. sortPriority passt zur Gruppe"); }

// GEGENPROBE: kaputte Schwelle wuerde auffallen
{ const g = derive(retRide({ assignedDriverId: "d1" }), { driver: DRIVER, minutesUntil: 61 }).group;
  ok(g === "driver_assigned", "GEGENPROBE: 61 min ist NICHT due_soon (Schwelle 60 aktiv)"); }

console.log(`\n=== D-Logik: ${pass} bestanden, ${fail} fehlgeschlagen ===`);
if (fail > 0) process.exit(1);
