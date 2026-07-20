// Smoke-Test der Import-Dauerberechnung (estDurationMin) in parseRow.
// Baut eine Vollkopie der Quelle + Export und ruft die ECHTE parseRow.
// Ziel: Custom-Orte (Muenchen/Leonardo/Karl August) bekommen jetzt die richtige
// Fahrzeit ueber die B-Ortsaufloesung; die vier Bestands-IDs bleiben byte-identisch;
// echt unbekannte Orte bleiben null. matchLoc bleibt unberuehrt.
import fs from "fs";
import { execSync } from "child_process";

const src = process.argv[2] || "src/ShuttleLeitstelle.jsx";
const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/imp-" + tag + ".jsx";
fs.writeFileSync(copy, fs.readFileSync(src, "utf8") + "\nexport { parseRow, matchLoc, rideEndpointMatrixNode, resolveLocation, travelMin, seedMatrix };\n");
const out = "/home/claude/repo/.imp-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const m = await import(out);
const { parseRow, matchLoc, seedMatrix } = m;

const setup = {
  drivers: [],
  matrix: seedMatrix(),
  config: { minDurationMin: 20, festivalDates: ["2026-07-23","2026-07-24","2026-07-25","2026-07-26","2026-07-27"] },
  locations: [],
};

let ok = 0, fail = 0;
const eq = (name, got, exp) => {
  const good = got === exp;
  console.log(`${good ? "OK  " : "FAIL"} ${name} (erwartet ${exp}, war ${got})`);
  good ? ok++ : fail++;
};

const row = (from, to) => ({ Date: "2026-07-25", Time: "20:00", Artist: "Testact", From: from, To: to });
const dur = (from, to) => parseRow(setup, row(from, to), false).ride.estDurationMin;

// --- Custom-Orte: vorher null (Fallback 20), jetzt echte Fahrzeit -------------
eq("1. Flughafen Muenchen -> Festival = 105", dur("Flughafen München", "Festival"), 105);
eq("2. Munich Airport -> Festival = 105 (engl.)", dur("Munich Airport", "Open Beatz Festival"), 105);
eq("3. Leonardo Royal Hotel Nürnberg -> Festival = 38", dur("Leonardo Royal Hotel Nürnberg", "Festival"), 38);
eq("4. Leonardo -> Festival = 38 (Kurzform)", dur("Leonardo", "Festival"), 38);
eq("5. Hotel Karl August -> Festival = 38", dur("Hotel Karl August", "Festival"), 38);
eq("6. Nürnberg Hbf -> Festival = 38", dur("Nürnberg Hbf", "Festival"), 38);

// --- Rueckrichtung (Festival -> Custom) ---------------------------------------
eq("7. Festival -> Flughafen Muenchen = 105", dur("Festival", "Flughafen München"), 105);
eq("8. Festival -> Leonardo = 38", dur("Festival", "Leonardo Royal Hotel Nürnberg"), 38);
eq("9. Festival -> Karl August = 38", dur("Open Beatz Festival", "Hotel Karl August"), 38);

// --- Bestands-IDs: muessen BYTE-IDENTISCH bleiben (waren vorher schon korrekt) --
eq("10. Sheraton -> Festival = 38", dur("Sheraton Carlton", "Festival"), 38);
eq("11. Flughafen Nürnberg -> Festival = 30", dur("Airport Nuremberg", "Festival"), 30);
eq("12. Flughafen Nürnberg -> Mövenpick = 3", dur("Flughafen Nürnberg", "Mövenpick"), 3);
eq("13. Mövenpick -> Festival = 30", dur("Mövenpick Hotel", "Festival"), 30);

// --- Echt unbekannter Ort: bleibt null (Bestandsverhalten Punkt 10) -----------
eq("14. voellig unbekannter Ort -> null", dur("Irgendein Zufallsort XYZ 999", "Festival"), null);
// Zwei GEGENSEITIG unaufloesbare Orte kollidieren beide auf den "__custom"-Knoten;
// travel()'s a===b-Regel gibt dann 0. Das ist VORBESTEHENDES Verhalten (in HEAD
// identisch, siehe diff-import) und wird durch diesen Fix NICHT veraendert.
eq("15. beide unbekannt -> 0 (vorbestehend, unveraendert)", dur("Wildfremd A", "Wildfremd B"), 0);

// --- matchLoc: die 4 urspruenglichen harten IDs bleiben stabil ---------------
const ml = (t) => matchLoc(t).id;
eq("16. matchLoc Sheraton unveraendert", ml("Sheraton Carlton"), "sheraton");
// 17/18 seit Commit bb868a4 (matchLoc-/Orts-Fix) absichtlich GEAENDERT: matchLoc
// erkennt Muenchen/Leonardo jetzt echt (vorher __custom). Referenzwerte hier an
// smoke-orte-fix.mjs (aktuelle Suite fuer diesen Fix) angeglichen, keine App-Aenderung.
eq("17. matchLoc Muenchen erkannt (seit Orts-Fix)", ml("Flughafen München"), "airport_muc");
eq("18. matchLoc Leonardo erkannt (seit Orts-Fix)", ml("Leonardo"), "leonardo");

console.log(`\nImport-Dauer Smoke: ${ok} OK, ${fail} FAIL`);
fs.rmSync(out, { force: true });
if (fail > 0) process.exit(1);
