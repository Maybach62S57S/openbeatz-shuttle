// Teilpaket C3 - Logiktests gegen die ECHTEN Quellfunktionen (Wegwerf-Kopie der
// Quelle + Export, Original bleibt unangetastet). Deckt Grenzwerte, Mitternacht,
// Leonardo/HBF, Match-Sicherheit, fehlende Daten, Read-only und Determinismus ab.
import fs from "fs";
import { execSync } from "child_process";

const srcFile = process.argv[2] || "src/ShuttleLeitstelle.jsx";
const rawSrc = fs.readFileSync(srcFile, "utf8");
const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/c3-src-" + tag + ".jsx";
fs.writeFileSync(copy, rawSrc + `
export { evaluateTimetableTiming, gradeArrivalMargin, c3RideStartAbsMin, c3AbsToParts, TIMETABLE_WARNING_CONFIG, matchRideToTimetable, normalizeTimetableEntries, festDayKey, seedMatrix, seedLocations, ttAbsMin };
`);
const out = "/home/claude/repo/.c3-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const M = await import(out);
fs.unlinkSync(out); fs.unlinkSync(copy);

const {
  evaluateTimetableTiming, gradeArrivalMargin, c3RideStartAbsMin, c3AbsToParts,
  TIMETABLE_WARNING_CONFIG, matchRideToTimetable, normalizeTimetableEntries,
  festDayKey, seedMatrix, seedLocations, ttAbsMin,
} = M;

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log("OK   " + name); } else { fail++; console.log("FAIL " + name); } }
function eq(a, b, name) { ok(a === b, `${name} (erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)})`); }

const setup = { matrix: seedMatrix(), locations: seedLocations() };
const cfg = TIMETABLE_WARNING_CONFIG;
const TRAVEL_SHERATON = setup.matrix["sheraton|festival"].min; // 38

// Timetable-Fabrik: EIN Artist, EIN Set (eindeutiger exact-Match). Start/Ende am
// selben Kalendertag (fuer Abend-Sets ohne Mitternachtswechsel).
function ttOne(artist, day, start, end, stage = "Mainstage") {
  return normalizeTimetableEntries([{ festival_day: null, stage, artist, start: `${day} ${start}`, end: `${day} ${end}` }]);
}
// Wie ttOne, aber mit vollen "YYYY-MM-DD HH:MM"-Strings (Sets ueber Mitternacht:
// Ende hat das echte spaetere Datum - so wie C1 es aus den Rohdaten erhaelt).
function ttOneDT(artist, startDT, endDT, stage = "Mainstage") {
  return normalizeTimetableEntries([{ festival_day: null, stage, artist, start: startDT, end: endDT }]);
}
function ride(o) { return { fromId: "sheraton", toId: "festival", fromCustom: "", toCustom: "", date: "2026-07-25", ...o }; }
function evalR(r, entries) {
  const match = matchRideToTimetable({ ride: r, timetableEntries: entries });
  return evaluateTimetableTiming({ ride: r, matchResult: match, setup, now: Date.now() });
}

// ---- Hilfen: Ride-Zeit fuer gewuenschte Ankunfts-Marge (Hinfahrt, sheraton->festival) ----
// setStart als Absolutminute; arrival = setStart - margin; rideStart = arrival - travel.
function rideTimeForMargin(setDay, setStart, margin, travel = TRAVEL_SHERATON) {
  const setAbs = ttAbsMin(`${setDay} ${setStart}`);
  const arrAbs = setAbs - margin;
  const rideAbs = arrAbs - travel;
  const p = c3AbsToParts(rideAbs);
  return { date: p.iso.slice(0, 10), time: p.hm };
}

