// Laufzeit-Smoke-Test fuer FlightTab und LiveGoogleMap (Session 27e).
//
// TOGGLE-FALLE, wie in smoke27b: ein normaler Render-Test sieht nur den
// STARTzustand. FlightTab startet mit busy=null und note=null, LiveGoogleMap
// startet ohne Google-Key immer auf "no-key" - die Zustaende "laedt",
// "bereit" und "Fehler" wuerden nie rendern. Deshalb baut dieses Skript eine
// WEGWERF-KOPIE der Datei, in der genau diese useState-Startwerte aus
// globalThis geseedet werden. Das Original wird nicht angefasst.
import fs from "fs"; import { execSync } from "child_process";
import React from "react"; import { renderToStaticMarkup } from "react-dom/server";

const src = fs.readFileSync(process.argv[2], "utf8");
let out = src;
const patch = (alt, neu) => {
  if (!out.includes(alt)) { console.error("PATCH GESCHEITERT:", alt); process.exit(1); }
  out = out.replace(alt, neu);
};
// FlightTab: Ladezustand und Rueckmeldung seedbar machen
patch('const [busy, setBusy] = useState(null); // rideId | "all"',
      'const [busy, setBusy] = useState(globalThis.__BUSY__ ?? null);');
patch('  const [note, setNote] = useState(null);\n  const rides = (dyn.rides || [])',
      '  const [note, setNote] = useState(globalThis.__NOTE__ ?? null);\n  const rides = (dyn.rides || [])');
// LiveGoogleMap: alle vier Zustaende erreichbar machen
patch('const [status, setStatus] = useState(hasGoogleMaps() ? "loading" : "no-key"); // loading|ready|error|no-key',
      'const [status, setStatus] = useState(globalThis.__GSTATUS__ ?? (hasGoogleMaps() ? "loading" : "no-key"));');
patch('const [errorMsg, setErrorMsg] = useState("");',
      'const [errorMsg, setErrorMsg] = useState(globalThis.__GERR__ ?? "");');

const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/sm27e-" + tag + ".jsx";
fs.writeFileSync(copy, out + "\nexport { FlightTab, LiveGoogleMap };\n");
const bundle = "/home/claude/repo/.sm27e-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${bundle}`, { stdio: "pipe" });
const { FlightTab, LiveGoogleMap } = await import(bundle);

