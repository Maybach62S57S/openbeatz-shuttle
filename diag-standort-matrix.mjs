// DIAGNOSE (rein lesend, kein Fix): Unter welchen Bedingungen landet ein Fahrer
// auf der Schema-Karte am Festival/Zonen-Cluster?
// Faehrt die echte estimateDriverPosition aus dem Quellcode gegen eine Matrix
// von Fahrer-Zustaenden, LIVE und SIM, und protokolliert das Ergebnis.
import fs from "fs";
import { execSync } from "child_process";

const srcFile = process.argv[2];
const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/diag-src-" + tag + ".jsx";
fs.writeFileSync(copy, fs.readFileSync(srcFile, "utf8") +
  "\nexport { estimateDriverPosition, computeDriverStats, buildMapNodes, resolveNode, computeMapPositions };\n");
const out = "/home/claude/repo/.diag-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const mod = await import(out);
const { estimateDriverPosition, computeDriverStats, buildMapNodes, computeMapPositions } = mod;

const day = "2026-07-24";
const nowMin = 16 * 60; // 16:00

// Setup wie in Produktion: baseLocationId testen wir in BEIDEN Varianten.
function mkSetup(baseLocationId) {
  return {
    drivers: [{ id: "dX", firstName: "Test", lastName: "Fahrer", vehicleType: "Car", seats: 4 }],
    locations: [
      { id: "festival", short: "F", name: "Festival" },
      { id: "sheraton", short: "S", name: "Sheraton" },
      { id: "airport", short: "A", name: "Airport" },
      { id: "leonardo", short: "L", name: "Leonardo" },
    ],
    zones: ["Caldera", "Zone 3", "Stonelands"],
    config: { baseLocationId, minDurationMin: 20, softHoursMin: 480 },
    matrix: {},
  };
}

function ride(o) {
  return {
    id: o.id, dayKey: day, time: o.time, djName: "X",
    fromId: o.fromId, toId: o.toId, zone: o.zone || null,
    status: o.status, assignedDriverId: "dX", passengerCount: 2,
    estDurationMin: 30, issues: [], statusHistory: [], log: [],
  };
}

// Szenarien: was hat der Fahrer heute, was steht in driverState
const SZENARIEN = [
  { name: "S1  keine Fahrten heute, kein GPS, kein locationId", rides: [], st: {} },
  { name: "S2  nur geplante Fahrten (planned), sonst nichts",   rides: [ride({ id: "r1", time: "20:00", fromId: "sheraton", toId: "festival", zone: "Caldera", status: "planned" })], st: {} },
  { name: "S3  done-Fahrt ZUM Festival (mit Zone)",             rides: [ride({ id: "r1", time: "12:00", fromId: "airport", toId: "festival", zone: "Caldera", status: "done" })], st: {} },
  { name: "S4  done-Fahrt ZUM Festival (ohne Zone)",            rides: [ride({ id: "r1", time: "12:00", fromId: "airport", toId: "festival", zone: null, status: "done" })], st: {} },
  { name: "S5  done-Fahrt zum Sheraton",                        rides: [ride({ id: "r1", time: "12:00", fromId: "airport", toId: "sheraton", status: "done" })], st: {} },
  { name: "S6  done SEHR frueh (06:00) zum Festival",           rides: [ride({ id: "r1", time: "06:00", fromId: "airport", toId: "festival", zone: "Caldera", status: "done" })], st: {} },
  { name: "S7  st.locationId = festival gesetzt",               rides: [], st: { locationId: "festival" } },
  { name: "S8  done zum Sheraton + st.locationId festival",     rides: [ride({ id: "r1", time: "12:00", fromId: "airport", toId: "sheraton", status: "done" })], st: { locationId: "festival" } },
  { name: "S9  done zu unbekanntem Ort (nicht in nodes)",       rides: [ride({ id: "r1", time: "12:00", fromId: "airport", toId: "gibtsnicht", status: "done" })], st: {} },
  { name: "S10 zwei done: erst Festival, dann Sheraton",        rides: [ride({ id: "r1", time: "10:00", fromId: "airport", toId: "festival", zone: "Caldera", status: "done" }), ride({ id: "r2", time: "13:00", fromId: "festival", toId: "sheraton", status: "done" })], st: {} },
  { name: "S11 zwei done: erst Sheraton, dann Festival",        rides: [ride({ id: "r1", time: "10:00", fromId: "airport", toId: "sheraton", status: "done" }), ride({ id: "r2", time: "13:00", fromId: "sheraton", toId: "festival", zone: "Caldera", status: "done" })], st: {} },
];

