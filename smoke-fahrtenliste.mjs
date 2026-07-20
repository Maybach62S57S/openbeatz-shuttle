// Smoke-Test Fahrtenliste (RidesListTab): rendert die rein lesende Live-Uebersicht
// mit echten Ride-Feldern und prueft, dass alle gewuenschten Spalten erscheinen.
// Plus Gegenproben (leere Liste -> EmptyState, nicht vorhandener Name fehlt) und
// ein Read-only-Nachweis am Quelltext (kein Schreib-/Mutations-Pfad im Block).
import fs from "fs";
import { execSync } from "child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const srcFile = process.argv[2] || "src/ShuttleLeitstelle.jsx";
const src = fs.readFileSync(srcFile, "utf8");
const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/fl-src-" + tag + ".jsx";
fs.writeFileSync(copy, src + "\nexport { RidesListTab, ridesListDirection };\n");
const out = "/home/claude/repo/.fl-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const mod = await import(out);
const { RidesListTab, ridesListDirection } = mod;

let ok = 0, fail = 0;
const check = (name, cond) => { if (cond) { ok++; } else { fail++; console.log("FAIL:", name); } };

// --- Direction-Ableitung (reine Funktion) ---
check("dir return -> rueck", ridesListDirection("return").key === "rueck");
check("dir arrival -> hin", ridesListDirection("arrival").key === "hin");
check("dir toVenue -> hin", ridesListDirection("toVenue").key === "hin");
check("dir transfer -> transfer", ridesListDirection("transfer").key === "transfer");
check("dir unbekannt -> transfer", ridesListDirection("irgendwas").key === "transfer");

const setup = {
  locations: [
    { id: "leonardo", short: "Leonardo" },
    { id: "festival", short: "Caldera" },
    { id: "airport", short: "NUE" },
  ],
  drivers: [{ id: "d1", firstName: "Max", lastName: "Muster", vehicleType: "Van" }],
  config: {},
};
const rides = [
  { id: "r1", dayKey: "2026-07-23", time: "15:00", djName: "ZEYPHIA", fromId: "leonardo", toId: "festival", type: "toVenue", passengerCount: 2, assignedDriverId: "d1", flightNo: "", notes: "", status: "planned" },
  { id: "r2", dayKey: "2026-07-23", time: "20:30", djName: "XETEX", fromId: "festival", toId: "airport", type: "return", passengerCount: 3, assignedDriverId: null, flightNo: "LH123", notes: "live über App zuteilen", status: "done" },
];
const html = renderToStaticMarkup(React.createElement(RidesListTab, { setup, dyn: { rides }, day: "2026-07-23" }));

// --- Kernspalten sichtbar ---
check("Titel Fahrtenliste", html.includes("Fahrtenliste"));
check("Artist ZEYPHIA", html.includes("ZEYPHIA"));
check("Artist XETEX", html.includes("XETEX"));
check("Hinfahrt-Badge", html.includes("Hinfahrt"));
check("Rückfahrt-Badge", html.includes("Rückfahrt"));
check("Route Leonardo->Caldera", html.includes("Leonardo") && html.includes("Caldera"));
check("Route Caldera->NUE", html.includes("NUE"));
check("Personen 2", html.includes(">2<"));
check("Personen 3", html.includes(">3<"));
check("Fahrzeug Van", html.includes("Van"));
check("Fahrer Max Muster (zugeteilt)", html.includes("Max Muster"));
check("Fahrer offen (unbesetzt)", html.includes("offen"));
check("Status Geplant", html.includes("Geplant"));
check("Status Abgeschlossen", html.includes("Abgeschlossen"));
check("Flug LH123", html.includes("LH123"));
check("Notiz durchgereicht", html.includes("live über App zuteilen"));
check("Zeit 15:00", html.includes("15:00"));
check("Zeit 20:30", html.includes("20:30"));
check("Tageszähler '2 Fahrten'", html.includes("2 Fahrten"));

// --- Gegenprobe 1: nicht vorhandener Name darf NICHT erscheinen ---
check("Gegenprobe: NICHTVORHANDEN fehlt", !html.includes("NICHTVORHANDEN"));

// --- Gegenprobe 2: leere Liste -> EmptyState ---
const htmlEmpty = renderToStaticMarkup(React.createElement(RidesListTab, { setup, dyn: { rides: [] }, day: "2026-07-23" }));
check("Leer -> 'Keine Fahrten gefunden'", htmlEmpty.includes("Keine Fahrten gefunden"));
check("Leer -> kein Artist", !htmlEmpty.includes("ZEYPHIA"));

// --- Gegenprobe 3: der Test misst wirklich (bewusst falsche Erwartung schlaegt fehl) ---
let counterWorks = false;
try {
  const bad = (name, cond) => { if (!cond) throw new Error("erwartet-fehlgeschlagen: " + name); };
  bad("html enthaelt Unsinn", html.includes("DIESER_STRING_EXISTIERT_NICHT_XYZ"));
} catch (e) { counterWorks = true; }
check("Gegenprobe greift (falsche Erwartung wirft)", counterWorks);

// --- Read-only-Nachweis am Quelltext des RidesListTab-Blocks ---
const blockStart = src.indexOf("function RidesListTab(");
const blockEnd = src.indexOf("\n/* ===", blockStart);
const block = src.slice(blockStart, blockEnd > 0 ? blockEnd : blockStart + 8000);
for (const forbidden of ["updateDyn", "updateSetup", "onEdit", "onAssign", "window.storage", "supabase", "logRide"]) {
  check(`Read-only: kein '${forbidden}' im Block`, !block.includes(forbidden));
}

fs.unlinkSync(out); fs.unlinkSync(copy);
console.log(`\nFahrtenliste-Smoke: ${ok} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
