// Teilpaket C3 - UI/Read-only-Tests. Rendert TimetableTimingInfo mit echtem React
// in allen Statusfaellen (kein Absturz, korrekte sichtbare Labels/Farben) und prueft
// per statischer Analyse: C3 nur in Leitstellen-Komponenten, keine Schreibwege,
// C2-Match weiterhin unveraendert sichtbar. Wegwerf-Kopie + Export, Original bleibt.
import fs from "fs";
import { execSync } from "child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const srcFile = process.argv[2] || "src/ShuttleLeitstelle.jsx";
const rawSrc = fs.readFileSync(srcFile, "utf8");
const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/c3ui-src-" + tag + ".jsx";
fs.writeFileSync(copy, rawSrc + `
export { TimetableTimingInfo, TimetableMatchInfo, matchRideToTimetable, normalizeTimetableEntries, festDayKey, seedMatrix, seedLocations };
`);
const out = "/home/claude/repo/.c3ui-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const M = await import(out);
fs.unlinkSync(out); fs.unlinkSync(copy);

const { TimetableTimingInfo, TimetableMatchInfo, matchRideToTimetable, normalizeTimetableEntries, festDayKey, seedMatrix, seedLocations } = M;

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log("OK   " + name); } else { fail++; console.log("FAIL " + name); } }

const setup = { matrix: seedMatrix(), locations: seedLocations() };
function ttOne(artist, start, end, stage = "Mainstage") {
  return normalizeTimetableEntries([{ festival_day: null, stage, artist, start, end }]);
}
function ride(o) { return { fromId: "sheraton", toId: "festival", fromCustom: "", toCustom: "", date: "2026-07-25", ...o }; }
function renderTiming(r, entries) {
  const match = matchRideToTimetable({ ride: r, timetableEntries: entries });
  try { return renderToStaticMarkup(React.createElement(TimetableTimingInfo, { ride: r, matchResult: match, setup })); }
  catch (e) { return "FEHLER: " + e.message; }
}

const ENT = ttOne("Zeit Act", "2026-07-25 21:30", "2026-07-25 23:00");

// ---- Alle Status rendern: sichtbares Label + korrekte Farbe ----
// on_time (Ride 20:00 -> Ankunft 20:38, Puffer 52)
{ const h = renderTiming(ride({ djName: "Zeit Act", time: "20:00" }), ENT);
  ok(!h.startsWith("FEHLER") && h.includes("Planungsbewertung"), "Panel-Titel Planungsbewertung");
  ok(h.includes("Rechtzeitig geplant"), "on_time Label sichtbar");
  ok(h.includes("--mc-st-done"), "on_time nutzt done-Farbe (gruen)");
  ok(!h.includes("--mc-st-problem"), "on_time keine Alarmfarbe"); }
// tight (Ride 20:20 -> Puffer 32)
{ const h = renderTiming(ride({ djName: "Zeit Act", time: "20:20" }), ENT);
  ok(h.includes("Knapp geplant"), "tight Label sichtbar");
  ok(h.includes("--mc-st-assigned"), "tight nutzt assigned-Farbe (amber)");
  ok(!h.includes("--mc-st-problem"), "tight keine Alarmfarbe"); }
// critical (Ride 20:35 -> Puffer 17)
{ const h = renderTiming(ride({ djName: "Zeit Act", time: "20:35" }), ENT);
  ok(h.includes("Kritische Planung"), "critical Label sichtbar");
  ok(h.includes("--mc-st-problem"), "critical nutzt problem-Farbe (rot)"); }
// late (Ride 21:05 -> Puffer -13)
{ const h = renderTiming(ride({ djName: "Zeit Act", time: "21:05" }), ENT);
  ok(h.includes("Zu spät geplant"), "late Label sichtbar (distinkt von kritisch)");
  ok(h.includes("--mc-st-problem"), "late nutzt problem-Farbe (rot)");
  ok(!h.includes("Kritische Planung"), "late nicht mit kritisch verwechselt"); }