// =====================================================================
// 1) Grader-Referenz + Grenzwerte (Spec 4.5, Tests 1-30)
// =====================================================================
function refStatus(margin) {
  if (margin >= 40) return "on_time";
  if (margin >= 20) return "tight";
  if (margin >= 0) return "critical";
  return "late";
}
// gradeArrivalMargin direkt (reine Grenzlogik)
for (const [m, s, sev] of [
  [90, "on_time", "ok"], [41, "on_time", "ok"], [40, "on_time", "ok"],
  [39, "tight", "warning"], [30, "tight", "warning"], [25, "tight", "warning"], [24, "tight", "warning"], [20, "tight", "warning"],
  [19, "critical", "critical"], [10, "critical", "critical"], [1, "critical", "critical"], [0, "critical", "critical"],
  [-1, "late", "critical"], [-15, "late", "critical"], [-30, "late", "critical"],
]) {
  const g = gradeArrivalMargin(m, cfg);
  eq(g.status, s, `grade(${m}).status`);
  eq(g.severity, sev, `grade(${m}).severity`);
}

// Vollstaendige Grenzwertabdeckung -120..+180: genau eine Stufe, keine Luecke/Ueberschneidung.
{
  let gaplessOk = true, singleOk = true;
  const valid = new Set(["on_time", "tight", "critical", "late"]);
  for (let m = -120; m <= 180; m++) {
    const g = gradeArrivalMargin(m, cfg);
    if (!valid.has(g.status)) singleOk = false;
    if (g.status !== refStatus(m)) gaplessOk = false;
  }
  ok(gaplessOk, "24-26. jeder Ganzminutenwert -120..+180 exakt einer Stufe (keine Luecke/Ueberschneidung)");
  ok(singleOk, "24. nur gueltige Stufenwerte");
  eq(gradeArrivalMargin(40, cfg).status, "on_time", "27. 40 min ausschliesslich on_time");
  eq(gradeArrivalMargin(20, cfg).status, "tight", "28. 20 min ausschliesslich tight");
  eq(gradeArrivalMargin(0, cfg).status, "critical", "29. 0 min ausschliesslich critical");
  eq(gradeArrivalMargin(-1, cfg).status, "late", "30. -1 min ausschliesslich late");
}

// Ende-zu-Ende ueber echte Rides (Motor + Marge zusammen), Set 21:30.
const ENT = ttOne("Zeitpruef Act", "2026-07-25", "21:30", "23:00");
for (const m of [90, 41, 40, 39, 30, 25, 24, 20, 19, 10, 1, 0, -1, -15, -30]) {
  const rt = rideTimeForMargin("2026-07-25", "21:30", m);
  const r = ride({ djName: "Zeitpruef Act", date: rt.date, time: rt.time });
  const res = evalR(r, ENT);
  eq(res.marginMinutes, m, `E2E Marge ${m}: marginMinutes`);
  eq(res.status, refStatus(m), `E2E Marge ${m}: status`);
}

// Beispiele aus Spec Abschnitt 5 (exakte Zahlen)
{
  // Ride 20:00 + 38 = 20:38, Set 21:30 -> Puffer 52 -> on_time
  const r = ride({ djName: "Zeitpruef Act", time: "20:00" });
  const res = evalR(r, ENT);
  eq(res.status, "on_time", "Spec5 rechtzeitig status"); eq(res.marginMinutes, 52, "Spec5 rechtzeitig Puffer 52");
  ok(res.message.includes("52 Minuten vor Set-Beginn"), "Spec5 rechtzeitig Meldung");
}
{ const res = evalR(ride({ djName: "Zeitpruef Act", time: "20:20" }), ENT); eq(res.status, "tight", "Spec5 knapp status"); eq(res.marginMinutes, 32, "Spec5 knapp Puffer 32"); }
{ const res = evalR(ride({ djName: "Zeitpruef Act", time: "20:35" }), ENT); eq(res.status, "critical", "Spec5 kritisch status"); eq(res.marginMinutes, 17, "Spec5 kritisch Puffer 17"); }
{ const res = evalR(ride({ djName: "Zeitpruef Act", time: "21:05" }), ENT); eq(res.status, "late", "Spec5 zu spaet status"); eq(res.marginMinutes, -13, "Spec5 zu spaet Puffer -13"); ok(res.message.includes("13 Minuten nach Set-Beginn"), "Spec5 zu spaet Meldung"); }

