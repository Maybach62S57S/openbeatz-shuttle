// Smoke: ueberlappende Fahrten desselben Fahrers werden in getrennte, gestauchte
// Sub-Lanes gelegt (Variante C, feste Zeilenhoehe 64px). Prueft:
//  (1)+(2) beide ueberlappenden Fahrten gerendert (beide sichtbar),
//  (3)+(4) je Fahrt beide Knoepfe ("Fahrer aendern" + "Fahrt bearbeiten") vorhanden,
//          also mindestens 2x -> beide Kacheln bleiben anklickbar,
//  (5) die beiden Kacheln haben unterschiedliche top-Werte (getrennte Lanes, keine Verdeckung),
//  (6) Normalfall (Einzelfahrt anderer Fahrer) unveraendert: top 6px / height 52px,
//  (7) Pflicht-Gegenprobe: mit auf Lane 0 verbogenem timelineLanes fallen beide top gleich
//      -> die Trennungs-Pruefung (5) kippt, beweist dass sie wirklich misst,
//  (8) GP-Kontrolle: die Mutation ist wirklich angekommen (beide top == 6px).

import fs from "fs";
import { execSync } from "child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const srcFile = process.argv[2];
if (!srcFile) { console.log("Aufruf: node smoke-timeline-sublane-overlap.mjs src/ShuttleLeitstelle.jsx"); process.exit(1); }
const tag = Math.random().toString(36).slice(2);

if (typeof globalThis.window === "undefined") globalThis.window = { innerWidth: 1200, innerHeight: 800 };
if (typeof globalThis.document === "undefined") globalThis.document = { elementFromPoint: () => null };

const setup = {
  drivers: [
    { id: "d1", firstName: "Mustafa", lastName: "Uenver", vehicleType: "Van", seats: 7 },
    { id: "d2", firstName: "David", lastName: "Schneider", vehicleType: "Car", seats: 4 },
  ],
  locations: [
    { id: "airport", short: "APT", name: "Airport" },
    { id: "festival", short: "FEST", name: "Festival" },
  ],
  config: { baseLocationId: "festival" },
};
const day = "2026-07-25";
// r1 und r2 gehoeren beide d1 und ueberschneiden sich (18:00-19:00 vs 18:30-19:30).
// r3 gehoert d2 und ueberschneidet sich mit nichts -> Einzel-Lane (Normalfall).
const rides = [
  { id: "r1", dayKey: day, time: "18:00", djName: "Timmy Trumpet", fromId: "airport", toId: "festival", status: "accepted", assignedDriverId: "d1", passengerCount: 5, estDurationMin: 60, issues: [], statusHistory: [], log: [] },
  { id: "r2", dayKey: day, time: "18:30", djName: "Da Tweekaz", fromId: "festival", toId: "airport", status: "accepted", assignedDriverId: "d1", passengerCount: 3, estDurationMin: 60, issues: [], statusHistory: [], log: [] },
  { id: "r3", dayKey: day, time: "20:00", djName: "Solo Act", fromId: "airport", toId: "festival", status: "accepted", assignedDriverId: "d2", passengerCount: 2, estDurationMin: 60, issues: [], statusHistory: [], log: [] },
];
const dyn = { rides, driverState: {}, messages: [], rev: 1 };

function buildModule(source, suffix) {
  const copy = "/tmp/smk-sl-" + tag + "-" + suffix + ".jsx";
  fs.writeFileSync(copy, source + "\nexport { MissionTimelinePage };\n");
  const out = "/home/claude/repo/.smk-sl-" + tag + "-" + suffix + ".mjs";
  execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
  return out;
}
function renderTL(out) {
  return import(out + "?" + Math.random()).then((mod) =>
    renderToStaticMarkup(React.createElement(mod.MissionTimelinePage, {
      setup, dyn, day,
      onEdit: () => {}, onAssign: () => {}, updateDyn: async () => ({ ok: true }),
      by: "dispo:x", onUndo: () => {}, onErr: () => {},
    }))
  );
}

// Letzter inline-Style-Wert (z.B. top / height) VOR dem Vorkommen des Namens.
// Die Kachel rendert style="...;top:6px;height:52px;..." vor dem djName-Text.
function styleValBefore(markup, name, key) {
  // Auf den inneren Kacheltext ">Name" ankern, nicht auf das title-Attribut
  // (dort steht der djName ebenfalls, aber VOR dem style -> falscher Block).
  const idx = markup.indexOf(">" + name);
  if (idx < 0) return null;
  const before = markup.slice(0, idx);
  const m = [...before.matchAll(new RegExp(key + ":([\\d.]+)px", "g"))];
  return m.length ? m[m.length - 1][1] : null;
}
const countOcc = (h, needle) => h.split(needle).length - 1;

