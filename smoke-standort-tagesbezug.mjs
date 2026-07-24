// Smoke: Tagesbezug des zuletzt bekannten Fahrer-Standorts
//
// Hintergrund: driverState[id].locationId wurde nur beim Abschluss einer Fahrt
// gesetzt (DriverApp advance), aber nie geloescht, nie mit Zeitstempel versehen
// und nicht auf einen Tag bezogen. Ein Eintrag von gestern hat den Fahrer heute
// an einem Ort gezeigt, an dem er nicht ist, und schlug dabei sogar die letzte
// echte Fahrt von heute (Fall S8 unten).
//
// Geprueft wird:
//  A) stateLocationId als reine Funktion (Altbestand / heute / gestern / leer)
//  B) estimateDriverPosition: Karte ignoriert Altbestand, nutzt heutige Werte
//  C) computeDriverStats.locNow: dieselbe Regel, damit der "Am Festival"-Filter
//     und die Zuteilungs-Vorschlaege konsistent bleiben
//  D) Roundtrip: der Mutator-Kern aus advance() schreibt beide Felder, danach
//     liefert stateLocationId den Wert wieder
//  E) Gegenproben: ohne Tagespruefung MUSS der Bug reproduzierbar sein, und ein
//     absichtlich falscher dayKey MUSS anschlagen (sonst misst der Test nichts)

import fs from "fs";
import { execSync } from "child_process";

const srcFile = process.argv[2];
const quelltext = fs.readFileSync(srcFile, "utf8");
const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/smk-tb-" + tag + ".jsx";
fs.writeFileSync(copy, quelltext +
  "\nexport { stateLocationId, estimateDriverPosition, computeDriverStats, buildMapNodes, computeMapPositions };\n");
const out = "/home/claude/repo/.smk-tb-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const mod = await import(out);
const { stateLocationId, estimateDriverPosition, computeDriverStats, buildMapNodes, computeMapPositions } = mod;

const HEUTE = "2026-07-24";
const GESTERN = "2026-07-23";
const nowMin = 16 * 60;

const checks = [];
const pruef = (name, ok, hint) => checks.push({ name, ok, hint });

/* ---------------- A) stateLocationId als reine Funktion ------------------ */
pruef("A1 Altbestand (locationId ohne locationDayKey) -> null",
  stateLocationId({ locationId: "festival" }, HEUTE) === null);
pruef("A2 locationDayKey = heute -> Wert wird geliefert",
  stateLocationId({ locationId: "festival", locationDayKey: HEUTE }, HEUTE) === "festival");
pruef("A3 locationDayKey = gestern -> null",
  stateLocationId({ locationId: "festival", locationDayKey: GESTERN }, HEUTE) === null);
pruef("A4 leerer State -> null", stateLocationId({}, HEUTE) === null);
pruef("A5 kein State (undefined) -> null", stateLocationId(undefined, HEUTE) === null);
pruef("A6 locationId leer, aber DayKey passt -> null",
  stateLocationId({ locationId: "", locationDayKey: HEUTE }, HEUTE) === null);

/* ---------------- Testdaten wie in der echten Datenbank ------------------ */
// baseLocationId ist in der Produktions-DB NICHT gesetzt -> hier genauso.
const setup = {
  drivers: [
    { id: "jassin", firstName: "Jassin", lastName: "Salah", vehicleType: "Car", seats: 4 },
    { id: "dittes", firstName: "Dominik", lastName: "Dittes", vehicleType: "Car", seats: 4 },
    { id: "heute", firstName: "Heute", lastName: "Gesetzt", vehicleType: "Car", seats: 4 },
    { id: "sheraton_alt", firstName: "Sheraton", lastName: "Heute", vehicleType: "Car", seats: 4 },
  ],
  locations: [
    { id: "festival", short: "F", name: "Festival" },
    { id: "sheraton", short: "S", name: "Sheraton" },
    { id: "airport", short: "A", name: "Airport" },
  ],
  zones: ["Caldera", "Zone 3", "Stonelands"],
  config: { minDurationMin: 20, softHoursMin: 480 },  // baseLocationId bewusst NICHT gesetzt
  matrix: {},
};

const r = (o) => ({
  id: o.id, dayKey: HEUTE, time: o.time, djName: "X",
  fromId: o.fromId, toId: o.toId, zone: o.zone || null,
  status: o.status, assignedDriverId: o.drv, passengerCount: 2,
  estDurationMin: 30, issues: [], statusHistory: [], log: [],
});

const rides = [
  // Jassin: 3 Fahrten heute, KEINE done (echter DB-Stand)
  r({ id: "j1", time: "20:00", fromId: "sheraton", toId: "festival", zone: "Caldera", status: "planned", drv: "jassin" }),
  // Dittes: done heute zum Festival/Caldera (echter DB-Stand)
  r({ id: "d1", time: "13:30", fromId: "airport", toId: "festival", zone: "Caldera", status: "done", drv: "dittes" }),
  // sheraton_alt: done heute zum SHERATON, aber Altbestand-locationId = festival (Fall S8)
  r({ id: "s1", time: "12:00", fromId: "airport", toId: "sheraton", status: "done", drv: "sheraton_alt" }),
];

const driverState = {
  jassin:       { locationId: "festival" },                                 // Altbestand von gestern
  dittes:       { locationId: "festival" },                                 // Altbestand + heutige done-Fahrt
  heute:        { locationId: "sheraton", locationDayKey: HEUTE },           // sauber von heute
  sheraton_alt: { locationId: "festival" },                                  // Altbestand schlaegt heutige Fahrt?
};