// severity-Zuordnung
{ const res = evalR(ride({ djName: "Zeitpruef Act", time: "20:00" }), ENT); eq(res.severity, "ok", "on_time severity=ok"); }
{ const res = evalR(ride({ djName: "Zeitpruef Act", time: "20:20" }), ENT); eq(res.severity, "warning", "tight severity=warning"); }
{ const res = evalR(ride({ djName: "Zeitpruef Act", time: "20:35" }), ENT); eq(res.severity, "critical", "critical severity=critical"); }
{ const res = evalR(ride({ djName: "Zeitpruef Act", time: "21:05" }), ENT); eq(res.severity, "critical", "late severity=critical"); }

// =====================================================================
// 2) Rueckfahrt (Spec 8, Tests 31-36)
// =====================================================================
const ENT_R = ttOneDT("Return Act", "2026-07-25 23:30", "2026-07-26 01:00"); // endet 2026-07-26 01:00
function retRide(dep) { // dep = {date,time} der Abfahrt vom Festival
  return ride({ djName: "Return Act", fromId: "festival", toId: "sheraton", ...dep });
}
{ const res = evalR(retRide({ date: "2026-07-26", time: "01:30" }), ENT_R); eq(res.status, "return_ok", "31/35. Rueckfahrt +30 -> return_ok"); eq(res.minutesRelativeToSetEnd, 30, "31. rel=+30"); eq(res.severity, "ok", "return_ok severity=ok"); }
{ const res = evalR(retRide({ date: "2026-07-26", time: "01:00" }), ENT_R); eq(res.status, "return_ok", "32. Rueckfahrt exakt Set-Ende -> return_ok"); eq(res.minutesRelativeToSetEnd, 0, "32. rel=0"); }
{ const res = evalR(retRide({ date: "2026-07-26", time: "00:59" }), ENT_R); eq(res.status, "return_before_set_end", "33/36. Rueckfahrt 1 min vor Set-Ende"); eq(res.minutesRelativeToSetEnd, -1, "33. rel=-1"); eq(res.severity, "critical", "return_before_set_end severity=critical"); }
{ const res = evalR(retRide({ date: "2026-07-26", time: "00:30" }), ENT_R); eq(res.status, "return_before_set_end", "34. Rueckfahrt 30 min vor Set-Ende"); eq(res.minutesRelativeToSetEnd, -30, "34. rel=-30"); ok(res.message.includes("30 Minuten vor dem geplanten Set-Ende"), "34. Meldung vor Set-Ende"); }

// =====================================================================
// 3) Mitternacht (Spec 10, Tests 37-43)
// =====================================================================
{
  // Set 23:30-00:30 (Ende naechster Kalendertag)
  const ent = ttOneDT("Nacht Act", "2026-07-25 23:30", "2026-07-26 00:30");
  // Hinfahrt vor Mitternacht: Ride 22:30 + 38 = 23:08, Set 23:30 -> Puffer 22 -> tight
  const rH = ride({ djName: "Nacht Act", date: "2026-07-25", time: "22:30" });
  const resH = evalR(rH, ent);
  eq(resH.status, "tight", "37/38. Hinfahrt vor Mitternacht zu Set 23:30 (tight)");
  eq(resH.marginMinutes, 22, "38. Puffer 22");
  // Rueckfahrt nach Mitternacht: Abfahrt 00:45 (2026-07-26), Set-Ende 00:30 -> +15 -> return_ok
  const rR = retRide({ date: "2026-07-26", time: "00:45" });
  const resR = evaluateTimetableTiming({ ride: { ...rR, djName: "Nacht Act" }, matchResult: matchRideToTimetable({ ride: { ...rR, djName: "Nacht Act" }, timetableEntries: ent }), setup, now: Date.now() });
  eq(resR.status, "return_ok", "39. Rueckfahrt nach Mitternacht (return_ok)");
  eq(resR.minutesRelativeToSetEnd, 15, "39. rel=+15");
}
{
  // Set beginnt nach Mitternacht, gehoert zur VORIGEN Festival-Nacht (Betriebstag 2026-07-25)
  const ent = ttOne("Spaet Act", "2026-07-26", "01:00", "02:00");
  eq(ent[0].dayKey, "2026-07-25", "40. Set 01:00 gehoert zu Betriebstag 25.07.");
  // Fahrt beginnt nach Mitternacht (01:00 am 2026-07-26 -> festDayKey 25.07.)
  eq(festDayKey("2026-07-26", "01:00"), "2026-07-25", "41/42. Fahrt nach Mitternacht -> korrekter festDayKey 25.07.");
  // Hinfahrt: Ride 00:00 (2026-07-26) + 38 = 00:38, Set 01:00 -> Puffer 22 -> tight
  const r = ride({ djName: "Spaet Act", date: "2026-07-26", time: "00:00" });
  const res = evalR(r, ent);
  eq(res.status, "tight", "43. Fahrt+Set verschiedene Kalendertage, selber Betriebstag -> bewertet");
  eq(res.marginMinutes, 22, "43. Puffer 22 ueber Mitternacht korrekt");
}

