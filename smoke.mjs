// Laufzeit-Smoke-Test der drei umgebauten Leitstellen-Dialoge. esbuild meldet
// eine undefinierte JSX-Referenz NIE, ein echter Render schon.
import fs from "fs"; import { execSync } from "child_process";
import React from "react"; import { renderToStaticMarkup } from "react-dom/server";
const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/sm-" + tag + ".jsx";
fs.writeFileSync(copy, fs.readFileSync(process.argv[2], "utf8") + "\nexport { RideForm, AssignModal, WhatsAppModal };\n");
const out = "/home/claude/repo/.sm-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const m = await import(out);
const setup = {
  locations: [{ id: "airport", short: "FLH" }, { id: "festival", short: "FEST" }, { id: "hotel", short: "HTL" }],
  drivers: [{ id: "d1", firstName: "Finn", lastName: "Steinmetz", vehicleType: "Van", seats: 7 },
            { id: "d2", firstName: "Lea", lastName: "Bauer", vehicleType: "SUV", seats: 4 }],
  zones: ["Zone A", "Zone B"], matrix: {}, config: { festivalDates: ["2026-07-23"] },
};
const dyn = { rides: [], driverState: {} };
const ride = { id: "r1", time: "12:00", date: "2026-07-23", dayKey: "2026-07-23", djName: "Alok",
  fromId: "airport", toId: "festival", status: "planned", passengerCount: 2, issues: [], log: [], flightNo: "KL1845", zone: "Zone A" };
for (const [n, C, p] of [
  ["RideForm (bestehende Fahrt)", m.RideForm, { setup, ride, onClose(){}, onSave(){}, onDelete(){} }],
  ["RideForm (neue Fahrt)", m.RideForm, { setup, ride: { _new: true }, onClose(){}, onSave(){}, onDelete: null }],
  ["AssignModal", m.AssignModal, { setup, dyn, ride, onClose(){}, onAssign(){} }],
  ["WhatsAppModal", m.WhatsAppModal, { setup, ride, onClose(){}, onCopied(){} }],
]) {
  try { const h = renderToStaticMarkup(React.createElement(C, p));
    const mcTreffer = (h.match(/mc-input|mc-panel|mc-btn|mc-badge|mc-ride-card|--mc-/g) || []).length;
    const stone = (h.match(/stone-\d|orange-\d|sky-\d|emerald-\d|red-\d|amber-\d/g) || []).length;
    console.log("OK  " + n.padEnd(28) + h.length + " Zeichen | MC-Treffer: " + String(mcTreffer).padStart(3) + " | Classic-Reste: " + stone);
  } catch (e) { console.log("FEHLER  " + n + ": " + e.message); }
}
fs.unlinkSync(out); fs.unlinkSync(copy);
