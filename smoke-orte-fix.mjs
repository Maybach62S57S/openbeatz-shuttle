// Import-Erkennungstest fuer den matchLoc-/Orts-Fix (21.07.).
// Testet die ECHTEN Ortsstrings aus Gesamtuebersicht_Fahrten_OpenBeatz_5.xlsx
// gegen die matchLoc-Logik, verbatim aus der Quelle extrahiert.
import fs from "node:fs";
const src = fs.readFileSync("src/ShuttleLeitstelle.jsx", "utf8");

// matchLoc verbatim aus der Quelle ziehen und als Funktion instanzieren.
const m = src.match(/function matchLoc\(txt\) \{[\s\S]*?\n\}/);
if (!m) { console.error("matchLoc nicht gefunden"); process.exit(1); }
const matchLoc = new Function("txt", m[0].replace(/^function matchLoc\(txt\) \{/, "").replace(/\}$/, ""));

let ok = 0, fail = 0;
const t = (label, got, exp) => {
  const pass = JSON.stringify(got) === JSON.stringify(exp);
  if (pass) ok++; else { fail++; console.log(`FAIL ${label}: got ${JSON.stringify(got)} exp ${JSON.stringify(exp)}`); }
};

// --- ECHTE Strings (Von + Nach) aus der Live-Liste, mit erwarteter ID/Zone ---
const cases = [
  // [string, {id, zone?}]
  ["Sheraton Carlton Hotel Nuremberg", { id: "sheraton" }],
  ["Hotel Nürnberg City-Center by Leonardo Hotels (former InterCityHotel)", { id: "leonardo" }],
  ["Mövenpick Hotel Nürnberg Airport", { id: "moevenpick" }],           // enthaelt "Airport" -> darf NICHT airport werden
  ["Airport Munich", { id: "airport_muc" }],
  ["Karl August Hotel Nürnberg", { id: "karl_august" }],
  ["Nürnberg HBF/Central Station", { id: "hbf_nue" }],
  ["Airport Nuremberg", { id: "airport" }],
  ["Airport Nuremberg - Private Jet GAT", { id: "gat_nue" }],           // GAT VOR airport-nue
  ["Venue - Caldera", { id: "festival", zone: "Caldera" }],
  ["Venue - Zone III", { id: "festival", zone: "Zone 3" }],
  ["Venue - Stonelands", { id: "festival", zone: "Stonelands" }],
  ["Venue - Magical Forest", { id: "festival", zone: "Caldera" }],      // -> Caldera-Fallback
  ["Venue - House of Remix", { id: "festival", zone: "Caldera" }],
  ["Venue - Darkwoods", { id: "festival", zone: "Caldera" }],
  ["Venue - Gruener Stadl", { id: "festival", zone: "Caldera" }],
  ["Venue - Camping Stage", { id: "festival", zone: "Caldera" }],
  ["Venue - Campingstage", { id: "festival", zone: "Caldera" }],
  ["Venue - Campingstage (Thursday only!)", { id: "festival", zone: "Caldera" }],
  ["Venue Campingstage", { id: "festival", zone: "Caldera" }],
  ["Bahnhof Puschendor", { id: "__custom", custom: "Bahnhof Puschendor" }],       // Ausreisser -> custom
  ["Flugplatz Herzogenaurach", { id: "__custom", custom: "Flugplatz Herzogenaurach" }],
];
for (const [s, exp] of cases) t(`match "${s}"`, matchLoc(s), exp);

// --- Zusaetzliche Schreibvarianten, die real vorkommen koennen ---
const variants = [
  ["Munich Airport (MUC)", { id: "airport_muc" }],
  ["München Flughafen", { id: "airport_muc" }],
  ["MUC", { id: "airport_muc" }],
  ["Leonardo Royal Hotel Nürnberg", { id: "leonardo" }],
  ["Karl-August-Hotel", { id: "karl_august" }],
  ["Hauptbahnhof Nürnberg", { id: "hbf_nue" }],
  ["Private Jet GAT", { id: "gat_nue" }],
  ["GAT Nürnberg", { id: "gat_nue" }],
  ["Flughafen Nürnberg", { id: "airport" }],
];
for (const [s, exp] of variants) t(`variant "${s}"`, matchLoc(s), exp);

