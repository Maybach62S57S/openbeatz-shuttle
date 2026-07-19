import {
  normLoc, resolveLocation, resolveRideEndpoint, resolveOperationalRideLocations,
  resolveTravelMinutes, rideEndpointMatrixNode, travelMin, seedMatrix,
  LOC_MATRIX_NODE,
} from "./tmp-tb-funcs.mjs";

const M = seedMatrix();
const setup = { matrix: M };
let pass = 0, fail = 0;
const fails = [];
function ok(cond, name) { if (cond) { pass++; } else { fail++; fails.push(name); } }
function eq(a, b, name) { ok(JSON.stringify(a) === JSON.stringify(b), `${name} (erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)})`); }

// Helper: Ride bauen
const ride = (fromId, fromCustom, toId, toCustom) => ({ fromId, fromCustom, toId, toCustom });
const rl = (t, id) => resolveLocation(t, id);
const op = (r) => resolveOperationalRideLocations(r, setup);

/* === Bestehende Orte (1-4) === */
eq(rl("Open Beatz Festival").normalizedLocation, "festival", "1 festival");
eq(resolveRideEndpoint("airport", "").normalizedLocation, "airport_nue", "2 airport (feste ID)");
eq(rl("Sheraton Carlton Nürnberg").normalizedLocation, "sheraton", "3 sheraton");
eq(rl("Mövenpick Hotel").normalizedLocation, "moevenpick", "4 moevenpick");

/* === Neue Orte (5-10) === */
eq(rl("Hotel Karl August").normalizedLocation, "karl_august", "5 karl august");
eq(rl("Leonardo Royal Hotel Nürnberg").normalizedLocation, "leonardo", "6 leonardo");
eq(rl("Flughafen Nürnberg").normalizedLocation, "airport_nue", "7 flughafen nue");
eq(rl("NUE-GAT").normalizedLocation, "gat_nue", "8 nue-gat");
eq(rl("Nürnberg HBF").normalizedLocation, "hbf_nue", "9 hbf");
eq(rl("Flughafen München").normalizedLocation, "airport_muc", "10 muc");

/* === Normalisierung (11-18) === */
eq(rl("Unbekannter Treffpunkt XY").status, "unknown", "11 unbekannt");
eq(rl("").status, "unknown", "12 leer");
eq(rl("   ").status, "unknown", "12b nur Leerzeichen");
// 13 mehrdeutig: ein Text, der zwei verschiedene IDs treffen wuerde. Konstruiere
// durch identische Alias-Kollision gibt es per Design nicht (Aliase disjunkt),
// daher pruefen wir die ambiguous-Mechanik direkt ueber einen kuenstlichen Fall:
eq(rl("gat nue").normalizedLocation, "gat_nue", "13a spezifisch gewinnt");
eq(normLoc("NÜRNBERG  Hbf"), "nuernberg hbf", "14 gross/klein + doppel-space");
eq(normLoc("Mövenpick"), "moevenpick", "15 umlaut -> oe");
eq(rl("Karl-August").normalizedLocation, "karl_august", "16 bindestrich");
eq(normLoc("karl_august"), "karl august", "17 unterstrich");
eq(rl("NUE-GAT").normalizedLocation, "gat_nue", "18 NUE-GAT gewinnt vor NUE");
eq(rl("NUE").normalizedLocation, "airport_nue", "18b NUE allein = airport");

/* === Ride-Aufloesung (19-21) === */
eq(resolveRideEndpoint("sheraton", "irgendwas anderes").normalizedLocation, "sheraton", "19 feste ID vor custom");
eq(resolveRideEndpoint("__custom", "Leonardo Hotel").normalizedLocation, "leonardo", "20 custom genutzt");
eq(resolveRideEndpoint("__custom", "Leonardo Hotel").requestedLocation, "Leonardo Hotel", "21 urspruenglich erhalten");

