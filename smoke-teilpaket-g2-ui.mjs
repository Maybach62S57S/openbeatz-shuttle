// Teilpaket G2 - UI/Render/Read-only-Tests fuer die Anzeige der
// Rueckstellungs-Vorschlaege (rein praesentational, Logik von G1 unangetastet).
//
// Beweiskette:
//  (1) Fokus-Render des VERBATIM aus der Quelle angehaengten Badge-Ausdrucks mit
//      kontrolliertem repo.byDriver -> actionable-Status-Klassenzuordnung,
//      non-actionable/fehlend -> nichts, kein Alarmrot, keine Schaltflaeche.
//  (2) Integration: echte MissionReturnsTab mit idle-am-Festival-Fahrern (heute,
//      damit ein Fahrer aus einer beendeten Fahrt eine Position bekommt).
//      Precondition per computeDriverStats verifiziert. D/E/F-Eingaben VERBATIM
//      wie die Komponente rekonstruiert, Wiring per Bijektion (Badge sichtbar
//      <=> buildRepositionSuggestions liefert actionable). Read-only, kein Crash.
//  (3) Statische Analyse: einziger Einstieg buildRepositionSuggestions, kein
//      Schreibweg/Schaltflaeche im Badge, kein zweiter Timer, nur MC-Klassen,
//      Rollen-Gating (returns nur dispo), Anker des Quell-Ausdrucks vorhanden.
//  (4) Gegenproben: injizierter Schreibweg, entfernter actionable-Guard und eine
//      Classic-Farbklasse wuerden erkannt.
// Original unangetastet. Aufruf: node smoke-teilpaket-g2-ui.mjs [src]
import fs from "fs";
import { execSync } from "child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const srcFile = process.argv[2] || "src/ShuttleLeitstelle.jsx";
const rawSrc = fs.readFileSync(srcFile, "utf8");
const h = React.createElement;
const render = (el) => renderToStaticMarkup(el);

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log("OK   " + name); } else { fail++; console.log("FAIL " + name); } }
function eq(a, b, name) { ok(a === b, name + "  (war: " + JSON.stringify(a) + ")"); }

async function build(srcText, exportLine) {
  const tag = Math.random().toString(36).slice(2);
  const copy = "/tmp/g2ui-" + tag + ".jsx";
  const out = "/home/claude/repo/.g2ui-" + tag + ".mjs";
  fs.writeFileSync(copy, srcText + "\n" + exportLine + "\n");
  execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
  const mod = await import(out);
  fs.unlinkSync(out); fs.unlinkSync(copy);
  return mod;
}

// ---------------------------------------------------------------------------
// Verbatim-Badge-Ausdruck aus der Quelle. Wird an die Quelle angehaengt (damit
// REPOSITION_ACTIONABLE im Scope ist) und mit kontrolliertem repo gerendert.
// Der Ausdruck ist IDENTISCH zu dem in der atFestival-Zeile eingebauten (Anker-
// Pruefung in Teil 3 stellt das byte-genau sicher).
// ---------------------------------------------------------------------------
const PROBE = `
function __G2BadgeProbe({ repo, d }) {
  return (<div id="probe">{(() => { const g = repo.byDriver[d.id];
    return g && REPOSITION_ACTIONABLE.has(g.status)
      ? <span className={\`mc-badge text-[10px] shrink-0 \${g.status === "direct_to_next_pickup" ? "mc-badge--new" : "mc-badge--assigned"}\`} title={g.label}>{g.label}</span>
      : null; })()}</div>);
}
// Gegenprobe-Variante OHNE actionable-Guard, um zu beweisen, dass der Guard traegt.
function __G2BadgeProbeNoGuard({ repo, d }) {
  return (<div id="probe">{(() => { const g = repo.byDriver[d.id];
    return g ? <span className="mc-badge" title={g.label}>{g.label}</span> : null; })()}</div>);
}`;

