// Smoke: Fahrer-Standort wird als KARTENKNOTEN aufgeloest (resolveNode-Restbug)
//
// Hintergrund: driverState[id].locationId ist eine rohe Orts-ID der Fahrt
// (ride.toId). Auf der Karte wurde sie direkt als Knoten-Schluessel benutzt
// (computeMapPositions: nodes[pos.nodeId]), ohne resolveNode(). Folgen:
//   - "festival" ohne Zone landete am Festival-Hauptknoten statt in
//     Caldera / Zone 3 / Stonelands (Zone ging verloren)
//   - "karl_august" hat KEINEN eigenen Kartenknoten (bewusst, MAP_LAYOUT-Kommentar),
//     nur den Alias karl_august -> sheraton. Ohne resolveNode fiel der Fahrer
//     komplett von der Karte.
//   - "__custom" ist nur ein Platzhalter, der echte Text steht in toCustom.
//     Ohne mitgeschriebenen Text gab es keinen Knoten (Fall Marian Mihalca).
//
// Fix: advance() schreibt zusaetzlich locationZone + locationCustom, die neue
// Funktion stateNode(nodes, st, dayKey) loest ueber resolveNode auf, und die
// vier Kartenlesestellen in estimateDriverPosition nutzen sie.
// computeDriverStats.locNow bleibt BEWUSST bei stateLocationId (Matrix-Orts-ID,
// kein Kartenknoten).
//
// Geprueft wird:
//  A) stateNode als reine Funktion (Zone / Alias / Custom / normal / Tagesbezug)
//  B) Karte: estimateDriverPosition + computeMapPositions zeigen den Fahrer am
//     richtigen Knoten UND ueberhaupt (xy vorhanden)
//  C) computeDriverStats.locNow ist UNVERAENDERT (Matrix-ID, nicht aufgeloest)
//  D) Roundtrip: der Mutator-Kern aus advance() schreibt alle vier Felder
//  E) goBack(): Standort wird zurueckgenommen, aber nur bei der eigenen Fahrt
//  F) Gegenproben: die alte, rohe Logik MUSS den Bug reproduzieren, und eine
//     absichtlich kaputte stateNode-Variante MUSS anschlagen

import fs from "fs";
import { execSync } from "child_process";

const srcFile = process.argv[2];
const quelltext = fs.readFileSync(srcFile, "utf8");
const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/smk-rn-" + tag + ".jsx";
fs.writeFileSync(copy, quelltext +
  "\nexport { stateNode, stateLocationId, resolveNode, estimateDriverPosition, computeDriverStats, buildMapNodes, computeMapPositions };\n");
const out = "/home/claude/repo/.smk-rn-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const mod = await import(out);
const { stateNode, stateLocationId, resolveNode, estimateDriverPosition,
        computeDriverStats, buildMapNodes, computeMapPositions } = mod;

const HEUTE = "2026-07-24";
const GESTERN = "2026-07-23";
const nowMin = 16 * 60;

const checks = [];
const pruef = (name, ok, hint) => checks.push({ name, ok, hint });

/* ---------------- Testdaten nah am echten DB-Stand ----------------------- */
// karl_august ist bewusst OHNE mapX/mapY und ohne MAP_LAYOUT-Eintrag: genau so
// steht er in der Produktion, deshalb hat er keinen eigenen Knoten.
// baseLocationId ist in der Produktion NICHT gesetzt -> hier genauso.
const setup = {
  drivers: [
    { id: "zone_fahrer",   firstName: "Zone",   lastName: "Fahrer",  vehicleType: "Car", seats: 4 },
    { id: "karl_fahrer",   firstName: "Karl",   lastName: "Fahrer",  vehicleType: "Car", seats: 4 },
    { id: "custom_fahrer", firstName: "Marian", lastName: "Mihalca", vehicleType: "Van", seats: 7 },
    { id: "normal_fahrer", firstName: "Normal", lastName: "Fahrer",  vehicleType: "Car", seats: 4 },
    { id: "alt_fahrer",    firstName: "Alt",    lastName: "Bestand", vehicleType: "Car", seats: 4 },
  ],
  locations: [
    { id: "festival",    short: "F",  name: "Festival" },
    { id: "sheraton",    short: "S",  name: "Sheraton" },
    { id: "airport",     short: "A",  name: "Airport" },
    { id: "karl_august", short: "KA", name: "Karl August Hotel" }, // ohne Kartenposition
  ],
  zones: ["Caldera", "Zone 3", "Stonelands"],
  config: { minDurationMin: 20, softHoursMin: 480 },
  matrix: {},
};