// --- Gegenprobe: Reihenfolge-Fallen ---
// Muenchen darf NICHT als airport-nue durchrutschen
t("muc-not-airport", matchLoc("Airport Munich").id === "airport", false);
// GAT darf NICHT als airport durchrutschen
t("gat-not-airport", matchLoc("Airport Nuremberg - Private Jet GAT").id === "airport", false);
// Moevenpick mit "Airport" bleibt moevenpick
t("moevenpick-not-airport", matchLoc("Mövenpick Hotel Nürnberg Airport").id, "moevenpick");
// leere/None
t("empty", matchLoc(""), { id: "__custom", custom: "" });




// --- Teil 2: Fahrzeit-Knoten (LOC_MATRIX_NODE) + Karten-Alias (resolveNode) ---
{
  // Konstanten per eindeutigem Anfang..Ende extrahieren (nicht-gierig, EINDEUTIG).
  const between = (startMarker, endMarker) => {
    const i = src.indexOf(startMarker); if (i < 0) throw new Error("start fehlt: " + startMarker);
    const j = src.indexOf(endMarker, i); if (j < 0) throw new Error("ende fehlt: " + endMarker);
    return src.slice(i, j + endMarker.length);
  };
  const grabFn = (name) => {
    const mm = src.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`));
    if (!mm) throw new Error("fn fehlt: " + name); return mm[0];
  };
  const LOC_MATRIX_NODE = between("const LOC_MATRIX_NODE = {", "\n};");
  const KNOWN_FIXED_IDS = between("const KNOWN_FIXED_IDS =", ";");
  const MAP_NODE_ALIAS  = between("const MAP_NODE_ALIAS =", ";");
  const LOC_ZONE        = between("const LOC_ZONE = {", "\n};");
  const LOC_ALIASES     = between("const LOC_ALIASES = [", "\n];");
  const parts = [
    LOC_MATRIX_NODE, KNOWN_FIXED_IDS, MAP_NODE_ALIAS, LOC_ZONE, LOC_ALIASES,
    grabFn("normLoc"),
    grabFn("resolveLocation"),
    grabFn("rideEndpointMatrixNode"),
    'const zoneNodeId = (zone) => "zone:"+zone.toLowerCase().replace(/[^a-z0-9]+/g,"-");',
    'const customNodeId = (txt) => "custom:"+(txt||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,24);',
    grabFn("resolveNode"),
    "return { rideEndpointMatrixNode, resolveNode };",
  ];
  const { rideEndpointMatrixNode: rn, resolveNode: rnode } = (new Function(parts.join("\n")))();

  t("mtx leonardo", rn("leonardo", ""), "sheraton");
  t("mtx hbf", rn("hbf_nue", ""), "sheraton");
  t("mtx karl", rn("karl_august", ""), "sheraton");
  t("mtx gat", rn("gat_nue", ""), "airport");
  t("mtx muc", rn("airport_muc", ""), "muc");
  t("mtx sheraton", rn("sheraton", ""), "sheraton");
  t("mtx airport", rn("airport", ""), "airport");

  const nodes = { sheraton: {}, leonardo: {}, hbf_nue: {}, gat_nue: {}, airport_muc: {} };
  t("map karl->sheraton", rnode(nodes, "karl_august", null, ""), "sheraton");
  t("map leonardo eigen", rnode(nodes, "leonardo", null, ""), "leonardo");
  t("map hbf eigen", rnode(nodes, "hbf_nue", null, ""), "hbf_nue");
  t("map gat eigen", rnode(nodes, "gat_nue", null, ""), "gat_nue");
  t("map muc eigen", rnode(nodes, "airport_muc", null, ""), "airport_muc");
  t("map karl ohne sheraton", rnode({ leonardo: {} }, "karl_august", null, ""), null);
}

console.log(`\nOrts-Fix Import-Smoke gesamt: ${ok} OK, ${fail} FAIL`);
if (fail) process.exit(1);