const M = await build(rawSrc + PROBE,
  "export { __G2BadgeProbe, __G2BadgeProbeNoGuard, MissionReturnsTab, MC_ROLE_TABS, buildRepositionSuggestions, REPOSITION_ACTIONABLE, REPOSITION_STATUS_LABEL, computeDriverStats, dayNowMin, normalizeTimetableEntries, TIMETABLE_RAW, matchRideToTimetable, evaluateTimetableTiming, deriveReturnRideOperationalState, buildWaitRideCandidates, buildGroupRidePairCandidates, seedDrivers, seedLocations, seedMatrix, seedConfig };");
const {
  __G2BadgeProbe: Probe, __G2BadgeProbeNoGuard: ProbeNoGuard,
  MissionReturnsTab, MC_ROLE_TABS, buildRepositionSuggestions,
  REPOSITION_ACTIONABLE, REPOSITION_STATUS_LABEL, computeDriverStats, dayNowMin,
  normalizeTimetableEntries, TIMETABLE_RAW, matchRideToTimetable, evaluateTimetableTiming,
  deriveReturnRideOperationalState, buildWaitRideCandidates, buildGroupRidePairCandidates,
  seedDrivers, seedLocations, seedMatrix, seedConfig,
} = M;
const L = REPOSITION_STATUS_LABEL;

// ===========================================================================
// (1) Fokus-Render des Badge-Ausdrucks mit kontrolliertem repo
// ===========================================================================
const badgeFor = (status, label) => render(h(Probe, { d: { id: "x" }, repo: { byDriver: { x: { status, label } } } }));

const hDirect = badgeFor("direct_to_next_pickup", L.direct_to_next_pickup);
ok(hDirect.includes("mc-badge--new"), "1. direct_to_next_pickup -> mc-badge--new (Blau)");
ok(!hDirect.includes("mc-badge--assigned"), "2. direct_to_next_pickup NICHT amber");
ok(hDirect.includes(L.direct_to_next_pickup), "3. direct: Label wird angezeigt");
ok(hDirect.includes("mc-badge "), "4. direct: mc-badge-Grundklasse vorhanden");

const hFest = badgeFor("reposition_to_festival", L.reposition_to_festival);
ok(hFest.includes("mc-badge--assigned"), "5. reposition_to_festival -> mc-badge--assigned (Amber)");
ok(!hFest.includes("mc-badge--new"), "6. reposition_to_festival NICHT blau");
ok(hFest.includes(L.reposition_to_festival), "7. reposition_to_festival: Label angezeigt");

const hZone = badgeFor("reposition_to_demand_zone", L.reposition_to_demand_zone);
ok(hZone.includes("mc-badge--assigned"), "8. reposition_to_demand_zone -> mc-badge--assigned (actionable, amber)");

const hStay = badgeFor("stay_at_current_location", L.stay_at_current_location);
eq(hStay, '<div id="probe"></div>', "9. stay_at_current_location -> KEIN Badge (leer)");
const hNe = badgeFor("not_evaluable", L.not_evaluable);
eq(hNe, '<div id="probe"></div>', "10. not_evaluable -> KEIN Badge (leer)");

const hMissing = render(h(Probe, { d: { id: "y" }, repo: { byDriver: {} } }));
eq(hMissing, '<div id="probe"></div>', "11. Fahrer ohne Vorschlag -> KEIN Badge");

[hDirect, hFest, hZone].forEach((html, i) => {
  ok(!/mc-badge--problem|--mc-st-problem/.test(html), `12.${i} Badge nutzt KEIN Alarmrot`);
  ok(!/<button|onclick|onClick|href=/i.test(html), `13.${i} Badge ist rein statisch (keine Schaltflaeche/Link)`);
});

// ===========================================================================
// (2) Integration: echte MissionReturnsTab, idle-am-Festival, Wiring-Bijektion
// ===========================================================================
const drivers = seedDrivers();
const setup = { drivers, dispatchers: [{ id: "d1", name: "Chef" }], locations: seedLocations(), zones: ["Caldera", "Zone 3", "Stonelands"], matrix: seedMatrix(), config: seedConfig() };

