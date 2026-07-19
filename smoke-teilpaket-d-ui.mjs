// Teilpaket D - UI/Render/Read-only-Tests gegen die ECHTE MissionReturnsTab.
// Rendert die Komponente mit konstruierten Rueckfahrten in allen operativen
// Gruppen, prueft Gruppenueberschriften, operative Kennzeichnung, Set-Ende-Hinweis,
// erhaltene Aktionen, Leerzustaende, Read-only (updateDyn wird beim Render nie
// aufgerufen) sowie Timer- und Rollen-Gating strukturell. Original unangetastet.
import fs from "fs";
import { execSync } from "child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const srcFile = process.argv[2] || "src/ShuttleLeitstelle.jsx";
const rawSrc = fs.readFileSync(srcFile, "utf8");

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log("OK   " + name); } else { fail++; console.log("FAIL " + name); } }

async function build(srcText, exportLine) {
  const tag = Math.random().toString(36).slice(2);
  const copy = "/tmp/dui-" + tag + ".jsx";
  const out = "/home/claude/repo/.dui-" + tag + ".mjs";
  fs.writeFileSync(copy, srcText + "\n" + exportLine + "\n");
  execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
  const mod = await import(out);
  fs.unlinkSync(out); fs.unlinkSync(copy);
  return mod;
}

const M = await build(rawSrc,
  "export { MissionReturnsTab, mcNavForRole, MC_ROLE_TABS, seedDrivers, seedLocations, seedMatrix, seedConfig, festDayKey };");
const { MissionReturnsTab, mcNavForRole, MC_ROLE_TABS, seedDrivers, seedLocations, seedMatrix, seedConfig } = M;