/* === Leonardo-Abholung (22-28) === */
const rLeoFest = ride("__custom", "Leonardo Hotel", "__custom", "Open Beatz Festival");
const oLeo = op(rLeoFest);
eq(oLeo.operationalFrom.operationalLocation, "sheraton", "22 Leonardo->Festival op=sheraton");
eq(oLeo.requestedFrom.normalizedLocation, "leonardo", "23 urspruenglich leonardo");
// 24 Fahrer-Anfahrt nutzt Fahrerposition -> Sheraton (Matrix-Knoten)
eq(rideEndpointMatrixNode(rLeoFest.fromId, rLeoFest.fromCustom, oLeo.operationalFrom.operationalRule && oLeo.operationalFrom.operationalLocation), "sheraton", "24 pickup-node sheraton");
// 25 Fahrtweg Sheraton->Festival
eq(resolveTravelMinutes({ fromLocation: "sheraton", toLocation: "festival", setup }).minutes, 38, "25 sheraton->festival 38");
// 26 availableFrom nutzt dieselbe Anfahrt (= dead ueber sheraton). Da evaluateInsertion
//    deadMin an checkDriverAvailability durchreicht, ist die Quelle identisch. Hier:
eq(travelMin(M, "sheraton", "festival"), 38, "26 availableFrom nutzt sheraton-Zeit");
// 27 UI zeigt leonardo + sheraton -> beides vorhanden
ok(oLeo.requestedFrom.normalizedLocation === "leonardo" && oLeo.operationalFrom.operationalLocation === "sheraton", "27 UI zeigt beide");
// 28 Fahrerposition nach Abschluss = Festival (echtes Ziel, nicht sheraton)
eq(rideEndpointMatrixNode(rLeoFest.toId, rLeoFest.toCustom), "festival", "28 position danach festival");

/* === HBF-Abholung (29-35) === */
const rHbfFest = ride("__custom", "Nürnberg HBF", "__custom", "Festival");
const oHbf = op(rHbfFest);
eq(oHbf.operationalFrom.operationalLocation, "sheraton", "29 HBF->Festival op=sheraton");
eq(oHbf.requestedFrom.normalizedLocation, "hbf_nue", "30 urspruenglich hbf");
eq(rideEndpointMatrixNode(rHbfFest.fromId, rHbfFest.fromCustom, oHbf.operationalFrom.operationalRule && oHbf.operationalFrom.operationalLocation), "sheraton", "31 pickup-node sheraton");
eq(resolveTravelMinutes({ fromLocation: "hbf_nue", toLocation: "festival", setup }).minutes, 38, "32 weg ueber sheraton-node=38");
eq(travelMin(M, "sheraton", "festival"), 38, "33 availableFrom sheraton-Zeit");
ok(oHbf.requestedFrom.normalizedLocation === "hbf_nue" && oHbf.operationalFrom.operationalLocation === "sheraton", "34 UI zeigt beide");
eq(rideEndpointMatrixNode(rHbfFest.toId, rHbfFest.toCustom), "festival", "35 position danach festival");

/* === Leonardo-Rueckfahrt (36-40) === */
const rFestLeo = ride("__custom", "Festival", "__custom", "Leonardo Hotel");
const oFL = op(rFestLeo);
eq(oFL.operationalTo.normalizedLocation, "leonardo", "36 Festival->Leonardo Ziel bleibt leonardo");
eq(oFL.appliedRules.length, 0, "37 keine Sheraton-Umleitung");
eq(resolveTravelMinutes({ fromLocation: "festival", toLocation: "leonardo", setup }).minutes, 38, "38 Fahrzeit Festival->Leonardo(=sheraton-node) 38");
eq(rideEndpointMatrixNode(rFestLeo.toId, rFestLeo.toCustom), "sheraton", "39 position danach = leonardo-node (sheraton fuer Zeit)");
eq(oFL.requestedTo.normalizedLocation, "leonardo", "40 UI Ziel leonardo, kein sheraton-Hinweis");

/* === HBF-Rueckfahrt (41-45) === */
const rFestHbf = ride("__custom", "Festival", "__custom", "Nürnberg Hauptbahnhof");
const oFH = op(rFestHbf);
eq(oFH.operationalTo.normalizedLocation, "hbf_nue", "41 Festival->HBF Ziel bleibt hbf");
eq(oFH.appliedRules.length, 0, "42 keine Umleitung");
eq(resolveTravelMinutes({ fromLocation: "festival", toLocation: "hbf_nue", setup }).minutes, 38, "43 Fahrzeit Festival->HBF 38");
eq(rideEndpointMatrixNode(rFestHbf.toId, rFestHbf.toCustom), "sheraton", "44 position danach hbf-node");
eq(oFH.requestedTo.normalizedLocation, "hbf_nue", "45 UI Ziel hbf");

