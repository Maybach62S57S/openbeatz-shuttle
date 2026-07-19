// Teilpaket C1 - UI/Render/Read-only-Tests gegen die ECHTEN Komponenten.
// Rendert TimetableTab mit echtem React, prueft Rollen-Gating (mcNavForRole)
// und Absturz-Sicherheit bei leerer/kaputter Datei (Datenkonstante in
// Wegwerf-Kopien getauscht = Toggle-Trap). Original wird NICHT angefasst.
import fs from "fs";
import { execSync } from "child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const srcFile = process.argv[2] || "src/ShuttleLeitstelle.jsx";
const rawSrc = fs.readFileSync(srcFile, "utf8");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("OK   " + name); }
  else { fail++; console.log("FAIL " + name); }
}

// Baut aus (evtl. modifiziertem) Quelltext ein Modul mit Exports und importiert es.
async function build(srcText, exportLine) {
  const tag = Math.random().toString(36).slice(2);
  const copy = "/tmp/c1ui-" + tag + ".jsx";
  const out = "/home/claude/repo/.c1ui-" + tag + ".mjs";
  fs.writeFileSync(copy, srcText + "\n" + exportLine + "\n");
  execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
  const mod = await import(out);
  fs.unlinkSync(out); fs.unlinkSync(copy);
  return mod;
}

const exportLine = "export { TimetableTab, mcNavForRole, MC_ROLE_TABS };";

// ---- Normal-Render der echten Datei ----
const M = await build(rawSrc, exportLine);
const { TimetableTab, mcNavForRole, MC_ROLE_TABS } = M;

let html = "";
let crashed = false;
try { html = renderToStaticMarkup(React.createElement(TimetableTab)); }
catch (e) { crashed = true; console.log("   Render-Fehler:", e.message); }

// ---- 39-42: Rollen-Gating (das eigentliche Sichtbarkeits-Mechanismus) ----
const dispoTabs = mcNavForRole("dispo").map((n) => n.tab);
const stageTabs = mcNavForRole("stage").map((n) => n.tab);
const driverTabs = mcNavForRole("driver").map((n) => n.tab);
ok(dispoTabs.includes("timetable"), "39. Timetable-Tab in der Leitstellen-Nav (dispo) sichtbar");
ok(!stageTabs.includes("timetable"), "40/41. Stage-Nav enthaelt KEIN Timetable (Stage-Ansicht unveraendert)");
ok(!driverTabs.includes("timetable"), "40. Fahrer-Nav enthaelt KEIN Timetable (Fahreransicht unveraendert)");
// Gast: hat gar keine MC-Nav (eigener Link/Modus), MC_ROLE_TABS kennt keinen guest-Eintrag
ok(!("guest" in MC_ROLE_TABS) && mcNavForRole("guest").length === 0, "42. Gast-Rolle bekommt keinerlei MC-Nav (Gastansicht unveraendert)");

// ---- Render-Inhalt ----
ok(!crashed && html.length > 0, "Render: TimetableTab rendert ohne Absturz");
ok(html.includes("CALDERA"), "Render: eine echte Stage erscheint (CALDERA)");
ok(html.includes("Timmy Trumpet"), "Render: ein echter Artist erscheint (Timmy Trumpet)");
ok(html.includes("B2B"), "Render: mindestens ein B2B-Badge erscheint");
ok(html.includes("nach Mitternacht"), "Render: Post-Mitternacht-Markierung erscheint");

// ---- 44: Diagnose bei ungueltigen Eintraegen (Datei mit Defekt) ----
const withBad = rawSrc.replace(
  /const TIMETABLE_RAW = \[[\s\S]*?\n\];/,
  'const TIMETABLE_RAW = [\n  { festival_day: "24/07/2026", stage: "CALDERA", artist: "Gut", start: "2026-07-24 15:00", end: "2026-07-24 16:00" },\n  { festival_day: "24/07/2026", stage: "CALDERA", artist: "", start: "2026-07-24 16:00", end: "kaputt" },\n];'
);
ok(withBad !== rawSrc, "44-setup: TIMETABLE_RAW konnte fuer Test ersetzt werden");
const Mbad = await build(withBad, exportLine);
let htmlBad = "", badCrash = false;
try { htmlBad = renderToStaticMarkup(React.createElement(Mbad.TimetableTab)); }
catch (e) { badCrash = true; console.log("   Render-Fehler (bad):", e.message); }
ok(!badCrash, "44a. kein Absturz bei ungueltigen Eintraegen");
ok(htmlBad.includes("nicht vollst\u00e4ndig verarbeitet"), "44b. Diagnosezusammenfassung erscheint bei ungueltigen Eintraegen");

// ---- 45: leere Datei ----
const empty = rawSrc.replace(/const TIMETABLE_RAW = \[[\s\S]*?\n\];/, "const TIMETABLE_RAW = [];");
const Mempty = await build(empty, exportLine);
let htmlEmpty = "", emptyCrash = false;
try { htmlEmpty = renderToStaticMarkup(React.createElement(Mempty.TimetableTab)); }
catch (e) { emptyCrash = true; console.log("   Render-Fehler (empty):", e.message); }
ok(!emptyCrash && htmlEmpty.length > 0, "45. kein Absturz bei leerer Datee, EmptyState/Rahmen rendert");

// ---- 46: kaputte Datei (Nicht-Array / Muell) ----
const garbage = rawSrc.replace(/const TIMETABLE_RAW = \[[\s\S]*?\n\];/, "const TIMETABLE_RAW = null;");
const Mg = await build(garbage, exportLine);
let gCrash = false;
try { renderToStaticMarkup(React.createElement(Mg.TimetableTab)); }
catch (e) { gCrash = true; console.log("   Render-Fehler (garbage):", e.message); }
ok(!gCrash, "46. kein Absturz bei ungueltiger Datei (TIMETABLE_RAW = null)");

// ---- 47-50: Read-only (statische Analyse des TimetableTab-Koerpers) ----
// Koerper depth-korrekt bis zur schliessenden Klammer der Funktion abgrenzen
// (nicht bis zur naechsten Funktion - sonst wuerden nachfolgend eingefuegte
// Nachbarfunktionen faelschlich mitgemessen, z. B. die C2-Matching-Schicht).
const s = rawSrc.indexOf("function TimetableTab()");
let body = "";
{
  const j = rawSrc.indexOf("{", s); let depth = 0, m = j;
  for (; m < rawSrc.length; m++) {
    if (rawSrc[m] === "{") depth++;
    else if (rawSrc[m] === "}") { depth--; if (depth === 0) { body = rawSrc.slice(s, m + 1); break; } }
  }
}
const forbidden = ["updateDyn", "updateSetup", "sset(", "sget(", "supabase", ".insert(", ".update(", ".delete(", "localStorage.setItem", "window.storage", "advanceStatus", "assignRide", "reportIssue"];
const hits = forbidden.filter((tok) => body.includes(tok));
ok(hits.length === 0, "47-50. TimetableTab enthaelt KEINEN Schreibvorgang (updateDyn/Supabase/Storage/Zuweisung) - Treffer: " + (hits.join(", ") || "keine"));
// Nur erlaubter State: query/dayFilter/stageFilter via useState (lokal)
const stateVars = [...body.matchAll(/useState\(/g)].length;
ok(stateVars === 3, "47b. genau 3 lokale useState (query, dayFilter, stageFilter) - nur UI-State");

console.log(`\n=== C1-UI/Read-only: ${pass} bestanden, ${fail} fehlgeschlagen ===`);
process.exit(fail ? 1 : 0);