const checks = [];
const pruef = (name, ok, hint) => checks.push({ name, ok, hint });

// --- Aktueller Stand ---
const src = fs.readFileSync(srcFile, "utf8");
const outNeu = buildModule(src, "neu");
let hNeu;
try { hNeu = await renderTL(outNeu); }
catch (e) { console.log("FEHLER Render (neu): " + e.message); process.exit(1); }

pruef("neu: erste ueberlappende Fahrt (Timmy Trumpet) sichtbar", hNeu.includes("Timmy Trumpet"));
pruef("neu: zweite ueberlappende Fahrt (Da Tweekaz) sichtbar", hNeu.includes("Da Tweekaz"));
pruef("neu: 'Fahrer aendern' mind. 2x (beide Kacheln haben den Knopf)", countOcc(hNeu, 'title="Fahrer ändern"') >= 2);
pruef("neu: 'Fahrt bearbeiten' mind. 2x (beide Kacheln haben den Stift)", countOcc(hNeu, 'title="Fahrt bearbeiten"') >= 2);

const topA = styleValBefore(hNeu, "Timmy Trumpet", "top");
const topB = styleValBefore(hNeu, "Da Tweekaz", "top");
pruef("neu: beide ueberlappenden Kacheln haben top-Wert", topA != null && topB != null, `topA=${topA} topB=${topB}`);
pruef("neu: getrennte Sub-Lanes (top unterschiedlich) -> keine Verdeckung", topA != null && topB != null && topA !== topB, `topA=${topA} topB=${topB}`);

const topSolo = styleValBefore(hNeu, "Solo Act", "top");
const hSolo = styleValBefore(hNeu, "Solo Act", "height");
pruef("neu: Normalfall (Einzelfahrt) unveraendert top=6px", topSolo === "6", `top=${topSolo}`);
pruef("neu: Normalfall (Einzelfahrt) unveraendert height=52px", hSolo === "52", `height=${hSolo}`);

// --- Pflicht-Gegenprobe: timelineLanes so verbiegen, dass alles Lane 0 / count 1 wird ---
let mut = src;
const c1 = mut.includes("laneOf[r.id] = placed;");
const c2 = mut.includes("return { laneOf, count: Math.max(1, laneEnd.length) };");
mut = mut.replace("laneOf[r.id] = placed;", "laneOf[r.id] = 0;");
mut = mut.replace("return { laneOf, count: Math.max(1, laneEnd.length) };", "return { laneOf, count: 1 };");
pruef("GP-Setup: beide Mutationsanker im Quelltext gefunden", c1 && c2);

const outMut = buildModule(mut, "mut");
let hMut;
try { hMut = await renderTL(outMut); }
catch (e) { console.log("FEHLER Render (mut): " + e.message); process.exit(1); }

const mTopA = styleValBefore(hMut, "Timmy Trumpet", "top");
const mTopB = styleValBefore(hMut, "Da Tweekaz", "top");
pruef("GP: mit Lane-0-Mutation liegen beide Kacheln gleich (Trennung kippt)", mTopA != null && mTopA === mTopB, `mTopA=${mTopA} mTopB=${mTopB}`);
pruef("GP-Kontrolle: Mutation wirkte, beide top == 6px (voll gestapelt wie vorher)", mTopA === "6" && mTopB === "6", `mTopA=${mTopA} mTopB=${mTopB}`);

// --- Ausgabe ---
let bad = 0;
for (const c of checks) {
  console.log((c.ok ? "OK    " : "FAIL  ") + c.name + (c.ok ? "" : "  -- " + (c.hint || "")));
  if (!c.ok) bad++;
}
console.log("");
console.log(bad === 0 ? "SUBLANE-OVERLAP-SMOKE OK (" + checks.length + " Pruefungen, inkl. 2 Gegenproben)" : "SMOKE FAIL: " + bad + " von " + checks.length);

for (const f of fs.readdirSync("/home/claude/repo")) {
  if (f.startsWith(".smk-sl-" + tag)) fs.unlinkSync("/home/claude/repo/" + f);
}
process.exit(bad === 0 ? 0 : 1);
