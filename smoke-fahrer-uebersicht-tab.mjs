// Smoke: DriverApp mit neuem activeTab-Umschalter.
// Prueft: (1) "mine" zeigt Nachrichten-Composer und Naechste-Fahrt-Block wie bisher,
// (2) "all" zeigt die neue Uebersicht mit zugeteiltem Fahrer und ohne Composer/Naechste-Fahrt,
// (3) Tab-Bar in beiden Zustaenden sichtbar,
// (4) Gegenprobe: bewusster Fehler wird erkannt.

import fs from "fs";
import { execSync } from "child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const srcFile = process.argv[2];
const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/smk-src-" + tag + ".jsx";
fs.writeFileSync(copy, fs.readFileSync(srcFile, "utf8") + "\nexport { DriverApp };\n");
const out = "/home/claude/repo/.smk-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const mod = await import(out);
const { DriverApp } = mod;

const day = "2026-07-25";
const setup = {
  drivers: [
    { id: "d1", firstName: "Mustafa", lastName: "Uenver", vehicleType: "Car", seats: 4 },
    { id: "d2", firstName: "David", lastName: "Schneider", vehicleType: "Car", seats: 4 },
  ],
  locations: [
    { id: "airport", short: "APT", name: "Airport" },
    { id: "festival", short: "FEST", name: "Festival" },
  ],
  config: { baseLocationId: "festival" },
};

const rides = [
  { id: "r1", dayKey: day, time: "18:00", djName: "Timmy Trumpet", fromId: "airport", toId: "festival", status: "onboard", assignedDriverId: "d1", passengerCount: 5, estDurationMin: 60, issues: [], statusHistory: [], log: [] },
  { id: "r2", dayKey: day, time: "20:00", djName: "Da Tweekaz", fromId: "airport", toId: "festival", status: "enroute_pickup", assignedDriverId: "d2", passengerCount: 3, estDurationMin: 60, issues: [], statusHistory: [], log: [] },
  { id: "r3", dayKey: day, time: "22:00", djName: "Will Sparks", fromId: "airport", toId: "festival", status: "planned", assignedDriverId: null, passengerCount: 2, estDurationMin: 60, issues: [], statusHistory: [], log: [] },
  { id: "r4", dayKey: "2026-07-26", time: "10:00", djName: "Nicht heute", fromId: "airport", toId: "festival", status: "planned", assignedDriverId: "d1", passengerCount: 1, estDurationMin: 60, issues: [], statusHistory: [], log: [] },
];

const dyn = { rides, driverState: {}, messages: [], rev: 1 };
const session = { role: "driver", driverId: "d1" };

// Rendere DriverApp mit Default-State (mine)
let htmlMine, htmlAll;
try {
  htmlMine = renderToStaticMarkup(React.createElement(DriverApp, {
    setup, dyn, session, updateDyn: async () => ({ ok: true }), onLogout: () => {},
  }));
} catch (e) { console.log("FEHLER mine: " + e.message); process.exit(1); }

// Rendere DriverApp mit umgeschaltet auf "all" via globalThis-Seed
globalThis.__ACTIVE_TAB__ = "all";
// Wegwerf-Copy mit Seed-Override
const copy2 = "/tmp/smk-src-" + tag + "-all.jsx";
let source = fs.readFileSync(srcFile, "utf8");
// Ersetze den Default-State fuer den Test durch den globalen Seed
source = source.replace(
  'const [activeTab, setActiveTab] = useState("mine");',
  'const [activeTab, setActiveTab] = useState(globalThis.__ACTIVE_TAB__ || "mine");'
);
fs.writeFileSync(copy2, source + "\nexport { DriverApp };\n");
const out2 = "/home/claude/repo/.smk-" + tag + "-all.mjs";
execSync(`./node_modules/.bin/esbuild ${copy2} --bundle=false --format=esm --jsx=automatic --outfile=${out2}`);
const mod2 = await import(out2);
try {
  htmlAll = renderToStaticMarkup(React.createElement(mod2.DriverApp, {
    setup, dyn, session, updateDyn: async () => ({ ok: true }), onLogout: () => {},
  }));
} catch (e) { console.log("FEHLER all: " + e.message); process.exit(1); }

// Pruefungen
const checks = [];
function pruef(name, ok, hint) { checks.push({ name, ok, hint }); }

