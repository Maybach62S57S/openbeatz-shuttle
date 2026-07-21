// smoke-artisttext-privacy-l.mjs
// Block L (Go-Live-Freigabe): der Artist-/Manager-Text (waArtistText) darf die
// private Fahrer-Telefonnummer NICHT mehr enthalten (Konsistenz zum Gast-Link).
// Der Fahrer-Text (waDriverText) behaelt die interne Notiz.
//
// Pruefmethode:
//  A) Laufzeit: NEUE waArtistText verbatim repliziert, mit Fahrer MIT Telefon
//     rendern -> Nummer darf NICHT im Text stehen, Vorname + Fahrzeug schon.
//  B) Gegenprobe: ALTE waArtistText (mit Telefon) rendern -> Nummer MUSS im Text
//     stehen. Beweist, dass der Detektor ueberhaupt zwischen beiden unterscheidet.
//  C) Drift-Check gegen die Quelle: der echte waArtistText-Block im File darf
//     'drv.phone' nicht enthalten, muss 'Driver: ${drv.firstName}' enthalten.
//  D) Guard: waDriverText im File enthaelt weiter 'ride.notes' (nicht angefasst).
import { readFileSync } from "node:fs";

const SRC = process.argv[2] || "src/ShuttleLeitstelle.jsx";
const src = readFileSync(SRC, "utf8");

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; } else { fail++; console.log("FAIL:", name); } };

// waLoc-Stub (Ortsaufloesung ist fuer diesen Test irrelevant)
const waLoc = (_setup, id, custom) => id || custom || "-";

// ---- NEUE Funktion verbatim (Stand nach Fix) ----
function waArtistText(setup, ride) {
  const drv = setup.drivers.find((d) => d.id === ride.assignedDriverId);
  const veh = drv ? (drv.vehicleType === "Van" ? "Van" : "Car") : null;
  return [
    "Your shuttle is confirmed.",
    `Pickup time: ${ride.time}`,
    `Pickup location: ${waLoc(setup, ride.fromId, ride.fromCustom)}${ride.meetingPoint ? `, ${ride.meetingPoint}` : ""}`,
    drv ? `Driver: ${drv.firstName}` : null,
    veh ? `Vehicle: ${veh}` : null,
    `Destination: ${waLoc(setup, ride.toId, ride.toCustom)}${ride.zone ? ` – ${ride.zone}` : ""}`,
    "If anything changes, please contact us.",
  ].filter(Boolean).join("\n");
}

// ---- ALTE Funktion (Gegenprobe): identisch, aber mit Telefon in der Driver-Zeile ----
function waArtistTextOLD(setup, ride) {
  const drv = setup.drivers.find((d) => d.id === ride.assignedDriverId);
  const veh = drv ? (drv.vehicleType === "Van" ? "Van" : "Car") : null;
  return [
    "Your shuttle is confirmed.",
    `Pickup time: ${ride.time}`,
    `Pickup location: ${waLoc(setup, ride.fromId, ride.fromCustom)}${ride.meetingPoint ? `, ${ride.meetingPoint}` : ""}`,
    drv ? `Driver: ${drv.firstName}${drv.phone ? ` (${drv.phone})` : ""}` : null,
    veh ? `Vehicle: ${veh}` : null,
    `Destination: ${waLoc(setup, ride.toId, ride.toCustom)}${ride.zone ? ` – ${ride.zone}` : ""}`,
    "If anything changes, please contact us.",
  ].filter(Boolean).join("\n");
}

const PHONE = "+491701234567";
const PHONE_DIGITS = "491701234567";
const setup = { drivers: [{ id: "d1", firstName: "Max", lastName: "Mustermann", vehicleType: "Van", phone: PHONE }] };
const ride = { assignedDriverId: "d1", time: "14:30", fromId: "sheraton", toId: "festival", meetingPoint: "Lobby", zone: "Caldera" };

// ---- A) Laufzeit NEU ----
const outNew = waArtistText(setup, ride);
ok("A1 neu: keine +Nummer im Artist-Text", !outNew.includes(PHONE));
ok("A2 neu: keine nackten Ziffern im Artist-Text", !outNew.includes(PHONE_DIGITS));
ok("A3 neu: Fahrer-Vorname vorhanden", outNew.includes("Driver: Max"));
ok("A4 neu: Fahrzeug vorhanden", outNew.includes("Vehicle: Van"));
ok("A5 neu: kein 'Mustermann' (kein Nachname geleakt)", !outNew.includes("Mustermann"));

// ---- B) Gegenprobe ALT (muss Nummer enthalten) ----
const outOld = waArtistTextOLD(setup, ride);
ok("B1 gegenprobe: ALT enthaelt die Nummer", outOld.includes(PHONE));
ok("B2 gegenprobe: Detektor unterscheidet ALT/NEU", outOld.includes(PHONE) && !outNew.includes(PHONE));

// ---- C) Drift-Check gegen die echte Quelle ----
const iA = src.indexOf("function waArtistText(setup, ride)");
ok("C0 quelle: waArtistText gefunden", iA >= 0);
const blockA = iA >= 0 ? src.slice(iA, iA + 800) : "";
const endA = blockA.indexOf("\n}\n");
const bodyA = endA >= 0 ? blockA.slice(0, endA) : blockA;
ok("C1 quelle: waArtistText enthaelt KEIN drv.phone", !bodyA.includes("drv.phone"));
ok("C2 quelle: waArtistText enthaelt 'Driver: ${drv.firstName}'", bodyA.includes("Driver: ${drv.firstName}"));

// ---- D) Guard: waDriverText unangetastet (interne Notiz bleibt) ----
const iD = src.indexOf("function waDriverText");
ok("D0 quelle: waDriverText gefunden", iD >= 0);
const blockD = iD >= 0 ? src.slice(iD, iD + 900) : "";
ok("D1 quelle: waDriverText enthaelt weiter ride.notes", blockD.includes("ride.notes"));

console.log(`\nArtist-Text Privacy Smoke (Block L): ${pass} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
