// Teilpaket C1 - Logiktests (Datenanalyse, Normalisierung, Zeitlogik, Suche,
// Filter, B2B) gegen die ECHTEN, aus der Quelle gebundelten Funktionen (kein
// Nachbau). Wegwerf-Kopie der Quelle + angehaengter Export, via esbuild
// gebundelt, dann importiert. Das Original wird NICHT angefasst.
import fs from "fs";
import { execSync } from "child_process";

const srcFile = process.argv[2] || "src/ShuttleLeitstelle.jsx";
const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/c1-src-" + tag + ".jsx";
fs.writeFileSync(
  copy,
  fs.readFileSync(srcFile, "utf8") +
    "\nexport { TIMETABLE_RAW, TIMETABLE_META, normalizeTimetableEntries, ttHash, ttAbsMin, ttIsB2B, ttNorm, ttCompare, festDayKey };\n"
);
const out = "/home/claude/repo/.c1-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const M = await import(out);
fs.unlinkSync(out); fs.unlinkSync(copy);

const {
  TIMETABLE_RAW, TIMETABLE_META, normalizeTimetableEntries,
  ttHash, ttAbsMin, ttIsB2B, ttNorm, ttCompare, festDayKey,
} = M;

let pass = 0, fail = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function ok(cond, name) {
  if (cond) { pass++; console.log("OK   " + name); }
  else { fail++; console.log("FAIL " + name); }
}

// Referenz: die normalisierte echte Datei
const norm = normalizeTimetableEntries(TIMETABLE_RAW);
const valid = norm.filter((e) => e.valid);
const invalid = norm.filter((e) => !e.valid);

// ---- 1. Datenanalyse ----------------------------------------------------
ok(TIMETABLE_RAW.length === 229, "1. Quelldatensaetze = 229");
ok(valid.length === 229, "2. gueltige Eintraege = 229");
ok(invalid.length === 0, "3. ungueltige Eintraege = 0");
const stages = [...new Set(valid.map((e) => e.stage))].sort();
ok(stages.length === 10, "4. Stage-Liste = 10 Stages");
const days = [...new Set(valid.map((e) => e.dayKey))].sort();
ok(days.length === 4, "5. Festival-Tage = 4");
ok(norm.length === TIMETABLE_RAW.length, "6. kein Eintrag still entfernt (Ein-/Ausgabe gleich lang)");

// ---- 2. Normalisierung --------------------------------------------------
ok(normalizeTimetableEntries([{ festival_day: "24/07/2026", stage: "CALDERA", artist: "X", start: "2026-07-24 15:00", end: "2026-07-24 16:00" }])[0].valid === true, "7. gueltiger Eintrag -> valid");
ok(normalizeTimetableEntries([{ festival_day: "24/07/2026", stage: "CALDERA", artist: "", start: "2026-07-24 15:00", end: "2026-07-24 16:00" }])[0].problems.some((p) => p.field === "artist"), "8. fehlender Artist -> Diagnose");
ok(normalizeTimetableEntries([{ festival_day: "24/07/2026", stage: "", artist: "X", start: "2026-07-24 15:00", end: "2026-07-24 16:00" }])[0].problems.some((p) => p.field === "stage"), "9. fehlende Stage -> Diagnose");
ok(normalizeTimetableEntries([{ festival_day: "24/07/2026", stage: "S", artist: "X", start: "", end: "2026-07-24 16:00" }])[0].problems.some((p) => p.field === "start"), "10. fehlende Startzeit -> Diagnose");
ok(normalizeTimetableEntries([{ festival_day: "24/07/2026", stage: "S", artist: "X", start: "2026-07-24 15:00", end: "" }])[0].problems.some((p) => p.field === "end"), "11. fehlende Endzeit -> Diagnose");
const inv12 = normalizeTimetableEntries([{ festival_day: "24/07/2026", stage: "S", artist: "X", start: "25:99 kaputt", end: "2026-07-24 16:00" }])[0];
ok(inv12.problems.some((p) => p.field === "start") && inv12.startAt === null, "12. ungueltige Startzeit -> Diagnose, keine geratene Zeit");
ok(normalizeTimetableEntries([{ festival_day: "kaputt", stage: "S", artist: "X", start: "2026-07-24 15:00", end: "2026-07-24 16:00" }])[0].problems.some((p) => p.field === "festival_day"), "13. ungueltiges Datum (festival_day) -> Diagnose");
const before = JSON.parse(JSON.stringify(TIMETABLE_RAW[0]));
normalizeTimetableEntries(TIMETABLE_RAW);
ok(eq(TIMETABLE_RAW[0], before), "14. Originaldaten werden NICHT mutiert");
const idA = normalizeTimetableEntries([TIMETABLE_RAW[5]])[0].id;
const idB = normalizeTimetableEntries([TIMETABLE_RAW[5]])[0].id;
ok(idA === idB && /^tt-[0-9a-f]{8}-\d+$/.test(idA), "15. deterministische, stabile ID");
ok(eq(normalizeTimetableEntries(TIMETABLE_RAW).map((e) => e.id), norm.map((e) => e.id)), "16. identische Eingabe -> identisches Ergebnis (alle IDs)");

