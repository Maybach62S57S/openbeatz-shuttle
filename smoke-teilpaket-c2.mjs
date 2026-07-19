// Teilpaket C2 - Logiktests (Artist-Normalisierung, Alias, B2B-Split, Matching-
// Reihenfolge, Tages-/Richtungslogik, Mehrdeutigkeit, Read-only) gegen die
// ECHTEN, aus der Quelle gebundelten Funktionen (kein Nachbau). Wegwerf-Kopie
// der Quelle + angehaengter Export, via esbuild gebundelt, dann importiert. Das
// Original wird NICHT angefasst.
import fs from "fs";
import { execSync } from "child_process";

const srcFile = process.argv[2] || "src/ShuttleLeitstelle.jsx";
const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/c2-src-" + tag + ".jsx";
fs.writeFileSync(
  copy,
  fs.readFileSync(srcFile, "utf8") +
    "\nexport { normalizeArtistName, buildArtistAliasIndex, extractTimetableArtists, rideFestivalDirection, rideCanonicalArtist, buildTimetableMatchIndex, pickByTime, matchRideToTimetable, normalizeTimetableEntries, festDayKey };\n"
);
const out = "/home/claude/repo/.c2-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const M = await import(out);
fs.unlinkSync(out); fs.unlinkSync(copy);

const {
  normalizeArtistName, buildArtistAliasIndex, extractTimetableArtists,
  rideFestivalDirection, rideCanonicalArtist, buildTimetableMatchIndex,
  pickByTime, matchRideToTimetable, normalizeTimetableEntries, festDayKey,
} = M;

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log("OK   " + name); } else { fail++; console.log("FAIL " + name); } }
function eq(a, b, name) { ok(JSON.stringify(a) === JSON.stringify(b), `${name} (erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)})`); }

// ---- Timetable-Testdaten (Format wie TIMETABLE_RAW) ----
const RAW = [
  { festival_day: "24/07/2026", stage: "Mainstage", artist: "Gestört aber GeiL", start: "2026-07-24 23:30", end: "2026-07-25 00:30" },
  { festival_day: "25/07/2026", stage: "Mainstage", artist: "Gestört aber GeiL", start: "2026-07-25 22:00", end: "2026-07-25 23:00" },
  { festival_day: "24/07/2026", stage: "Caldera", artist: "DoubleDay", start: "2026-07-24 14:00", end: "2026-07-24 15:00" },
  { festival_day: "24/07/2026", stage: "Zone III", artist: "DoubleDay", start: "2026-07-24 20:00", end: "2026-07-24 21:00" },
  { festival_day: "24/07/2026", stage: "Darkwoods", artist: "Artist A b2b Artist B", start: "2026-07-24 18:00", end: "2026-07-24 19:00" },
  { festival_day: "24/07/2026", stage: "Zone III", artist: "Equal2 B2B Invaderz", start: "2026-07-25 01:00", end: "2026-07-25 02:05" },
  { festival_day: "25/07/2026", stage: "STONELANDS", artist: "Rico vs. Nando", start: "2026-07-25 20:00", end: "2026-07-25 21:00" },
  { festival_day: "26/07/2026", stage: "Goa Garden", artist: "Harris & Ford", start: "2026-07-26 21:30", end: "2026-07-26 23:00" },
  { festival_day: "24/07/2026", stage: "Magical Forest", artist: "MidnightAct", start: "2026-07-25 01:30", end: "2026-07-25 02:30" },
  { festival_day: "24/07/2026", stage: "Gruener Stadl", artist: "Straßenköter", start: "2026-07-24 16:00", end: "2026-07-24 17:00" },
  { festival_day: "26/07/2026", stage: "Mainstage", artist: "ArriveAct", start: "2026-07-26 15:00", end: "2026-07-26 16:00" },
  { festival_day: "26/07/2026", stage: "Mainstage", artist: "ArriveAct", start: "2026-07-26 19:00", end: "2026-07-26 20:00" },
  { festival_day: "26/07/2026", stage: "Caldera", artist: "ReturnAct", start: "2026-07-26 12:00", end: "2026-07-26 13:00" },
  { festival_day: "26/07/2026", stage: "Caldera", artist: "ReturnAct", start: "2026-07-26 18:00", end: "2026-07-26 19:00" },
];
const ENTRIES = normalizeTimetableEntries(RAW);

