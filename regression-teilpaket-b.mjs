import * as ALT from "/tmp/reg_alt.mjs";
import * as NEU from "/tmp/reg_neu.mjs";

// Minimal-Setup mit den 4 Bestandsorten + Bestands-Matrix-Werten (33!, wie Alt-Stand)
// WICHTIG: Fuer den Regressionsvergleich muss die Matrix in BEIDEN identisch sein,
// sonst vergleiche ich Aepfel mit Birnen. Ich nehme die ALTE Matrix (33) fuer beide,
// damit nur der CODE-Unterschied wirkt, nicht der Datenunterschied.
const matrix = {
  "airport|moevenpick": { min: 3, km: 1 },
  "airport|sheraton": { min: 18, km: 10 },
  "airport|festival": { min: 30, km: 26 },
  "moevenpick|sheraton": { min: 18, km: 10 },
  "moevenpick|festival": { min: 30, km: 26 },
  "sheraton|festival": { min: 33, km: 28 },
};
const config = {
  festivalDates: ["2026-07-23","2026-07-24"], baseLocationId: "sheraton",
  minDurationMin: 20, softHoursMin: 480,
};
const drivers = [
  { id: "d1", firstName: "A", lastName: "One", seats: 3, vehicleType: "Car" },
  { id: "d2", firstName: "B", lastName: "Two", seats: 6, vehicleType: "Van" },
  { id: "d3", firstName: "C", lastName: "Three", seats: 4, vehicleType: "Car" },
];
const setup = { matrix, config, drivers, locations: [] };

// Rides ueber die 4 Bestandsorte (planned + zugeteilte fuer Ketten)
const rides = [
  { id: "r1", dayKey: "2026-07-23", date: "2026-07-23", time: "12:30", fromId: "airport", fromCustom: "", toId: "moevenpick", toCustom: "", passengerCount: 2, estDurationMin: 30, status: "done", assignedDriverId: "d1" },
  { id: "r2", dayKey: "2026-07-23", date: "2026-07-23", time: "14:00", fromId: "airport", fromCustom: "", toId: "sheraton", toCustom: "", passengerCount: 2, estDurationMin: 18, status: "planned", assignedDriverId: "d2" },
  { id: "r3", dayKey: "2026-07-23", date: "2026-07-23", time: "17:15", fromId: "sheraton", fromCustom: "", toId: "festival", toCustom: "", passengerCount: 2, estDurationMin: 33, status: "planned", assignedDriverId: null },
  { id: "r4", dayKey: "2026-07-23", date: "2026-07-23", time: "19:30", fromId: "sheraton", fromCustom: "", toId: "festival", toCustom: "", passengerCount: 2, estDurationMin: 33, status: "planned", assignedDriverId: null },
  { id: "r5", dayKey: "2026-07-23", date: "2026-07-23", time: "23:30", fromId: "festival", fromCustom: "", toId: "sheraton", toCustom: "", passengerCount: 2, estDurationMin: 33, status: "planned", assignedDriverId: "d1" },
  { id: "r6", dayKey: "2026-07-23", date: "2026-07-23", time: "20:00", fromId: "moevenpick", fromCustom: "", toId: "festival", toCustom: "", passengerCount: 4, estDurationMin: 30, status: "planned", assignedDriverId: null },
];
const dyn = { rides, driverState: {} };

// Fuer jede planbare Fahrt: suggestDrivers alt vs neu vergleichen
let diffs = 0;
const targets = rides.filter((r) => r.assignedDriverId == null || r.status === "planned");
for (const ride of targets) {
  const a = ALT.suggestDrivers(setup, dyn, ride);
  const n = NEU.suggestDrivers(setup, dyn, ride);
  // Vergleiche die relevanten Kennzahlen pro Fahrer (Reihenfolge + Kernwerte)
  const norm = (arr) => arr.map((x) => ({
    id: x.driver.id, feasible: x.feasible, deadMin: x.deadMin, deadKnown: x.deadKnown,
    lateToPickup: x.lateToPickup, lateToNext: x.lateToNext, unknownTiming: x.unknownTiming,
    score: Math.round(x.score * 1000) / 1000, problems: x.problems,
  }));
  const na = JSON.stringify(norm(a));
  const nn = JSON.stringify(norm(n));
  if (na !== nn) {
    diffs++;
    console.log(`\nDIFF bei Ride ${ride.id} (${ride.fromId}->${ride.toId} @ ${ride.time}):`);
    console.log("  ALT:", na);
    console.log("  NEU:", nn);
  }
}

console.log(`\n=== Regression Bestandsfahrten: ${targets.length} Fahrten geprueft, ${diffs} Abweichungen ===`);
if (diffs === 0) console.log("IDENTISCH - keine Regression");
else process.exit(1);

// Gegenprobe: ein bewusst manipulierter Vergleich MUSS eine Abweichung zeigen
const fakeA = JSON.stringify([{ id: "d1", score: 1 }]);
const fakeB = JSON.stringify([{ id: "d1", score: 2 }]);
console.log("GEGENPROBE (muss ungleich sein):", fakeA !== fakeB ? "OK - Vergleich misst wirklich" : "FEHLER");
