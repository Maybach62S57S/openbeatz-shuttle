// Smoke: Fahrer-Nummer + Datum in Texten (WhatsApp-Modal + Gast-Link)
// Prueft:
//  driverPhoneIntl: DE-Format, Ausland, +49-Passthrough, 00-Prefix, leer, Muell
//  contactPhoneFor: Fahrer-Nummer bevorzugt, Fallback auf Koord-Nummer, ohne
//    beides null
//  fmtDateNum: liefert "25.07.2026"
//  waArtistText: Date-Zeile + Driver phone Zeile
//  guestInfoText: Date-Zeile im kompakten Format + Driver phone Zeile
//  Gegenprobe: absichtlich falsche Erwartung schlaegt an

import fs from "fs";
import { execSync } from "child_process";

const srcFile = process.argv[2];
const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/smk-src-" + tag + ".jsx";
fs.writeFileSync(copy, fs.readFileSync(srcFile, "utf8") + "\nexport { driverPhoneIntl, contactPhoneFor, fmtDateNum, waArtistText, guestInfoText };\n");
const out = "/home/claude/repo/.smk-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const mod = await import(out);
const { driverPhoneIntl, contactPhoneFor, fmtDateNum, waArtistText, guestInfoText } = mod;

const checks = [];
function pruef(name, ok, hint) { checks.push({ name, ok, hint }); }

// --- driverPhoneIntl -----------------------------------------------------
pruef("driverPhoneIntl: '0176 12345678' -> '+49 176 12345678'",
  driverPhoneIntl("0176 12345678") === "+49 176 12345678",
  `got '${driverPhoneIntl("0176 12345678")}'`);
pruef("driverPhoneIntl: '01761234567' -> '+49 176 1234567'",
  driverPhoneIntl("01761234567") === "+49 176 1234567",
  `got '${driverPhoneIntl("01761234567")}'`);
pruef("driverPhoneIntl: '0049 176 1234567' -> '+49 176 1234567'",
  driverPhoneIntl("0049 176 1234567") === "+49 176 1234567",
  `got '${driverPhoneIntl("0049 176 1234567")}'`);
pruef("driverPhoneIntl: '+49 176 1234567' -> '+49 176 1234567' (pass-through)",
  driverPhoneIntl("+49 176 1234567") === "+49 176 1234567",
  `got '${driverPhoneIntl("+49 176 1234567")}'`);
pruef("driverPhoneIntl: '+43 664 1234567' bleibt AT (kein '+49'-Overwrite)",
  driverPhoneIntl("+43 664 1234567").startsWith("+43 "),
  `got '${driverPhoneIntl("+43 664 1234567")}'`);
pruef("driverPhoneIntl: leer -> null (Aufrufer entscheidet Fallback)",
  driverPhoneIntl("") === null && driverPhoneIntl(null) === null,
  "null-Faelle nicht sauber");
pruef("driverPhoneIntl: Muell (Buchstaben) -> Ausgangswert (blockiert nicht)",
  driverPhoneIntl("abc123") === "abc123",
  `got '${driverPhoneIntl("abc123")}'`);
pruef("driverPhoneIntl: mit Bindestrichen '0176-1234-5678' -> '+49 176 12345678'",
  driverPhoneIntl("0176-1234-5678") === "+49 176 12345678",
  `got '${driverPhoneIntl("0176-1234-5678")}'`);

// --- contactPhoneFor -----------------------------------------------------
const setupOhneCoord = { drivers: [], locations: [], config: {} };
const setupMitCoord  = { drivers: [], locations: [], config: { coordinationPhone: "+49 170 7654321" } };

const drvMitNr = { id: "d1", firstName: "Karim", lastName: "K", vehicleType: "Car", seats: 4, phone: "0176 12345678" };
const drvOhneNr = { id: "d2", firstName: "Leon", lastName: "L", vehicleType: "Van", seats: 8, phone: "" };

const c1 = contactPhoneFor(setupMitCoord, drvMitNr);
pruef("contactPhoneFor: Fahrer mit Nummer -> source='driver', normalisiert",
  c1 && c1.source === "driver" && c1.label === "+49 176 12345678",
  `got ${JSON.stringify(c1)}`);
pruef("contactPhoneFor: tel-Feld ohne Leerzeichen (fuer tel:-URL)",
  c1 && c1.tel === "+4917612345678",
  `tel='${c1?.tel}'`);

const c2 = contactPhoneFor(setupMitCoord, drvOhneNr);
pruef("contactPhoneFor: Fahrer ohne Nummer -> Fallback auf Koord, source='coord'",
  c2 && c2.source === "coord" && c2.label === "+49 170 7654321",
  `got ${JSON.stringify(c2)}`);

const c3 = contactPhoneFor(setupOhneCoord, drvOhneNr);
pruef("contactPhoneFor: weder Fahrer- noch Koord-Nummer -> null",
  c3 === null,
  `got ${JSON.stringify(c3)}`);

