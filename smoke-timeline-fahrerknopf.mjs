// Smoke: additiver "Fahrer ändern"-Knopf in der Timeline-Fahrtkachel (MissionTimelinePage).
// Prueft: (1) neuer Knopf (title "Fahrer ändern") im Timeline-Markup vorhanden,
// (2) Stift-Knopf (title "Fahrt bearbeiten") weiter vorhanden (nicht kaputt),
// (3) Fahrt gerendert. Gegenprobe: HEAD-Version (ohne den Knopf) hat "Fahrer ändern" NICHT in der Timeline.

import fs from "fs";
import { execSync } from "child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const srcFile = process.argv[2];
const tag = Math.random().toString(36).slice(2);

// Minimal-Stubs, falls der Render window/document streift (defensiv).
if (typeof globalThis.window === "undefined") globalThis.window = { innerWidth: 1200, innerHeight: 800 };
if (typeof globalThis.document === "undefined") globalThis.document = { elementFromPoint: () => null };

const setup = {
  drivers: [
    { id: "d1", firstName: "Mustafa", lastName: "Uenver", vehicleType: "Van", seats: 7 },
    { id: "d2", firstName: "David", lastName: "Schneider", vehicleType: "Car", seats: 4 },
  ],
  locations: [
    { id: "airport", short: "APT", name: "Airport" },
    { id: "festival", short: "FEST", name: "Festival" },
  ],
  config: { baseLocationId: "festival" },
};
const day = "2026-07-25";
const rides = [
  { id: "r1", dayKey: day, time: "18:00", djName: "Timmy Trumpet", fromId: "airport", toId: "festival", status: "accepted", assignedDriverId: "d1", passengerCount: 5, estDurationMin: 60, issues: [], statusHistory: [], log: [] },
];
const dyn = { rides, driverState: {}, messages: [], rev: 1 };

function buildModule(source, suffix) {
  const copy = "/tmp/smk-tl-" + tag + "-" + suffix + ".jsx";
  fs.writeFileSync(copy, source + "\nexport { MissionTimelinePage };\n");
  const out = "/home/claude/repo/.smk-tl-" + tag + "-" + suffix + ".mjs";
  execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
  return out;
}

function renderTL(out) {
  return import(out + "?" + Math.random()).then((mod) =>
    renderToStaticMarkup(React.createElement(mod.MissionTimelinePage, {
      setup, dyn, day,
      onEdit: () => {}, onAssign: () => {}, updateDyn: async () => ({ ok: true }),
      by: "dispo:x", onUndo: () => {}, onErr: () => {},
    }))
  );
}

const checks = [];
const pruef = (name, ok, hint) => checks.push({ name, ok, hint });

// --- Aktueller Stand (mit Knopf) ---
const outNeu = buildModule(fs.readFileSync(srcFile, "utf8"), "neu");
let hNeu;
try { hNeu = await renderTL(outNeu); }
catch (e) { console.log("FEHLER Render (neu): " + e.message); process.exit(1); }

pruef("neu: Fahrt (Timmy Trumpet) gerendert", hNeu.includes("Timmy Trumpet"));
pruef("neu: Fahrer-Knopf (Button title=\"Fahrer ändern\") vorhanden", hNeu.includes('title="Fahrer ändern"'));
pruef("neu: Stift-Knopf (title 'Fahrt bearbeiten') weiter vorhanden", hNeu.includes("Fahrt bearbeiten"));

// --- Gegenprobe: HEAD (ohne Knopf) ---
const headSrc = execSync("git show HEAD:src/ShuttleLeitstelle.jsx", { maxBuffer: 32 * 1024 * 1024 }).toString();
const outHead = buildModule(headSrc, "head");
let hHead;
try { hHead = await renderTL(outHead); }
catch (e) { console.log("FEHLER Render (head): " + e.message); process.exit(1); }

pruef("GP: HEAD-Timeline hat Button title=\"Fahrer ändern\" NICHT (kippt)", !hHead.includes('title="Fahrer ändern"'), "Gegenprobe misst nichts");
pruef("GP-Kontrolle: HEAD-Timeline hat 'Fahrt bearbeiten' schon", hHead.includes("Fahrt bearbeiten"));

// --- Ausgabe ---
let bad = 0;
for (const c of checks) {
  console.log((c.ok ? "OK    " : "FAIL  ") + c.name + (c.ok ? "" : "  -- " + (c.hint || "")));
  if (!c.ok) bad++;
}
console.log("");
console.log(bad === 0 ? "TIMELINE-KNOPF-SMOKE OK (" + checks.length + " Pruefungen, inkl. Gegenprobe)" : "SMOKE FAIL: " + bad + " von " + checks.length);

for (const f of fs.readdirSync("/home/claude/repo")) {
  if (f.startsWith(".smk-tl-" + tag)) fs.unlinkSync("/home/claude/repo/" + f);
}
process.exit(bad === 0 ? 0 : 1);
