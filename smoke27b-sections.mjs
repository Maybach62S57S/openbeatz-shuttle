// Laufzeit-Smoke-Test fuer die vier kleinen Settings-Bausteine (27b, Scheibe 1b):
// DriverPhones, DispatcherUsers, AccessPinsSection, PushSettingsSection.
//
// TOGGLE-FALLE: alle vier starten mit saved=false und saveError="". Die
// "gespeichert"-Bestaetigung und die Fehlerzeile haengen dahinter und wuerden in
// einem normalen Render-Test GAR NICHT laufen. Genauso der Warnhinweis in
// DriverPhones (haengt an phoneLooksInvalid ueber den Eingabe-State, nicht am
// Prop) und der "kein Key hinterlegt"-Hinweis in PushSettingsSection.
// Muster wie smoke27b/smoke27e: WEGWERF-KOPIE, useState-Startwerte aus
// globalThis geseedet, Original bleibt unangetastet.
import fs from "fs"; import { execSync } from "child_process";
import React from "react"; import { renderToStaticMarkup } from "react-dom/server";

const src = fs.readFileSync(process.argv[2], "utf8");

// Funktionsblock einer Top-Level-Komponente ausschneiden
const block = (name) => {
  const a = src.indexOf(`function ${name}(`);
  if (a < 0) { console.error("NICHT GEFUNDEN: " + name); process.exit(1); }
  const b = src.indexOf("\n  );\n}\n", a) + 8;
  return [a, b];
};

// In jeder der vier Komponenten saved/saveError aus globalThis seeden.
let out = src;
const ZIELE = ["DriverPhones", "DispatcherUsers", "AccessPinsSection", "PushSettingsSection"];
// von hinten nach vorne patchen, damit die Indizes gueltig bleiben
const spans = ZIELE.map((n) => [n, ...block(n)]).sort((x, y) => y[1] - x[1]);
for (const [name, a, b] of spans) {
  let code = out.slice(a, b);
  const vorher = code;
  code = code.replace("const [saved, setSaved] = useState(false);",
    `const [saved, setSaved] = useState(globalThis.__SAVED__ || false);`);
  code = code.replace('const [saveError, setSaveError] = useState("");',
    `const [saveError, setSaveError] = useState(globalThis.__SAVEERR__ || "");`);
  if (code === vorher) { console.error("PATCH GESCHEITERT: " + name); process.exit(1); }
  out = out.slice(0, a) + code + out.slice(b);
}

const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/sm27bx-" + tag + ".jsx";
fs.writeFileSync(copy, out + `\nexport { ${ZIELE.join(", ")} };\n`);
const built = "/home/claude/repo/.sm27bx-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${built}`, { stdio: "pipe" });
const M = await import(built);
fs.unlinkSync(built); fs.unlinkSync(copy);

const drivers = [
  { id: "d1", firstName: "Finn", lastName: "Berger", vehicleType: "Van", phone: "+49 170 1234567", plate: "ER-AB 12", pin: "1111" },
  { id: "d2", firstName: "Nina", lastName: "Klein", vehicleType: "Car", phone: "0170 987654", plate: "", pin: "" },
];
// d3 hat bewusst eine kaputte Nummer -> loest den oddPhones-Warnhinweis aus
const driversOdd = [...drivers, { id: "d3", firstName: "Amar", lastName: "Sayed", vehicleType: "Van", phone: "keine Nummer", plate: "", pin: "" }];
const mk = (o = {}) => ({
  drivers, locations: [],
  dispatchers: [{ id: "p1", name: "Jordan", pin: "9999" }],
  matrix: {},
  config: { festivalDates: [], defaultPin: "1234", stagePin: "", coordinationPhone: "", vapidPublicKey: "" },
  ...o,
});
const upd = async () => ({ ok: true });

const faelle = [
  ["DriverPhones", "Grundzustand", mk(), false, ""],
  ["DriverPhones", "gespeichert", mk(), true, ""],
  ["DriverPhones", "Speicherfehler", mk(), false, "Keine Verbindung, bitte erneut versuchen."],
  ["DriverPhones", "Warnhinweis kaputte Nummer", mk({ drivers: driversOdd }), false, ""],
  ["DriverPhones", "Warnung + Fehler gleichzeitig", mk({ drivers: driversOdd }), false, "Speichern fehlgeschlagen."],
  ["DispatcherUsers", "Grundzustand", mk(), false, ""],
  ["DispatcherUsers", "gespeichert", mk(), true, ""],
  ["DispatcherUsers", "Speicherfehler", mk(), false, "Konflikt, bitte neu laden."],
  ["DispatcherUsers", "keine Nutzer hinterlegt", mk({ dispatchers: [] }), false, ""],
  ["AccessPinsSection", "Grundzustand", mk(), false, ""],
  ["AccessPinsSection", "gespeichert", mk(), true, ""],
  ["AccessPinsSection", "Speicherfehler", mk(), false, "Speichern fehlgeschlagen."],
  ["PushSettingsSection", "kein Key -> Hinweis", mk(), false, ""],
  ["PushSettingsSection", "Key gesetzt", mk({ config: { ...mk().config, vapidPublicKey: "BIed3xyz" } }), false, ""],
  ["PushSettingsSection", "gespeichert", mk(), true, ""],
];

const CLASSIC = /(stone-\d|orange-\d|emerald-\d|red-\d|sky-\d|amber-\d|bg-white\/|border-white\/)/g;
let bad = 0;
for (const [komp, name, setup, saved, saveErr] of faelle) {
  globalThis.__SAVED__ = saved; globalThis.__SAVEERR__ = saveErr;
  let html;
  try {
    html = renderToStaticMarkup(React.createElement(M[komp], { setup, updateSetup: upd }));
  } catch (e) { console.log(`CRASH  ${komp}/${name} -> ${e.message}`); bad++; continue; }
  const mc = (html.match(/mc-[a-z-]+|--mc-[a-z-]+/g) || []).length;
  const reste = [...new Set(html.match(CLASSIC) || [])];
  if (reste.length) bad++;
  console.log(`${reste.length ? "FEHLER" : "OK    "} ${(komp + " / " + name).padEnd(46)} ${String(html.length).padStart(5)} Z | MC: ${String(mc).padStart(3)} | Classic-Reste: ${reste.length}${reste.length ? " -> " + reste.join(",") : ""}`);
}
console.log(`\n${faelle.length} Zustaende, ${bad} Fehler`);
process.exit(bad ? 1 : 0);
