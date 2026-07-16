// Laufzeit-Smoke-Test fuer GuestLinksSection (27b, Scheibe 2).
//
// TOGGLE-FALLE: die Komponente startet mit savedPhone=false, copiedTok=null,
// saveError="" und tokens = hasSupabase() ? null : setup.guestTokens. Ein
// normaler Render-Test sieht damit NUR den Startzustand und wuerde die
// "gespeichert"-Bestaetigung, die Kopiert-Bestaetigung, die Fehlerbox, den
// "Laedt…"-Zustand und den phoneLooksInvalid-Hinweis GAR NICHT rendern.
// Muster wie smoke27b-settings/smoke27b-sections: WEGWERF-KOPIE, useState-
// Startwerte aus globalThis geseedet, Original bleibt unangetastet.
import fs from "fs"; import { execSync } from "child_process";
import React from "react"; import { renderToStaticMarkup } from "react-dom/server";

const src = fs.readFileSync(process.argv[2], "utf8");

const block = (name) => {
  const a = src.indexOf(`function ${name}(`);
  if (a < 0) { console.error("NICHT GEFUNDEN: " + name); process.exit(1); }
  const b = src.indexOf("\n  );\n}\n", a) + 8;
  return [a, b];
};

let out = src;
const [a, b] = block("GuestLinksSection");
let code = out.slice(a, b);
const patches = [
  ['const [coordPhone, setCoordPhone] = useState(setup.config.coordinationPhone || "");',
   'const [coordPhone, setCoordPhone] = useState(globalThis.__PHONE__ ?? (setup.config.coordinationPhone || ""));'],
  ["const [savedPhone, setSavedPhone] = useState(false);",
   "const [savedPhone, setSavedPhone] = useState(globalThis.__SAVEDPHONE__ || false);"],
  ["const [copiedTok, setCopiedTok] = useState(null);",
   "const [copiedTok, setCopiedTok] = useState(globalThis.__COPIED__ || null);"],
  ['const [saveError, setSaveError] = useState("");',
   'const [saveError, setSaveError] = useState(globalThis.__SAVEERR__ || "");'],
  ["const [tokens, setTokens] = useState(hasSupabase() ? null : (setup.guestTokens || []));",
   "const [tokens, setTokens] = useState(globalThis.__TOKENS__ === undefined ? (hasSupabase() ? null : (setup.guestTokens || [])) : globalThis.__TOKENS__);"],
];
for (const [alt, neu] of patches) {
  if (!code.includes(alt)) { console.error("PATCH GESCHEITERT: " + alt.slice(0, 40)); process.exit(1); }
  code = code.replace(alt, neu);
}
out = out.slice(0, a) + code + out.slice(b);

const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/sm27bg-" + tag + ".jsx";
fs.writeFileSync(copy, out + `\nexport { GuestLinksSection };\n`);
const built = "/home/claude/repo/.sm27bg-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${built}`, { stdio: "pipe" });
const M = await import(built);
fs.unlinkSync(built); fs.unlinkSync(copy);

const TOKS = [
  { token: "abcdef1234567890", djName: "Boris Brejcha", createdAt: 2 },
  { token: "0f9e8d7c6b5a4321", djName: "Charlotte de Witte", createdAt: 1 },
];
const mkSetup = (o = {}) => ({
  drivers: [], locations: [], dispatchers: [], matrix: {},
  guestTokens: [], config: { coordinationPhone: "+49 170 1234567" }, ...o,
});
const mkDyn = (rides = []) => ({ rides });
const RIDES = [
  { id: "r1", djName: "Boris Brejcha", status: "planned" },
  { id: "r2", djName: "Amelie Lens", status: "planned" },
  { id: "r3", djName: "Weg Damit", status: "cancelled" },
];
const upd = async (fn) => { fn(mkSetup()); return { ok: true }; };