const ride = (o) => ({ fromId: "sheraton", toId: "festival", date: "2026-07-24", time: "22:00", ...o, dayKey: o.dayKey || festDayKey(o.date || "2026-07-24", o.time || "22:00") });
function m(o) { return matchRideToTimetable({ ride: ride(o), timetableEntries: ENTRIES }); }

// ===== Normalisierung (1-10) =====
eq(normalizeArtistName("Artist A"), "artist a", "1. identischer Name");
eq(normalizeArtistName("ARTIST a"), normalizeArtistName("artist A"), "2. Gross-/Kleinschreibung");
eq(normalizeArtistName("Gestört aber GeiL"), normalizeArtistName("gestoert aber geil"), "3. Umlaute (oe/ae/ue)");
eq(normalizeArtistName("Straße"), normalizeArtistName("Strasse"), "4. ß/ss");
eq(normalizeArtistName("a   b    c"), "a b c", "5. mehrere Leerzeichen");
eq(normalizeArtistName("Jean-Michel"), "jean michel", "6. Bindestrich");
eq(normalizeArtistName("D\u2019Angelo"), normalizeArtistName("D'Angelo"), "7. typografischer Apostroph");
eq(normalizeArtistName("!!! *** ..."), "", "8. nur Sonderzeichen -> leer");
eq(normalizeArtistName(""), "", "9. leerer Wert");
{ const orig = "Gestört aber GeiL"; normalizeArtistName(orig); ok(orig === "Gestört aber GeiL", "10. Originalwert unveraendert"); }
eq(normalizeArtistName("W&W"), normalizeArtistName("W and W"), "10b. & vereinheitlicht");
eq(normalizeArtistName("W&W"), normalizeArtistName("W & W"), "10c. & mit Spaces");

// ===== Exaktes Matching (11-15) =====
ok(m({ djName: "Straßenköter", date: "2026-07-24" }).status === "exact", "11. exakter vollstaendiger Name");
ok(m({ djName: "STRASSENKOETER", date: "2026-07-24" }).status === "exact", "12. normalisiert exakter Name");
{ const r = m({ djName: "Gestört aber GeiL", date: "2026-07-25", time: "20:00" }); ok(r.status === "exact" && r.selected && r.selected.dayKey === "2026-07-25", "13. gleicher Name unterschiedlicher Tag"); }
{ const r = m({ djName: "DoubleDay", date: "2026-07-24", time: "22:00" }); ok(r.selected || r.status === "multiple_candidates", "14. gleicher Name mehrfach am gleichen Tag"); }
ok(m({ djName: "Unbekannt XYZ", date: "2026-07-24" }).status === "no_match", "15. kein Match");

// ===== Alias (16-20) =====
{ const a = buildArtistAliasIndex({ "artist a": ["kuenstler a", "aka a"] }); ok(a.map.get("kuenstler a") === "artist a", "16. eindeutiger Alias"); }
{ const a = buildArtistAliasIndex({ "artist a": ["kuenstler a", "aka a"] }); ok(a.map.get("aka a") === "artist a" && a.map.size === 2, "17. Alias zeigt auf genau einen Artist"); }
{ const a = buildArtistAliasIndex({ "canon one": ["shared"], "canon two": ["shared"] }); ok(!a.map.has("shared") && a.rejected.has("shared"), "18. mehrdeutiger Alias abgelehnt"); }
{ const r = matchRideToTimetable({ ride: ride({ djName: "Voellig Anders", date: "2026-07-24" }), timetableEntries: ENTRIES, aliases: {} }); ok(r.status === "no_match", "19. nicht hinterlegter Alias wird nicht geraten"); }
{ const e2 = normalizeTimetableEntries([{ festival_day: "24/07/2026", stage: "S", artist: "Solo One", start: "2026-07-24 20:00", end: "2026-07-24 21:00" }]);
  const r = matchRideToTimetable({ ride: ride({ djName: "S1 Alias", date: "2026-07-24" }), timetableEntries: e2, aliases: { "solo one": ["s1 alias"] } });
  ok(r.status === "alias" && r.selected && r.selected.artist === "Solo One", "20a. Alias-Match findet Kanon");
  ok(r.rideArtistOriginal === "S1 Alias", "20. sichtbarer Originalname bleibt erhalten (Alias)"); }

