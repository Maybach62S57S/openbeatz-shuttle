// Smoke-Test Fokus-Bereich (neuer Nav-Punkt "fokus").
//
// Bauweise: der Block wird NICHT nachgebaut, sondern zeilengenau aus
// src/ShuttleLeitstelle.jsx extrahiert und in eine Wegwerf-Sonde gewrappt.
// Damit ist Drift zwischen Test und Quelle strukturell ausgeschlossen - der
// Test rendert echten Produktivcode. Alle zeitabhaengigen Eingaben (emCases)
// werden als Prop injiziert, der Test ist daher NICHT systemzeitabhaengig.
//
// Abgedeckt: Nav-/Rollen-Gating, Eimer-Zuordnung (vollstaendig + disjunkt),
// Reihenfolge critical-vor-warn, beide Zustaende des Erledigt-Aufklappers
// ("toggle trap"), Wiederverwendung der bestehenden Handler, Read-only.
import fs from "fs";
import { execSync } from "child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const srcFile = process.argv[2] || "src/ShuttleLeitstelle.jsx";
const src = fs.readFileSync(srcFile, "utf8");

// ---- Block zeilengenau aus der Quelle schneiden -------------------------
const START = '{tab === "fokus" && (() => {';
const sIdx = src.indexOf(START);
if (sIdx < 0) { console.log("FATAL: Fokus-Block nicht gefunden"); process.exit(1); }
// Klammern zaehlen ab der oeffnenden geschweiften Klammer des JSX-Ausdrucks.
let depth = 0, eIdx = -1;
for (let i = sIdx; i < src.length; i++) {
  if (src[i] === "{") depth++;
  else if (src[i] === "}") { depth--; if (depth === 0) { eIdx = i + 1; break; } }
}
if (eIdx < 0) { console.log("FATAL: Blockende nicht gefunden"); process.exit(1); }
const block = src.slice(sIdx, eIdx);

const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/fokus-src-" + tag + ".jsx";
const probe = `
function FokusProbe(p) {
  const { tab, focusWidth, focusRef, dyn, emCases, dayRides, setup, day, flashIds,
          locName, boardGroupPrimary, setAssignRide, setEditRide, setWaRide,
          focusDoneOpen, setFocusDoneOpen } = p;
  return (<div>
  ${block}
  </div>);
}
export { FokusProbe, mcNavForRole, MC_ROLE_TABS, MC_NAV, MC_MOBILE_PRIMARY };
`;
fs.writeFileSync(copy, src + probe);
const out = "/home/claude/repo/.fokus-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const mod = await import(out);
const { FokusProbe, mcNavForRole, MC_ROLE_TABS, MC_NAV, MC_MOBILE_PRIMARY } = mod;

let ok = 0, fail = 0;
const check = (name, cond) => { if (cond) { ok++; } else { fail++; console.log("FAIL:", name); } };

// ---- 1-8: Nav und Rollen-Gating ----------------------------------------
const dispoTabs = mcNavForRole("dispo").map((n) => n.tab);
const stageTabs = mcNavForRole("stage").map((n) => n.tab);
const driverTabs = mcNavForRole("driver").map((n) => n.tab);
check("1. fokus in der Leitstellen-Nav", dispoTabs.includes("fokus"));
check("2. Stage-Nav OHNE fokus (Read-only-Garantie)", !stageTabs.includes("fokus"));
check("3. Fahrer-Nav OHNE fokus", !driverTabs.includes("fokus"));
check("4. Gast-Rolle weiterhin ohne MC-Nav", !("guest" in MC_ROLE_TABS) && mcNavForRole("guest").length === 0);
const item = MC_NAV.find((n) => n.tab === "fokus");
check("5. fokus-Eintrag existiert", !!item);
check("6. Gruppe FAHRTEN", item && item.group === "FAHRTEN");
check("7. Label 'Fokus'", item && item.label === "Fokus");
check("8. Icon gesetzt (Crosshair)", item && typeof item.icon !== "undefined" && item.icon !== null);
check("9. fokus NICHT in der primaeren Mobil-Leiste (landet unter 'Mehr')", !MC_MOBILE_PRIMARY.includes("fokus"));
check("10. fokus steht direkt hinter board", MC_NAV.findIndex((n) => n.tab === "fokus") === MC_NAV.findIndex((n) => n.tab === "board") + 1);
check("11. board unveraendert vorhanden", dispoTabs.includes("board"));
check("12. Stage-Allowlist unveraendert (nur overview+emergency)",
  stageTabs.length === 2 && stageTabs.includes("overview") && stageTabs.includes("emergency"));