// [Name, setup, dyn, tokens, savedPhone, copiedTok, saveError, coordPhone]
const U = undefined;
const faelle = [
  ["Grundzustand, keine Tokens",          mkSetup(), mkDyn(RIDES), [],   false, null, "", U],
  ["Laedt… (Supabase, tokens=null)",      mkSetup(), mkDyn(RIDES), null, false, null, "", U],
  ["Tokenliste gefuellt",                 mkSetup(), mkDyn(RIDES), TOKS, false, null, "", U],
  ["Vorschlaege leer (keine Fahrten)",    mkSetup(), mkDyn([]),    [],   false, null, "", U],
  ["Vorschlag schon vergeben -> raus",    mkSetup(), mkDyn(RIDES), TOKS, false, null, "", U],
  ["Nummer gespeichert",                  mkSetup(), mkDyn(RIDES), TOKS, true,  null, "", U],
  ["Kopiert-Bestaetigung",                mkSetup(), mkDyn(RIDES), TOKS, false, TOKS[0].token, "", U],
  ["Ladefehler (tokens=[] + saveError)",  mkSetup(), mkDyn(RIDES), [],   false, null, "Gast-Links konnten nicht geladen werden. Bitte Seite neu laden.", U],
  ["Speicherfehler bei gefuellter Liste", mkSetup(), mkDyn(RIDES), TOKS, false, null, "Speichern fehlgeschlagen, bitte nochmal versuchen. (Details in der Browser-Konsole)", U],
  ["coordPhone kaputt -> Warnung",        mkSetup(), mkDyn(RIDES), TOKS, false, null, "", "keine Nummer"],
  ["coordPhone leer -> keine Warnung",    mkSetup(), mkDyn(RIDES), TOKS, false, null, "", ""],
  ["Warnung + Fehler gleichzeitig",       mkSetup(), mkDyn(RIDES), TOKS, false, null, "Speichern fehlgeschlagen.", "abc"],
  ["Warnung + gespeichert + kopiert",     mkSetup(), mkDyn(RIDES), TOKS, true,  TOKS[1].token, "", "0170/12 34"],
  ["alles gleichzeitig",                  mkSetup(), mkDyn(RIDES), TOKS, true,  TOKS[0].token, "Speichern fehlgeschlagen.", "kaputt"],
  ["ohne onPreviewGuest (optional)",      mkSetup(), mkDyn(RIDES), TOKS, false, null, "", U],
  ["viele Vorschlaege (>12 -> Cap)",      mkSetup(), mkDyn(Array.from({ length: 20 }, (_, i) => ({ id: "x" + i, djName: "Artist " + i, status: "planned" }))), [], false, null, "", U],
];

// (?<![-a-z]) schuetzt vor dem Fehlalarm: "var(--mc-font-mono)" enthaelt die
// Zeichenkette "font-mono", ist aber genau der MC-Ersatz, nicht der Classic-Rest.
const CLASSIC = /(stone-\d|orange-\d|emerald-\d|red-\d|sky-\d|amber-\d|bg-white\/|border-white\/|(?<![-a-z])font-mono)/g;
let bad = 0;
for (const [name, setup, dyn, tokens, savedPhone, copiedTok, saveErr, phone] of faelle) {
  globalThis.__TOKENS__ = tokens; globalThis.__SAVEDPHONE__ = savedPhone;
  globalThis.__COPIED__ = copiedTok; globalThis.__SAVEERR__ = saveErr;
  globalThis.__PHONE__ = phone;
  const props = { setup, dyn, updateSetup: upd };
  if (name !== "ohne onPreviewGuest (optional)") props.onPreviewGuest = () => {};
  let html;
  try {
    html = renderToStaticMarkup(React.createElement(M.GuestLinksSection, props));
  } catch (e) { console.log(`CRASH  ${name} -> ${e.message}`); bad++; continue; }
  const mc = (html.match(/mc-[a-z-]+|--mc-[a-z-]+/g) || []).length;
  const reste = [...new Set(html.match(CLASSIC) || [])];
  if (reste.length) bad++;
  console.log(`${reste.length ? "FEHLER" : "OK    "} ${name.padEnd(38)} ${String(html.length).padStart(5)} Z | MC: ${String(mc).padStart(3)} | Classic-Reste: ${reste.length}${reste.length ? " -> " + reste.join(",") : ""}`);
}
console.log(`\n${faelle.length} Zustaende, ${bad} Fehler`);
process.exit(bad ? 1 : 0);