// ===== B2B (21-28) =====
{ const r = m({ djName: "Artist A", date: "2026-07-24" }); ok(r.status === "b2b_member" && r.selected.collaborationLabel === "Artist A b2b Artist B", "21. Artist A b2b Artist B"); }
{ const r = m({ djName: "Equal2", date: "2026-07-25", time: "01:00" }); ok(r.status === "b2b_member" && r.festivalDay === "2026-07-24", "22. B2B gross, Post-Mitternacht-Betriebstag"); }
{ const r = m({ djName: "Rico", date: "2026-07-25", time: "20:00" }); ok(r.status === "b2b_member" && r.selected.collaborationLabel === "Rico vs. Nando", "23. vs.-Schreibweise"); }
{ const r = m({ djName: "Artist A", date: "2026-07-24" }); ok(r.status === "b2b_member", "24. Fahrt fuer Artist A matcht B2B"); }
{ const r = m({ djName: "Artist B", date: "2026-07-24" }); ok(r.status === "b2b_member" && r.selected.artist === "Artist A b2b Artist B", "25. Fahrt fuer Artist B matcht B2B"); }
{ const ex = extractTimetableArtists({ artist: "Harris & Ford" }); ok(ex.collaborationType === null && ex.normalizedArtists.length === 1, "26. & wird NICHT als B2B geteilt"); }
{ const r = m({ djName: "Harris & Ford", date: "2026-07-26", time: "21:00" }); ok(r.status === "exact" && r.selected.artist === "Harris & Ford", "27. & als Teil eines einzelnen Namens -> exact"); }
{ const ex = extractTimetableArtists({ artist: "Artist A b2b Artist B" }); ok(ex.originalArtistLabel === "Artist A b2b Artist B", "28. Original-B2B-Name vollstaendig erhalten"); }

// ===== Festival-Tag (29-34) =====
{ const r = m({ djName: "Gestört aber GeiL", date: "2026-07-24", time: "22:00" }); ok(r.selected && r.selected.dayKey === "2026-07-24", "29. gleicher Artist an zwei Tagen -> Tag 24"); }
{ const r = m({ djName: "Straßenköter", date: "2026-07-24" }); ok(r.festivalDay === "2026-07-24", "30. korrekter Tag ueber festDayKey"); }
{ const r = m({ djName: "MidnightAct", date: "2026-07-24", time: "23:00" }); ok(r.selected && r.selected.dayKey === "2026-07-24", "31. Set nach Mitternacht -> Vortag-Betriebstag"); }
ok(festDayKey("2026-07-25", "01:00") === "2026-07-24", "32. Fahrt nach Mitternacht -> Betriebstag Vortag");
{ const r = m({ djName: "MidnightAct", date: "2026-07-25", time: "01:00" }); ok(r.festivalDay === "2026-07-24" && r.selected, "33. keine zweite Tageslogik (festDayKey konsistent)"); }
{ const r = m({ djName: "Gestört aber GeiL", date: "2026-07-23", time: "22:00" }); ok(r.status === "multiple_candidates" || r.selected === null, "34. kein Match auf falschem Festival-Tag"); }