// Heutiger Tag: nur so liefert dayNowMin echte Minuten und eine beendete Fahrt
// positioniert den Fahrer (deriveDriverPlannedPosition liest keinen locationId).
const nowD = new Date();
const pad = (n) => String(n).padStart(2, "0");
const DAY = `${nowD.getFullYear()}-${pad(nowD.getMonth() + 1)}-${pad(nowD.getDate())}`;
const nm = dayNowMin(DAY);
const fmt = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
// Sicheres Tagesfenster: beendete Fahrt klar vor jetzt, naechste klar nach jetzt.
// Ausserhalb (tiefe Nacht) wird der actionable-Teil bewusst uebersprungen; das
// Verhalten deckt Teil 1 deterministisch ab.
const safeClock = Number.isFinite(nm) && nm >= 150 && nm <= 1290;

const A = drivers[0], B = drivers[1];
const rbase = { fromCustom: "", toCustom: "", dayKey: DAY, passengerCount: 2, issues: [] };
const doneTime = safeClock ? fmt(nm - 120) : "06:00";
const nextTime = safeClock ? fmt(nm + 120) : "22:00";
const ridesA = [
  { ...rbase, id: "aDone", date: DAY, time: doneTime, fromId: "airport", toId: "festival", status: "done", assignedDriverId: A.id },
  { ...rbase, id: "aNext", date: DAY, time: nextTime, fromId: "airport", toId: "festival", status: "accepted", assignedDriverId: A.id },
];
// Eine unbesetzte Rueckfahrt, damit die rechte Spalte (returns.length>0) und
// damit die Frei-Liste ueberhaupt rendert.
const retRide = { ...rbase, id: "ret1", date: DAY, time: nextTime, fromId: "festival", toId: "sheraton", status: "planned", assignedDriverId: null, type: "return", djName: "GastX" };
const allRides = [...ridesA, retRide];
const driverState = {}; drivers.forEach((d) => { driverState[d.id] = {}; });
driverState[B.id] = { locationId: "festival" }; // B idle am Festival, aber ohne Fahrt -> not_evaluable (Kontrolle)
const dyn = { rides: allRides, artistPresence: {}, driverState, rev: 1 };

const sA = computeDriverStats(setup, dyn, A.id, DAY);
const sB = computeDriverStats(setup, dyn, B.id, DAY);
ok(!sA.active && sA.locNow === "festival", "14. Precondition: Fahrer A idle am Festival (aus beendeter Fahrt)");
ok(!sB.active && sB.locNow === "festival", "15. Precondition: Fahrer B idle am Festival (aus locationId)");

// D/E/F-Eingaben VERBATIM wie die Komponente (Z. 8348-8390) rekonstruieren.
const NW = Date.now();
const ttMatchEntries = normalizeTimetableEntries(TIMETABLE_RAW);
const returnsList = (dyn.rides || []).filter((r) => r.dayKey === DAY && r.status !== "cancelled" && (r.type === "return" || r.fromId === "festival"));
const baseModels = returnsList.map((r) => {
  const driver = setup.drivers.find((d) => d.id === r.assignedDriverId) || null;
  const match = matchRideToTimetable({ ride: r, timetableEntries: ttMatchEntries });
  const timing = evaluateTimetableTiming({ ride: r, matchResult: match, setup, now: 0 });
  return { ride: r, driver, match, timing };
});
const viewModels = baseModels.map((b) => ({ ...b, op: deriveReturnRideOperationalState({ ride: b.ride, driver: b.driver, timetableMatch: b.match, timingEvaluation: b.timing, now: NW, setup }) }));
const waitModel = buildWaitRideCandidates({ dyn, setup, now: NW, day: DAY });
const waitRideSuggestions = [...waitModel.byReturn.values()].map((v) => v.best).filter(Boolean);
const groupModel = buildGroupRidePairCandidates({ rides: dyn.rides, drivers: setup.drivers, setup, now: 0, timetableEntries: ttMatchEntries });
const repoExp = buildRepositionSuggestions({
  drivers: setup.drivers, dyn, setup, now: NW, dayKey: DAY,
  returnRideViewModels: viewModels, waitRideSuggestions, groupRideSuggestions: groupModel.primaries,
});
const expA = repoExp.byDriver[A.id];
const expB = repoExp.byDriver[B.id];
ok(!!expA && !!expB, "16. buildRepositionSuggestions liefert je einen Vorschlag fuer A und B");