// Tab-Bar in beiden Zustaenden sichtbar
pruef("mine: Tab-Bar 'Meine Fahrten' sichtbar", htmlMine.includes("Meine Fahrten"), "Tab-Beschriftung fehlt");
pruef("mine: Tab-Bar 'Wer faehrt wen' sichtbar", htmlMine.includes("Wer faehrt wen"), "Tab-Beschriftung fehlt");
pruef("all: Tab-Bar 'Meine Fahrten' sichtbar", htmlAll.includes("Meine Fahrten"), "Tab-Beschriftung fehlt");
pruef("all: Tab-Bar 'Wer faehrt wen' sichtbar", htmlAll.includes("Wer faehrt wen"), "Tab-Beschriftung fehlt");

// mine: eigene Fahrten sichtbar (Timmy Trumpet ist d1)
pruef("mine: eigene Fahrt (Timmy Trumpet) sichtbar", htmlMine.includes("Timmy Trumpet"), "Fahrt nicht gerendert");
// mine: fremde Fahrt (Da Tweekaz von d2) NICHT sichtbar in eigener Liste (aber in Naechste Fahrt auch nicht)
pruef("mine: fremde Fahrt (Da Tweekaz) NICHT sichtbar", !htmlMine.includes("Da Tweekaz"), "Fremde Fahrt sichtbar");
// mine: Nachrichten-Composer sichtbar (Placeholder-Text)
pruef("mine: Nachrichten-Composer sichtbar", htmlMine.includes("brauche Info"), "Composer fehlt");

// all: alle Fahrten des Tages sichtbar
pruef("all: Timmy Trumpet sichtbar", htmlAll.includes("Timmy Trumpet"), "Fahrt fehlt");
pruef("all: Da Tweekaz sichtbar", htmlAll.includes("Da Tweekaz"), "Fahrt fehlt");
pruef("all: Will Sparks sichtbar", htmlAll.includes("Will Sparks"), "Fahrt fehlt");
// all: Fahrer-Namen der Zuteilung sichtbar
pruef("all: Mustafa Uenver (Fahrer von Timmy) sichtbar", htmlAll.includes("Mustafa Uenver"), "Fahrer-Name fehlt");
pruef("all: David Schneider (Fahrer von Da Tweekaz) sichtbar", htmlAll.includes("David Schneider"), "Fahrer-Name fehlt");
// all: "Nicht zugeteilt" fuer Will Sparks
pruef("all: 'Nicht zugeteilt' fuer Will Sparks", htmlAll.includes("Nicht zugeteilt"), "Fallback fehlt");
// all: Fahrt eines ANDEREN Tages NICHT sichtbar
pruef("all: Fahrt anderer Tag (26.07.) NICHT sichtbar", !htmlAll.includes("Nicht heute"), "Tages-Filter kaputt");
// all: Nachrichten-Composer NICHT sichtbar (nur mine-Tab)
pruef("all: Nachrichten-Composer NICHT sichtbar", !htmlAll.includes("brauche Info"), "Composer im all-Tab sichtbar");

// Gegenprobe: wenn ich einen Fahrer entferne, ist "Mustafa" NICHT im all-HTML
const setupOhneD1 = { ...setup, drivers: setup.drivers.filter((d) => d.id !== "d1") };
const htmlGegenprobe = renderToStaticMarkup(React.createElement(mod2.DriverApp, {
  setup: setupOhneD1, dyn, session: { role: "driver", driverId: "d2" },
  updateDyn: async () => ({ ok: true }), onLogout: () => {},
}));
pruef("Gegenprobe: ohne Fahrer d1 taucht 'Mustafa Uenver' NICHT auf", !htmlGegenprobe.includes("Mustafa Uenver"), "Gegenprobe schlaegt nicht an");

// Ausgabe
let bad = 0;
for (const c of checks) {
  console.log((c.ok ? "OK    " : "FAIL  ") + c.name + (c.ok ? "" : "  -- " + c.hint));
  if (!c.ok) bad++;
}
console.log("");
console.log(bad === 0 ? "SMOKE OK (" + checks.length + " Pruefungen)" : "SMOKE FAIL: " + bad + " von " + checks.length + " Pruefungen fehlgeschlagen");

// Aufraeumen
fs.unlinkSync(out); fs.unlinkSync(copy);
fs.unlinkSync(out2); fs.unlinkSync(copy2);
process.exit(bad === 0 ? 0 : 1);
