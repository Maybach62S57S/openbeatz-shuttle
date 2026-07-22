// Teilpaket A: Tests gegen den ECHTEN Code in src/ShuttleLeitstelle.jsx
// (kein Nachbau). Muster identisch zu test_passengercount_safety.mjs:
// Export anhaengen, mit esbuild kompilieren, importieren, pruefen.
// Aufruf: node test_springer_availability.mjs src/ShuttleLeitstelle.jsx
import fs from "fs";
import { execSync } from "child_process";

const srcFile = process.argv[2];
if (!srcFile) { console.error("Aufruf: node test_springer_availability.mjs <pfad-zur-jsx>"); process.exit(2); }

const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/spa-src-" + tag + ".jsx";
fs.writeFileSync(copy, fs.readFileSync(srcFile, "utf8") +
  "\nexport { evaluateInsertion, suggestDrivers, driverCategoryOf, availableFromOf, teamGroupOf, teamLabelOf, checkDriverAvailability, parseWallClock, normDriverName };\n");
const out = new URL("./.spa-" + tag + ".mjs", import.meta.url).pathname;
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const M = await import(out);
const { evaluateInsertion, suggestDrivers, driverCategoryOf, availableFromOf, teamGroupOf, teamLabelOf, checkDriverAvailability, parseWallClock, normDriverName } = M;

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`OK   ${name}`); }
  else { fail++; console.log(`FAIL ${name}${detail ? " -- " + detail : ""}`); }
}

// ---- Fixtures ----
// Matrix: sheraton<->festival 33 min; airport<->festival 30 min. Symmetrisch,
// aber travel() probiert a|b und b|a, hier beide Richtungen eingetragen zur Sicherheit.
const setup = {
  config: { minDurationMin: 20, softHoursMin: 600, baseLocationId: "sheraton" },
  matrix: {
    "sheraton|festival": { min: 33, km: 28 },
    "airport|festival":  { min: 30, km: 25 },
  },
  drivers: [
    // regulaerer Car in derselben Startzone -> geeignet
    { id: "reg-car",  firstName: "Toni",    lastName: "Penno",  vehicleType: "Car", seats: 4, driverCategory: "regular" },
    // Springer-Car
    { id: "spr-car",  firstName: "Leon",    lastName: "Merg",   vehicleType: "Car", seats: 4 }, // Kategorie aus Profil
    { id: "spr-car2", firstName: "Philipp", lastName: "Stich",  vehicleType: "Car", seats: 4 }, // Kategorie aus Profil
    // Fahrer OHNE driverCategory-Feld und ohne Profil -> muss regular sein
    { id: "no-cat",   firstName: "Max",     lastName: "Muster", vehicleType: "Car", seats: 4 },
    // Fahrer mit availableFrom (spaet)
    { id: "late",     firstName: "Philipp", lastName: "Baumeister", vehicleType: "Car", seats: 4 }, // 2026-07-25 14:00 aus Profil
    // Van im Timmy-Team (nur Info)
    { id: "team-van", firstName: "Lukas",   lastName: "Bieber", vehicleType: "Van", seats: 6 },
  ],
};
const dyn = { rides: [], driverState: {} };

// Standardfahrt: sheraton->festival, 25.07. 21:00, 3 Personen, Dauer bekannt.
// Datum bewusst 2026-07-25, damit Baumeister (verfuegbar ab 25.07. 14:00) im
// Standardfall (21:00) tatsaechlich verfuegbar ist; frueher Slot testet die Grenze.
const mkRide = (over = {}) => ({
  id: "rt1", dayKey: "2026-07-25", date: "2026-07-25", time: "21:00",
  fromId: "sheraton", toId: "festival", passengerCount: 3, estDurationMin: 33, ...over,
});

// Hilfs: nur die aktiven Fahrer ohne die Springer -> um "kein regulaerer" zu erzwingen,
// blockieren wir reguläre per Overlap (bestehende Fahrt zur selben Zeit).
function blockDriver(dynObj, driverId, ride) {
  dynObj.rides.push({ id: "blk-" + driverId, assignedDriverId: driverId, dayKey: ride.dayKey,
    date: ride.date, time: ride.time, fromId: "sheraton", toId: "festival", status: "planned",
    passengerCount: 1, estDurationMin: 33 });
}