let updateDynCalls = 0;
const spyUpdateDyn = async () => { updateDynCalls++; return { ok: true }; };
const noop = () => {};
let tabHtml = "", crashed = null;
try {
  tabHtml = render(h(MissionReturnsTab, {
    setup, dyn, day: DAY, updateDyn: spyUpdateDyn, by: "dispo:test",
    onErr: noop, onAssign: noop, onWhatsApp: noop, onEdit: noop, onNewReturn: noop,
  }));
} catch (e) { crashed = e.message; }
ok(!crashed, "17. MissionReturnsTab rendert ohne Crash" + (crashed ? " (" + crashed + ")" : ""));
eq(updateDynCalls, 0, "18. Read-only: updateDyn im Render NICHT aufgerufen");

ok(tabHtml.includes("Am Festival / frei"), "19. Frei-Liste (Am Festival / frei) wird gerendert");
ok(tabHtml.includes(`${A.firstName} ${A.lastName[0]}.`), "20. Fahrer A erscheint in der Frei-Liste");
ok(tabHtml.includes(`${B.firstName} ${B.lastName[0]}.`), "21. Fahrer B erscheint in der Frei-Liste");

const aAct = REPOSITION_ACTIONABLE.has(expA.status);
const bAct = REPOSITION_ACTIONABLE.has(expB.status);
eq(tabHtml.includes(expA.label), aAct, `22. A: Badge-Label sichtbar <=> actionable (Status ${expA.status})`);
eq(tabHtml.includes(expB.label), bAct, `23. B: Badge-Label sichtbar <=> actionable (Status ${expB.status})`);
eq(expB.status, "not_evaluable", "24. B ohne Fahrt -> not_evaluable (Kontrolle, kein Badge)");

if (safeClock) {
  eq(expA.status, "direct_to_next_pickup", "25. A (Position Festival, Pickup Flughafen) -> direct_to_next_pickup");
  ok(tabHtml.includes("mc-badge--new"), "26. A actionable -> mc-badge--new (Blau) im echten Tab");
  ok(tabHtml.includes(expA.label), "27. A: Vorschlags-Label im echten Tab sichtbar");
  ok(!/Am Festival \/ frei[\s\S]*mc-badge--problem/.test(tabHtml), "28. kein Alarmrot in der Frei-Liste");
} else {
  ok(true, "25. (ausserhalb sicheren Tagesfensters uebersprungen)");
  ok(true, "26. (uebersprungen)");
  ok(true, "27. (uebersprungen)");
  ok(true, "28. (uebersprungen)");
}

const emptyDyn = { rides: [], artistPresence: {}, driverState, rev: 1 };
let emptyCrash = null;
try {
  render(h(MissionReturnsTab, { setup, dyn: emptyDyn, day: DAY, updateDyn: spyUpdateDyn, by: "dispo:test", onErr: noop, onAssign: noop, onWhatsApp: noop, onEdit: noop, onNewReturn: noop }));
} catch (e) { emptyCrash = e.message; }
ok(!emptyCrash, "29. leerer Tag rendert ohne Crash" + (emptyCrash ? " (" + emptyCrash + ")" : ""));

// ===========================================================================
// (3) Statische Analyse
// ===========================================================================
const anchorLine = 'return g && REPOSITION_ACTIONABLE.has(g.status)';
const classLine = 'g.status === "direct_to_next_pickup" ? "mc-badge--new" : "mc-badge--assigned"';
ok(rawSrc.includes(anchorLine), "30. Anker: actionable-Guard steht wortgleich in der Quelle");
ok(rawSrc.includes(classLine), "31. Anker: Klassenzuordnung steht wortgleich in der Quelle");
ok(rawSrc.includes("const g = repo.byDriver[d.id];"), "32. Anker: byDriver-Lookup steht in der Quelle");