// return_ok / exact-end / before-end
const ENT_R = normalizeTimetableEntries([{ festival_day: null, stage: "M", artist: "Ret Act", start: "2026-07-25 23:30", end: "2026-07-26 01:00" }]);
function retRide(dep) { return ride({ djName: "Ret Act", fromId: "festival", toId: "sheraton", ...dep }); }
{ const h = renderTiming(retRide({ date: "2026-07-26", time: "01:30" }), ENT_R);
  ok(h.includes("Rückfahrt nach Set-Ende geplant"), "return_ok Label sichtbar");
  ok(h.includes("--mc-st-done"), "return_ok nutzt done-Farbe"); }
{ const h = renderTiming(retRide({ date: "2026-07-26", time: "01:00" }), ENT_R);
  ok(h.includes("Rückfahrt zum Set-Ende geplant"), "return_ok exakt-Ende eigenes Label"); }
{ const h = renderTiming(retRide({ date: "2026-07-26", time: "00:30" }), ENT_R);
  ok(h.includes("Rückfahrt vor Set-Ende"), "return_before_set_end Label sichtbar");
  ok(h.includes("--mc-st-problem"), "return_before_set_end nutzt problem-Farbe"); }

// timing_unknown (fehlende Fahrzeit: unbekannter Ort -> Festival)
{ const ent = ttOne("Unk Act", "2026-07-25 21:30", "2026-07-25 23:00");
  const h = renderTiming(ride({ djName: "Unk Act", fromId: "__custom", fromCustom: "Voellig Unbekannt 999", toId: "festival", time: "20:00" }), ent);
  ok(h.includes("Zeitbewertung nicht möglich"), "timing_unknown Label sichtbar");
  ok(!h.includes("--mc-st-problem"), "timing_unknown keine Alarmfarbe (neutral)"); }

// not_applicable (Hotel->Flughafen)
{ const h = renderTiming(ride({ djName: "Zeit Act", fromId: "sheraton", toId: "airport", time: "10:00" }), ENT);
  ok(h.includes("keine Festival-Zeitbewertung erforderlich"), "not_applicable neutrale Meldung");
  ok(!h.includes("--mc-st-problem"), "not_applicable keine Alarmfarbe"); }

// multiple_candidates (neutral, kein Alarm)
{ const ent = normalizeTimetableEntries([
    { festival_day: null, stage: "A", artist: "Sym Act", start: "2026-07-25 20:00", end: "2026-07-25 21:00" },
    { festival_day: null, stage: "B", artist: "Sym Act", start: "2026-07-25 20:00", end: "2026-07-25 21:00" },
  ]);
  const h = renderTiming(ride({ djName: "Sym Act", time: "19:00" }), ent);
  ok(h.includes("Timetable-Zuordnung prüfen"), "multiple_candidates neutraler Hinweis");
  ok(!h.includes("--mc-st-problem"), "multiple_candidates keine Alarmfarbe"); }

// no_match / missing_artist / invalid_artist (neutral)
{ const h = renderTiming(ride({ djName: "Gibt Nicht Xyz", time: "20:00" }), ENT); ok(!h.startsWith("FEHLER") && h.includes("Keine Timetable-Zeitbewertung möglich"), "no_match neutral"); ok(!h.includes("--mc-st-problem"), "no_match keine Alarmfarbe"); }
{ const h = renderTiming(ride({ djName: "", time: "20:00" }), ENT); ok(!h.startsWith("FEHLER"), "missing_artist rendert ohne Absturz"); }
{ const h = renderTiming(ride({ djName: "!!! ***", time: "20:00" }), ENT); ok(!h.startsWith("FEHLER"), "invalid_artist rendert ohne Absturz"); }

// Diagnose-Details aufklappbar vorhanden
{ const h = renderTiming(ride({ djName: "Zeit Act", time: "20:00" }), ENT); ok(h.includes("<details") && h.includes("Details"), "Diagnose-Details vorhanden"); }