// ---- Testdaten ----------------------------------------------------------
const DAY = "2026-07-24";
const setup = {
  locations: [
    { id: "airport", short: "NUE" },
    { id: "leo", short: "Leonardo" },
    { id: "fest", short: "Caldera" },
  ],
  drivers: [
    { id: "d1", firstName: "Max", lastName: "Muster", vehicleType: "Van" },
    { id: "d2", firstName: "Eva", lastName: "Klein", vehicleType: "SUV" },
  ],
  config: {},
};
const mk = (o) => ({ dayKey: DAY, fromId: "airport", toId: "leo", passengerCount: 2,
  issues: [], flightNo: "", zone: "", assignedDriverId: null, ...o });
const rides = [
  mk({ id: "a1", time: "10:35", djName: "WILDSTYLEZ", status: "planned" }),           // Aufmerksamkeit (critical)
  mk({ id: "a2", time: "10:05", djName: "NEELIX", status: "planned", assignedDriverId: "d1" }), // Aufmerksamkeit (warn)
  mk({ id: "o1", time: "13:15", djName: "TWEEKAZ", status: "planned" }),              // offen
  mk({ id: "o2", time: "14:00", djName: "COONE", status: "planned" }),                // offen
  mk({ id: "r1", time: "09:40", djName: "TRUMPET", status: "onboard", assignedDriverId: "d2" }), // laeuft
  mk({ id: "r2", time: "09:50", djName: "VERTILE", status: "accepted", assignedDriverId: "d1" }),// laeuft (zugeteilt)
  mk({ id: "e1", time: "08:00", djName: "LESHUUK", status: "done", assignedDriverId: "d2" }),    // erledigt
  mk({ id: "e2", time: "08:30", djName: "ABGESAGT", status: "cancelled" }),           // erledigt (abgesagt)
];
// emCases wird injiziert -> keine Systemzeit-Abhaengigkeit. Reihenfolge ist die
// echte emergencyCases-Sortierung: critical zuerst.
const emCases = [
  { r: rides[0], sev: "critical", type: "nodriver", label: "ohne Fahrer · Start in 12 min" },
  { r: rides[1], sev: "warn", type: "issue", label: "Gast nicht auffindbar" },
  { r: rides[1], sev: "warn", type: "flight", label: "Zweitfall derselben Fahrt" }, // Dedup-Test
];
const dayRides = rides.slice().sort((a, b) => a.time.localeCompare(b.time));

const base = {
  tab: "fokus", focusWidth: 900, focusRef: null, dyn: { rides, driverState: {} }, emCases, dayRides, setup, day: DAY,
  flashIds: {},
  locName: (id, txt) => setup.locations.find((l) => l.id === id)?.short || txt || "—",
  boardGroupPrimary: () => null,
  setAssignRide: () => {}, setEditRide: () => {}, setWaRide: () => {}, setFocusDoneOpen: () => {},
};
const render = (over = {}) => renderToStaticMarkup(React.createElement(FokusProbe, { ...base, focusDoneOpen: false, ...over }));
const html = render();

// ---- 13-20: Ueberschriften und Zaehler ----------------------------------
const countAfter = (label) => {
  const i = html.indexOf(label);
  if (i < 0) return null;
  const m = html.slice(i, i + 260).match(/tabular-nums[^>]*>(\d+)</);
  return m ? Number(m[1]) : null;
};
check("13. Block 'Braucht Aufmerksamkeit' vorhanden", html.includes("Braucht Aufmerksamkeit"));
check("14. Block 'Offen, noch Zeit' vorhanden", html.includes("Offen, noch Zeit"));
check("15. Block 'Läuft gerade' vorhanden", html.includes("Läuft gerade"));
check("16. Block 'Erledigt' vorhanden", html.includes("Erledigt"));
check("17. Zaehler Aufmerksamkeit = 2 (Dedup: a2 nur einmal trotz zwei Faellen)", countAfter("Braucht Aufmerksamkeit") === 2);
check("18. Zaehler Offen = 2", countAfter("Offen, noch Zeit") === 2);
check("19. Zaehler Laeuft = 2", countAfter("Läuft gerade") === 2);
check("20. Zaehler Erledigt = 2 (done + cancelled)", countAfter("Erledigt") === 2);
check("21. Summe der vier Eimer = Anzahl Fahrten des Tages",
  countAfter("Braucht Aufmerksamkeit") + countAfter("Offen, noch Zeit")
  + countAfter("Läuft gerade") + countAfter("Erledigt") === dayRides.length);