// =====================================================================
// 4) Leonardo / HBF (Spec 7/9, Tests 44-49)
// =====================================================================
{
  // Leonardo -> Festival: operativ Sheraton -> Festival (38), NICHT eigene Route.
  const ent = ttOne("Leo Act", "2026-07-25", "21:00", "22:30");
  const r = ride({ djName: "Leo Act", fromId: "__custom", fromCustom: "Leonardo Hotel", toId: "festival", time: "20:00" });
  const res = evalR(r, ent);
  eq(res.operationalFrom, "sheraton", "44. Leonardo->Festival operativ ab Sheraton");
  eq(res.operationalTravelMinutes, 38, "44. Fahrzeit 38 (Sheraton->Festival)");
  // Ankunft 20:38, Set 21:00 -> Puffer 22 -> tight
  eq(res.status, "tight", "44. Leonardo->Festival bewertet ueber Sheraton");
}
{
  // HBF -> Festival: operativ Sheraton -> Festival
  const ent = ttOne("Hbf Act", "2026-07-25", "21:00", "22:30");
  const r = ride({ djName: "Hbf Act", fromId: "__custom", fromCustom: "Nuernberg Hbf", toId: "festival", time: "20:00" });
  const res = evalR(r, ent);
  eq(res.operationalFrom, "sheraton", "45. HBF->Festival operativ ab Sheraton");
  eq(res.operationalTravelMinutes, 38, "45. HBF Fahrzeit 38");
}
{
  // Festival -> Leonardo: Ziel bleibt Leonardo (Rueckfahrt), Sheraton-Regel gilt NICHT.
  const ent = ttOne("LeoBack Act", "2026-07-25", "20:00", "22:00");
  const r = ride({ djName: "LeoBack Act", fromId: "festival", toId: "__custom", toCustom: "Leonardo Hotel", date: "2026-07-25", time: "22:15" });
  const res = evalR(r, ent);
  eq(res.direction, "from_festival", "46. Festival->Leonardo bleibt Rueckfahrt");
  eq(res.operationalFrom, "festival", "46. Startknoten Festival");
  eq(res.status, "return_ok", "46. Rueckfahrt nach Set-Ende (return_ok)");
}
{
  // Festival -> HBF bleibt Rueckfahrt zum HBF
  const ent = ttOne("HbfBack Act", "2026-07-25", "20:00", "22:00");
  const r = ride({ djName: "HbfBack Act", fromId: "festival", toId: "__custom", toCustom: "Nuernberg Hbf", date: "2026-07-25", time: "21:30" });
  const res = evalR(r, ent);
  eq(res.direction, "from_festival", "47. Festival->HBF bleibt Rueckfahrt");
  eq(res.status, "return_before_set_end", "47. Abfahrt vor Set-Ende");
}