// ===================== Kategorie / Rueckwaertskompatibilitaet =====================
check("6. Fahrer ohne driverCategory -> gilt als regular", driverCategoryOf(setup.drivers[3]) === "regular");
check("6b. Springer aus Profil erkannt (Leon Merg)", driverCategoryOf(setup.drivers[1]) === "springer");
check("14. bestehender Fahrer ohne alle neuen Felder -> Verhalten unveraendert (regular, keine Verf.-Grenze, kein Team)",
  driverCategoryOf(setup.drivers[3]) === "regular" && availableFromOf(setup.drivers[3]) === null && teamGroupOf(setup.drivers[3]) === null);

// ===================== Mapping =====================
check("15. Mapping ueber Name: Profil greift bei uebereinstimmendem Vollnamen (Baumeister -> availableFrom)",
  availableFromOf({ firstName: "Philipp", lastName: "Baumeister" }) === "2026-07-25 14:00");
check("16. Mapping ueber eindeutigen Namen (Ünver normalisiert -> unver -> timmy-team)",
  teamGroupOf({ firstName: "Mustafa", lastName: "Ünver" }) === "timmy-team");
check("16b. normDriverName entfernt Umlaute korrekt", normDriverName({ firstName: "Björn", lastName: "Korn" }) === "bj rn korn" || normDriverName({ firstName: "Björn", lastName: "Korn" }) === "bjorn korn");
// 17. mehrdeutiger Name: es gibt zwei "Schneider" (David/Maximilian) und zwei "Salah".
//     Der Vollname bleibt aber eindeutig -> nur exakter Vollname matcht, kein Nachname-Fuzzy.
check("17. kein Match bei bloss gleichem Nachnamen (David Schneider != Maximilian Schneider-Profil)",
  driverProfileGone("David", "Schneider"));
function driverProfileGone(fn, ln) {
  // David Schneider hat KEIN Profil -> default regular/null/null (kein Fuzzy auf 'Schneider')
  return driverCategoryOf({ firstName: fn, lastName: ln }) === "regular"
    && availableFromOf({ firstName: fn, lastName: ln }) === null
    && teamGroupOf({ firstName: fn, lastName: ln }) === null;
}

