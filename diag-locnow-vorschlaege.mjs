// DIAGNOSE (reine Messung, aendert nichts): Wirkt sich ein unbekannter
// Fahrer-Standort (locNow = null) auf die Zuteilungs-Vorschlaege aus?
//
// Hintergrund: evaluateInsertion Z. 2243
//   const prevLoc = prev ? rideEndpointMatrixNode(...) : (stats.locNow || cfg.baseLocationId);
// Hat ein Fahrer an diesem Tag noch KEINE Vorfahrt (prev === null), faellt die
// Position auf stats.locNow zurueck. Seit 121c4de (Tagesbezug) liefert
// stateLocationId bei Altbestand null, und baseLocationId ist in der
// Produktion bewusst NICHT gesetzt. Damit koennte prevLoc undefined werden ->
// travelMin unbekannt -> deadKnown=false -> unknownTiming=true -> feasible=false.
//
// Praktische Frage: Verschwinden dadurch Fahrer aus den Vorschlaegen, die
// eigentlich verfuegbar sind (z. B. morgens, bevor die erste Fahrt beendet ist)?
//
// Gemessen wird gegen BEIDE Staende: vor dem Tagesbezugs-Fix und aktuell.

import fs from "fs";
import { execSync } from "child_process";

const srcFile = process.argv[2];
const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/diag-loc-" + tag + ".jsx";
fs.writeFileSync(copy, fs.readFileSync(srcFile, "utf8") +
  "\nexport { evaluateInsertion, suggestDrivers, computeDriverStats, travelMin, seedMatrix, seedLocations };\n");
const out = "/home/claude/repo/.diag-loc-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const { evaluateInsertion, suggestDrivers, computeDriverStats, travelMin, seedMatrix, seedLocations } = await import(out);

const HEUTE = "2026-07-24";
const GESTERN = "2026-07-23";

// ECHTE Matrix und Orte aus dem Quelltext (kein selbstgebautes Format).
const matrix = seedMatrix();
const locations = seedLocations();
const setup = {
  drivers: [
    { id: "frisch",   firstName: "Frisch",   lastName: "Ohne State", vehicleType: "Car", seats: 4 },
    { id: "altstate", firstName: "Alt",      lastName: "Bestand",    vehicleType: "Car", seats: 4 },
    { id: "heute",    firstName: "Heute",    lastName: "Gesetzt",    vehicleType: "Car", seats: 4 },
  ],
  locations,
  zones: ["Caldera"],
  // baseLocationId bewusst NICHT gesetzt, exakt wie in der Produktion.
  config: { minDurationMin: 20, softHoursMin: 480, bufferMin: 5 },
  matrix,
};

// Eine offene Fahrt am Vormittag, die zugeteilt werden soll.
const neueFahrt = {
  id: "neu1", dayKey: HEUTE, date: HEUTE, time: "23:30", djName: "Testartist",
  fromId: "airport", toId: "festival", zone: "Caldera",
  fromCustom: "", toCustom: "", status: "planned", assignedDriverId: null,
  passengerCount: 2, estDurationMin: 35, issues: [], statusHistory: [], log: [],
};

const driverState = {
  // 1) Fahrer ohne jeden State (z. B. erster Einsatztag, App frisch)
  frisch: {},
  // 2) Fahrer mit Altbestand von GESTERN (haeufigster Fall am Morgen)
  altstate: { locationId: "festival", locationDayKey: GESTERN },
  // 3) Fahrer mit sauberem State von heute (Kontrolle)
  heute: { locationId: "sheraton", locationDayKey: HEUTE },
};

const dyn = { rides: [neueFahrt], driverState, messages: [], rev: 1 };

console.log("\n=== Quelle:", srcFile, "===\n");

// Rohwerte: was liefert computeDriverStats?
for (const d of setup.drivers) {
  const s = computeDriverStats(setup, dyn, d.id, HEUTE);
  console.log(`  ${d.id.padEnd(9)} locNow = ${String(s.locNow)}`);
}
console.log("");

// Kernfrage: ist der Fahrer fuer die neue Fahrt vorschlagbar?
for (const d of setup.drivers) {
  const ev = evaluateInsertion(setup, dyn, d, neueFahrt);
  console.log(`  ${d.id.padEnd(9)} feasible=${String(ev.feasible).padEnd(5)}` +
    ` unknownTiming-Probleme: ${(ev.problems || []).join(" / ") || "-"}`);
}
console.log("");

// Was zeigt die Leitstelle wirklich an?
const vorschlaege = suggestDrivers(setup, dyn, neueFahrt);
const machbar = (vorschlaege || []).filter((v) => v.feasible);
console.log("  suggestDrivers gesamt:", (vorschlaege || []).length,
            "| davon feasible:", machbar.length,
            "|", machbar.map((v) => v.driver.id).join(",") || "KEINER");

// Kontrollmessung: liefert travelMin mit undefined ueberhaupt etwas?
console.log("  KONTROLLE travelMin(sheraton->airport):", String(travelMin(matrix, "sheraton", "airport")));
console.log("  travelMin(undefined -> airport):", String(travelMin(matrix, undefined, "airport")));
console.log("  travelMin(null -> airport):     ", String(travelMin(matrix, null, "airport")));
console.log("");

try { fs.unlinkSync(copy); fs.unlinkSync(out); } catch {}
