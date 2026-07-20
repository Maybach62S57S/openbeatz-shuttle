// Teilpaket F2 - UI/Render/Read-only-Tests gegen die ECHTE Anzeige der
// Sammelfahrt-Vorschlaege. Rendert (a) GroupSuggestionNote direkt mit
// konstruierten Kandidaten und (b) MissionReturnsTab mit einem gruppierbaren
// Rueckfahrt-Paar. Prueft ruhige Severity-Farben (kein Alarmrot), Kartentext,
// die zwei erlaubten Aktionen, KEINE Zusammenlegen-Schaltflaeche, Read-only
// (updateDyn wird beim Render nie aufgerufen), Rollen-Gating (nur dispo) und
// den Leerzustand. Statische Analyse + Gegenprobe. Original unangetastet.
import fs from "fs";
import { execSync } from "child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const srcFile = process.argv[2] || "src/ShuttleLeitstelle.jsx";
const rawSrc = fs.readFileSync(srcFile, "utf8");

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log("OK   " + name); } else { fail++; console.log("FAIL " + name); } }

async function build(srcText, exportLine) {
  const tag = Math.random().toString(36).slice(2);
  const copy = "/tmp/fui-" + tag + ".jsx";
  const out = "/home/claude/repo/.fui-" + tag + ".mjs";
  fs.writeFileSync(copy, srcText + "\n" + exportLine + "\n");
  execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
  const mod = await import(out);
  fs.unlinkSync(out); fs.unlinkSync(copy);
  return mod;
}

const M = await build(rawSrc,
  "export { GroupSuggestionNote, MissionReturnsTab, MC_ROLE_TABS, seedDrivers, seedLocations, seedMatrix, seedConfig, GROUP_RIDE_ACTIONABLE };");
const { GroupSuggestionNote, MissionReturnsTab, MC_ROLE_TABS, seedDrivers, seedLocations, seedMatrix, seedConfig } = M;
const h = React.createElement;
const render = (el) => renderToStaticMarkup(el);

// ---------------------------------------------------------------------------
// (1) GroupSuggestionNote direkt: ruhige Farben, Kartentext, zwei Aktionen
// ---------------------------------------------------------------------------
const recCand = {
  status: "group_recommended", label: "Sammelfahrt sinnvoll", rideIds: ["a", "b"],
  routeReliable: true, estimatedDrivingSavedMin: 18, detourMin: 6,
  combinedPassengerCount: 4, fitsFleet: true, driverAssignment: "both_unassigned", warnings: [],
};
const partnerRides = [{ id: "b", djName: "Boris Brejcha", time: "02:15" }];
let calledPartner = null, calledAssign = 0;
const recHtml = render(h(GroupSuggestionNote, {
  candidate: recCand, thisRideId: "a", rides: partnerRides,
  onOpenPartner: (p) => { calledPartner = p; }, onOpenAssign: () => { calledAssign++; },
}));
ok(recHtml.includes("var(--mc-st-done)"), "1. recommended nutzt Gruen (--mc-st-done)");
ok(!recHtml.includes("var(--mc-st-problem)"), "2. recommended enthaelt KEIN Alarmrot (--mc-st-problem)");
ok(recHtml.includes("Sammelfahrt sinnvoll"), "3. Label wird gezeigt");
ok(recHtml.includes("Boris Brejcha") && recHtml.includes("02:15"), "4. Partnerfahrt (Name + Zeit) gezeigt");
ok(recHtml.includes("18 Fahrminuten sparbar"), "5. Einsparung im Kartentext");
ok(recHtml.includes("Umweg 6 min"), "6. Umweg im Kartentext");
ok(recHtml.includes("4 Pers."), "7. Kombinierte Personenzahl gezeigt");
ok(recHtml.includes("beide noch ohne Fahrer"), "8. Fahrer-Hinweis (both_unassigned)");
ok(recHtml.includes("Fahrt öffnen"), "9. Aktion 'Fahrt öffnen' vorhanden");
ok(recHtml.includes("Zuweisung öffnen"), "10. Aktion 'Zuweisung öffnen' vorhanden");