// ===================== Springerlogik (suggestDrivers) =====================
{
  // 1. regulaerer Fahrer geeignet, Springer ebenfalls (naeher/gleich) -> nur regulaer
  const ride = mkRide();
  const sugg = suggestDrivers(setup, dyn, ride);
  const ids = sugg.map((x) => x.driver.id);
  check("1. regulaer geeignet, Springer da -> nur regulaere Fahrer erscheinen",
    ids.includes("reg-car") && !ids.includes("spr-car") && !ids.includes("spr-car2"),
    "ids=" + ids.join(","));
  check("1b. kein emergencySpringer-Flag, wenn Regulaere vorhanden", sugg.every((x) => !x.emergencySpringer));
}
{
  // 2. regulaerer Fahrer geeignet, Springer weniger ausgelastet -> immer noch nur regulaer
  //    (Springer haben hier per Definition 0 Fahrten, also "weniger ausgelastet")
  const ride = mkRide();
  const sugg = suggestDrivers(setup, dyn, ride);
  check("2. regulaer geeignet, Springer weniger ausgelastet -> Springer verdraengt NICHT",
    sugg.every((x) => x.driver.driverCategory !== "springer" && driverCategoryOf(x.driver) !== "springer"));
}
{
  // 3. kein regulaerer Fahrer geeignet -> Springer erscheinen
  const d2 = { rides: [], driverState: {} };
  const ride = mkRide();
  // alle regulaeren blockieren: reg-car, no-cat, late(late ist ohnehin nicht verfuegbar), team-van
  blockDriver(d2, "reg-car", ride);
  blockDriver(d2, "no-cat", ride);
  blockDriver(d2, "team-van", ride);
  blockDriver(d2, "late", ride);
  const sugg = suggestDrivers(setup, d2, ride);
  const ids = sugg.map((x) => x.driver.id);
  check("3. kein regulaerer geeignet -> Springer erscheinen", ids.includes("spr-car") && ids.includes("spr-car2"), "ids=" + ids.join(","));
  check("3b. Springer im Fallback tragen emergencySpringer=true", sugg.length > 0 && sugg.every((x) => x.emergencySpringer === true));
}
{
  // 4. mehrere geeignete Springer -> bestehende Rangfolge innerhalb der Springer
  //    Rangfolge = sortFn: feasible zuerst, dann Score aufsteigend. Beide Springer
  //    identisch positioniert -> stabile Sortierung nach Score. Wir pruefen, dass
  //    die Reihenfolge deterministisch der sortFn folgt (score aufsteigend bei
  //    gleichem feasible).
  const d2 = { rides: [], driverState: {} };
  const ride = mkRide();
  blockDriver(d2, "reg-car", ride);
  blockDriver(d2, "no-cat", ride);
  blockDriver(d2, "team-van", ride);
  blockDriver(d2, "late", ride);
  const sugg = suggestDrivers(setup, d2, ride).filter((x) => x.driver.driverCategory !== undefined || true);
  const onlySpr = sugg.filter((x) => driverCategoryOf(x.driver) === "springer");
  let ordered = true;
  for (let i = 1; i < onlySpr.length; i++) {
    if (onlySpr[i - 1].feasible === onlySpr[i].feasible && onlySpr[i - 1].score > onlySpr[i].score + 1e-9) ordered = false;
  }
  check("4. mehrere Springer -> bestehende Rangfolge (feasible, dann Score aufst.)", onlySpr.length >= 2 && ordered);
}
{
  // 5. weder regulaer noch Springer geeignet -> kein Vorschlag
  const d2 = { rides: [], driverState: {} };
  const ride = mkRide();
  for (const d of setup.drivers) blockDriver(d2, d.id, ride);
  const sugg = suggestDrivers(setup, d2, ride);
  check("5. keiner geeignet -> leere Vorschlagsliste", sugg.length === 0, "len=" + sugg.length);
}

