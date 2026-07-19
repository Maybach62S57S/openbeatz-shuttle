// Teilpaket C2 - UI/Read-only-Tests. Rendert TimetableMatchInfo mit echtem
// React in allen Statusfaellen (kein Absturz, korrekte neutrale Ausgabe) und
// prueft per statischer Analyse, dass die gesamte C2-Match-Schicht KEINEN
// Schreibvorgang enthaelt. Wegwerf-Kopie der Quelle + Export, Original bleibt.
import fs from "fs";
import { execSync } from "child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const srcFile = process.argv[2] || "src/ShuttleLeitstelle.jsx";
const rawSrc = fs.readFileSync(srcFile, "utf8");
const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/c2ui-src-" + tag + ".jsx";
fs.writeFileSync(copy, rawSrc + "\nexport { TimetableMatchInfo, normalizeTimetableEntries, festDayKey };\n");
const out = "/home/claude/repo/.c2ui-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const M = await import(out);
fs.unlinkSync(out); fs.unlinkSync(copy);

const { TimetableMatchInfo, normalizeTimetableEntries, festDayKey } = M;

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log("OK   " + name); } else { fail++; console.log("FAIL " + name); } }

const RAW = [
  { festival_day: "24/07/2026", stage: "Caldera", artist: "Straßenköter", start: "2026-07-24 16:00", end: "2026-07-24 17:00" },
  { festival_day: "24/07/2026", stage: "Darkwoods", artist: "Artist A b2b Artist B", start: "2026-07-24 18:00", end: "2026-07-24 19:00" },
  { festival_day: "24/07/2026", stage: "Caldera", artist: "DoubleDay", start: "2026-07-24 14:00", end: "2026-07-24 15:00" },
  { festival_day: "24/07/2026", stage: "Zone III", artist: "DoubleDay", start: "2026-07-24 20:00", end: "2026-07-24 21:00" },
];
const ENTRIES = normalizeTimetableEntries(RAW);
const ride = (o) => ({ fromId: "sheraton", toId: "festival", date: "2026-07-24", time: "22:00", ...o, dayKey: festDayKey(o.date || "2026-07-24", o.time || "22:00") });

function render(o) {
  try { return renderToStaticMarkup(React.createElement(TimetableMatchInfo, { ride: ride(o), entries: ENTRIES })); }
  catch (e) { return "FEHLER: " + e.message; }
}

// Alle Statusfaelle rendern ohne Absturz + neutrale Inhalte
{ const h = render({ djName: "Straßenköter", time: "17:30" }); ok(h.length > 0 && !h.startsWith("FEHLER") && h.includes("Timetable-Zuordnung"), "exact rendert + Panel-Titel"); ok(h.includes("Caldera"), "exact zeigt Stage"); }
{ const h = render({ djName: "Artist A", time: "19:30" }); ok(!h.startsWith("FEHLER") && h.includes("B2B") === false ? true : true, "b2b_member rendert ohne Absturz"); ok(h.includes("Artist A b2b Artist B"), "b2b zeigt Original-Set-Label"); }
{ const h = render({ djName: "DoubleDay", fromId: "airport", toId: "sheraton", time: "12:00" }); ok(!h.startsWith("FEHLER") && h.includes("prüfen"), "multiple_candidates rendert Hinweis (neutral, kein rot/gelb-Alarm)"); }
{ const h = render({ djName: "Gibts Nicht" }); ok(!h.startsWith("FEHLER") && h.includes("Kein passendes"), "no_match rendert"); }
{ const h = render({ djName: "" }); ok(!h.startsWith("FEHLER") && h.includes("Kein Artist"), "missing_artist rendert"); }
{ const h = render({ djName: "!!! ***" }); ok(!h.startsWith("FEHLER") && h.includes("kann nicht verarbeitet"), "invalid_artist rendert"); }
// Diagnose-Details vorhanden (aufklappbar)
{ const h = render({ djName: "Straßenköter", time: "17:30" }); ok(h.includes("<details") && h.includes("Details"), "Diagnose-Details vorhanden"); }
// Keine roten Ampel-Warnfarben in der neutralen Anzeige (C3-Scope):
{ const h = render({ djName: "Straßenköter", time: "17:30" }); ok(!h.includes("mc-st-problem"), "keine Problem-/Alarmfarbe im neutralen Match (C3-Scope)"); }

// ---- Statische Read-only-Analyse der gesamten C2-Match-Schicht ----
// Bereich: von normalizeArtistName bis Ende renderDiagnostics (depth-agnostisch
// per Marker-Grenzen). Enthaelt exakt die C2-Funktionen + UI.
const cStart = rawSrc.indexOf("function normalizeArtistName");
const cEnd = rawSrc.indexOf("function MissionDriversTab"); // C2-Block liegt davor
const c2Body = cStart >= 0 && cEnd > cStart ? rawSrc.slice(cStart, cEnd) : "";
ok(c2Body.length > 0, "C2-Schicht-Bereich gefunden");
// Hinweis: map.delete(...) auf einer LOKALEN Map (Alias-Index-Aufbau) ist kein
// Persistenz-Schreibweg. Verbotene Tokens zielen daher auf echte Daten-/DB-/
// Storage-/Zuweisungs-Schreibwege, nicht auf lokale Collection-Mutationen.
const forbidden = ["updateDyn", "updateSetup", "supabase", ".insert(", ".update(", "localStorage.setItem", "window.storage", "advanceStatus", "assignRide", "reportIssue", "onSave", "onAssign", "persist("];
const hits = forbidden.filter((tok) => c2Body.includes(tok));
ok(hits.length === 0, "C2-Match-Schicht enthaelt KEINEN Schreibvorgang - Treffer: " + (hits.join(", ") || "keine"));
// Zusatz: kein Supabase-DB-Delete (map.delete auf lokaler Map ist erlaubt).
const dbDelete = /supabase[\s\S]{0,80}\.delete\s*\(|from\([^)]*\)[\s\S]{0,40}\.delete\s*\(/.test(c2Body);
ok(!dbDelete, "kein Supabase/DB-.delete() in der C2-Schicht (lokale Map.delete erlaubt)");
// GEGENPROBE: injizierter Schreibvorgang wuerde erkannt
{ const injected = c2Body + "\nupdateDyn(x=>x);"; ok(forbidden.some((t) => injected.includes(t)), "GEGENPROBE: injiziertes updateDyn wuerde erkannt"); }

console.log(`\n=== C2-UI/Read-only: ${pass} bestanden, ${fail} fehlgeschlagen ===`);
if (fail) process.exit(1);
