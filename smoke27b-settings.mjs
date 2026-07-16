// Laufzeit-Smoke-Test fuer den SettingsTab-Rahmen (Session 27b, Scheibe 1a).
//
// TOGGLE-FALLE: SettingsTab startet mit wb=null und imp=null. Gerendert wird dann
// NUR die Grundflaeche. Die Tabellenblatt-Auswahl, die komplette Import-Vorschau,
// die amber Warnbox, die rote Fehlerbox, der "Importiere…"-Zustand und die
// "+N weitere"-Zeile haengen alle hinter diesen beiden States und wuerden in einem
// normalen Render-Test GAR NICHT laufen. Muster wie smoke27b/smoke27e: eine
// WEGWERF-KOPIE, in der die useState-Startwerte aus globalThis geseedet werden.
// Das Original wird nicht angefasst.
//
// ZWEI LAEUFE, weil Scheibe 1a nur den RAHMEN umbaut:
//   Lauf A: SettingsTab echt, inkl. der noch nicht umgebauten Unterbausteine
//           (DriverPhones/DispatcherUsers/AccessPinsSection/GuestLinksSection/
//           PushSettingsSection/AuditLogSection/ReportSection). Belegt: nichts
//           crasht. Classic-Reste sind hier ERWARTET und stammen nur von dort.
//   Lauf B: dieselbe Kopie, aber die sieben Unterbausteine durch Platzhalter
//           ersetzt. Misst damit genau den Rahmen. Classic-Reste muessen 0 sein.
import fs from "fs"; import { execSync } from "child_process";
import React from "react"; import { renderToStaticMarkup } from "react-dom/server";

const src = fs.readFileSync(process.argv[2], "utf8");
const a = src.indexOf("function SettingsTab(");
const b = src.indexOf("\n  );\n}\n", a) + 8;
let st = src.slice(a, b);
const before = st;

st = st.replace("const [wb, setWb] = useState(null);", "const [wb, setWb] = useState(globalThis.__WB__ || null);");
st = st.replace('const [sheet, setSheet] = useState("");', 'const [sheet, setSheet] = useState(globalThis.__SHEET__ || "");');
st = st.replace("const [imp, setImp] = useState(null);", "const [imp, setImp] = useState(globalThis.__IMP__ || null);");
st = st.replace("const [importing, setImporting] = useState(false);", "const [importing, setImporting] = useState(globalThis.__IMPORTING__ || false);");
if (st === before) { console.error("PATCH GESCHEITERT"); process.exit(1); }

const SUB = ["DriverPhones", "DispatcherUsers", "AccessPinsSection", "GuestLinksSection",
             "PushSettingsSection", "AuditLogSection", "ReportSection"];

