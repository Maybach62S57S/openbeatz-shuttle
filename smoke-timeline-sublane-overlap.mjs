// Smoke: Sub-Lanes NUR fuer tatsaechlich ueberlappende Fahrten (Variante C).
// Kernfall (Regression aus dem Live-Betrieb): eine allein stehende Fahrt in
// DERSELBEN Zeile wie eine Ueberlappung darf NICHT mitgestaucht werden, sie
// bleibt voll hoch. Nur die wirklich ueberlappenden Fahrten teilen sich die Hoehe.
// Prueft:
//  (1)-(3) alle drei Fahrten von d1 sichtbar (zwei ueberlappend + eine allein),
//  (4) beide Knoepfe je Kachel vorhanden (mind. 2x),
//  (5)+(6) die zwei ueberlappenden: getrennte top-Werte, je 25px hoch,
//  (7) die allein stehende Fahrt DERSELBEN Zeile: top 6px / height 52px (VOLL),
//  (8) Einzelfahrt in eigener Zeile: top 6px / height 52px,
//  (9) GP-A: laneOf auf 0 verbogen -> beide ueberlappenden top gleich (Trennung kippt),
//  (10) GP-B: Gruppen-Count auf fix 2 verbogen -> allein stehende Fahrt wird 25px
//       statt 52px (die "bleibt voll"-Pruefung kippt, beweist dass sie misst).

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
// d1: r1 + r2 ueberlappen (18:00-19:00 vs 18:30-19:30). r4 steht allein (22:00-23:00)
//     -> muss trotz der Ueberlappung frueher in derselben Zeile VOLL hoch bleiben.
// d2: r3 steht allein in eigener Zeile.
const rides = [
  { id: "r1", dayKey: day, time: "18:00", djName: "Timmy Trumpet", fromId: "airport", toId: "festival", status: "accepted", assignedDriverId: "d1", passengerCount: 5, estDurationMin: 60, issues: [], statusHistory: [], log: [] },
  { id: "r2", dayKey: day, time: "18:30", djName: "Da Tweekaz", fromId: "festival", toId: "airport", status: "accepted", assignedDriverId: "d1", passengerCount: 3, estDurationMin: 60, issues: [], statusHistory: [], log: [] },
  { id: "r4", dayKey: day, time: "22:00", djName: "Allein Fahrt", fromId: "airport", toId: "festival", status: "accepted", assignedDriverId: "d1", passengerCount: 2, estDurationMin: 60, issues: [], statusHistory: [], log: [] },
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
// Auf den inneren Kacheltext ">Name" ankern, nicht auf das title-Attribut
// (dort steht der djName ebenfalls, aber VOR dem style -> falscher Block).
function styleValBefore(markup, name, key) {
  const idx = markup.indexOf(">" + name);
  if (idx < 0) return null;
  const before = markup.slice(0, idx);
  const m = [...before.matchAll(new RegExp(key + ":([\\d.]+)px", "g"))];
  return m.length ? m[m.length - 1][1] : null;
}
const countOcc = (h, needle) => h.split(needle).length - 1;

const checks = [];
const pruef = (name, ok, hint) => checks.push({ name, ok, hint });

const src = fs.readFileSync(srcFile, "utf8");
const outNeu = buildModule(src, "neu");
let hNeu;
try { hNeu = await renderTL(outNeu); }
catch (e) { console.log("FEHLER Render (neu): " + e.message); process.exit(1); }

pruef("neu: ueberlappende Fahrt 1 (Timmy Trumpet) sichtbar", hNeu.includes("Timmy Trumpet"));
pruef("neu: ueberlappende Fahrt 2 (Da Tweekaz) sichtbar", hNeu.includes("Da Tweekaz"));
pruef("neu: allein stehende Fahrt derselben Zeile (Allein Fahrt) sichtbar", hNeu.includes("Allein Fahrt"));
pruef("neu: 'Fahrer aendern' mind. 2x (Kacheln haben den Knopf)", countOcc(hNeu, 'title="Fahrer ändern"') >= 2);
pruef("neu: 'Fahrt bearbeiten' mind. 2x (Kacheln haben den Stift)", countOcc(hNeu, 'title="Fahrt bearbeiten"') >= 2);

const topA = styleValBefore(hNeu, "Timmy Trumpet", "top");
const topB = styleValBefore(hNeu, "Da Tweekaz", "top");
const hA = styleValBefore(hNeu, "Timmy Trumpet", "height");
const hB = styleValBefore(hNeu, "Da Tweekaz", "height");
pruef("neu: ueberlappende getrennte Sub-Lanes (top unterschiedlich)", topA != null && topB != null && topA !== topB, `topA=${topA} topB=${topB}`);
pruef("neu: ueberlappende je gestaucht (height 25px)", hA === "25" && hB === "25", `hA=${hA} hB=${hB}`);

const topAllein = styleValBefore(hNeu, "Allein Fahrt", "top");
const hAllein = styleValBefore(hNeu, "Allein Fahrt", "height");
pruef("neu: KERNFALL allein stehende Fahrt bleibt VOLL (top 6px)", topAllein === "6", `top=${topAllein}`);
pruef("neu: KERNFALL allein stehende Fahrt bleibt VOLL (height 52px)", hAllein === "52", `height=${hAllein}`);

const topSolo = styleValBefore(hNeu, "Solo Act", "top");
const hSolo = styleValBefore(hNeu, "Solo Act", "height");
pruef("neu: Einzelfahrt eigene Zeile unveraendert (top 6 / height 52)", topSolo === "6" && hSolo === "52", `top=${topSolo} height=${hSolo}`);

// --- GP-A: laneOf auf 0 verbiegen -> alles Lane 0 -> ueberlappende top gleich ---
const gpA_ok = src.includes("laneOf[r.id] = placed;");
const mutA = src.replace("laneOf[r.id] = placed;", "laneOf[r.id] = 0;");
pruef("GP-A-Setup: Mutationsanker (laneOf placed) gefunden", gpA_ok);
const outA = buildModule(mutA, "gpa");
let hMutA;
try { hMutA = await renderTL(outA); }
catch (e) { console.log("FEHLER Render (gpa): " + e.message); process.exit(1); }
const aTopA = styleValBefore(hMutA, "Timmy Trumpet", "top");
const aTopB = styleValBefore(hMutA, "Da Tweekaz", "top");
pruef("GP-A: mit Lane-0-Mutation liegen die ueberlappenden gleich (Trennung kippt)", aTopA != null && aTopA === aTopB, `aTopA=${aTopA} aTopB=${aTopB}`);

// --- GP-B: Gruppen-Count fix auf 2 -> allein stehende Fahrt wird ebenfalls 25px ---
const gpB_ok = src.includes("const c = mx + 1;");
const mutB = src.replace("const c = mx + 1;", "const c = 2;");
pruef("GP-B-Setup: Mutationsanker (const c = mx + 1) gefunden", gpB_ok);
const outB = buildModule(mutB, "gpb");
let hMutB;
try { hMutB = await renderTL(outB); }
catch (e) { console.log("FEHLER Render (gpb): " + e.message); process.exit(1); }
const bHAllein = styleValBefore(hMutB, "Allein Fahrt", "height");
pruef("GP-B: mit fixem Gruppen-Count wird die allein stehende Fahrt 25px (bleibt-voll kippt)", bHAllein === "25", `height=${bHAllein}`);

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