// ---- C2-Match weiterhin voll sichtbar (unveraendert) ----
{ const match = matchRideToTimetable({ ride: ride({ djName: "Zeit Act", time: "20:00" }), timetableEntries: ENT });
  const h = renderToStaticMarkup(React.createElement(TimetableMatchInfo, { ride: ride({ djName: "Zeit Act", time: "20:00" }), entries: ENT, match }));
  ok(h.includes("Timetable-Zuordnung") && h.includes("Mainstage"), "C2-Match weiterhin voll sichtbar (mit geteiltem match-Prop)");
  // C2 ohne match-Prop identisch (Rueckwaertskompatibilitaet)
  const h2 = renderToStaticMarkup(React.createElement(TimetableMatchInfo, { ride: ride({ djName: "Zeit Act", time: "20:00" }), entries: ENT }));
  ok(h === h2, "C2-Match mit/ohne match-Prop identisch (rueckwaertskompatibel)"); }

// ---- Statische Analyse: nur Leitstelle, keine Schreibwege ----
{
  // C3-Anzeige NUR in Leitstellen-Komponenten (RideForm/AssignModal), nicht in Fahrer-/Stage-/Gast-Apps.
  const driverStart = rawSrc.indexOf("function DriverApp");
  const guestEnd = (() => { const i = rawSrc.indexOf("function GuestApp"); return i >= 0 ? rawSrc.indexOf("\nfunction ", i + 10) : -1; })();
  // Bereich der drei Nicht-Leitstellen-Rollen grob eingrenzen und pruefen, dass TimetableTimingInfo dort nicht referenziert wird.
  const stageIdx = rawSrc.indexOf("function StageApp");
  const guestIdx = rawSrc.indexOf("function GuestApp");
  const refsTiming = (from, to) => { const seg = from >= 0 && to > from ? rawSrc.slice(from, to) : ""; return seg.includes("<TimetableTimingInfo"); };
  // DriverApp-Segment
  const driverSeg = rawSrc.slice(driverStart, rawSrc.indexOf("\nfunction ", driverStart + 10));
  ok(!driverSeg.includes("<TimetableTimingInfo"), "C3-Anzeige nicht in DriverApp");
  const stageSeg = rawSrc.slice(stageIdx, rawSrc.indexOf("\nfunction ", stageIdx + 10));
  ok(!stageSeg.includes("<TimetableTimingInfo"), "C3-Anzeige nicht in StageApp");
  const guestSeg = rawSrc.slice(guestIdx, rawSrc.indexOf("\nfunction ", guestIdx + 10));
  ok(!guestSeg.includes("<TimetableTimingInfo"), "C3-Anzeige nicht in GuestApp");
  // Genau zwei Einbindungen (RideForm + AssignModal)
  const count = (rawSrc.match(/<TimetableTimingInfo/g) || []).length;
  ok(count === 2, "genau zwei C3-Einbindungen (RideForm + AssignModal) - war " + count);
}
{
  // C3-Komponente + reine Funktionen enthalten keinen Schreibweg (Bereich C3-Header..MissionDriversTab)
  const cStart = rawSrc.indexOf("TEILPAKET C3 - rein lesende");
  const cEnd = rawSrc.indexOf("function MissionDriversTab");
  const c3Body = cStart >= 0 && cEnd > cStart ? rawSrc.slice(cStart, cEnd) : "";
  const forbidden = ["updateDyn", "updateSetup", "supabase", ".insert(", ".update(", "localStorage.setItem", "window.storage", "advanceStatus", "assignRide", "reportIssue", "onSave", "onAssign", "setRideStatus", "logRide", "onClose", "onDelete"];
  const hits = forbidden.filter((t) => c3Body.includes(t));
  ok(hits.length === 0, "C3-Schicht ohne Schreibweg/Handler - Treffer: " + (hits.join(", ") || "keine"));
}

console.log(`\n=== C3-UI/Read-only: ${pass} bestanden, ${fail} fehlgeschlagen ===`);
if (fail) process.exit(1);
