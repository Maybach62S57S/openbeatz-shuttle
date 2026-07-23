import fs from "node:fs";
const matchLoc = new Function("return (" + fs.readFileSync("/tmp/ml_new.js","utf8").trim() + ")")();
const orte = JSON.parse(fs.readFileSync("/tmp/orte.json","utf8"));
let unbekannt = 0, zellen = 0;
const treffer = {};
for (const [name, n] of Object.entries(orte)) {
  const r = matchLoc(name);
  zellen += n;
  if (r.id === "__custom") { unbekannt += n; console.log("  UNBEKANNT:", name); }
  treffer[r.id] = (treffer[r.id]||0) + n;
}
console.log("\n  Zellen gesamt:", zellen, "| unbekannt:", unbekannt);
// Pflichtpruefungen
const P = [
  ["MELTER - a Neighborhood Hotel", "melter"],
  ["MELTER - a Neighborhood Hotel + Karl August Hotel", "melter"],
  ["Karl August Hotel Nürnberg", "karl_august"],
  ["Flugplatz Herzogenaurach", "flugplatz_herzo"],
  ["Flugplatz Herzogenaurach, Am Brikenbühl 1, 91074 Herzogenaurach", "flugplatz_herzo"],
  ["Bahnhof Puschendor", "bahnhof_puschendorf"],
  // Regressionsschutz: bestehende Orte duerfen sich NICHT verschoben haben
  ["Sheraton Carlton Hotel Nuremberg", "sheraton"],
  ["Hotel Nürnberg City-Center by Leonardo Hotels (former InterCityHotel)", "leonardo"],
  ["Mövenpick Hotel Nürnberg Airport", "moevenpick"],
  ["Airport Munich", "airport_muc"],
  ["Airport Nuremberg", "airport"],
  ["Airport Nuremberg - Private Jet GAT", "gat_nue"],
  ["Nürnberg HBF/Central Station", "hbf_nue"],
  ["Venue - Caldera", "festival"],
  ["Venue - Zone III", "festival"],
  ["Venue - Stonelands", "festival"],
  ["Venue - Campingstage", "festival"],
];
let fail = 0;
for (const [txt, soll] of P) {
  const ist = matchLoc(txt).id;
  const ok = ist === soll;
  if (!ok) { fail++; console.log(`  FAIL  "${txt}" -> ${ist}, erwartet ${soll}`); }
}
// Zonen-Regel unveraendert?
const Z = [["Venue - Caldera","Caldera"],["Venue - Zone III","Zone 3"],["Venue - Stonelands","Stonelands"],["Venue - Magical Forest","Caldera"],["Venue - Darkwoods","Caldera"]];
for (const [txt,soll] of Z) { const z = matchLoc(txt).zone; if (z!==soll){fail++;console.log(`  FAIL Zone "${txt}" -> ${z}, erwartet ${soll}`);} }
console.log("  Pflichtpruefungen:", P.length + Z.length, "| Fehler:", fail);
console.log(fail===0 && unbekannt===0 ? "\n  ERGEBNIS: GRUEN" : "\n  ERGEBNIS: ROT");
process.exit(fail===0 && unbekannt===0 ? 0 : 1);