const pad = (n) => String(n).padStart(2, "0");
function offsetDT(min) {
  const d = new Date(Date.now() + min * 60000);
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

const drivers = seedDrivers();
const DRV = drivers[0].id;
const setup = { drivers, dispatchers: [], locations: seedLocations(), zones: ["Caldera", "Zone 3", "Stonelands"], matrix: seedMatrix(), config: seedConfig() };
const DAY = "2026-07-23";
const base = { fromId: "festival", toId: "sheraton", fromCustom: "", toCustom: "", dayKey: DAY, passengerCount: 2, meetingPoint: "Behind the stage", issues: [], type: "return" };
const due = offsetDT(30);      // bald faellig
const miss = offsetDT(45);     // Fahrer fehlt (kein Fahrer)

const rides = [
  { ...base, id: "r-rev", date: DAY, time: "", djName: "", status: "planned", assignedDriverId: null },                       // needs_review (fehlende Zeit)
  { ...base, id: "r-over", date: "2020-01-01", time: "12:00", djName: "OldAct", status: "planned", assignedDriverId: DRV },     // overdue
  { ...base, id: "r-done", date: DAY, time: "22:00", djName: "DoneAct", status: "done", assignedDriverId: DRV },                // completed
  { ...base, id: "r-act", date: DAY, time: "22:30", djName: "ActiveAct", status: "onboard", assignedDriverId: DRV },            // in_progress
  { ...base, id: "r-not", date: "2030-01-01", time: "12:00", djName: "FutureAct", status: "planned", assignedDriverId: null },  // not_due
  { ...base, id: "r-asg", date: "2030-01-01", time: "13:00", djName: "AssignedAct", status: "planned", assignedDriverId: DRV }, // driver_assigned
  { ...base, id: "r-due", date: due.date, time: due.time, djName: "SoonAct", status: "planned", assignedDriverId: DRV },        // due_soon
  { ...base, id: "r-miss", date: miss.date, time: miss.time, djName: "MissAct", status: "planned", assignedDriverId: null },    // driver_missing
  { ...base, id: "r-tezz", date: "2026-07-23", time: "16:30", djName: "TEZZ", status: "planned", assignedDriverId: null },      // Set-Ende (return_ok)
  { ...base, id: "r-tezz2", date: "2026-07-23", time: "16:00", djName: "TEZZ", status: "planned", assignedDriverId: null },     // return_before_set_end -> Pruefen
];
const driverState = {};
drivers.forEach((d) => { driverState[d.id] = {}; });
const dyn = { rides, artistPresence: {}, driverState, rev: 1 };

let updateCalled = false;
const props = {
  setup, dyn, day: DAY,
  updateDyn: async () => { updateCalled = true; return { ok: true }; },
  by: "dispo:test", onErr: () => {}, onAssign: () => {}, onWhatsApp: () => {}, onEdit: () => {}, onNewReturn: () => {},
};

let html = "", crashed = false;
try { html = renderToStaticMarkup(React.createElement(MissionReturnsTab, props)); }
catch (e) { crashed = true; console.log("   Render-Fehler:", e.message); }

// ---- Grundlegender Render + Read-only ----
ok(!crashed && html.length > 0, "Render: MissionReturnsTab rendert ohne Absturz");
ok(updateCalled === false, "83-90/Read-only: updateDyn wird beim Render NICHT aufgerufen");

// ---- 96/97 Gruppenueberschriften + Zaehler (Sektionen, mit Anzahl in Klammern) ----
ok(/Prüfen \(\d+\)/.test(html), "96. Sektion 'Prüfen' mit Anzahl sichtbar");
ok(/Überfällig \(\d+\)/.test(html), "96b. Sektion 'Überfällig' mit Anzahl sichtbar");
ok(/Fahrer fehlt \(\d+\)/.test(html), "96c. Sektion 'Fahrer fehlt' mit Anzahl sichtbar");
ok(/Bald fällig \(\d+\)/.test(html), "96d. Sektion 'Bald fällig' mit Anzahl sichtbar");
ok(/Fahrer zugeteilt \(\d+\)/.test(html), "96e. Sektion 'Fahrer zugeteilt' mit Anzahl sichtbar");
ok(/Läuft \(\d+\)/.test(html), "96f. Sektion 'Läuft' mit Anzahl sichtbar");
ok(/Später \(\d+\)/.test(html), "96g. Sektion 'Später' mit Anzahl sichtbar");
ok(/Erledigt \(\d+\)/.test(html), "97. Sektion 'Erledigt' (Akkordeon) mit Anzahl sichtbar");

// ---- 98 operative Kennzeichnung (Badge-Labels auf Karten) ----
ok(html.includes("seit") && /seit \d+ min/.test(html), "98. operative Kennzeichnung 'seit X min' (overdue) sichtbar");
ok(/Abfahrt in \d+ min/.test(html), "98b. 'Abfahrt in X min' (bald faellig / Fahrer fehlt) sichtbar");

// ---- 99/100 Abfahrt + Fahrer sichtbar ----
ok(html.includes("22:30") || html.includes("22:00"), "99. geplante Abfahrtszeit sichtbar");
ok(html.includes(drivers[0].firstName), "100. Fahrer (Vorname) sichtbar");

// ---- 101 C3-Hinweis (Set-Ende + Rueckfahrt vor Set-Ende) ----
ok(html.includes("Set-Ende 16:15"), "101. C3-Hinweis 'Set-Ende 16:15' sichtbar");
ok(html.includes("vor Set-Ende"), "101b. Prueflauf 'Rückfahrt ... vor Set-Ende' sichtbar");

// ---- 102 bestehende Aktionen erhalten ----
ok(html.includes("Fahrer zuweisen"), "102. Aktion 'Fahrer zuweisen' erhalten");
ok(html.includes("umteilen"), "102b. Aktion 'umteilen' erhalten");
ok(html.includes(">Text<") || html.includes("Text"), "102c. Aktion 'Text' erhalten");
ok(html.includes("Fahrt öffnen"), "102d. Aktion 'Fahrt öffnen' erhalten");

// ---- Zusatzhinweise (Fahrer fehlt / kein Timetable) ----
ok(html.includes("Kein Fahrer zugeteilt") || html.includes("Fahrer fehlt"), "Zusatz: Fahrer-fehlt-Hinweis sichtbar");

// ---- operative Zaehler-Kacheln + Gruppenfilter ----
ok(html.includes("nur ohne Fahrer"), "Filter: 'nur ohne Fahrer'-Umschalter vorhanden");
ok(html.includes("Rückfahrten · Leitstand"), "Kopf: 'Rückfahrten · Leitstand' Titel");

// ---- 105 responsive Kerninformationen (Grid-Klassen) ----
ok(html.includes("xl:grid-cols-3") && html.includes("md:grid-cols-2"), "105. responsive Grid-Klassen vorhanden");

// ---- 103 Leerzustand ohne Rueckfahrten ----
let htmlEmpty = "";
try { htmlEmpty = renderToStaticMarkup(React.createElement(MissionReturnsTab, { ...props, dyn: { rides: [], artistPresence: {}, driverState, rev: 1 } })); } catch (e) { htmlEmpty = ""; console.log("   Leer-Render-Fehler:", e.message); }
ok(htmlEmpty.includes("Keine Rückfahrten für diesen Betriebstag"), "103. Leerzustand ohne Rueckfahrten sichtbar");

// ---- 104 Leerzustand bei Filtern (strukturell im Quelltext) ----
const body = rawSrc.slice(rawSrc.indexOf("function MissionReturnsTab"), rawSrc.indexOf("/* -------------------------- Flughafen-Modul"));
ok(body.includes("Keine Rückfahrten entsprechen den aktuellen Filtern."), "104. Filter-Leerzustand im Quelltext vorhanden");

// ---- 92-95 Timer (strukturell) ----
ok(/setInterval\(\(\) => setNow\(Date\.now\(\)\), 60000\)/.test(body), "92. Timer aktualisiert einmal pro Minute (60000 ms)");
ok(!body.includes("30000"), "92b. kein 30s-Timer mehr in der Rueckfahrten-Ansicht");
ok(body.includes("clearInterval"), "93. Timer wird beim Unmount entfernt (clearInterval)");
{ const eff = body.slice(body.indexOf("useEffect(() => { const t = setInterval"), body.indexOf("useEffect(() => { const t = setInterval") + 160);
  ok(!/updateDyn|supabase|storage\.set/.test(eff), "94/95. Timer loest keinen DB-/Schreibvorgang aus"); }

// ---- Read-only: D-Ergaenzungen ohne neuen Schreibweg (nur bekannte Presence-Handler) ----
{ // updateDyn nur in den 3 uebernommenen Presence-Handlern, nicht in der D-Ableitung/Anzeige
  const dPart = body.slice(body.indexOf("// ---- Teilpaket D: operatives View-Model"));
  ok(!/updateDyn\(/.test(dPart), "Read-only: D-Ableitung/Anzeige enthaelt keinen updateDyn-Aufruf");
}

// ---- 116-118 Rollen-Gating: Rueckfahrten bleibt Leitstelle-only ----
const dispoTabs = mcNavForRole("dispo").map((n) => n.tab);
const stageTabs = mcNavForRole("stage").map((n) => n.tab);
const driverTabs = mcNavForRole("driver").map((n) => n.tab);
ok(dispoTabs.includes("returns"), "116. Rueckfahrten in der Leitstellen-Nav");
ok(!stageTabs.includes("returns"), "117. Stage-Nav ohne Rueckfahrten-Leitstand");
ok(!driverTabs.includes("returns"), "116b. Fahrer-Nav ohne Rueckfahrten-Leitstand");
ok(!("guest" in MC_ROLE_TABS) && mcNavForRole("guest").length === 0, "118. Gast-Rolle ohne MC-Nav");

console.log(`\n=== D-UI/Read-only: ${pass} bestanden, ${fail} fehlgeschlagen ===`);
if (fail > 0) process.exit(1);