const posCand = {
  status: "group_possible", label: "Sammelfahrt möglicherweise sinnvoll", rideIds: ["a", "b"],
  routeReliable: true, estimatedDrivingSavedMin: 9, detourMin: 12,
  combinedPassengerCount: 4, fitsFleet: true, driverAssignment: "two_drivers", warnings: ["c3_buffer_tight"],
};
const posHtml = render(h(GroupSuggestionNote, { candidate: posCand, thisRideId: "a", rides: partnerRides }));
ok(posHtml.includes("var(--mc-st-new)"), "11. possible nutzt Blau (--mc-st-new)");
ok(!posHtml.includes("var(--mc-st-problem)"), "12. possible enthaelt KEIN Alarmrot");
ok(!posHtml.includes("var(--mc-st-assigned)"), "13. possible nutzt KEIN Amber (bewusst ruhig)");
ok(posHtml.includes("zwei Fahrer zugeteilt, bitte prüfen"), "14. Fahrer-Hinweis (two_drivers)");
ok(posHtml.includes("Zeitpuffer knapp, Ankunft beachten"), "15. C3-Warnung im Kartentext");

// Route unvollstaendig -> keine Einsparung behauptet
const unrelCand = { ...recCand, routeReliable: false, estimatedDrivingSavedMin: null, detourMin: null };
const unrelHtml = render(h(GroupSuggestionNote, { candidate: unrelCand, thisRideId: "a", rides: partnerRides }));
ok(unrelHtml.includes("Fahrzeit unvollständig, keine Einsparung geschätzt"), "16. routeReliable=false: keine Einsparung behauptet");
ok(!unrelHtml.includes("Umweg"), "17. routeReliable=false: kein Umweg-Wert");

// Fehlender Partner -> Fallback, kein Crash, kein Partner-Button
const noPartnerHtml = render(h(GroupSuggestionNote, { candidate: recCand, thisRideId: "a", rides: [], onOpenAssign: () => {} }));
ok(noPartnerHtml.includes("Partnerfahrt"), "18. fehlender Partner: Fallback-Label 'Partnerfahrt'");
ok(!noPartnerHtml.includes("Fahrt öffnen"), "19. fehlender Partner: kein 'Fahrt öffnen'-Button");

// Nicht handlungsleitend / null -> rendert nichts
const notRec = render(h(GroupSuggestionNote, { candidate: { ...recCand, status: "group_not_recommended" }, thisRideId: "a", rides: partnerRides }));
ok(notRec === "", "20. group_not_recommended rendert nichts");
const nullNote = render(h(GroupSuggestionNote, { candidate: null, thisRideId: "a", rides: partnerRides }));
ok(nullNote === "", "21. null-Kandidat rendert nichts");

// ---------------------------------------------------------------------------
// (2) MissionReturnsTab: echtes gruppierbares Rueckfahrt-Paar -> Notiz + Read-only
// ---------------------------------------------------------------------------
const drivers = seedDrivers();
const setup = { drivers, dispatchers: [], locations: seedLocations(), zones: ["Caldera", "Zone 3", "Stonelands"], matrix: seedMatrix(), config: seedConfig() };
const DAY = "2026-07-24";
const rbase = { fromId: "festival", toId: "sheraton", fromCustom: "", toCustom: "", dayKey: DAY, passengerCount: 2, meetingPoint: "Backstage", issues: [], type: "return" };
const pairRides = [
  { ...rbase, id: "g1", date: DAY, time: "03:00", djName: "ActA", status: "planned", assignedDriverId: null },
  { ...rbase, id: "g2", date: DAY, time: "03:08", djName: "ActB", status: "planned", assignedDriverId: null },
];
const driverState = {}; drivers.forEach((d) => { driverState[d.id] = {}; });
const dyn = { rides: pairRides, artistPresence: {}, driverState, rev: 1 };

let updateDynCalls = 0;
const spyUpdateDyn = async () => { updateDynCalls++; return { ok: true }; };
const noop = () => {};
let tabHtml = "";
let crashed = null;
try {
  tabHtml = render(h(MissionReturnsTab, {
    setup, dyn, day: DAY, updateDyn: spyUpdateDyn, by: "dispo:test",
    onErr: noop, onAssign: noop, onWhatsApp: noop, onEdit: noop, onNewReturn: noop,
  }));
} catch (e) { crashed = e.message; }
ok(!crashed, "22. MissionReturnsTab rendert ohne Crash" + (crashed ? " (" + crashed + ")" : ""));
ok(updateDynCalls === 0, "23. Read-only: updateDyn beim Render NICHT aufgerufen (war " + updateDynCalls + ")");
ok(/Sammelfahrt (sinnvoll|möglicherweise sinnvoll)/.test(tabHtml), "24. gruppierbares Paar erzeugt eine Sammelfahrt-Notiz");
ok(tabHtml.includes("nur mit Sammelfahrt"), "25. Filter-Toggle 'nur mit Sammelfahrt' erscheint bei Count>0");
ok(tabHtml.includes("Zuweisung öffnen"), "26. Notiz-Aktion 'Zuweisung öffnen' im Tab");