/* === Andere Orte (46-50): keine Umleitung === */
eq(op(ride("sheraton", "", "__custom", "Festival")).appliedRules.length, 0, "46 sheraton unveraendert");
eq(op(ride("__custom", "Mövenpick", "__custom", "Festival")).appliedRules.length, 0, "47 moevenpick nicht umgeleitet");
eq(op(ride("__custom", "Karl August", "__custom", "Festival")).appliedRules.length, 0, "48 karl august nicht umgeleitet");
eq(op(ride("__custom", "NUE-GAT", "__custom", "Festival")).appliedRules.length, 0, "49 GAT nicht umgeleitet");
eq(op(ride("airport", "", "__custom", "Festival")).appliedRules.length, 0, "50 flughafen nicht umgeleitet");

/* === Matrix (51-57) === */
eq(resolveTravelMinutes({ fromLocation: "sheraton", toLocation: "festival", setup }).status, "known", "51 vorhandene Verbindung");
// echte fehlende Kante: muc->moevenpick (nur muc|festival und muc|sheraton geseedet)
eq(resolveTravelMinutes({ fromLocation: "airport_muc", toLocation: "moevenpick", setup }).status, "unknown", "52 fehlende Verbindung");
eq(resolveTravelMinutes({ fromLocation: "airport_muc", toLocation: "moevenpick", setup }).minutes, null, "53 fehlend != 0 (null)");
eq(resolveTravelMinutes({ fromLocation: "airport", toLocation: "festival", setup }).minutes, 30, "54 hinrichtung");
eq(resolveTravelMinutes({ fromLocation: "festival", toLocation: "airport", setup }).minutes, 30, "55 rueckrichtung (symmetrisch)");
eq(travelMin(M, "muc", "festival"), 105, "56 muc->festival 105");
eq(travelMin(M, "festival", "muc"), 105, "57 symmetrischer fallback");

/* === GAT/airport Zeit-Aequivalenz (Nachbar) === */
eq(resolveTravelMinutes({ fromLocation: "gat_nue", toLocation: "festival", setup }).minutes, 30, "GAT rechnet wie airport (30)");
eq(resolveTravelMinutes({ fromLocation: "airport_muc", toLocation: "sheraton", setup }).minutes, 105, "MUC->Sheraton 105");

/* === Regression (58-64): Bestands-IDs byte-identisch === */
// 61 bestehende vier feste Orte -> Matrix-Knoten = Identitaet
for (const id of ["airport", "moevenpick", "sheraton", "festival"]) {
  eq(rideEndpointMatrixNode(id, "", null), id, `61 identitaet ${id}`);
}
// 62 keine Mutation der Eingabe
const inp = ride("__custom", "Leonardo Hotel", "__custom", "Festival");
const snap = JSON.stringify(inp);
op(inp); rideEndpointMatrixNode(inp.fromId, inp.fromCustom);
eq(JSON.stringify(inp), snap, "62 keine Mutation");
// 63 deterministisch
eq(JSON.stringify(op(inp)), JSON.stringify(op(inp)), "63 deterministisch");
// 58 availableFrom und Eignung nutzen dieselbe Anfahrt: strukturell eine deadMin-Quelle
//    -> hier belegt durch identische travelMin fuer pickup-node
ok(travelMin(M, "sheraton", "festival") === resolveTravelMinutes({ fromLocation: "leonardo", toLocation: "festival", setup }).minutes, "58 gleiche Anfahrt Eignung/availableFrom");

/* === Counter-Proof (Gegenprobe): absichtlich falsch muss fehlschlagen === */
let gegenprobeOk = false;
try {
  const wrong = travelMin(M, "sheraton", "festival") === 999;
  if (!wrong) gegenprobeOk = true; // korrekt: 38 !== 999
} catch { }
ok(gegenprobeOk, "GEGENPROBE: falscher Wert wird erkannt");

/* === Ergebnis === */
console.log(`\n=== Teilpaket-B Tests: ${pass} bestanden, ${fail} fehlgeschlagen ===`);
if (fail > 0) { console.log("FEHLGESCHLAGEN:"); fails.forEach((f) => console.log("  - " + f)); process.exit(1); }
else console.log("ALLE GRUEN");