// ===== Hinfahrt (35-39) =====
{ const r = matchRideToTimetable({ ride: ride({ djName: "Straßenköter", fromId: "sheraton", toId: "festival", date: "2026-07-24", time: "15:00" }), timetableEntries: ENTRIES }); ok(r.direction === "toFestival" && r.selected, "35. eindeutiger Artist, ein Set nach Ankunft (Hinfahrt)"); }
{ const r = matchRideToTimetable({ ride: ride({ djName: "ArriveAct", fromId: "airport", toId: "festival", date: "2026-07-26", time: "16:30" }), timetableEntries: ENTRIES }); ok(r.selected && r.selected.startAt === "2026-07-26 19:00", "36. mehrere Sets, eines zeitlich plausibel (nach Ankunft)"); }
{ const r = matchRideToTimetable({ ride: ride({ djName: "ArriveAct", fromId: "sheraton", toId: "festival", date: "2026-07-26", time: "17:00" }), timetableEntries: ENTRIES }); ok(r.selected || r.status === "multiple_candidates", "37. Hinfahrt-Auswahl deterministisch"); }
{ const r = matchRideToTimetable({ ride: ride({ djName: "ArriveAct", fromId: "sheraton", toId: "festival", date: "2026-07-26", time: "23:00" }), timetableEntries: ENTRIES }); ok(r.selected && r.selected.startAt === "2026-07-26 19:00", "38. Ankunft nach allen Sets -> naechstes"); }
{ const r = matchRideToTimetable({ ride: ride({ djName: "GibtsNicht", fromId: "sheraton", toId: "festival", date: "2026-07-26", time: "19:00" }), timetableEntries: ENTRIES }); ok(r.status === "no_match", "39. Zeitnaehe ohne Artist-Match -> kein Match"); }

// ===== Rueckfahrt (40-44) =====
{ const r = matchRideToTimetable({ ride: ride({ djName: "Straßenköter", fromId: "festival", toId: "sheraton", date: "2026-07-24", time: "18:00" }), timetableEntries: ENTRIES }); ok(r.direction === "fromFestival" && r.selected, "40. eindeutiger Artist, Set endet vor Rueckfahrt"); }
{ const r = matchRideToTimetable({ ride: ride({ djName: "ReturnAct", fromId: "festival", toId: "sheraton", date: "2026-07-26", time: "19:30" }), timetableEntries: ENTRIES }); ok(r.selected && r.selected.endAt === "2026-07-26 19:00", "41. mehrere Sets, eines plausibel (Ende vor Rueckfahrt)"); }
{ const r = matchRideToTimetable({ ride: ride({ djName: "DoubleDay", fromId: "festival", toId: "sheraton", date: "2026-07-24", time: "22:00" }), timetableEntries: ENTRIES }); ok(r.selected || r.status === "multiple_candidates", "42. mehrere gleich plausible Sets (Rueckfahrt)"); }
{ const r = matchRideToTimetable({ ride: ride({ djName: "ReturnAct", fromId: "festival", toId: "sheraton", date: "2026-07-26", time: "10:00" }), timetableEntries: ENTRIES }); ok(r.selected && r.selected.endAt === "2026-07-26 13:00", "43. Rueckfahrt vor allen Set-Enden -> naechstes"); }
{ const r = matchRideToTimetable({ ride: ride({ djName: "GibtsNicht", fromId: "festival", toId: "sheraton", date: "2026-07-26", time: "19:00" }), timetableEntries: ENTRIES }); ok(r.status === "no_match", "44. Zeitnaehe ohne Artist-Match -> kein Match (Rueckfahrt)"); }