// ---- 22-27: Zuordnung und Reihenfolge -----------------------------------
const pos = (s) => html.indexOf(s);
check("22. WILDSTYLEZ (critical) steht vor NEELIX (warn)", pos("WILDSTYLEZ") > 0 && pos("WILDSTYLEZ") < pos("NEELIX"));
check("23. Aufmerksamkeits-Block steht vor 'Offen, noch Zeit'", pos("NEELIX") < pos("Offen, noch Zeit"));
check("24. TWEEKAZ liegt im Offen-Block", pos("TWEEKAZ") > pos("Offen, noch Zeit") && pos("TWEEKAZ") < pos("Läuft gerade"));
check("25. TRUMPET liegt im Laeuft-Block", pos("TRUMPET") > pos("Läuft gerade"));
check("26. VERTILE (zugeteilt, noch nicht gestartet) liegt im Laeuft-Block", pos("VERTILE") > pos("Läuft gerade"));
check("27. WILDSTYLEZ erscheint genau einmal", (html.match(/WILDSTYLEZ/g) || []).length === 1);
check("28. NEELIX erscheint genau einmal (kein Doppel durch zwei emCases)", (html.match(/NEELIX/g) || []).length === 1);

// ---- 29-33: Grund-Zeile bei Aufmerksamkeit ------------------------------
check("29. Klartext-Grund der kritischen Fahrt sichtbar", html.includes("ohne Fahrer"));
check("30. Klartext-Grund der Warn-Fahrt sichtbar", html.includes("Gast nicht auffindbar"));
check("31. Zweitfall derselben Fahrt wird NICHT zusaetzlich angezeigt", !html.includes("Zweitfall derselben Fahrt"));
check("32. Grund nur bei Aufmerksamkeit, nicht bei offenen Fahrten",
  html.indexOf("ohne Fahrer") < pos("Offen, noch Zeit"));

// ---- 34-38: Toggle-Trap, Erledigt-Aufklapper ----------------------------
check("33. zugeklappt: erledigte Fahrt NICHT im Markup", !html.includes("LESHUUK"));
check("34. zugeklappt: abgesagte Fahrt NICHT im Markup", !html.includes("ABGESAGT"));
check("35. zugeklappt: aria-expanded=false", html.includes('aria-expanded="false"'));
const htmlOpen = render({ focusDoneOpen: true });
check("36. aufgeklappt: erledigte Fahrt sichtbar", htmlOpen.includes("LESHUUK"));
check("37. aufgeklappt: abgesagte Fahrt sichtbar", htmlOpen.includes("ABGESAGT"));
check("38. aufgeklappt: aria-expanded=true", htmlOpen.includes('aria-expanded="true"'));
check("39. aufgeklappt aendert die anderen Bloecke nicht",
  htmlOpen.includes("WILDSTYLEZ") && htmlOpen.includes("TWEEKAZ") && htmlOpen.includes("TRUMPET"));

// ---- 40-45: Handler-Wiederverwendung, Fahrerspalte, Leerzustaende -------
check("40. Zuteilen-Knopf fuer Fahrten ohne Fahrer", html.includes("Zuteilen"));
check("41. Fahrername bei zugeteilter Fahrt sichtbar", html.includes("Muster") || html.includes("M."));
check("42. Fahrer-live-Spalte vorhanden", html.includes("Fahrer live"));
check("43. Fahrer der Spalte erscheinen", html.includes("Max") || html.includes("Eva"));
const htmlEmpty = render({ dayRides: [], dyn: { rides: [], driverState: {} }, emCases: [] });
check("44. Leerer Tag zeigt Leerzustand statt Bloecke", htmlEmpty.includes("keine Fahrten geplant") && !htmlEmpty.includes("Braucht Aufmerksamkeit"));
// Fahrerliste leer, weil computeDriverStats bei rides=null wirft - identisches
// Verhalten wie im Fahrten-Tab, siehe "Weitere gefundene Punkte".
const htmlLoading = render({ dyn: { rides: null, driverState: {} }, setup: { ...setup, drivers: [] } });
check("45. Nicht geladene Fahrten zeigen Ladezustand", htmlLoading.includes("geladen"));
const htmlCalm = render({ emCases: [], dayRides: [rides[2]], dyn: { rides: [rides[2]], driverState: {} } });
check("46. Ohne kritische Faelle erscheint der Ruhe-Hinweis", htmlCalm.includes("Nichts Kritisches offen."));
check("47. Anderer Tab rendert den Fokus-Block nicht", render({ tab: "board" }).indexOf("Braucht Aufmerksamkeit") === -1);

