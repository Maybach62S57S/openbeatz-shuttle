// Smoke: Artist-Suchfeld im "all"-Tab (Uebersicht) der DriverApp.
// Prueft echten Render-Pfad: activeTab="all" + allSearch=<wert> via globalThis-Seed.
// (1) leeres Feld -> alle Fahrten, (2) Treffer filtert korrekt (case-insensitiv, Teilstring, trim),
// (3) kein Treffer -> "Keine Treffer.", (4) leerer Tag -> "Keine Fahrten fuer diesen Tag.",
// (5) Suchfeld immer sichtbar. Pflicht-Gegenproben: Filter ausgehebelt bzw. toLowerCase entfernt -> kippt.

import fs from "fs";
import { execSync } from "child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const srcFile = process.argv[2];
const tag = Math.random().toString(36).slice(2);

const setup = {
  drivers: [
    { id: "d1", firstName: "Mustafa", lastName: "Uenver", vehicleType: "Car", seats: 4 },
    { id: "d2", firstName: "David", lastName: "Schneider", vehicleType: "Car", seats: 4 },
  ],
  locations: [
    { id: "airport", short: "APT", name: "Airport" },
    { id: "festival", short: "FEST", name: "Festival" },
  ],
  config: { baseLocationId: "festival" },
};
const day = "2026-07-25";
const rides = [
  { id: "r1", dayKey: day, time: "18:00", djName: "Timmy Trumpet", fromId: "airport", toId: "festival", status: "onboard", assignedDriverId: "d1", passengerCount: 5, estDurationMin: 60, issues: [], statusHistory: [], log: [] },
  { id: "r2", dayKey: day, time: "20:00", djName: "Da Tweekaz", fromId: "airport", toId: "festival", status: "enroute_pickup", assignedDriverId: "d2", passengerCount: 3, estDurationMin: 60, issues: [], statusHistory: [], log: [] },
  { id: "r3", dayKey: day, time: "22:00", djName: "Will Sparks", fromId: "airport", toId: "festival", status: "planned", assignedDriverId: null, passengerCount: 2, estDurationMin: 60, issues: [], statusHistory: [], log: [] },
];
const dyn = { rides, driverState: {}, messages: [], rev: 1 };
const session = { role: "driver", driverId: "d1" };

// Baut ein DriverApp-Modul, in dem activeTab + allSearch aus globalThis geseedet werden.
// mutate: optionale Funktion, die die Quelle zusaetzlich veraendert (fuer Gegenproben).
function buildModule(suffix, mutate) {
  let source = fs.readFileSync(srcFile, "utf8");
  source = source.replace(
    'const [activeTab, setActiveTab] = useState("mine");',
    'const [activeTab, setActiveTab] = useState(globalThis.__ACTIVE_TAB__ || "mine");'
  );
  source = source.replace(
    'const [allSearch, setAllSearch] = useState("");',
    'const [allSearch, setAllSearch] = useState(globalThis.__ALL_SEARCH__ || "");'
  );
  if (mutate) source = mutate(source);
  const copy = "/tmp/smk-suche-" + tag + "-" + suffix + ".jsx";
  fs.writeFileSync(copy, source + "\nexport { DriverApp };\n");
  const out = "/home/claude/repo/.smk-suche-" + tag + "-" + suffix + ".mjs";
  execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
  return out;
}

async function render(out, opts) {
  const mod = await import(out + "?" + Math.random());
  globalThis.__ACTIVE_TAB__ = "all";
  globalThis.__ALL_SEARCH__ = opts.search;
  return renderToStaticMarkup(React.createElement(mod.DriverApp, {
    setup: opts.setup || setup,
    dyn: opts.dyn || dyn,
    session, updateDyn: async () => ({ ok: true }), onLogout: () => {},
  }));
}

const checks = [];
const pruef = (name, ok, hint) => checks.push({ name, ok, hint });

// --- Korrekter Build ---
const outOk = buildModule("ok", null);

// (1) leeres Feld -> alle Fahrten
let h = await render(outOk, { search: "" });
pruef("leer: Timmy sichtbar", h.includes("Timmy Trumpet"));
pruef("leer: Tweekaz sichtbar", h.includes("Da Tweekaz"));
pruef("leer: Will Sparks sichtbar", h.includes("Will Sparks"));
pruef("leer: Suchfeld-Placeholder sichtbar", h.includes("Artist suchen"));