const r = (o) => ({
  id: o.id, dayKey: HEUTE, time: o.time, djName: "X",
  fromId: o.fromId, toId: o.toId, zone: o.zone || null,
  fromCustom: o.fromCustom || "", toCustom: o.toCustom || "",
  status: o.status, assignedDriverId: o.drv, passengerCount: 2,
  estDurationMin: 30, issues: [], statusHistory: [], log: [],
});

const CUSTOM_TEXT = "Gasthof Zur Post";

const rides = [
  r({ id: "z1", time: "12:00", fromId: "airport", toId: "festival", zone: "Caldera", status: "done", drv: "zone_fahrer" }),
  r({ id: "k1", time: "12:10", fromId: "airport", toId: "karl_august", status: "done", drv: "karl_fahrer" }),
  r({ id: "c1", time: "12:20", fromId: "airport", toId: "__custom", toCustom: CUSTOM_TEXT, status: "done", drv: "custom_fahrer" }),
  r({ id: "n1", time: "12:30", fromId: "airport", toId: "sheraton", status: "done", drv: "normal_fahrer" }),
];

// So schreibt advance() nach dem Fix (Zone/Custom mit).
const driverState = {
  zone_fahrer:   { locationId: "festival",    locationDayKey: HEUTE, locationZone: "Caldera",    locationCustom: null },
  karl_fahrer:   { locationId: "karl_august", locationDayKey: HEUTE, locationZone: null,         locationCustom: null },
  custom_fahrer: { locationId: "__custom",    locationDayKey: HEUTE, locationZone: null,         locationCustom: CUSTOM_TEXT },
  normal_fahrer: { locationId: "sheraton",    locationDayKey: HEUTE, locationZone: null,         locationCustom: null },
  // Altbestand aus der DB: die beiden neuen Felder fehlen komplett.
  alt_fahrer:    { locationId: "sheraton",    locationDayKey: HEUTE },
};

const dyn = { rides, driverState, messages: [], rev: 1 };
const nodes = buildMapNodes(setup, dyn, HEUTE);
const CUSTOM_NODE = "custom:gasthof-zur-post";

/* ---------------- A) stateNode als reine Funktion ------------------------ */
pruef("A0 Vorbedingung: karl_august hat KEINEN eigenen Kartenknoten",
  !nodes["karl_august"], "nodes-Keys: " + Object.keys(nodes).join(","));
pruef("A0b Vorbedingung: Custom-Knoten wurde aus der Fahrt gebaut",
  !!nodes[CUSTOM_NODE], "erwartet " + CUSTOM_NODE);

pruef("A1 festival + Zone Caldera -> zone:caldera",
  stateNode(nodes, driverState.zone_fahrer, HEUTE) === "zone:caldera",
  "ist: " + stateNode(nodes, driverState.zone_fahrer, HEUTE));
pruef("A2 karl_august -> sheraton (Alias)",
  stateNode(nodes, driverState.karl_fahrer, HEUTE) === "sheraton",
  "ist: " + stateNode(nodes, driverState.karl_fahrer, HEUTE));
pruef("A3 __custom + Text -> Custom-Knoten",
  stateNode(nodes, driverState.custom_fahrer, HEUTE) === CUSTOM_NODE,
  "ist: " + stateNode(nodes, driverState.custom_fahrer, HEUTE));
pruef("A4 normaler Ort bleibt unveraendert (sheraton -> sheraton)",
  stateNode(nodes, driverState.normal_fahrer, HEUTE) === "sheraton");
