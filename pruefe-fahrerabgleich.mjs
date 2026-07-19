// Read-only Abgleich: Live-Fahrer-Export (aus der SQL-Abfrage in SCHRITT-1) vs. drivers_openbeatz.json
// Fuehrt keine Schreibvorgaenge aus, nur Vergleich und Textausgabe.
// Nutzung: LIVE_ROWS unten mit dem echten Query-Ergebnis fuellen (JSON-Array), dann: node pruefe-fahrerabgleich.mjs

import { readFileSync } from "node:fs";

// Hier das Ergebnis der SQL-Abfrage aus SCHRITT-1 als JSON-Array einfuegen, z.B.:
// [{"id":"finn-steinmetz","first_name":"Finn","last_name":"Steinmetz","vehicle_type":"Van","seats":7,"vehicle_id":"V1","plate":"","phone":"","pin_vorhanden":true,"active":true}, ...]
const LIVE_ROWS = [
  // <<< HIER EINFUEGEN >>>
];

const extPath = process.argv[2] || "./drivers_openbeatz.json";
const ext = JSON.parse(readFileSync(extPath, "utf8")).drivers;

const norm = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
const liveByName = new Map(LIVE_ROWS.map((r) => [norm(`${r.first_name} ${r.last_name}`), r]));
const liveById = new Map(LIVE_ROWS.map((r) => [r.id, r]));

console.log(`Live-Datensaetze: ${LIVE_ROWS.length} | Externe Datei: ${ext.length}\n`);

let missing = [], idDev = [], vehDev = [], seatDev = [];

for (const x of ext) {
  const byId = liveById.get(x.id);
  const byName = liveByName.get(norm(x.name));
  const match = byId || byName;

  if (!match) {
    missing.push(x.name);
    continue;
  }
  if (byName && !byId) idDev.push(`${x.name}: externe ID "${x.id}" != Live-ID "${match.id}"`);
  const extVeh = x.vehicle === "van" ? "Van" : "Car";
  if (match.vehicle_type !== extVeh) vehDev.push(`${x.name}: extern ${extVeh}, live ${match.vehicle_type}`);
  if (match.seats !== x.seats) seatDev.push(`${x.name}: extern ${x.seats} Sitze, live ${match.seats} Sitze`);
}

console.log("=== Fehlende Fahrer (in Live-DB nicht gefunden) ===");
console.log(missing.length ? missing.join("\n") : "keine");

console.log("\n=== Abweichende IDs ===");
console.log(idDev.length ? idDev.join("\n") : "keine");

console.log("\n=== Abweichender Fahrzeugtyp ===");
console.log(vehDev.length ? vehDev.join("\n") : "keine");

console.log("\n=== Abweichende Sitzplatzzahl (insb. Van 6 vs. 7) ===");
console.log(seatDev.length ? seatDev.join("\n") : "keine");

console.log(`\n=== Zusammenfassung: ${missing.length} fehlend, ${idDev.length} ID-Abweichung, ${vehDev.length} Typ-Abweichung, ${seatDev.length} Sitz-Abweichung ===`);