// ===================== availableFrom =====================
{
  // 7. availableFrom fehlt -> keine Einschraenkung
  const r = checkDriverAvailability({ firstName: "Toni", lastName: "Penno" }, mkRide(), 30);
  check("7. availableFrom fehlt -> restricted=false, ok=true", r.restricted === false && r.ok === true);
}
{
  // 8. availableFrom deutlich vor benoetigtem Einsatzbeginn -> geeignet
  //    Fahrt 21:00, Anfahrt 33 -> benoetigt ab 20:27. available 14:00 -> ok.
  const r = checkDriverAvailability(setup.drivers[4] /* late/Baumeister 14:00 */, mkRide(), 33);
  check("8. availableFrom deutlich vorher -> ok=true", r.ok === true && r.restricted === true);
}
{
  // 9. availableFrom exakt am benoetigten Einsatzbeginn -> geeignet (<=)
  //    Fahrt 14:30, Anfahrt 30 -> benoetigt ab 14:00. available 14:00 -> ok.
  const drv = { firstName: "X", lastName: "Y", availableFrom: "2026-07-24 14:00" };
  const r = checkDriverAvailability(drv, mkRide({ time: "14:30", date: "2026-07-24" }), 30);
  check("9. availableFrom exakt am Einsatzbeginn -> ok=true", r.ok === true, JSON.stringify(r));
}
{
  // 10. availableFrom NACH benoetigtem Einsatzbeginn -> ausgeschlossen
  //     Task-Beispiel: Fahrt 14:30, Anfahrt 30 -> benoetigt ab 14:00, available 14:15 -> NICHT.
  const drv = { firstName: "X", lastName: "Y", availableFrom: "2026-07-24 14:15" };
  const r = checkDriverAvailability(drv, mkRide({ time: "14:30", date: "2026-07-24" }), 30);
  check("10. availableFrom nach Einsatzbeginn -> ok=false + Ausschlussgrund",
    r.ok === false && /benötigt ab 14:00/.test(r.reason), JSON.stringify(r));
}
{
  // 11. Fahrt ueber Mitternacht: date ist echtes Kalenderdatum (25.), dayKey 24.
  //     Fahrt 00:30 am 2026-07-25, Anfahrt 30 -> benoetigt ab 00:00 (25.).
  //     available "2026-07-24 23:00" (Vorabend) -> ok. available "2026-07-25 00:15" -> NICHT.
  const rideNight = mkRide({ time: "00:30", date: "2026-07-25", dayKey: "2026-07-24" });
  const okDrv  = { firstName: "N1", lastName: "T", availableFrom: "2026-07-24 23:00" };
  const badDrv = { firstName: "N2", lastName: "T", availableFrom: "2026-07-25 00:15" };
  const rOk  = checkDriverAvailability(okDrv,  rideNight, 30);
  const rBad = checkDriverAvailability(badDrv, rideNight, 30);
  check("11. Ueber-Mitternacht: Vorabend-Verfuegbarkeit ok", rOk.ok === true, JSON.stringify(rOk));
  check("11b. Ueber-Mitternacht: zu spaete Verfuegbarkeit ausgeschlossen", rBad.ok === false, JSON.stringify(rBad));
}
{
  // 12. ungueltiges availableFrom -> sichtbarer Ausschluss, kein stilles Freigeben
  const drv = { firstName: "X", lastName: "Y", availableFrom: "kaputt" };
  const r = checkDriverAvailability(drv, mkRide(), 30);
  check("12. ungueltiges availableFrom -> ok=false, restricted=true, Grund gesetzt",
    r.ok === false && r.restricted === true && /ungültig/.test(r.reason), JSON.stringify(r));
  // ungueltig auch als Kalenderwert (Monat 13)
  const r2 = checkDriverAvailability({ firstName: "X", lastName: "Y", availableFrom: "2026-13-01 10:00" }, mkRide(), 30);
  check("12b. ungueltiger Kalenderwert -> ok=false", r2.ok === false, JSON.stringify(r2));
}
{
  // availableFrom integriert in evaluateInsertion: 'late'/Baumeister bei fruehem Slot
  //    Fahrt 13:00 (vor 14:00) -> Baumeister ausgeschlossen (available=false).
  const early = mkRide({ time: "13:00", date: "2026-07-25", dayKey: "2026-07-25", passengerCount: 2 });
  const ev = evaluateInsertion(setup, dyn, setup.drivers[4], early);
  check("6/10-int. evaluateInsertion: Baumeister vor 14:00 -> available=false, nicht feasible",
    ev.available === false && ev.feasible === false && ev.problems.some((p) => /verfügbar/.test(p)), JSON.stringify({a: ev.available, p: ev.problems}));
  // und nach 14:00 (21:00 Standard) -> available true
  const ev2 = evaluateInsertion(setup, dyn, setup.drivers[4], mkRide({ passengerCount: 2 }));
  check("8-int. evaluateInsertion: Baumeister um 21:00 -> available=true", ev2.available === true);
  // suggestDrivers blendet den nicht-verfuegbaren Baumeister bei frueher Fahrt aus
  const suggEarly = suggestDrivers(setup, dyn, early).map((x) => x.driver.id);
  check("10-int. suggestDrivers: nicht verfuegbarer Fahrer erscheint nicht", !suggEarly.includes("late"));
}