const defCount = (rawSrc.match(/function buildRepositionSuggestions\(/g) || []).length;
const useCount = (rawSrc.match(/buildRepositionSuggestions\(/g) || []).length;
eq(defCount, 1, "33. buildRepositionSuggestions genau einmal definiert");
eq(useCount, 2, "34. buildRepositionSuggestions genau 1 Aufruf (2 = Def + Aufruf)");

function sliceBody(name) {
  const i = rawSrc.indexOf("function " + name);
  if (i < 0) return "";
  const rest = rawSrc.slice(i + 1);
  const j = rest.indexOf("\nfunction ");
  return j < 0 ? rest : rest.slice(0, j);
}
const returnsBody = sliceBody("MissionReturnsTab");
ok(/const repo = useMemo\(\(\) => buildRepositionSuggestions\(/.test(returnsBody), "35. repo-Memo liegt im MissionReturnsTab-Koerper");

const memoStart = returnsBody.indexOf("Teilpaket G2");
const memoBlock = returnsBody.slice(memoStart, memoStart + 900);
ok(!/setInterval|setTimeout/.test(memoBlock), "36. G2-Memo enthaelt KEINEN eigenen Timer");

const writeRe = /updateDyn\(|supabase|window\.storage|localStorage|advanceStatus|assignRide\(|setDriver/;
const badgeStart = returnsBody.indexOf("const g = repo.byDriver[d.id]");
const badgeBlock = returnsBody.slice(badgeStart - 20, badgeStart + 320);
ok(!writeRe.test(badgeBlock), "37. Badge-Block enthaelt KEINEN Schreibweg");
ok(!/onClick|<button/.test(badgeBlock), "38. Badge-Block enthaelt KEINE Schaltflaeche");

const classicColor = /\b(bg|text|border|ring)-(red|green|blue|yellow|amber|orange|slate|gray|zinc|neutral|emerald|indigo|sky)-\d{2,3}\b/;
ok(!classicColor.test(badgeBlock), "39. Badge nutzt KEINE Classic-Farbklasse (Classic-Reste 0)");
ok(/mc-badge--new|mc-badge--assigned/.test(badgeBlock), "40. Badge nutzt die MC-Badge-Klassen");

// ===========================================================================
// (4) Rollen-Gating: returns ist NUR dispo (kein neuer Tab)
// ===========================================================================
eq(MC_ROLE_TABS.dispo, null, "41. dispo hat volle Nav (null)");
ok(Array.isArray(MC_ROLE_TABS.stage) && !MC_ROLE_TABS.stage.includes("returns"), "42. stage-Rolle ohne returns");
ok(Array.isArray(MC_ROLE_TABS.driver) && !MC_ROLE_TABS.driver.includes("returns"), "43. driver-Rolle ohne returns");

// ===========================================================================
// (5) Gegenproben
// ===========================================================================
const noGuardStay = render(h(ProbeNoGuard, { d: { id: "x" }, repo: { byDriver: { x: { status: "stay_at_current_location", label: L.stay_at_current_location } } } }));
ok(noGuardStay.includes("mc-badge"), "GP1a: ohne Guard wuerde auch stay ein Badge zeigen");
ok(!hStay.includes("mc-badge"), "GP1b: mit Guard zeigt stay KEIN Badge (Guard traegt)");

const injected = badgeBlock.replace("const g = repo.byDriver[d.id]", "const g = repo.byDriver[d.id]; updateDyn(() => {})");
ok(writeRe.test(injected), "GP2: injiziertes updateDyn im Badge wuerde erkannt");

ok(classicColor.test('<span className="mc-badge bg-red-500">x</span>'), "GP3: eine Classic-Farbklasse wuerde erkannt");

console.log(`\nTeilpaket G2 UI-Smoke: ${pass} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