const FESTIVAL_NODES = new Set(["festival", "zone:caldera", "zone:zone-3", "zone:stonelands"]);

function istFestival(nodeId) {
  if (!nodeId) return false;
  return FESTIVAL_NODES.has(nodeId) || String(nodeId).startsWith("zone:");
}

const zeilen = [];
for (const base of [undefined, "sheraton", "festival"]) {
  const setup = mkSetup(base);
  for (const mode of ["live", "sim"]) {
    for (const s of SZENARIEN) {
      const dyn = { rides: s.rides, driverState: { dX: s.st }, messages: [], rev: 1 };
      const nodes = buildMapNodes(setup, dyn, day);
      const ctx = { setup, dyn, dayKey: day, nowMin, mode, nodes };
      const pos = estimateDriverPosition(ctx, setup.drivers[0]);
      const mapped = computeMapPositions(setup, dyn, day, nowMin, mode, nodes)[0];
      const stats = computeDriverStats(setup, dyn, "dX", day);
      zeilen.push({
        base: base === undefined ? "NULL(DB)" : base, mode, szenario: s.name,
        nodeId: pos.nodeId === null ? "NULL" : pos.nodeId,
        sichtbar: mapped.xy ? "JA" : "nein",
        amFestival: istFestival(pos.nodeId) && mapped.xy ? "!! FESTIVAL !!" : "",
        locNow: stats.locNow === null ? "NULL" : stats.locNow,
        atFestivalFilter: (!stats.active && stats.locNow === "festival") ? "zaehlt" : "",
      });
    }
  }
}

const w = (s, n) => String(s).padEnd(n).slice(0, n);
console.log("");
console.log("DIAGNOSE: wo landet ein Fahrer auf der Karte?");
console.log("nowMin = 16:00, Tag = " + day);
console.log("");
console.log(w("base", 9) + w("mode", 6) + w("Szenario", 48) + w("Karten-Node", 16) + w("sichtbar", 10) + w("Festival?", 16) + w("locNow", 12) + "atFest-Filter");
console.log("-".repeat(130));
let letzte = null;
for (const z of zeilen) {
  const key = z.base + z.mode;
  if (letzte && letzte !== key) console.log("-".repeat(130));
  letzte = key;
  console.log(w(z.base, 9) + w(z.mode, 6) + w(z.szenario, 48) + w(z.nodeId, 16) + w(z.sichtbar, 10) + w(z.amFestival, 16) + w(z.locNow, 12) + z.atFestivalFilter);
}
console.log("");

// Zusammenfassung: welche Szenarien erzeugen im LIVE-Modus einen Festival-Punkt?
const liveFest = zeilen.filter((z) => z.mode === "live" && z.amFestival);
const simFest = zeilen.filter((z) => z.mode === "sim" && z.amFestival);
console.log("LIVE-Modus, Fahrer landet am Festival:");
liveFest.forEach((z) => console.log("   [base=" + z.base + "] " + z.szenario + "  -> " + z.nodeId));
console.log("");
console.log("SIM-Modus, Fahrer landet am Festival:");
simFest.forEach((z) => console.log("   [base=" + z.base + "] " + z.szenario + "  -> " + z.nodeId));
console.log("");

fs.unlinkSync(out);
fs.unlinkSync(copy);