// =====================================================================
// 5) Match-Sicherheit (Spec 11, Tests 50-57)
// =====================================================================
{ const res = evalR(ride({ djName: "Zeitpruef Act", time: "20:00" }), ENT); eq(res.matchStatus, "exact", "50. exact-Match"); ok(["on_time"].includes(res.status), "50. exact -> harte Bewertung erlaubt"); }
{
  // multiple_candidates: zwei Sets desselben Artists am selben Tag, andere Richtung als Zeit -> keine eindeutige Auswahl
  const ent = normalizeTimetableEntries([
    { festival_day: null, stage: "A", artist: "Multi Act", start: "2026-07-25 14:00", end: "2026-07-25 15:00" },
    { festival_day: null, stage: "B", artist: "Multi Act", start: "2026-07-25 20:00", end: "2026-07-25 21:00" },
  ]);
  const r = ride({ djName: "Multi Act", fromId: "sheraton", toId: "airport", time: "12:00" }); // andere Richtung -> pickByTime null
  const res = evalR(r, ent);
  // Diese Fahrt ist hotel->airport -> not_applicable dominiert (kein Festivalbezug)
  eq(res.status, "not_applicable", "53a. hotel->airport dominiert (not_applicable)");
}
{
  // multiple_candidates bei Hinfahrt: zwei gleich weit entfernte Sets -> keine harte Bewertung
  const ent = normalizeTimetableEntries([
    { festival_day: null, stage: "A", artist: "Twin Act", start: "2026-07-25 20:00", end: "2026-07-25 21:00" },
    { festival_day: null, stage: "B", artist: "Twin Act", start: "2026-07-25 22:00", end: "2026-07-25 23:00" },
  ]);
  // Ride 21:00: sortMin 21:00=1260; nach Ankunft (21:38) liegen beide? start 20:00<21:38, 22:00>21:38 -> after=[22:00] eindeutig.
  // Um Mehrdeutigkeit zu erzwingen: Ride so, dass Abstand gleich. Ankunftszeit egal - pickByTime nutzt ride.time.
  // ride.time 21:00 -> after=[22:00] (nur eins) -> eindeutig. Nehmen wir ride.time 19:00: after=[20:00,22:00], Abstand 60 vs 180 -> 20:00.
  // Gleichstand: ride.time 21:00, kein 'after' Gleichstand. Nutze zwei Sets symmetrisch um ride.time:
  const ent2 = normalizeTimetableEntries([
    { festival_day: null, stage: "A", artist: "Sym Act", start: "2026-07-25 20:00", end: "2026-07-25 21:00" },
    { festival_day: null, stage: "B", artist: "Sym Act", start: "2026-07-25 20:00", end: "2026-07-25 21:00" },
  ]);
  const r = ride({ djName: "Sym Act", time: "19:00" });
  const res = evalR(r, ent2);
  eq(res.status, "multiple_candidates", "53. multiple_candidates erzeugt keine harte Zeitbewertung");
  eq(res.severity, "info", "53. multiple_candidates severity=info");
  ok(res.marginMinutes == null, "53. keine Marge bei multiple_candidates");
}
{ const res = evalR(ride({ djName: "Gibt Es Nicht Xyz", time: "20:00" }), ENT); eq(res.status, "no_match", "54. no_match erzeugt keine harte Bewertung"); ok(res.marginMinutes == null, "54. keine Marge"); }
{ const res = evalR(ride({ djName: "", time: "20:00" }), ENT); eq(res.status, "missing_artist", "55. missing_artist"); }
{ const res = evalR(ride({ djName: "!!! ***", time: "20:00" }), ENT); eq(res.status, "invalid_artist", "56. invalid_artist"); }
{
  // 57. Zeitnaehe ohne sicheren Artist-Match -> keine Warnung (Set existiert, aber anderer Artist)
  const ent = ttOne("Bekannt Act", "2026-07-25", "21:30", "23:00");
  const r = ride({ djName: "Unbekannt Act", time: "20:52" }); // Zeit waere kritisch, aber Artist matcht nicht
  const res = evalR(r, ent);
  eq(res.status, "no_match", "57. Zeitnaehe ohne Artist-Match -> no_match, keine Warnung");
  ok(res.severity !== "critical", "57. keine kritische Warnung");
}

