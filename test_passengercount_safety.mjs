// Vor-Festival-Sicherheitsphase: Tests gegen den ECHTEN, geaenderten Code in
// src/ShuttleLeitstelle.jsx (kein Nachbau). Nutzt dasselbe Muster wie
// rendertest.mjs: Export anhaengen, kompilieren, importieren.
// Aufruf: node test_passengercount_safety.mjs src/ShuttleLeitstelle.jsx
import fs from "fs";
import { execSync } from "child_process";

const srcFile = process.argv[2];
if (!srcFile) { console.error("Aufruf: node test_passengercount_safety.mjs <pfad-zur-jsx>"); process.exit(2); }

const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/pcs-src-" + tag + ".jsx";
// Wegwerf-Kopie mit angehaengtem Export. Das Original wird NICHT angefasst.
fs.writeFileSync(copy, fs.readFileSync(srcFile, "utf8") + "\nexport { validPassengerCount, evaluateInsertion, suggestDrivers };\n");
const out = new URL("./.pcs-" + tag + ".mjs", import.meta.url).pathname; // im Repo, damit node_modules (react) aufloesbar ist
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const { validPassengerCount, evaluateInsertion, suggestDrivers } = await import(out);

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`OK   ${name}`); }
  else { fail++; console.log(`FAIL ${name}${detail ? " -- " + detail : ""}`); }
}

// ---- 1-10: validPassengerCount direkt, die 10 geforderten Rohwerte ----
check("1. undefined -> null", validPassengerCount(undefined) === null);
check("2. null -> null", validPassengerCount(null) === null);
check('3. "" -> null', validPassengerCount("") === null);
check('4. "   " -> null', validPassengerCount("   ") === null);
check("5. 0 -> null", validPassengerCount(0) === null);
check('6. "0" -> null', validPassengerCount("0") === null);
check('7. "abc" -> null', validPassengerCount("abc") === null);
check("8. -1 -> null", validPassengerCount(-1) === null);
check("9. 1 -> 1 (gueltig)", validPassengerCount(1) === 1);
check('10. "6" -> 6 (gueltig, numerischer String)', validPassengerCount("6") === 6);
// zusaetzlich, nicht explizit gefordert, aber im Auftrag genannt ("negative Zahl" als String, Dezimalzahl)
check('zusatz: "-1" (String) -> null', validPassengerCount("-1") === null);
check("zusatz: 6.5 (Dezimalzahl) -> null", validPassengerCount(6.5) === null);
check('zusatz: "6.5" (String) -> null', validPassengerCount("6.5") === null);
check("zusatz: NaN -> null", validPassengerCount(NaN) === null);

// ---- Fixtures fuer evaluateInsertion/suggestDrivers ----
const setup = {
  config: { minDurationMin: 20, softHoursMin: 600, baseLocationId: "sheraton" },
  matrix: { "sheraton|festival": { min: 33, km: 28 } },
  drivers: [
    { id: "car1", firstName: "Test", lastName: "Car4", vehicleType: "Car", seats: 4 },
    { id: "van6", firstName: "Test", lastName: "Van6", vehicleType: "Van", seats: 6 },
    { id: "van7", firstName: "Test", lastName: "Van7", vehicleType: "Van", seats: 7 },
  ],
};
const dyn = { rides: [], driverState: {} };
const mkRide = (passengerCount) => ({ id: "rt1", dayKey: "2026-07-24", time: "21:00", fromId: "sheraton", toId: "festival", passengerCount, estDurationMin: 33 });

// ---- 11-13: konkrete Personen/Sitze-Kombinationen ----
{
  const ev = evaluateInsertion(setup, dyn, setup.drivers[1], mkRide(6)); // van6, 6 Pers/6 Sitze
  check("11. 6 Personen, 6 Sitze -> eligible", ev.eligible === true && ev.capacityUnknown === false);
}
{
  const ev = evaluateInsertion(setup, dyn, setup.drivers[1], mkRide(7)); // van6, 7 Pers/6 Sitze
  check("12. 7 Personen, 6 Sitze -> NICHT eligible (zu wenig Sitzplätze)", ev.eligible === false && ev.capacityUnknown === false && ev.problems.some(p => p.includes("Sitzplätze")));
}
{
  const ev = evaluateInsertion(setup, dyn, setup.drivers[2], mkRide(7)); // van7, 7 Pers/7 Sitze
  check("13. 7 Personen, 7 Sitze -> eligible", ev.eligible === true && ev.capacityUnknown === false);
}

// ---- 14: Vorschlagsdialog kann bei ungueltiger Personenzahl nicht endgueltig zuweisen ----
// (auf Motor-Ebene geprueft: suggestDrivers liefert fuer JEDEN Fahrer leer, wenn
// capacityUnknown, weil eligible ueberall false ist -> AssignModal hat dann nichts
// Bestaetigbares in der Vorschlagsliste UND sperrt zusaetzlich die manuelle Liste
// per disabled={ev.capacityUnknown} -- das UI-Verhalten selbst ist nicht headless
// testbar, siehe Bericht.)
{
  const ride = mkRide(undefined);
  const sugg = suggestDrivers(setup, dyn, ride);
  check("14a. suggestDrivers liefert leere Liste bei fehlender Personenzahl", sugg.length === 0);
  const evAll = setup.drivers.map(d => evaluateInsertion(setup, dyn, d, ride));
  check("14b. ALLE Fahrer capacityUnknown=true, eligible=false (kein Override-Ziel)", evAll.every(x => x.capacityUnknown === true && x.eligible === false));
  check('14c. problems enthaelt exakt die geforderte Meldung', evAll.every(x => x.problems.includes("Personenzahl fehlt – Kapazität kann nicht geprüft werden")));
}

// ---- 15: gueltige bestehende Fahrten funktionieren unveraendert ----
{
  const ride = mkRide(3);
  const ev = evaluateInsertion(setup, dyn, setup.drivers[0], ride); // car1, 4 Sitze, 3 Personen
  check("15. gueltige Fahrt (3 Pers., 4-Sitzer) weiterhin normal eligible", ev.eligible === true && ev.capacityUnknown === false);
}

// ---- Zusatz: keine Mutation der Eingabedaten ----
{
  const ride = mkRide(undefined);
  const rideBefore = JSON.stringify(ride);
  const setupBefore = JSON.stringify(setup);
  evaluateInsertion(setup, dyn, setup.drivers[0], ride);
  suggestDrivers(setup, dyn, ride);
  check("zusatz: ride unveraendert nach Aufrufen", JSON.stringify(ride) === rideBefore);
  check("zusatz: setup unveraendert nach Aufrufen", JSON.stringify(setup) === setupBefore);
}

// ---- Zusatz: bestehende Vorschlaege mit gueltiger Personenzahl bleiben unveraendert ----
{
  const ride = mkRide(4);
  const s1 = suggestDrivers(setup, dyn, ride).map(x => ({ id: x.driver.id, score: x.score, eligible: x.eligible }));
  check("zusatz: gueltige Fahrt liefert weiterhin normale Vorschlagsliste (nicht leer)", s1.length > 0);
}

try { fs.unlinkSync(copy); fs.unlinkSync(out); } catch {}

console.log(`\n=== Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen ===`);
process.exit(fail > 0 ? 1 : 0);