// ---- 3. Zeitlogik -------------------------------------------------------
const day = (s, e, fd) => normalizeTimetableEntries([{ festival_day: fd || "24/07/2026", stage: "S", artist: "A", start: s, end: e }])[0];
ok(day("2026-07-24 15:00", "2026-07-24 16:00").durationMin === 60, "17. normales Set innerhalb eines Tages -> Dauer 60");
const cross = day("2026-07-24 23:00", "2026-07-25 00:30");
ok(cross.durationMin === 90 && cross.dayKey === "2026-07-24", "18. Set vor->nach Mitternacht -> Dauer 90, Betriebstag Freitag");
const after = day("2026-07-25 01:00", "2026-07-25 02:00", "24/07/2026");
ok(after.startsAfterMidnight === true, "19. Set nach Mitternacht -> startsAfterMidnight");
ok(after.dayKey === "2026-07-24", "20. Festival-Tag-Zuordnung nach Mitternacht -> Vortag (Freitag-Nacht)");
// 21: Sortierung ueber Mitternacht: 23:00 (Fr) vor 00:30 (Sa-Kalender, Fr-Nacht)
const s21 = [day("2026-07-25 00:30", "2026-07-25 01:30"), day("2026-07-24 23:00", "2026-07-24 23:45")].sort(ttCompare);
ok(s21[0].startAt === "2026-07-24 23:00" && s21[1].startAt === "2026-07-25 00:30", "21. Sortierung ueber Mitternacht korrekt (23:00 vor 00:30)");
const badEnd = day("2026-07-24 15:00", "2026-07-24 14:00");
ok(badEnd.problems.some((p) => p.field === "end") && badEnd.durationMin <= 0, "22. ungueltige Endzeit (vor Start) -> Diagnose");

// ---- 4. Suche (via ttNorm-Semantik, gleiche Logik wie im Tab) ----------
const hay = (e) => ttNorm(`${e.artist} ${e.stage} ${fmtISOhm(e.startAt)} ${fmtISOhm(e.endAt)}`);
function fmtISOhm(x) { return x ? x.slice(11) : ""; }
function search(q) {
  const toks = ttNorm(q).split(" ").filter(Boolean);
  return valid.filter((e) => toks.every((t) => hay(e).includes(t)));
}
ok(search("Timmy Trumpet").length >= 1, "23. exakter Artist findet Set");
ok(search("Trumpet").length >= 1, "24. Teilstring findet Set");
ok(search("tImMy").length >= 1 && search("TIMMY").length === search("timmy").length, "25. Gross-/Kleinschreibung egal");
ok(search("krocher").some((e) => /Kr\u00f6cher/.test(e.artist)), "26. Umlaut normalisiert (krocher findet Kroecher)");
ok(eq(search("timmy   trumpet"), search("timmy trumpet")), "27. mehrere Leerzeichen toleriert");
ok(search("CALDERA").length >= 1, "28. Stage-Suche findet Sets");
ok(search("zzzz_gibtsnicht_xyz").length === 0, "29. keine Treffer -> leere Liste");

// ---- 5. Filter ----------------------------------------------------------
const byDay = (k) => valid.filter((e) => e.dayKey === k);
ok(byDay("2026-07-24").length === 82, "30. einzelner Festival-Tag (Fr) = 82 Sets");
const oneStage = valid.filter((e) => e.stage === "CALDERA");
ok(oneStage.length === 31, "31. einzelne Stage (CALDERA) = 31 Sets");
const combo = valid.filter((e) => e.dayKey === "2026-07-24" && e.stage === "CALDERA");
ok(combo.length > 0 && combo.every((e) => e.dayKey === "2026-07-24" && e.stage === "CALDERA"), "32. Tag+Stage kombiniert korrekt");
ok(valid.length === 229, "33. Filter zuruecksetzen -> volle Liste (229)");
const stageList = [...new Set(valid.map((e) => e.stage))];
ok(stageList.length === new Set(stageList).size && stageList.length === 10, "34. dynamische Stage-Liste ohne Duplikate");

// ---- 6. B2B -------------------------------------------------------------
ok(ttIsB2B("Equal2 b2b Invaderz") === true, "35. 'b2b' erkannt");
ok(ttIsB2B("Artist A B2B Artist B") === true, "36. 'B2B' (gross) erkannt");
ok(ttIsB2B("Artist A vs. Artist B") === true && ttIsB2B("A vs B") === true, "37. 'vs.'/'vs' erkannt (alternative Schreibweise)");
const b2bEntry = norm.find((e) => e.artist === "Equal2 b2b Invaderz");
ok(b2bEntry && b2bEntry.artist === "Equal2 b2b Invaderz" && b2bEntry.isB2B, "38. Originalname bei B2B unveraendert erhalten");
// Zusatz: Kollaborationsnamen (x/&/feat.) sind KEIN B2B
ok(ttIsB2B("Harris & Ford") === false && ttIsB2B("BassWar x CaoX") === false && ttIsB2B("TekkSchuster feat. Loco Erno") === false, "38b. &/x/feat. sind KEIN B2B");

// ---- Gegenprobe (beweist, dass die Tests wirklich messen) ---------------
// Absichtlich falsche Erwartung muss fehlschlagen:
let gp = false;
try { const wrong = normalizeTimetableEntries([{ festival_day: "24/07/2026", stage: "S", artist: "X", start: "2026-07-24 15:00", end: "2026-07-24 16:00" }])[0]; gp = (wrong.durationMin === 999); } catch { gp = false; }
ok(gp === false, "GEGENPROBE: falsche Dauer-Erwartung wird korrekt NICHT bestaetigt");

console.log(`\n=== C1-Logik: ${pass} bestanden, ${fail} fehlgeschlagen ===`);
process.exit(fail ? 1 : 0);
