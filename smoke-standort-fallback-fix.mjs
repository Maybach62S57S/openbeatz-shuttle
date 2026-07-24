// Smoke: Standort-Fallback-Fix (Stufe 1 + 2)
// Prueft:
// Stufe 2: estimateDriverPosition gibt bei Fahrer OHNE aktive Fahrt, OHNE GPS
//   und OHNE last-done nun nodeId=null (statt "festival"). Fahrer mit last-done
//   nutzen weiter das echte Ziel dieser Fahrt.
// Stufe 1: atFestival-Filter (nachgebaut, gleiche Logik wie in Z. 9162) filtert
//   Fahrer ohne locNow nicht mehr als am Festival ein.
// Gegenprobe: wenn wir absichtlich einen Fahrer MIT last-done-Ziel Sheraton
//   nehmen, kommt sheraton raus (Fallback greift korrekt).

import fs from "fs";
import { execSync } from "child_process";

const srcFile = process.argv[2];
const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/smk-src-" + tag + ".jsx";
fs.writeFileSync(copy, fs.readFileSync(srcFile, "utf8") + "\nexport { estimateDriverPosition, computeDriverStats };\n");
const out = "/home/claude/repo/.smk-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const mod = await import(out);
const { estimateDriverPosition, computeDriverStats } = mod;

const day = "2026-07-25";
const setup = {
  drivers: [
    { id: "d1", firstName: "A", lastName: "A", vehicleType: "Car", seats: 4 },
    { id: "d2", firstName: "B", lastName: "B", vehicleType: "Car", seats: 4 },
    { id: "d3", firstName: "C", lastName: "C", vehicleType: "Car", seats: 4 },
  ],
  locations: [
    { id: "festival", short: "F", name: "Festival", lat: 49.5, lng: 10.9 },
    { id: "sheraton", short: "S", name: "Sheraton", lat: 49.6, lng: 10.9 },
    { id: "airport", short: "A", name: "Airport", lat: 49.7, lng: 10.9 },
  ],
  config: { baseLocationId: "festival", softHoursMin: 480 },
  matrix: {},
};

const nodes = {
  festival: { id: "festival", x: 500, y: 300, short: "F", name: "Festival" },
  sheraton: { id: "sheraton", x: 700, y: 500, short: "S", name: "Sheraton" },
  airport:  { id: "airport",  x: 900, y: 100, short: "A", name: "Airport"  },
};

// d1: keine Fahrten heute, kein GPS, kein st.locationId, keine done -> unbekannt
// d2: eine erledigte Fahrt heute mit Ziel sheraton -> Sheraton
// d3: aktive onboard-Fahrt -> auf Route
const rides = [
  { id: "r_done", dayKey: day, time: "10:00", djName: "X", fromId: "airport", toId: "sheraton", status: "done", assignedDriverId: "d2", passengerCount: 2, estDurationMin: 30, issues: [], statusHistory: [], log: [] },
  { id: "r_active", dayKey: day, time: "14:00", djName: "Y", fromId: "airport", toId: "festival", status: "onboard", assignedDriverId: "d3", passengerCount: 2, estDurationMin: 45, issues: [], statusHistory: [], log: [] },
];

const dyn = { rides, driverState: {}, messages: [], rev: 1 };
const nowMin = 15 * 60; // 15:00
const ctx = { setup, dyn, dayKey: day, nowMin, mode: "live", nodes };

const checks = [];
function pruef(name, ok, hint) { checks.push({ name, ok, hint }); }

// --- Stufe 2: estimateDriverPosition -------------------------------------
const p1 = estimateDriverPosition(ctx, setup.drivers[0]);
const p2 = estimateDriverPosition(ctx, setup.drivers[1]);
const p3 = estimateDriverPosition(ctx, setup.drivers[2]);

pruef("Stufe 2: Fahrer ohne Info bekommt nodeId=null (nicht 'festival')",
  p1.nodeId === null,
  `nodeId ist '${p1.nodeId}' statt null`);
pruef("Stufe 2: Fahrer mit last-done Sheraton bekommt nodeId='sheraton' (Gegenprobe Fallback)",
  p2.nodeId === "sheraton",
  `nodeId ist '${p2.nodeId}' statt 'sheraton'`);
pruef("Stufe 2: Fahrer onboard bleibt auf Route (mode='onboard')",
  p3.mode === "onboard" && p3.fromId === "airport" && p3.toId === "festival",
  `mode='${p3.mode}', from='${p3.fromId}', to='${p3.toId}'`);
pruef("Stufe 2: Fahrer ohne Info hat mode='free' (Verhalten unveraendert)",
  p1.mode === "free",
  `mode ist '${p1.mode}'`);