// (2a) Treffer "timmy" (lowercase) -> nur Timmy
h = await render(outOk, { search: "timmy" });
pruef("timmy: Timmy sichtbar", h.includes("Timmy Trumpet"));
pruef("timmy: Tweekaz NICHT sichtbar", !h.includes("Da Tweekaz"));
pruef("timmy: Will Sparks NICHT sichtbar", !h.includes("Will Sparks"));

// (2b) case-insensitiv: "TWEEKAZ"
h = await render(outOk, { search: "TWEEKAZ" });
pruef("TWEEKAZ: Tweekaz sichtbar (case-insensitiv)", h.includes("Da Tweekaz"));
pruef("TWEEKAZ: Timmy NICHT sichtbar", !h.includes("Timmy Trumpet"));

// (2c) Teilstring: "spark"
h = await render(outOk, { search: "spark" });
pruef("spark: Will Sparks sichtbar (Teilstring)", h.includes("Will Sparks"));
pruef("spark: Timmy NICHT sichtbar", !h.includes("Timmy Trumpet"));

// (2d) trim: "  timmy  "
h = await render(outOk, { search: "  timmy  " });
pruef("trim: Timmy sichtbar trotz Whitespace", h.includes("Timmy Trumpet"));

// (3) kein Treffer -> "Keine Treffer.", keine djNames
h = await render(outOk, { search: "xyz123" });
pruef("xyz123: 'Keine Treffer.' sichtbar", h.includes("Keine Treffer."));
pruef("xyz123: keine Fahrt sichtbar", !h.includes("Timmy Trumpet") && !h.includes("Da Tweekaz") && !h.includes("Will Sparks"));
pruef("xyz123: NICHT 'Keine Fahrten fuer diesen Tag.'", !h.includes("Keine Fahrten fuer diesen Tag."));

// (4) leerer Tag + leeres Feld -> "Keine Fahrten fuer diesen Tag." (nicht "Keine Treffer.")
h = await render(outOk, { search: "", dyn: { rides: [], driverState: {}, messages: [], rev: 1 } });
pruef("leerer Tag: 'Keine Fahrten fuer diesen Tag.' sichtbar", h.includes("Keine Fahrten fuer diesen Tag."));
pruef("leerer Tag: NICHT 'Keine Treffer.'", !h.includes("Keine Treffer."));

// --- Gegenprobe 1: Filter ausgehebelt (shown = all immer) ---
const outGp1 = buildModule("gp1", (s) => s.replace(
  'const shown = q ? all.filter((r) => (r.djName || "").toLowerCase().includes(q)) : all;',
  'const shown = all;'
));
h = await render(outGp1, { search: "timmy" });
const gp1_kippt = h.includes("Da Tweekaz"); // bei ausgehebeltem Filter faelschlich sichtbar
pruef("GP1: ausgehebelter Filter -> Tweekaz taucht bei 'timmy' auf (kippt)", gp1_kippt, "Gegenprobe misst nichts");

// --- Gegenprobe 2: toLowerCase auf djName entfernt ---
const outGp2 = buildModule("gp2", (s) => s.replace(
  '(r.djName || "").toLowerCase().includes(q)',
  '(r.djName || "").includes(q)'
));
h = await render(outGp2, { search: "tweekaz" });
const gp2_kippt = !h.includes("Da Tweekaz"); // ohne toLowerCase matcht "tweekaz" nicht auf "Da Tweekaz"
pruef("GP2: ohne toLowerCase -> 'tweekaz' matcht 'Da Tweekaz' nicht mehr (kippt)", gp2_kippt, "Gegenprobe misst nichts");

// --- Ausgabe ---
let bad = 0;
for (const c of checks) {
  console.log((c.ok ? "OK    " : "FAIL  ") + c.name + (c.ok ? "" : "  -- " + (c.hint || "")));
  if (!c.ok) bad++;
}
console.log("");
console.log(bad === 0 ? "SUCHE-SMOKE OK (" + checks.length + " Pruefungen, inkl. 2 Gegenproben)" : "SUCHE-SMOKE FAIL: " + bad + " von " + checks.length);

// Aufraeumen
for (const f of fs.readdirSync("/home/claude/repo")) {
  if (f.startsWith(".smk-suche-" + tag)) fs.unlinkSync("/home/claude/repo/" + f);
}
process.exit(bad === 0 ? 0 : 1);
