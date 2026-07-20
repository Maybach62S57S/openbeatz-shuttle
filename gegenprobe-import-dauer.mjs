// GEGENPROBE zur Import-Dauerberechnung: mutiere die Quelle zurueck auf die alte
// rohe matchLoc-ID-Berechnung. Dann MUSS Muenchen/Leonardo wieder null liefern -
// das beweist, dass smoke-import-dauer.mjs den Fix wirklich misst (kein Selbstlaeufer).
// Bestandsorte (Sheraton) bleiben auch in der Mutation 38 (byte-identisch).
import fs from "fs"; import { execSync } from "child_process";

const src = fs.readFileSync(process.argv[2] || "src/ShuttleLeitstelle.jsx", "utf8");
const mutated = src.replace(
  "const durMin = travelMin(setup.matrix, durFromNode, durToNode); // null wenn unbekannt (Punkt 10)",
  "const durMin = travelMin(setup.matrix, from.id, to.id); // GEGENPROBE alte Logik"
);
if (mutated === src) { console.log("FAIL: Mutation griff nicht (Anker nicht gefunden)"); process.exit(1); }

const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/gpid-" + tag + ".jsx";
fs.writeFileSync(copy, mutated + "\nexport { parseRow, seedMatrix };\n");
const out = "/home/claude/repo/.gpid-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const m = await import(out); fs.rmSync(out, { force: true });

const setup = { drivers: [], matrix: m.seedMatrix(), config: { minDurationMin: 20, festivalDates: ["2026-07-25"] }, locations: [] };
const row = (f, t) => ({ Date: "2026-07-25", Time: "20:00", Artist: "X", From: f, To: t });
const d = (f, t) => m.parseRow(setup, row(f, t), false).ride.estDurationMin;

let ok = 0, fail = 0;
const c = (n, got, exp) => { const g = got === exp; console.log(`${g ? "OK  " : "FAIL"} ${n} (erwartet ${exp}, war ${got})`); g ? ok++ : fail++; };
c("GP1 Muenchen faellt ohne Fix auf null zurueck", d("Flughafen München", "Festival"), null);
c("GP2 Leonardo faellt ohne Fix auf null zurueck", d("Leonardo", "Festival"), null);
c("GP3 Karl August faellt ohne Fix auf null zurueck", d("Hotel Karl August", "Festival"), null);
c("GP4 Sheraton (Bestand) bleibt auch alt 38", d("Sheraton Carlton", "Festival"), 38);
c("GP5 Airport NUE (Bestand) bleibt auch alt 30", d("Airport Nuremberg", "Festival"), 30);
console.log(`\nGegenprobe Import-Dauer: ${ok} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
