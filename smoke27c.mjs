// Laufzeit-Smoke-Test der vier 27d-Bausteine. esbuild meldet eine undefinierte
// JSX-Referenz NIE, ein echter Render schon. Gleiche Bauart wie smoke.mjs.
import fs from "fs"; import { execSync } from "child_process";
import React from "react"; import { renderToStaticMarkup } from "react-dom/server";
const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/sm27c-" + tag + ".jsx";
fs.writeFileSync(copy, fs.readFileSync(process.argv[2], "utf8") + "\nexport { MapTab, MapFilters, MapLegend, DriverDetailsPanel };\n");
const out = "/home/claude/repo/.sm27c-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const m = await import(out);
const day = "2026-07-23";
const setup = {
  locations: [{ id: "airport", short: "FLH", lat: 49.49, lng: 11.07 }, { id: "festival", short: "FEST", lat: 49.56, lng: 10.88 }, { id: "hotel", short: "HTL", lat: 49.57, lng: 10.89 }],
  drivers: [{ id: "d1", firstName: "Finn", lastName: "Steinmetz", vehicleType: "Van", seats: 7, phone: "+49111" },
            { id: "d2", firstName: "Lea", lastName: "Bauer", vehicleType: "SUV", seats: 4 }],
  zones: ["Zone A"], matrix: {}, config: { festivalDates: [day], softHoursMin: 300, defaultDurationMin: 30 },
};
const mk = (id, drv, st, t) => ({ id, time: t, date: day, dayKey: day, djName: "Alok", fromId: "airport", toId: "festival",
  status: st, assignedDriverId: drv, passengerCount: 2, issues: [], log: [], estDurationMin: 40 });
const dyn = { rides: [
  mk("r1", "d1", "onboard", "12:00"), mk("r2", "d1", "done", "12:20"),        // Ueberschneidung -> Konflikt
  mk("r3", "d2", "enroute_pickup", "14:00"), mk("r4", null, "planned", "15:00"), // ohne Fahrer -> warn-Zeile
  mk("r5", "d2", "accepted", "16:00"), mk("r6", "d1", "cancelled", "17:00"),
], driverState: { d1: { gps: { lat: 49.5, lng: 11.0, at: Date.now() } } } };
const stats = { active: dyn.rides[0], locNow: "airport", count: 3, drivingMin: 400 };
const counts = { onboard: 1, toPickup: 1, free: 2, unterwegs: 2, frei: 2, verspaetet: 1, problem: 1, unbekannt: 0 };
// DriverDetailsPanel sitzt hinter einer Auswahl und rendert im MapTab-Test NIE.
// Deshalb hier direkt, in beiden Zustaenden (mit/ohne Telefonnummer).
const nodes = { airport: { short: "FLH", name: "Flughafen" }, festival: { short: "FEST", name: "Festival" } };
const pos = { driver: setup.drivers[0], mode: "onboard", fromId: "airport", toId: "festival", f: 0.5,
  positionSource: "gps", gps: { at: Date.now() }, uncertain: false, problem: true, lateMin: 12,
  ride: { djName: "Alok", time: "12:00", zone: "Zone A" }, etaMin: 8, nextRide: null,
  lastChange: { status: "onboard", at: Date.now() } };
const posB = { ...pos, driver: setup.drivers[1], mode: "free", nodeId: "airport", problem: false, lateMin: 0,
  positionSource: "estimated", uncertain: true, ride: null, etaMin: null, lastChange: null };
for (const [n, C, p] of [
  ["MapTab (heute/live)", m.MapTab, { setup, dyn, day, onEdit(){} }],
  ["MapTab (anderer Tag/sim)", m.MapTab, { setup, dyn, day: "2026-07-25", onEdit(){} }],
  ["MapFilters", m.MapFilters, { value: "all", onChange(){}, counts }],
  ["MapFilters (Filter aktiv)", m.MapFilters, { value: "problem", onChange(){}, counts }],
  ["MapLegend", m.MapLegend, { counts }],
  ["DriverDetailsPanel (Tel)", m.DriverDetailsPanel, { pos, setup, nodes, onClose(){} }],
  ["DriverDetailsPanel (o. Tel)", m.DriverDetailsPanel, { pos: posB, setup, nodes, onClose(){} }],
]) {
  try { const h = renderToStaticMarkup(React.createElement(C, p));
    const mcT = (h.match(/mc-input|mc-panel|mc-btn|mc-badge|mc-ride-card|mc-iconbtn|mc-eyebrow|mc-live-dot|mc-tl-block|--mc-/g) || []).length;
    const stone = (h.match(/stone-\d|orange-\d|sky-\d|emerald-\d|red-\d|amber-\d|blue-\d/g) || []).length;
    console.log("OK  " + n.padEnd(28) + String(h.length).padStart(6) + " Zeichen | MC-Treffer: " + String(mcT).padStart(3) + " | Classic-Reste: " + stone);
  } catch (e) { console.log("FEHLER  " + n + ": " + e.message); }
}
fs.unlinkSync(out); fs.unlinkSync(copy);