const c4 = contactPhoneFor(setupMitCoord, null);
pruef("contactPhoneFor: kein Fahrer zugeteilt -> Fallback auf Koord",
  c4 && c4.source === "coord",
  `got ${JSON.stringify(c4)}`);

// --- fmtDateNum ----------------------------------------------------------
pruef("fmtDateNum: '2026-07-25' -> '25.07.2026'",
  fmtDateNum("2026-07-25") === "25.07.2026",
  `got '${fmtDateNum("2026-07-25")}'`);
pruef("fmtDateNum: leerer Input -> leerer String (nicht crashen)",
  fmtDateNum("") === "" && fmtDateNum(null) === "",
  "leer/null crasht");

// --- waArtistText --------------------------------------------------------
const setup = {
  drivers: [drvMitNr, drvOhneNr],
  locations: [
    { id: "airport", name: "Airport" },
    { id: "festival", name: "Festival" },
  ],
  config: { coordinationPhone: "+49 170 7654321" },
};
const ride1 = { id: "r1", dayKey: "2026-07-25", time: "18:00", djName: "Timmy Trumpet", fromId: "airport", toId: "festival", assignedDriverId: "d1", passengerCount: 3 };
const ride2 = { ...ride1, id: "r2", assignedDriverId: "d2" }; // Fahrer ohne Nummer -> Koord
const ride3 = { ...ride1, id: "r3", assignedDriverId: null };  // ohne Fahrer -> Koord

const t1 = waArtistText(setup, ride1);
pruef("waArtistText: enthaelt 'Date: 25.07.2026'",
  t1.includes("Date: 25.07.2026"),
  "Date-Zeile fehlt oder falsches Format");
pruef("waArtistText: enthaelt 'Driver phone: +49 176 12345678'",
  t1.includes("Driver phone: +49 176 12345678"),
  "Driver phone fehlt");

const t2 = waArtistText(setup, ride2);
pruef("waArtistText: Fahrer ohne Nummer -> 'Shuttle coordination:' statt 'Driver phone:'",
  t2.includes("Shuttle coordination: +49 170 7654321") && !t2.includes("Driver phone:"),
  "Fallback-Labeling stimmt nicht");

const t3 = waArtistText(setup, ride3);
pruef("waArtistText: ohne Fahrer -> Koord-Nummer, kein Driver-Feld",
  t3.includes("Shuttle coordination: +49 170 7654321") && !t3.includes("Driver:"),
  "Ohne-Fahrer-Fall stimmt nicht");

// --- guestInfoText -------------------------------------------------------
const g1 = guestInfoText(setup, ride1);
pruef("guestInfoText: enthaelt kompaktes Datum '25.07.2026' (nicht 'Sa 25.07.')",
  g1.includes("Date: 25.07.2026") && !g1.includes("Sa 25.07"),
  "Datumsformat nicht auf kompakt umgestellt");
pruef("guestInfoText: enthaelt 'Driver phone: +49 176 12345678'",
  g1.includes("Driver phone: +49 176 12345678"),
  "Driver phone fehlt");

const g2 = guestInfoText(setup, ride2);
pruef("guestInfoText: Fahrer ohne Nummer -> 'Shuttle coordination:'",
  g2.includes("Shuttle coordination: +49 170 7654321"),
  "Fallback fehlt");

// --- Gegenprobe ----------------------------------------------------------
// Wenn ich absichtlich '99.99.9999' erwarte, sollte der Test das erkennen.
pruef("Gegenprobe: waArtistText enthaelt NICHT '99.99.9999'",
  !t1.includes("99.99.9999"),
  "Gegenprobe defekt");
// Wenn ich die Koord-Nummer aus setup entferne, darf ride2 keine Zeile 'phone' oder 'coordination' mehr enthalten.
const setupKahl = { ...setup, config: {} };
const t2kahl = waArtistText(setupKahl, ride2);
pruef("Gegenprobe: ohne Koord und ohne Fahrer-Nr -> weder 'Driver phone' noch 'Shuttle coordination'",
  !t2kahl.includes("Driver phone") && !t2kahl.includes("Shuttle coordination"),
  "Kontakt-Zeile taucht faelschlich auf");

// --- Ausgabe ------------------------------------------------------------
let bad = 0;
for (const c of checks) {
  console.log((c.ok ? "OK    " : "FAIL  ") + c.name + (c.ok ? "" : "  -- " + c.hint));
  if (!c.ok) bad++;
}
console.log("");
console.log(bad === 0 ? "SMOKE OK (" + checks.length + " Pruefungen)" : "SMOKE FAIL: " + bad + " von " + checks.length + " Pruefungen fehlgeschlagen");

fs.unlinkSync(out); fs.unlinkSync(copy);
process.exit(bad === 0 ? 0 : 1);
