// Laufzeit-Smoke-Test fuer ChatPanel (Session 27b-2).
//
// TOGGLE-FALLE: ChatPanel startet mit open=false, gerendert wird dann NUR der
// runde Knopf. Das ganze Panel (Kopf, Blasen, Aktions-Knoepfe, Eingabe) haengt
// hinter dem Toggle und wuerde in einem normalen Render-Test GAR NICHT laufen.
// Deshalb baut dieses Skript eine WEGWERF-KOPIE, in der nur fuer ChatPanel
// useState(false) -> useState(true) und die leere Nachrichtenliste durch echte
// Nachrichten mit allen vier resolved-Zustaenden ersetzt wird. Das Original
// wird nicht angefasst.
import fs from "fs"; import { execSync } from "child_process";
import React from "react"; import { renderToStaticMarkup } from "react-dom/server";

const src = fs.readFileSync(process.argv[2], "utf8");
const a = src.indexOf("function ChatPanel(");
const b = src.indexOf("\n  );\n}\n", a) + 8;
let cp = src.slice(a, b);
const before = cp;
cp = cp.replace('const [open, setOpen] = useState(false);', 'const [open, setOpen] = useState(true);');
cp = cp.replace('const [messages, setMessages] = useState([]);',
  'const [messages, setMessages] = useState(globalThis.__SEED__ || []);');
cp = cp.replace('const [busy, setBusy] = useState(false);', 'const [busy, setBusy] = useState(globalThis.__BUSY__ || false);');
cp = cp.replace('const [err, setErr] = useState("");', 'const [err, setErr] = useState(globalThis.__ERR__ || "");');
if (cp === before) { console.error("PATCH GESCHEITERT"); process.exit(1); }

const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/sm27b-" + tag + ".jsx";
fs.writeFileSync(copy, src.slice(0, a) + cp + src.slice(b) + "\nexport { ChatPanel };\n");
const out = "/home/claude/repo/.sm27b-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`, { stdio: "pipe" });
const { ChatPanel } = await import(out);

const setup = { drivers: [{ id: "1", firstName: "Finn", lastName: "B" }], locations: [], config: {} };
const dyn = { rides: [], rev: 1 };
const CLASSIC = /(stone-\d|orange-\d|emerald-\d|red-\d|bg-white\/|border-white\/)/g;

const faelle = [
  ["FAB + Panel offen, leer", [], false, ""],
  ["mit Vorschlag (offen)", [
    { role: "user", text: "Wer ist frei?" },
    { role: "assistant", text: "Finn ist frei.", action: { summary: "Finn die 14-Uhr-Fahrt zuteilen" }, resolved: false },
  ], false, ""],
  ["Vorschlag: speichert", [{ role: "assistant", text: "x", action: { summary: "s" }, resolved: "saving" }], false, ""],
  ["Vorschlag: uebernommen", [{ role: "assistant", text: "x", action: { summary: "s" }, resolved: "done" }], false, ""],
  ["Vorschlag: verworfen", [{ role: "assistant", text: "x", action: { summary: "s" }, resolved: "dismissed" }], false, ""],
  ["Vorschlag: Fehler", [{ role: "assistant", text: "x", action: { summary: "s" }, resolved: "error", resolveError: "kein Netz" }], false, ""],
  ["denkt nach + Fehlertext", [], true, "Chat-Assistent gerade nicht erreichbar"],
];

let bad = 0;
for (const [name, seed, busy, err] of faelle) {
  globalThis.__SEED__ = seed; globalThis.__BUSY__ = busy; globalThis.__ERR__ = err;
  const html = renderToStaticMarkup(React.createElement(ChatPanel, {
    setup, dyn, day: "2026-07-24", updateDyn: async () => ({ ok: true }), by: "dispo:1", liftOffset: "var(--mc-fab-lift)",
  }));
  const mc = (html.match(/mc-[a-z-]+|--mc-[a-z-]+/g) || []).length;
  const reste = html.match(CLASSIC) || [];
  if (reste.length) bad++;
  console.log(`${reste.length ? "FEHLER" : "OK    "} ${name.padEnd(24)} ${String(html.length).padStart(5)} Zeichen | MC-Treffer: ${String(mc).padStart(3)} | Classic-Reste: ${reste.length}${reste.length ? " -> " + [...new Set(reste)].join(",") : ""}`);
}
fs.unlinkSync(out); fs.unlinkSync(copy);
process.exit(bad ? 1 : 0);