// Kein gruppierbares Paar (nur eine Rueckfahrt) -> keine Notiz, kein Toggle
const soloDyn = { rides: [pairRides[0]], artistPresence: {}, driverState, rev: 1 };
const soloHtml = render(h(MissionReturnsTab, {
  setup, dyn: soloDyn, day: DAY, updateDyn: spyUpdateDyn, by: "dispo:test",
  onErr: noop, onAssign: noop, onWhatsApp: noop, onEdit: noop, onNewReturn: noop,
}));
ok(!soloHtml.includes("nur mit Sammelfahrt"), "27. einzelne Rueckfahrt: kein Sammelfahrt-Toggle");
ok(!/Sammelfahrt (sinnvoll|möglicherweise)/.test(soloHtml), "28. einzelne Rueckfahrt: keine Sammelfahrt-Notiz");

// Leerer Betriebstag -> kein Crash, Leerzustand
const emptyHtml = render(h(MissionReturnsTab, {
  setup, dyn: { rides: [], artistPresence: {}, driverState, rev: 1 }, day: DAY, updateDyn: spyUpdateDyn, by: "dispo:test",
  onErr: noop, onAssign: noop, onWhatsApp: noop, onEdit: noop, onNewReturn: noop,
}));
ok(!emptyHtml.includes("nur mit Sammelfahrt"), "29. leerer Tag: kein Sammelfahrt-Toggle");

// ---------------------------------------------------------------------------
// (2b) board-Renderpfad (Toggle-Trap): Shell mit geseedetem tab="board" und
//      einem gruppierbaren toFestival-Paar am ersten Festivaltag. Beweist den
//      versteckten Renderpfad zur Laufzeit (esbuild allein wuerde undefinierte
//      JSX-Referenzen still durchlassen).
const seededSrc = rawSrc.replace(
  'const [tab, setTab] = useState("overview");',
  'const [tab, setTab] = useState(globalThis.__F2TAB || "overview");');
ok(seededSrc !== rawSrc, "2b.0 tab-Seed-Anker in der Shell gefunden");
const MB = await build(seededSrc, "export { MissionControl };");
const FDAY = "2026-07-23"; // erster Festivaltag (dayTabs liefert die festen Tage)
const ob = { fromId: "airport", toId: "festival", fromCustom: "", toCustom: "", dayKey: FDAY, passengerCount: 2, issues: [], type: "transfer" };
const obRides = [
  { ...ob, id: "h1", date: FDAY, time: "12:00", djName: "HinA", status: "planned", assignedDriverId: null },
  { ...ob, id: "h2", date: FDAY, time: "12:08", djName: "HinB", status: "planned", assignedDriverId: null },
];
const obDriverState = {}; drivers.forEach((d) => { obDriverState[d.id] = {}; });
const obDyn = { rides: obRides, artistPresence: {}, driverState: obDriverState, rev: 1 };
let mcUpdateDynCalls = 0;
setup.dispatchers = [{ id: "d1", name: "Chef" }];
globalThis.__F2TAB = "board";
let boardHtml = "", boardCrash = null;
try {
  boardHtml = render(h(MB.MissionControl, {
    setup, dyn: obDyn, session: { dispatcherId: "d1" },
    updateDyn: async () => { mcUpdateDynCalls++; return { ok: true }; }, updateSetup: async () => ({ ok: true }),
    onLogout: noop, onPreviewGuest: noop, onUndo: noop, undoCount: 0, onSwitchToMobile: noop, onSetUiMode: noop, offline: false, connIssue: false,
  }));
} catch (e) { boardCrash = e.message; }
globalThis.__F2TAB = undefined;
ok(!boardCrash, "2b.1 board-Pfad rendert ohne Crash" + (boardCrash ? " (" + boardCrash + ")" : ""));
ok(mcUpdateDynCalls === 0, "2b.2 Read-only: updateDyn im board-Render NICHT aufgerufen (war " + mcUpdateDynCalls + ")");
ok(/Sammelfahrt (sinnvoll|möglicherweise sinnvoll)/.test(boardHtml), "2b.3 Hinfahrt-Paar erzeugt eine Sammelfahrt-Notiz im board");
ok(boardHtml.includes("Sammelfahrt "), "2b.4 board-Filter-Toggle/Zaehler erscheint");
ok(!/Sammelfahrt[^<]*--mc-st-problem/.test(boardHtml), "2b.5 kein Alarmrot in der board-Notiz");