pruef("A5 Altbestand ohne die neuen Felder verhaelt sich wie vorher",
  stateNode(nodes, driverState.alt_fahrer, HEUTE) === "sheraton");
pruef("A6 festival OHNE Zone -> Festival-Hauptknoten (unveraendert)",
  stateNode(nodes, { locationId: "festival", locationDayKey: HEUTE }, HEUTE) === "festival");
pruef("A7 __custom OHNE Text -> null (kein erfundener Knoten)",
  stateNode(nodes, { locationId: "__custom", locationDayKey: HEUTE }, HEUTE) === null);
pruef("A8 Tagesbezug bleibt erhalten: gestern -> null",
  stateNode(nodes, { locationId: "festival", locationDayKey: GESTERN, locationZone: "Caldera" }, HEUTE) === null);
pruef("A9 leerer State -> null", stateNode(nodes, {}, HEUTE) === null);
pruef("A10 kein State (undefined) -> null", stateNode(nodes, undefined, HEUTE) === null);
pruef("A11 unbekannte Zone -> faellt auf den Hauptknoten zurueck",
  stateNode(nodes, { locationId: "festival", locationDayKey: HEUTE, locationZone: "Gibtsnicht" }, HEUTE) === "festival");

/* ---------------- B) Karte ----------------------------------------------- */
const ctx = { setup, dyn, dayKey: HEUTE, nowMin, mode: "live", nodes };
const P = (id) => estimateDriverPosition(ctx, setup.drivers.find((d) => d.id === id));
const karte = computeMapPositions(setup, dyn, HEUTE, nowMin, "live", nodes);
const XY = (id) => karte.find((p) => p.driver.id === id);

pruef("B1 Zonen-Fahrer steht in Caldera, nicht am Festival-Hauptknoten",
  P("zone_fahrer").nodeId === "zone:caldera", "ist: " + P("zone_fahrer").nodeId);
pruef("B2 Karl-August-Fahrer steht am Sheraton-Knoten",
  P("karl_fahrer").nodeId === "sheraton", "ist: " + P("karl_fahrer").nodeId);
pruef("B3 Custom-Fahrer steht am Custom-Knoten",
  P("custom_fahrer").nodeId === CUSTOM_NODE, "ist: " + P("custom_fahrer").nodeId);
pruef("B4 normaler Fahrer unveraendert am Sheraton",
  P("normal_fahrer").nodeId === "sheraton", "ist: " + P("normal_fahrer").nodeId);

pruef("B5 ALLE fuenf Fahrer sind ueberhaupt auf der Karte (xy gesetzt)",
  karte.every((p) => !!p.xy),
  "ohne xy: " + karte.filter((p) => !p.xy).map((p) => p.driver.id).join(",") || "-");
pruef("B6 Karl-August-Fahrer faellt NICHT mehr von der Karte", !!XY("karl_fahrer").xy);
pruef("B7 Custom-Fahrer faellt NICHT mehr von der Karte", !!XY("custom_fahrer").xy);
pruef("B8 alle Fahrer behalten mode 'free' (Verhalten unveraendert)",
  karte.every((p) => p.mode === "free"));

/* ---------------- C) locNow bleibt Matrix-Orts-ID ------------------------ */
const S = (id) => computeDriverStats(setup, dyn, id, HEUTE);
pruef("C1 locNow beim Zonen-Fahrer bleibt 'festival' (KEIN Kartenknoten)",
  S("zone_fahrer").locNow === "festival", "ist: " + S("zone_fahrer").locNow);
pruef("C2 locNow beim Karl-August-Fahrer bleibt 'karl_august' (kein Alias)",
  S("karl_fahrer").locNow === "karl_august", "ist: " + S("karl_fahrer").locNow);
pruef("C3 locNow beim Custom-Fahrer bleibt '__custom'",
  S("custom_fahrer").locNow === "__custom", "ist: " + S("custom_fahrer").locNow);