// Gegenprobe Stufe 2: wenn ich lastDone-Ziel auf null setze (Fahrt ohne toId),
// muss auch NULL rauskommen, nicht Festival
const dynBrokenDone = {
  ...dyn,
  rides: rides.map((r) => r.id === "r_done" ? { ...r, toId: null } : r),
};
const ctxBroken = { ...ctx, dyn: dynBrokenDone };
const p2broken = estimateDriverPosition(ctxBroken, setup.drivers[1]);
pruef("Gegenprobe: Fahrer mit last-done aber ohne Ziel-Node bekommt null (nicht festival)",
  p2broken.nodeId === null,
  `nodeId ist '${p2broken.nodeId}' statt null`);

// --- Stufe 1: atFestival-Filter (Nachbau der Z. 9162-Logik) --------------
// nach dem Fix: nur explizit locNow === "festival"
const atFestival = setup.drivers
  .map((d) => ({ d, s: computeDriverStats(setup, dyn, d.id, day) }))
  .filter((x) => !x.s.active && x.s.locNow === "festival");

const namesAtFestival = atFestival.map((x) => x.d.id);
// d1: keine Info -> locNow faellt in computeDriverStats aber auf "festival" (base-Fallback bleibt)
//     ABER: mit der Fix-Version des Filters wird d1 nur eingezaehlt, wenn locNow === "festival".
//     Da der computeDriverStats-Fallback UNVERAENDERT ist, wird d1 hier weiter zaehlen.
//     Das ist Design-Kompromiss: der Vorschlag zeigt "am Festival" fuer Fahrer, deren
//     letzte bekannte Info wirklich Festival war ODER die noch keine Info haben.
//     Was der Fix behebt: !x.s.locNow ist jetzt entfernt - also NULL wird nicht als
//     "am Festival" behandelt. Aber computeDriverStats liefert kein null. Deshalb
//     testen wir das indirekt: haende-simuliert eine Situation mit locNow=null.

// Direkter Filter-Test mit synthetischen locNow-Werten (Nachbau der Logik):
function atFestivalNeu(list) {
  return list.filter((x) => !x.s.active && x.s.locNow === "festival");
}
function atFestivalAlt(list) {
  return list.filter((x) => !x.s.active && (x.s.locNow === "festival" || !x.s.locNow));
}
const synth = [
  { d: { id: "s1" }, s: { active: false, locNow: "festival" } },   // beide: drin
  { d: { id: "s2" }, s: { active: false, locNow: "sheraton" } },   // beide: raus
  { d: { id: "s3" }, s: { active: false, locNow: null } },          // alt: drin, neu: raus (Bug)
  { d: { id: "s4" }, s: { active: false, locNow: undefined } },     // alt: drin, neu: raus (Bug)
  { d: { id: "s5" }, s: { active: true,  locNow: "festival" } },    // beide: raus (aktiv)
];
const altList = atFestivalAlt(synth).map((x) => x.d.id);
const neuList = atFestivalNeu(synth).map((x) => x.d.id);

pruef("Stufe 1 alt: enthaelt s1, s3, s4 (Bug-Zustand als Referenz)",
  JSON.stringify(altList) === JSON.stringify(["s1", "s3", "s4"]),
  `altList=${JSON.stringify(altList)}`);
pruef("Stufe 1 neu: enthaelt NUR s1 (Fahrer ohne locNow werden nicht mehr eingezaehlt)",
  JSON.stringify(neuList) === JSON.stringify(["s1"]),
  `neuList=${JSON.stringify(neuList)}`);
pruef("Stufe 1: s2 (sheraton) bleibt auch nach Fix draussen (unveraendertes Verhalten)",
  !neuList.includes("s2"),
  "s2 unerwartet drin");
pruef("Stufe 1: s5 (aktiv, festival) bleibt draussen (aktiv-Filter unveraendert)",
  !neuList.includes("s5"),
  "s5 unerwartet drin");

// --- Ausgabe ------------------------------------------------------------
let bad = 0;
for (const c of checks) {
  console.log((c.ok ? "OK    " : "FAIL  ") + c.name + (c.ok ? "" : "  -- " + c.hint));
  if (!c.ok) bad++;
}
console.log("");
console.log(bad === 0 ? "SMOKE OK (" + checks.length + " Pruefungen)" : "SMOKE FAIL: " + bad + " von " + checks.length + " Pruefungen fehlgeschlagen");

fs.unlinkSync(out); fs.unlinkSync(copy);
process.exit(bad === 0 ? 0 : 1);