// ---------------------------------------------------------------------------
// (3) Rollen-Gating: Sammelfahrt-Wirt (returns/board) ist NUR dispo
// ---------------------------------------------------------------------------
ok(MC_ROLE_TABS.dispo === null, "30. dispo hat volle Nav (null)");
ok(Array.isArray(MC_ROLE_TABS.stage) && !MC_ROLE_TABS.stage.includes("returns") && !MC_ROLE_TABS.stage.includes("board"),
  "31. stage-Rolle ohne returns/board (kein Sammelfahrt-Zugriff)");
ok(Array.isArray(MC_ROLE_TABS.driver) && !MC_ROLE_TABS.driver.includes("returns") && !MC_ROLE_TABS.driver.includes("board"),
  "32. driver-Rolle ohne returns/board");

// ---------------------------------------------------------------------------
// (4) Statische Analyse: Read-only, keine Zusammenlegen-Schaltflaeche,
//     GroupSuggestionNote nur in dispo-Komponenten
// ---------------------------------------------------------------------------
function sliceBody(name) {
  const i = rawSrc.indexOf("function " + name);
  if (i < 0) return "";
  // grobe Koerper-Abgrenzung bis zur naechsten Top-Level-Funktion
  const rest = rawSrc.slice(i + 1);
  const j = rest.indexOf("\nfunction ");
  return j < 0 ? rest : rest.slice(0, j);
}
const noteBody = sliceBody("GroupSuggestionNote");
ok(noteBody.length > 0, "33. GroupSuggestionNote im Quelltext gefunden");
const writeRe = /updateDyn\(|supabase|window\.storage|localStorage|setDriverGps|setDriverPushSubscription|advanceStatus|assignRide\(/;
ok(!writeRe.test(noteBody), "34. GroupSuggestionNote enthaelt KEINEN Schreibweg");

// Zusammenlegen-Schaltflaeche darf es NIRGENDS geben (Spec F)
ok(!/Zusammenlegen|zusammenlegen|Sammelfahrt anlegen|Gruppe anlegen|mergeRides|combineRides/.test(rawSrc),
  "35. KEINE Zusammenlegen-/Anlegen-Schaltflaeche im gesamten Quelltext");

// Board- und Returns-Einbindung existiert und ist an dispo gebunden
const driverAppBody = sliceBody("DriverApp");
const stageAppBody = sliceBody("StageApp");
const guestAppBody = sliceBody("GuestApp");
ok(!/GroupSuggestionNote|boardGroupPrimary|groupPrimaryFor/.test(driverAppBody), "36. DriverApp bindet KEINE Sammelfahrt-Anzeige ein");
ok(!/GroupSuggestionNote|boardGroupPrimary|groupPrimaryFor/.test(stageAppBody), "37. StageApp bindet KEINE Sammelfahrt-Anzeige ein");
ok(!/GroupSuggestionNote|boardGroupPrimary|groupPrimaryFor/.test(guestAppBody), "38. GuestApp bindet KEINE Sammelfahrt-Anzeige ein");

// Ruhige Farbwahl: Note-Body nutzt nur st-done/st-new als Akzent, kein problem/assigned
ok(noteBody.includes("--mc-st-done") && noteBody.includes("--mc-st-new"), "39. Note nutzt die ruhigen Akzentfarben done/new");
ok(!noteBody.includes("--mc-st-problem"), "40. Note nutzt kein --mc-st-problem (Alarmrot)");

// ---------------------------------------------------------------------------
// (5) Gegenprobe: injizierter Schreibweg in der Note wird erkannt
// ---------------------------------------------------------------------------
const injected = noteBody.replace("const c = candidate;", "const c = candidate; updateDyn(() => {});");
ok(writeRe.test(injected), "GEGENPROBE: injiziertes updateDyn in der Note wuerde erkannt");
const injectedMerge = rawSrc + "\n<button>Zusammenlegen</button>";
ok(/Zusammenlegen/.test(injectedMerge), "GEGENPROBE: eine Zusammenlegen-Schaltflaeche wuerde erkannt");

console.log(`\nTeilpaket F2 UI-Smoke: ${pass} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