const CLASSIC = /(stone-\d|orange-\d|emerald-\d|red-\d|amber-\d|sky-\d|bg-white\/|border-white\/|#78716c|#1c1917|#fb923c|#38bdf8|#0c0a09)/g;
const drivers = [
  { id: "d1", firstName: "Finn", lastName: "Berger", vehicleType: "Van", vehicleId: "V1", seats: 6 },
  { id: "d2", firstName: "Lea", lastName: "Kraus", vehicleType: "SUV", vehicleId: "S1", seats: 4 },
];
const locations = [
  { id: "airport", short: "NUE", name: "Flughafen", lat: 49.49, lng: 11.07 },
  { id: "festival", short: "FEST", name: "Festival", lat: 49.57, lng: 10.88 },
  { id: "sheraton", short: "SHE", name: "Sheraton", lat: 49.45, lng: 11.08 },
];
const setup = { drivers, locations, config: {}, matrix: {}, zones: [] };
const T = "2026-07-24";
const ride = (o) => ({ id: "r" + Math.random().toString(36).slice(2, 6), dayKey: T, time: "14:00", djName: "Testartist", fromId: "airport", toId: "festival", status: "planned", passengerCount: 2, issues: [], log: [], ...o });

const faelle = [
  ["leer (keine Flüge)", { rides: [] }, null, null],
  ["Status unbekannt", { rides: [ride({ flightNo: "LH123", scheduledArrival: "13:30" })] }, null, null],
  ["geplant + Fahrer", { rides: [ride({ flightNo: "LH123", flightStatus: "geplant", scheduledArrival: "13:30", assignedDriverId: "d1" })] }, null, null],
  ["verspätet (warn)", { rides: [ride({ flightNo: "LH123", flightStatus: "verspätet", scheduledArrival: "13:30", estimatedArrival: "14:10", delayMinutes: 40, assignedDriverId: "d2" })] }, null, null],
  ["gelandet ohne Fahrer (critical)", { rides: [ride({ flightNo: "LH123", flightStatus: "gelandet", scheduledArrival: "13:30", actualArrival: "13:28", toId: "sheraton", lastFlightUpdate: Date.now(), flightUpdateSource: "aerodatabox" })] }, null, null],
  ["annulliert (critical)", { rides: [ride({ flightNo: "LH123", flightStatus: "annulliert", scheduledArrival: "13:30" })] }, null, null],
  ["manuell überschrieben", { rides: [ride({ flightNo: "LH123", flightStatus: "gelandet", manualOverride: true, actualArrival: "13:28", terminal: "1", assignedDriverId: "d1" })] }, null, null],
  ["Zeile lädt (Rad dreht)", { rides: [ride({ id: "rx", flightNo: "LH123", flightStatus: "geplant" })] }, "rx", null],
  ["Kopf lädt (alle)", { rides: [ride({ flightNo: "LH123" })] }, "all", null],
  ["Rückmeldung ok (Zeile)", { rides: [ride({ id: "rx", flightNo: "LH123" })] }, null, { id: "rx", ok: true, text: "aktualisiert" }],
  ["Rückmeldung Fehler (Zeile)", { rides: [ride({ id: "rx", flightNo: "LH123" })] }, null, { id: "rx", ok: false, text: "kein Flug-Provider verbunden" }],
  ["Rückmeldung Kopf", { rides: [ride({ flightNo: "LH123" })] }, null, { id: "all", ok: true, text: "2 aktualisiert" }],
  ["alle fünf Status gemischt", { rides: [
    ride({ flightNo: "LH1", flightStatus: "", time: "10:00" }),
    ride({ flightNo: "LH2", flightStatus: "geplant", time: "11:00", assignedDriverId: "d1" }),
    ride({ flightNo: "LH3", flightStatus: "verspätet", time: "12:00", delayMinutes: 25, assignedDriverId: "d2" }),
    ride({ flightNo: "LH4", flightStatus: "gelandet", time: "13:00", assignedDriverId: "d1", status: "onboard" }),
    ride({ flightNo: "LH5", flightStatus: "annulliert", time: "14:00" }),
  ] }, null, null],
];

let bad = 0;
console.log("--- FlightTab ---");
for (const [name, dyn, busy, note] of faelle) {
  globalThis.__BUSY__ = busy; globalThis.__NOTE__ = note;
  let html;
  try {
    html = renderToStaticMarkup(React.createElement(FlightTab, {
      setup, dyn: { ...dyn, driverState: {}, rev: 1 }, day: T,
      updateDyn: async () => ({ ok: true }), by: "dispo:1", onErr: () => {}, onEdit: () => {},
    }));
  } catch (e) { console.log("FEHLER ".padEnd(7) + name.padEnd(32) + " -> " + e.message); bad++; continue; }
  const mc = (html.match(/mc-[a-z-]+|--mc-[a-z-]+/g) || []).length;
  const reste = html.match(CLASSIC) || [];
  if (reste.length) bad++;
  console.log(`${reste.length ? "FEHLER" : "OK    "} ${name.padEnd(32)} ${String(html.length).padStart(5)} Zeichen | MC-Treffer: ${String(mc).padStart(3)} | Classic-Reste: ${reste.length}${reste.length ? " -> " + [...new Set(reste)].join(",") : ""}`);
}
globalThis.__BUSY__ = null; globalThis.__NOTE__ = null;

console.log("\n--- LiveGoogleMap (alle vier Zustände) ---");
const gpsDyn = { rides: [], driverState: { d1: { gps: { lat: 49.5, lng: 11.0, at: Date.now(), accuracy: 12 } } }, rev: 1 };
for (const [name, st, err] of [
  ["no-key", "no-key", ""],
  ["loading", "loading", ""],
  ["ready", "ready", ""],
  ["error", "error", "Google Maps konnte nicht geladen werden."],
]) {
  globalThis.__GSTATUS__ = st; globalThis.__GERR__ = err;
  let html;
  try { html = renderToStaticMarkup(React.createElement(LiveGoogleMap, { setup, dyn: gpsDyn, glide: true })); }
  catch (e) { console.log("FEHLER ".padEnd(7) + name.padEnd(32) + " -> " + e.message); bad++; continue; }
  const mc = (html.match(/mc-[a-z-]+|--mc-[a-z-]+/g) || []).length;
  const reste = html.match(CLASSIC) || [];
  if (reste.length) bad++;
  console.log(`${reste.length ? "FEHLER" : "OK    "} ${name.padEnd(32)} ${String(html.length).padStart(5)} Zeichen | MC-Treffer: ${String(mc).padStart(3)} | Classic-Reste: ${reste.length}${reste.length ? " -> " + [...new Set(reste)].join(",") : ""}`);
}

// Google zeichnet die Marker im useEffect auf ein Canvas, im SSR-Render taucht
// davon KEIN Pixel auf. Die Marker-Farben sind also durch keinen Render-Test
// belegt. Deshalb hier eine Kopplungspruefung: GMAP_COLORS muss Wert fuer Wert
// dem entsprechen, was LIVE in MissionStyles steht. Wird ein Token dort
// geaendert, faellt diese Pruefung um, statt dass die Karte still auseinander-
// laeuft.
console.log("\n--- GMAP_COLORS gegen die Tokens in MissionStyles ---");
const tok = {};
for (const m of src.matchAll(/(--mc-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) tok[m[1]] = m[2].toLowerCase();
const gm = {};
for (const m of src.match(/const GMAP_COLORS = \{[^}]+\}/)[0].matchAll(/(\w+):\s*"(#[0-9a-fA-F]{6})"/g)) gm[m[1]] = m[2].toLowerCase();
for (const [k, token] of [["van", "--mc-st-assigned"], ["car", "--mc-st-new"], ["place", "--mc-st-idle"], ["stroke", "--mc-bg"]]) {
  const ok = gm[k] === tok[token];
  if (!ok) bad++;
  console.log(`${ok ? "OK    " : "FEHLER"} GMAP_COLORS.${k.padEnd(6)} ${gm[k]} ${ok ? "==" : "!="} ${token} ${tok[token]}`);
}

fs.unlinkSync(bundle); fs.unlinkSync(copy);
console.log(bad ? `\n${bad} FEHLER` : "\nalle Zustände sauber");
process.exit(bad ? 1 : 0);