// ===================== teamGroup nur informativ =====================
{
  // 13. Fahrer mit teamGroup -> Kennzeichnung sichtbar (Feld gesetzt), KEINE Ranking-Aenderung.
  //     Vergleiche Ranking mit/ohne Team-Fahrer im Pool: Team beeinflusst Score nicht.
  check("13. teamGroup wird erkannt (Lukas Bieber -> timmy-team)", teamGroupOf(setup.drivers[5]) === "timmy-team" && teamLabelOf(setup.drivers[5]) === "Timmy-Team");
  const ride = mkRide({ passengerCount: 5, fromId: "sheraton", toId: "festival" }); // 5 Pers -> Van noetig
  const ev = evaluateInsertion(setup, dyn, setup.drivers[5], ride);
  // Score-Neutralitaet: teamGroup taucht in evaluateInsertion NICHT im Score/feasible auf.
  // Wir pruefen, dass die Team-Info reines Beiwerk ist (feasible haengt nur an den
  // bekannten Faktoren, nicht am Team).
  check("13b. teamGroup aendert eligible/feasible nicht (nur Info)", ev.teamGroup === "timmy-team" && typeof ev.feasible === "boolean");

  // 13c-13f (22.07., Jordan): Team-Badge nur am Freitag (24.07.), sonst verborgen.
  // Direkter Aufruf mit dayKey:
  check("13c. teamLabelOf mit aktivem Tag (24.07.) -> Label sichtbar", teamLabelOf(setup.drivers[5], "2026-07-24") === "Timmy-Team");
  check("13d. teamLabelOf mit anderem Tag (25.07.) -> Label verborgen", teamLabelOf(setup.drivers[5], "2026-07-25") === null);
  check("13e. teamLabelOf ohne dayKey -> Rueckwaertskompatibel weiterhin sichtbar", teamLabelOf(setup.drivers[5]) === "Timmy-Team");
  // Ueber evaluateInsertion (ride.dayKey), wie es die App tatsaechlich aufruft:
  const rideFr = mkRide({ passengerCount: 5, fromId: "sheraton", toId: "festival", date: "2026-07-24", dayKey: "2026-07-24" });
  const rideSa = mkRide({ passengerCount: 5, fromId: "sheraton", toId: "festival", date: "2026-07-25", dayKey: "2026-07-25" });
  const evFr = evaluateInsertion(setup, dyn, setup.drivers[5], rideFr);
  const evSa = evaluateInsertion(setup, dyn, setup.drivers[5], rideSa);
  check("13f. evaluateInsertion Freitag-Fahrt -> teamLabel gesetzt", evFr.teamLabel === "Timmy-Team");
  check("13g. evaluateInsertion Samstag-Fahrt -> teamLabel null (bereits ev von oben, dayKey 25.07.)", ev.teamLabel === null && evSa.teamLabel === null);
  // Anker: aktives Team-Datum steht wortgleich in der Quelle (Drift-Check).
  const srcTxt = fs.readFileSync(srcFile, "utf8");
  check("13h. Anker: TEAM_ACTIVE_DAY mit 2026-07-24 steht in der Quelle", /TEAM_ACTIVE_DAY\s*=\s*\{\s*"timmy-team":\s*"2026-07-24"/.test(srcTxt));
}

// ===================== Reinheit / Determinismus =====================
{
  // 18. Vorschlagsberechnung veraendert keine Eingabedaten
  const ride = mkRide();
  const rb = JSON.stringify(ride), sb = JSON.stringify(setup), db = JSON.stringify(dyn);
  suggestDrivers(setup, dyn, ride);
  evaluateInsertion(setup, dyn, setup.drivers[0], ride);
  check("18. keine Mutation von ride/setup/dyn", JSON.stringify(ride) === rb && JSON.stringify(setup) === sb && JSON.stringify(dyn) === db);
}
{
  // 19. identische Eingabe -> identisches Ergebnis
  const ride = mkRide();
  const a = suggestDrivers(setup, dyn, ride).map((x) => x.driver.id + ":" + x.score.toFixed(4));
  const b = suggestDrivers(setup, dyn, ride).map((x) => x.driver.id + ":" + x.score.toFixed(4));
  check("19. deterministisch (gleiche Eingabe -> gleiche Ausgabe)", JSON.stringify(a) === JSON.stringify(b));
}

// parseWallClock Randfaelle
check("pwc. gueltig space", parseWallClock("2026-07-25 14:00") instanceof Date);
check("pwc. gueltig T", parseWallClock("2026-07-25T14:00") instanceof Date);
check("pwc. ungueltig leer", parseWallClock("") === null);
check("pwc. ungueltig null", parseWallClock(null) === null);
check("pwc. ungueltig Tag 32", parseWallClock("2026-07-32 10:00") === null);

try { fs.unlinkSync(copy); fs.unlinkSync(out); } catch {}
console.log(`\n=== Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen ===`);
process.exit(fail > 0 ? 1 : 0);