const dyn = { rides, driverState, messages: [], rev: 1 };
const nodes = buildMapNodes(setup, dyn, HEUTE);
const ctx = { setup, dyn, dayKey: HEUTE, nowMin, mode: "live", nodes };
const P = (id) => estimateDriverPosition(ctx, setup.drivers.find((d) => d.id === id));
const karte = computeMapPositions(setup, dyn, HEUTE, nowMin, "live", nodes);
const XY = (id) => karte.find((p) => p.driver.id === id);

/* ---------------- B) Karte (estimateDriverPosition) ---------------------- */
pruef("B1 Jassin (Altbestand festival, 0 done heute) -> nodeId null",
  P("jassin").nodeId === null, "ist: " + P("jassin").nodeId);
pruef("B2 Jassin taucht NICHT auf der Karte auf (kein xy)",
  !XY("jassin").xy);
pruef("B3 Dittes (Altbestand ignoriert, heutige done zum Festival) -> zone:caldera",
  P("dittes").nodeId === "zone:caldera", "ist: " + P("dittes").nodeId);
pruef("B4 heute (locationDayKey passt) -> sheraton",
  P("heute").nodeId === "sheraton", "ist: " + P("heute").nodeId);
pruef("B5 S8-Fall: Altbestand festival schlaegt NICHT mehr die heutige Sheraton-Fahrt",
  P("sheraton_alt").nodeId === "sheraton", "ist: " + P("sheraton_alt").nodeId);
pruef("B6 alle Fahrer behalten mode 'free' (Verhalten unveraendert)",
  ["jassin", "dittes", "heute", "sheraton_alt"].every((id) => P(id).mode === "free"));

/* ---------------- C) computeDriverStats.locNow --------------------------- */
const S = (id) => computeDriverStats(setup, dyn, id, HEUTE);
pruef("C1 Jassin locNow ist NICHT 'festival' (Am-Festival-Filter zaehlt ihn nicht mehr)",
  S("jassin").locNow !== "festival", "ist: " + S("jassin").locNow);
pruef("C2 Dittes locNow = 'festival' (heutige done-Fahrt, korrekt)",
  S("dittes").locNow === "festival", "ist: " + S("dittes").locNow);
pruef("C3 heute locNow = 'sheraton' (tagesgleicher State wird genutzt)",
  S("heute").locNow === "sheraton", "ist: " + S("heute").locNow);
pruef("C4 S8-Fall locNow = 'sheraton' (echte Fahrt schlaegt Altbestand)",
  S("sheraton_alt").locNow === "sheraton", "ist: " + S("sheraton_alt").locNow);

/* ---------------- D) Roundtrip Schreiben -> Lesen ------------------------ */
// Kern des Mutators aus advance(): beide Felder werden gesetzt.
const d = { driverState: {} };
const fahrt = { toId: "moevenpick", dayKey: HEUTE };
d.driverState["x"] = d.driverState["x"] || {};
d.driverState["x"].locationId = fahrt.toId;
d.driverState["x"].locationDayKey = fahrt.dayKey;
pruef("D1 nach dem Schreiben liefert stateLocationId den Wert",
  stateLocationId(d.driverState["x"], HEUTE) === "moevenpick");
pruef("D2 derselbe Eintrag gilt am Folgetag NICHT mehr",
  stateLocationId(d.driverState["x"], "2026-07-25") === null);
// Quelltext-Beleg, dass advance() wirklich beide Felder schreibt
pruef("D3 advance() schreibt locationId UND locationDayKey (Quelltext)",
  /if \(flow\.next === "done"\) \{[\s\S]{0,400}?locationId = ride\.toId;[\s\S]{0,400}?locationDayKey = ride\.dayKey;/.test(quelltext));

/* ---------------- E) Gegenproben ----------------------------------------- */
// E1: ohne Tagespruefung MUSS der Bug wieder da sein (Test misst wirklich etwas)
const ohnePruefung = (st) => (st && st.locationId) || null;
pruef("E1 GEGENPROBE alte Logik reproduziert den Bug (Jassin -> festival)",
  ohnePruefung(driverState.jassin) === "festival");
pruef("E2 GEGENPROBE alte Logik reproduziert S8 (Altbestand schlaegt Fahrt)",
  ohnePruefung(driverState.sheraton_alt) === "festival");
// E3: falscher dayKey MUSS zu null fuehren
pruef("E3 GEGENPROBE falscher dayKey -> null",
  stateLocationId({ locationId: "festival", locationDayKey: HEUTE }, "2026-07-26") === null);
// E4: Zaehlung Karte gesamt
const amFestival = karte.filter((p) => p.xy && String(p.nodeId).includes("festival") || (p.xy && String(p.nodeId).startsWith("zone:")));
pruef("E4 nur Dittes steht am Festival/Zone (1 von 4)",
  amFestival.length === 1 && amFestival[0].driver.id === "dittes",
  "ist: " + amFestival.map((p) => p.driver.id).join(","));

/* ---------------- Ausgabe ------------------------------------------------ */
console.log("");
let fehler = 0;
for (const c of checks) {
  console.log((c.ok ? "OK   " : "FEHL ") + " " + c.name + (c.ok || !c.hint ? "" : "   [" + c.hint + "]"));
  if (!c.ok) fehler++;
}
console.log("");
console.log(fehler === 0 ? `SMOKE OK (${checks.length} Pruefungen)` : `SMOKE FEHLGESCHLAGEN (${fehler} von ${checks.length})`);

fs.unlinkSync(out);
fs.unlinkSync(copy);
if (fehler > 0) process.exit(1);