// =====================================================================
// 6) Fehlende Daten (Spec 12/13/14, Tests 58-67)
// =====================================================================
{ const res = evalR(ride({ djName: "Zeitpruef Act", time: "" }), ENT); eq(res.status, "timing_unknown", "58. fehlende Ride-Zeit -> timing_unknown"); }
{ const res = evalR(ride({ djName: "Zeitpruef Act", time: "99:99" }), ENT); eq(res.status, "timing_unknown", "59. ungueltige Ride-Zeit -> timing_unknown"); }
{ const res = evalR(ride({ djName: "Zeitpruef Act", date: "", time: "20:00" }), ENT); eq(res.status, "timing_unknown", "60. fehlendes Ride-Datum -> timing_unknown"); }
{
  // 61. fehlende Matrixverbindung: unbekannter Custom-Ort -> Festival
  const ent = ttOne("Nowhere Act", "2026-07-25", "21:30", "23:00");
  const r = ride({ djName: "Nowhere Act", fromId: "__custom", fromCustom: "Voellig Unbekannter Ort 12345", toId: "festival", time: "20:00" });
  const res = evalR(r, ent);
  eq(res.status, "timing_unknown", "61. fehlende Fahrzeit -> timing_unknown");
  ok(res.operationalTravelMinutes == null, "61. keine Fahrzeit gesetzt");
  ok(res.estimatedArrivalAt == null, "62. keine geschaetzte Ankunft bei unbekanntem Ort");
  ok(res.message.includes("keine sichere Fahrzeit"), "61. Meldung: keine sichere Fahrzeit");
}
{
  // 63. fehlender Set-Start (ungueltige Startzeit im Timetable)
  const ent = normalizeTimetableEntries([{ festival_day: null, stage: "A", artist: "BadStart Act", start: "kaputt", end: "2026-07-25 23:00" }]);
  const r = ride({ djName: "BadStart Act", time: "20:00" });
  const res = evalR(r, ent);
  // ungueltiger Eintrag ist nicht valid -> kein Match -> no_match (kein harter Wert)
  ok(res.status === "no_match" || res.status === "timing_unknown", "63. fehlender/ungueltiger Set-Start -> keine harte Bewertung");
}
{
  // 65. ungueltige Timetable-Zeit -> Eintrag invalid -> no_match
  const ent = normalizeTimetableEntries([{ festival_day: null, stage: "A", artist: "BadEnd Act", start: "2026-07-25 21:00", end: "25:99" }]);
  const r = ride({ djName: "BadEnd Act", time: "20:00" });
  const res = evalR(r, ent);
  ok(res.status === "no_match", "64/65. ungueltige Timetable-Endzeit -> Eintrag verworfen, kein harter Wert");
}
{ // 67. keine Schaetzung bei fehlenden Daten (schon durch 61/62 belegt) - Zusatz: timing_unknown hat marginMinutes null
  const res = evalR(ride({ djName: "Zeitpruef Act", time: "" }), ENT);
  ok(res.marginMinutes == null && res.estimatedArrivalAt == null, "67. keine Schaetzung/Marge bei fehlenden Daten");
}

// =====================================================================
// 7) Andere Richtungen (Spec 15, Tests 68-71)
// =====================================================================
{ const res = evalR(ride({ djName: "Zeitpruef Act", fromId: "sheraton", toId: "airport", time: "10:00" }), ENT); eq(res.status, "not_applicable", "68. Hotel->Flughafen -> not_applicable"); }
{ const res = evalR(ride({ djName: "Zeitpruef Act", fromId: "airport", toId: "sheraton", time: "10:00" }), ENT); eq(res.status, "not_applicable", "69. Flughafen->Hotel -> not_applicable"); }
{ const res = evalR(ride({ djName: "Zeitpruef Act", fromId: "sheraton", toId: "moevenpick", time: "10:00" }), ENT); eq(res.status, "not_applicable", "70. Hotel->Hotel -> not_applicable"); }
{ const res = evalR(ride({ djName: "Zeitpruef Act", fromId: "airport", toId: "__custom", toCustom: "Flughafen Muenchen", time: "10:00" }), ENT); eq(res.status, "not_applicable", "71. Flughafen NUE->MUC -> not_applicable"); eq(res.severity, "info", "71. severity=info"); }