const bauen = async (rahmenOnly) => {
  let code = st;
  if (rahmenOnly) {
    for (const s of SUB) {
      const re = new RegExp(`<${s}\\b[^/]*/>`, "g");
      const vorher = code;
      code = code.replace(re, `<div data-stub="${s}" />`);
      if (code === vorher) { console.error("STUB GESCHEITERT: " + s); process.exit(1); }
    }
  }
  const tag = Math.random().toString(36).slice(2);
  const copy = "/tmp/sm27bs-" + tag + ".jsx";
  fs.writeFileSync(copy, src.slice(0, a) + code + src.slice(b) + "\nexport { SettingsTab };\n");
  const out = "/home/claude/repo/.sm27bs-" + tag + ".mjs";
  execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`, { stdio: "pipe" });
  const m = await import(out);
  fs.unlinkSync(out); fs.unlinkSync(copy);
  return m.SettingsTab;
};

const drivers = [
  { id: "d1", firstName: "Finn", lastName: "Berger", vehicleType: "Van", phone: "+49 170 1234567", plate: "ER-AB 12", pin: "1111" },
  { id: "d2", firstName: "Nina", lastName: "Klein", vehicleType: "Car", phone: "0170 987654", plate: "", pin: "" },
  { id: "d3", firstName: "Amar", lastName: "Sayed", vehicleType: "Van", phone: "keine Nummer", plate: "", pin: "" },
];
const locations = [
  { id: "nue", short: "NUE", name: "Flughafen" },
  { id: "hot", short: "Hotel", name: "Hotel" },
  { id: "fes", short: "Fest", name: "Festival" },
];
const setup = {
  drivers, locations,
  dispatchers: [{ id: "p1", name: "Jordan", pin: "9999" }],
  matrix: { "nue|hot": { min: 35, km: 28 }, "nue|fes": { min: 45, km: 40 } },
  config: { festivalDates: ["2026-07-23", "2026-07-24"], defaultPin: "1234", stagePin: "", coordinationPhone: "+49 170 000", vapidPublicKey: "" },
};
const ride = (o) => ({ id: "r" + Math.random(), dayKey: "2026-07-24", time: "14:00", fromId: "nue", toId: "hot",
  djName: "Artist", passengerCount: 2, status: "planned", statusHistory: [], issues: [], log: [], ...o });
const dyn = { rides: [ride({}), ride({ status: "done", assignedDriverId: "d1" })], driverState: {}, messages: [], artistPresence: {}, rev: 3 };

const impBasis = (o) => ({ rides: [], errors: [], dupExisting: 0, dupInFile: 0, matched: 0, total: 0, noName: 0, offDates: [], ...o });
const r8 = Array.from({ length: 12 }, (_, i) => ride({ time: `1${i % 10}:00` }));

const faelle = [
  ["Startzustand (leer)", null, "", null, false],
  ["ein Blatt (keine Auswahl)", { SheetNames: ["Tabelle1"] }, "Tabelle1", null, false],
  ["mehrere Blaetter -> Auswahl", { SheetNames: ["Tabelle1", "Rueckfahrten"] }, "Tabelle1", null, false],
  ["Vorschau normal", null, "", impBasis({ rides: [ride({}), ride({})], total: 2, matched: 1 }), false],
  ["Vorschau + Duplikate", null, "", impBasis({ rides: [ride({})], dupExisting: 4, dupInFile: 2, total: 7 }), false],
  ["Vorschau + Warnbox (noName)", null, "", impBasis({ rides: [ride({ djName: "" })], noName: 1, total: 1 }), false],
  ["Vorschau + Warnbox (offDates)", null, "", impBasis({ rides: [ride({ dayKey: "2025-07-24" })], offDates: ["2025-07-24"], total: 1 }), false],
  ["Vorschau + Fehlerbox", null, "", impBasis({ rides: [ride({})], errors: [{ row: 3, reason: "Datum fehlt", artist: "X" }, { row: 9, reason: "Uhrzeit ungueltig" }], total: 3 }), false],
  ["Vorschau > 8 -> +N weitere", null, "", impBasis({ rides: r8, total: 12 }), false],
  ["Vorschau + importiert gerade", null, "", impBasis({ rides: [ride({})], total: 1 }), true],
  ["alles gleichzeitig", { SheetNames: ["A", "B"] }, "A", impBasis({ rides: r8, errors: [{ row: 2, reason: "kaputt" }], dupExisting: 1, dupInFile: 1, noName: 2, offDates: ["2025-01-01"], matched: 3, total: 20 }), false],
];

const CLASSIC = /(stone-\d|orange-\d|emerald-\d|red-\d|sky-\d|amber-\d|bg-white\/|border-white\/)/g;

const lauf = async (rahmenOnly) => {
  const SettingsTab = await bauen(rahmenOnly);
  console.log(`\n=== Lauf ${rahmenOnly ? "B: NUR der Rahmen (Unterbausteine ausgeklammert)" : "A: SettingsTab echt, inkl. Classic-Unterbausteinen"} ===`);
  let bad = 0;
  for (const [name, wb, sheet, imp, importing] of faelle) {
    globalThis.__WB__ = wb; globalThis.__SHEET__ = sheet; globalThis.__IMP__ = imp; globalThis.__IMPORTING__ = importing;
    let html;
    try {
      html = renderToStaticMarkup(React.createElement(SettingsTab, {
        setup, dyn, day: "2026-07-24",
        updateSetup: async () => ({ ok: true }), updateDyn: async () => ({ ok: true }),
        onPreviewGuest: () => {},
      }));
    } catch (e) {
      console.log(`CRASH  ${name.padEnd(30)} -> ${e.message}`); bad++; continue;
    }
    const mc = (html.match(/mc-[a-z-]+|--mc-[a-z-]+/g) || []).length;
    const reste = [...new Set(html.match(CLASSIC) || [])];
    const fehler = rahmenOnly && reste.length > 0;
    if (fehler) bad++;
    console.log(`${fehler ? "FEHLER" : "OK    "} ${name.padEnd(30)} ${String(html.length).padStart(6)} Zeichen | MC-Treffer: ${String(mc).padStart(3)} | Classic-Reste: ${reste.length}${reste.length ? " -> " + reste.join(",") : ""}`);
  }
  return bad;
};

const badA = await lauf(false);
const badB = await lauf(true);
console.log(`\nLauf A (Crashes): ${badA}  |  Lauf B (Classic-Reste im Rahmen): ${badB}`);
process.exit(badA + badB ? 1 : 0);