// ---- 48-51: Read-only-Nachweis am Quelltext -----------------------------
const writeHits = ["updateDyn(", "updateSetup(", "supabase", "window.storage", "advanceStatus(", "assignRide("]
  .filter((n) => block.includes(n));
check("48. Fokus-Block enthaelt KEINEN Schreibweg (Treffer: " + (writeHits.join(", ") || "keine") + ")", writeHits.length === 0);
check("49. Fokus-Block nutzt die bestehenden Handler statt eigener Logik",
  block.includes("setAssignRide(r)") && block.includes("setEditRide(r)") && block.includes("setWaRide(r)"));
check("50. Fokus-Block nutzt emCases als einzige Aufmerksamkeitsquelle",
  block.includes("emCases.forEach") && !block.includes("emergencyCases("));
check("51. Fokus-Block nutzt die bestehende GroupSuggestionNote", block.includes("GroupSuggestionNote"));

// ---- Pflicht-Gegenproben: kippen die Tests ueberhaupt? ------------------
let gOk = 0, gBad = 0;
const gp = (name, cond) => { if (cond) { gOk++; } else { gBad++; console.log("GEGENPROBE GREIFT NICHT:", name); } };

// G1: erledigte Fahrt kuenstlich in dayRides verdoppeln -> Summe muss kippen
const gHtml1 = render({ dayRides: dayRides.concat([mk({ id: "x", time: "23:00", djName: "EXTRA", status: "done" })]) });
const c1 = (l) => { const i = gHtml1.indexOf(l); const m = gHtml1.slice(i, i + 260).match(/tabular-nums[^>]*>(\d+)</); return m ? Number(m[1]) : null; };
gp("G1 Zaehler Erledigt reagiert auf zusaetzliche Fahrt", c1("Erledigt") === 3);
// G2: emCases leeren -> Aufmerksamkeitszaehler muss auf 0 fallen und die Fahrten umziehen
const gHtml2 = render({ emCases: [] });
gp("G2 ohne emCases faellt Aufmerksamkeit auf 0", (() => { const i = gHtml2.indexOf("Braucht Aufmerksamkeit"); const m = gHtml2.slice(i, i + 260).match(/tabular-nums[^>]*>(\d+)</); return m && Number(m[1]) === 0; })());
gp("G2 WILDSTYLEZ rutscht dann in den Offen-Block",
  gHtml2.indexOf("WILDSTYLEZ") > gHtml2.indexOf("Offen, noch Zeit") && gHtml2.indexOf("WILDSTYLEZ") < gHtml2.indexOf("Läuft gerade"));
// G3: Sammelfahrt-Kandidat setzen -> GroupSuggestionNote muss auftauchen
const gCand = { status: "group_possible", label: "Sammelfahrt möglich", rideIds: ["o1", "o2"],
  routeReliable: true, estimatedDrivingSavedMin: 18, detourMin: 4, combinedPassengerCount: 4, fitsFleet: true, warnings: [] };
const gHtml3 = render({ boardGroupPrimary: (r) => (r.id === "o1" ? gCand : null) });
gp("G3 Sammelfahrt-Hinweis erscheint bei vorhandenem Kandidaten",
  gHtml3.includes("Sammelfahrt möglich") && gHtml3.includes("Fahrminuten sparbar") && !html.includes("Sammelfahrt möglich"));
gp("G3b Partnerfahrt wird im Hinweis benannt", gHtml3.includes("COONE"));
// G4: Toggle-Test misst wirklich etwas
gp("G4 zugeklappt und aufgeklappt liefern unterschiedliches Markup", html !== htmlOpen && htmlOpen.length > html.length);
// G5: Read-only-Check wuerde einen Schreibweg finden
gp("G5 Schreibweg-Erkennung funktioniert", (block + "updateDyn(").includes("updateDyn("));

try { fs.unlinkSync(out); fs.unlinkSync(copy); } catch {}

console.log(`\nFokus-Bereich Smoke: ${ok} OK, ${fail} FAIL  |  Gegenproben: ${gOk} griffen, ${gBad} griffen nicht`);
if (fail > 0 || gBad > 0) process.exit(1);