// =====================================================================
// 8) Read-only + Determinismus (Spec 18, Tests 72-80)
// =====================================================================
{
  const r = ride({ djName: "Zeitpruef Act", time: "20:00" });
  const match = matchRideToTimetable({ ride: r, timetableEntries: ENT });
  const rSnap = JSON.stringify(r), mSnap = JSON.stringify(match), sSnap = JSON.stringify(setup), eSnap = JSON.stringify(ENT);
  const res1 = evaluateTimetableTiming({ ride: r, matchResult: match, setup, now: 1 });
  const res2 = evaluateTimetableTiming({ ride: r, matchResult: match, setup, now: 999999 });
  eq(JSON.stringify(r), rSnap, "72. Ride nicht mutiert");
  eq(JSON.stringify(match), mSnap, "73. Match-Ergebnis nicht mutiert");
  eq(JSON.stringify(ENT), eSnap, "74. Timetable-Eintrag nicht mutiert");
  eq(JSON.stringify(setup), sSnap, "75. Setup nicht mutiert");
  eq(JSON.stringify(res1), JSON.stringify(res2), "80. identische Eingabe -> identisches Ergebnis (now ignoriert)");
}
// 76-79: statische Analyse - C3-Schicht enthaelt keine Schreibwege
{
  const cStart = rawSrc.indexOf("TEILPAKET C3 - rein lesende");
  const cEnd = rawSrc.indexOf("function MissionDriversTab");
  const c3Body = cStart >= 0 && cEnd > cStart ? rawSrc.slice(cStart, cEnd) : "";
  ok(c3Body.length > 0, "C3-Schicht-Bereich gefunden");
  const forbidden = ["updateDyn", "updateSetup", "supabase", ".insert(", ".update(", "localStorage.setItem", "window.storage", "advanceStatus", "assignRide", "reportIssue", "onSave", "onAssign", "setRideStatus", "logRide"];
  const hits = forbidden.filter((t) => c3Body.includes(t));
  ok(hits.length === 0, "76-79. C3-Schicht enthaelt KEINEN Schreibvorgang - Treffer: " + (hits.join(", ") || "keine"));
  // GEGENPROBE: injizierter Schreibvorgang wuerde erkannt
  ok(forbidden.some((t) => (c3Body + "\nupdateDyn(x=>x);").includes(t)), "GEGENPROBE: injiziertes updateDyn wuerde erkannt");
}

// =====================================================================
// 9) Diagnose-Vollstaendigkeit (Spec 19)
// =====================================================================
{
  const res = evalR(ride({ djName: "Zeitpruef Act", time: "20:00" }), ENT);
  const keys = ["direction", "matchStatus", "rideStartAt", "operationalFrom", "operationalTo", "operationalTravelMinutes", "estimatedArrivalAt", "plannedDepartureAt", "setStartAt", "setEndAt", "marginMinutes", "minutesRelativeToSetEnd", "status", "severity", "message", "reasons"];
  const missing = keys.filter((k) => !(k in res));
  ok(missing.length === 0, "19. Diagnose vollstaendig - fehlt: " + (missing.join(", ") || "nichts"));
  ok(Array.isArray(res.reasons) && res.reasons.length > 0, "19. reasons nachvollziehbar befuellt");
}

// GEGENPROBE: absichtlich falsche Erwartung wird NICHT bestaetigt
{
  const res = evalR(ride({ djName: "Zeitpruef Act", time: "20:00" }), ENT);
  ok(!(res.status === "late"), "GEGENPROBE: on_time-Fall wird nicht faelschlich als late gewertet");
}

console.log(`\n=== C3-Logik: ${pass} bestanden, ${fail} fehlgeschlagen ===`);
if (fail) process.exit(1);