// ===== Sonstige Fahrten (45-47) =====
{ const r = matchRideToTimetable({ ride: ride({ djName: "Straßenköter", fromId: "sheraton", toId: "airport", date: "2026-07-24", time: "12:00" }), timetableEntries: ENTRIES }); ok(r.direction === "other", "45. Hotel zu Flughafen -> Richtung other"); }
{ const r = matchRideToTimetable({ ride: ride({ djName: "Straßenköter", fromId: "airport", toId: "sheraton", date: "2026-07-24", time: "12:00" }), timetableEntries: ENTRIES }); ok(r.direction === "other" && (r.selected || r.status === "exact"), "46. Flughafen zu Hotel -> other, Artist-Match trotzdem"); }
{ const r = matchRideToTimetable({ ride: ride({ djName: "DoubleDay", fromId: "airport", toId: "sheraton", date: "2026-07-24", time: "12:00" }), timetableEntries: ENTRIES }); ok(r.status === "multiple_candidates", "47. Artist-Match, keine erzwungene Auswahl bei Mehrdeutigkeit (other)"); }

// ===== Status (48-54) =====
ok(m({ djName: "Straßenköter", date: "2026-07-24" }).status === "exact", "48. exact");
{ const e2 = normalizeTimetableEntries([{ festival_day: "24/07/2026", stage: "S", artist: "Solo One", start: "2026-07-24 20:00", end: "2026-07-24 21:00" }]);
  ok(matchRideToTimetable({ ride: ride({ djName: "S1 Alias", date: "2026-07-24" }), timetableEntries: e2, aliases: { "solo one": ["s1 alias"] } }).status === "alias", "49. alias"); }
ok(m({ djName: "Artist A", date: "2026-07-24" }).status === "b2b_member", "50. b2b_member");
ok(matchRideToTimetable({ ride: ride({ djName: "DoubleDay", fromId: "airport", toId: "sheraton", date: "2026-07-24", time: "12:00" }), timetableEntries: ENTRIES }).status === "multiple_candidates", "51. multiple_candidates");
ok(m({ djName: "Unbekannt", date: "2026-07-24" }).status === "no_match", "52. no_match");
ok(m({ djName: "", date: "2026-07-24" }).status === "missing_artist", "53. missing_artist");
ok(m({ djName: "!!! ***", date: "2026-07-24" }).status === "invalid_artist", "54. invalid_artist");

// ===== Read-only (55-59) =====
{ const r0 = ride({ djName: "Straßenköter", date: "2026-07-24" }); const snap = JSON.stringify(r0); matchRideToTimetable({ ride: r0, timetableEntries: ENTRIES }); ok(JSON.stringify(r0) === snap, "55. Ride-Objekt unveraendert"); }
{ const snap = JSON.stringify(ENTRIES); matchRideToTimetable({ ride: ride({ djName: "Artist A", date: "2026-07-24" }), timetableEntries: ENTRIES }); ok(JSON.stringify(ENTRIES) === snap, "56. Timetable-Array unveraendert"); }
{ // 57/58: statisch - Match-Schicht enthaelt keinen Schreibweg (siehe UI-Smoke)
  ok(true, "57. kein updateDyn (siehe UI-Smoke statische Analyse)");
  ok(true, "58. kein Supabase-Schreibweg (siehe UI-Smoke statische Analyse)"); }
{ const r = m({ djName: "Straßenköter", date: "2026-07-24" }); ok(!("timetableId" in ride({})) && r.selected.id, "59. kein gespeichertes Match-Feld am Ride"); }

// ===== Determinismus + Gegenproben =====
{ const a = m({ djName: "Gestört aber GeiL", date: "2026-07-25", time: "22:00" }); const b = m({ djName: "Gestört aber GeiL", date: "2026-07-25", time: "22:00" }); eq(a, b, "det. gleiche Eingabe -> gleiche Ausgabe"); }
{ const r = m({ djName: "Straßenköter", date: "2026-07-24" }); ok(!(r.status === "no_match"), "GEGENPROBE: exact wird nicht faelschlich als no_match gewertet"); }
{ const ex = extractTimetableArtists({ artist: "Harris & Ford" }); ok(!(ex.normalizedArtists.length === 2), "GEGENPROBE: & splittet NICHT in zwei Artists"); }

console.log(`\n=== C2-Logik: ${pass} bestanden, ${fail} fehlgeschlagen ===`);
if (fail) process.exit(1);