pruef("C4 locNow enthaelt nirgends einen Kartenknoten (zone:/custom:)",
  setup.drivers.every((d) => !String(S(d.id).locNow || "").startsWith("zone:")
                          && !String(S(d.id).locNow || "").startsWith("custom:")));

/* ---------------- D) Roundtrip advance() --------------------------------- */
// Mutator-Kern aus advance(), 1:1 nachgebaut.
const dAdv = { driverState: {} };
const fahrt = { toId: "__custom", dayKey: HEUTE, zone: null, toCustom: CUSTOM_TEXT };
dAdv.driverState["x"] = dAdv.driverState["x"] || {};
dAdv.driverState["x"].locationId = fahrt.toId;
dAdv.driverState["x"].locationDayKey = fahrt.dayKey;
dAdv.driverState["x"].locationZone = fahrt.zone || null;
dAdv.driverState["x"].locationCustom = fahrt.toCustom || null;
pruef("D1 nach dem Schreiben liefert stateNode den Custom-Knoten",
  stateNode(nodes, dAdv.driverState["x"], HEUTE) === CUSTOM_NODE);
pruef("D2 derselbe Eintrag gilt am Folgetag NICHT mehr",
  stateNode(nodes, dAdv.driverState["x"], "2026-07-25") === null);
pruef("D3 advance() schreibt locationId, DayKey, Zone UND Custom (Quelltext)",
  /if \(flow\.next === "done"\) \{[\s\S]{0,900}?locationId = ride\.toId;[\s\S]{0,900}?locationDayKey = ride\.dayKey;[\s\S]{0,900}?locationZone = ride\.zone \|\| null;[\s\S]{0,900}?locationCustom = ride\.toCustom \|\| null;/.test(quelltext));
// Aufrufe zaehlen, NICHT die Funktionsdefinition (deshalb "function " ausschliessen).
const aufrufe = (quelltext.match(/(?<!function )stateNode\(nodes, st, dayKey\)/g) || []).length;
const defs = (quelltext.match(/function stateNode\(nodes, st, dayKey\)/g) || []).length;
pruef("D4 die vier Kartenlesestellen nutzen stateNode (4 Aufrufe, 1 Definition)",
  aufrufe === 4 && defs === 1, "Aufrufe: " + aufrufe + ", Definitionen: " + defs);
pruef("D5 computeDriverStats nutzt WEITERHIN stateLocationId",
  /locNow = stateLocationId\(st, dayKey\)/.test(quelltext));

/* ---------------- E) goBack() -------------------------------------------- */
// Mutator-Kern aus goBack(), 1:1 nachgebaut.
const goBackKern = (d, driverId, from, r2) => {
  if (from === "done") {
    const st = d.driverState[driverId];
    if (st && st.locationId === r2.toId && st.locationDayKey === r2.dayKey) {
      st.locationId = null; st.locationDayKey = null;
      st.locationZone = null; st.locationCustom = null;
    }
  }
  return d;
};
const dGb = { driverState: { g1: { locationId: "festival", locationDayKey: HEUTE, locationZone: "Caldera", locationCustom: null } } };
goBackKern(dGb, "g1", "done", { toId: "festival", dayKey: HEUTE });
pruef("E1 goBack von 'done' nimmt den Standort zurueck",
  dGb.driverState.g1.locationId === null && dGb.driverState.g1.locationZone === null);
pruef("E2 danach liefert stateNode null (Karte faellt auf letzte done-Fahrt zurueck)",
  stateNode(nodes, dGb.driverState.g1, HEUTE) === null);

const dGb2 = { driverState: { g2: { locationId: "sheraton", locationDayKey: HEUTE } } };
goBackKern(dGb2, "g2", "done", { toId: "festival", dayKey: HEUTE });
pruef("E3 aelterer Eintrag einer ANDEREN Fahrt bleibt stehen",
  dGb2.driverState.g2.locationId === "sheraton");

const dGb3 = { driverState: { g3: { locationId: "sheraton", locationDayKey: GESTERN } } };
goBackKern(dGb3, "g3", "done", { toId: "sheraton", dayKey: HEUTE });
pruef("E4 Eintrag eines anderen TAGES bleibt stehen",
  dGb3.driverState.g3.locationId === "sheraton");

const dGb4 = { driverState: { g4: { locationId: "sheraton", locationDayKey: HEUTE } } };
goBackKern(dGb4, "g4", "onboard", { toId: "sheraton", dayKey: HEUTE });
pruef("E5 goBack aus einem ANDEREN Status ruehrt den Standort nicht an",
  dGb4.driverState.g4.locationId === "sheraton");

pruef("E6 goBack() setzt alle vier Felder zurueck (Quelltext)",
  /if \(from === "done"\) \{[\s\S]{0,600}?st\.locationId === r\.toId && st\.locationDayKey === r\.dayKey[\s\S]{0,600}?locationId = null;[\s\S]{0,400}?locationDayKey = null;[\s\S]{0,400}?locationZone = null;[\s\S]{0,400}?locationCustom = null;/.test(quelltext));

/* ---------------- F) Gegenproben ----------------------------------------- */
// F1-F3: die ALTE, rohe Logik (locationId direkt als Knoten) MUSS den Bug zeigen.
const rohLogik = (st) => stateLocationId(st, HEUTE);
pruef("F1 GEGENPROBE roh: Zone geht verloren (festival statt zone:caldera)",
  rohLogik(driverState.zone_fahrer) === "festival"
  && rohLogik(driverState.zone_fahrer) !== "zone:caldera");
pruef("F2 GEGENPROBE roh: karl_august hat keinen Knoten -> Fahrer waere weg",
  !nodes[rohLogik(driverState.karl_fahrer)]);
pruef("F3 GEGENPROBE roh: __custom hat keinen Knoten -> Fahrer waere weg",
  !nodes[rohLogik(driverState.custom_fahrer)]);

// F4: absichtlich kaputte stateNode-Variante MUSS anschlagen (sonst misst der
// Test nichts). Zone/Custom werden hier bewusst NICHT durchgereicht.
const kaputt = (nds, st, dk) => {
  const locId = stateLocationId(st, dk);
  return locId ? resolveNode(nds, locId, null, null) : null;
};
pruef("F4 GEGENPROBE kaputte Variante liefert bei der Zone ein ANDERES Ergebnis",
  kaputt(nodes, driverState.zone_fahrer, HEUTE) !== stateNode(nodes, driverState.zone_fahrer, HEUTE));
pruef("F5 GEGENPROBE kaputte Variante verliert den Custom-Ort",
  kaputt(nodes, driverState.custom_fahrer, HEUTE) === null
  && stateNode(nodes, driverState.custom_fahrer, HEUTE) === CUSTOM_NODE);
pruef("F6 GEGENPROBE kaputte Variante trifft den Alias trotzdem (Alias braucht keine Extra-Info)",
  kaputt(nodes, driverState.karl_fahrer, HEUTE) === "sheraton");

// F7: reine Funktion, keine Mutation der Eingaben.
const vorher = JSON.stringify({ setup, dyn });
stateNode(nodes, driverState.zone_fahrer, HEUTE);
estimateDriverPosition(ctx, setup.drivers[0]);
computeMapPositions(setup, dyn, HEUTE, nowMin, "live", nodes);
pruef("F7 keine Mutation von setup/dyn", JSON.stringify({ setup, dyn }) === vorher);

/* ---------------- Ausgabe ------------------------------------------------ */
console.log("");
let fehler = 0;
for (const c of checks) {
  if (c.ok) console.log("OK    " + c.name);
  else { fehler++; console.log("FAIL  " + c.name + (c.hint ? "   [" + c.hint + "]" : "")); }
}
console.log("");
console.log(fehler === 0
  ? `SMOKE OK (${checks.length} Pruefungen)`
  : `SMOKE FEHLGESCHLAGEN: ${fehler} von ${checks.length}`);
try { fs.unlinkSync(copy); fs.unlinkSync(out); } catch {}
process.exit(fehler === 0 ? 0 : 1);
