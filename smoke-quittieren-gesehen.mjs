// Smoke: Quittieren ("Gesehen") fuer die zeitbasierten Notfaelle.
//
// Hintergrund: der bestehende "Problem erledigt"-Knopf haengt an c.type ===
// "issue" und ruft resolveIssues(). Zeitbasierte Faelle (flight/nodriver/
// waiting) haben kein issues[], bekamen also keinen Knopf. Neu: eine Quittung
// am Ride-Objekt (caseAckAt/Type/Sev/Label) blendet den Fall ACK_SNOOZE_MIN
// Minuten aus, danach kommt er automatisch zurueck; Eskalation bricht sofort
// durch. issue-Faelle bleiben unveraendert.
//
// Prueft:
//  Teil 1  caseAckActive rein: kein Ack, passendes Ack, abgelaufen, Eskalation
//          (sev), falscher Typ, flight mit geaendertem Alarmtext, waiting mit
//          geaenderter Minutenzahl (Label dort bewusst egal).
//  Teil 2  emergencyCases-Integration ueber den flight-Fall (unabhaengig von
//          der Wanduhr, weil flightAlert nicht am live-Fenster haengt).
//  Teil 3  waiting/nodriver inkl. echter Eskalation warn -> critical
//          (nur im sicheren Tagesfenster, sonst sauber uebersprungen).
//  Teil 4  UI: "Gesehen" erscheint beim flight-Fall, beim issue-Fall NICHT,
//          und der Render bleibt read-only (kein updateDyn).
//  Teil 5  Gegenproben: Zeitfenster entfernt, sev-Vergleich entfernt,
//          ACK_CASE_TYPES um "issue" erweitert -> die jeweils zustaendige
//          Pruefung MUSS kippen.
//
// Original unangetastet. Aufruf: node smoke-quittieren-gesehen.mjs src/ShuttleLeitstelle.jsx

import fs from "fs";
import { execSync } from "child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const srcFile = process.argv[2];
if (!srcFile) { console.log("Aufruf: node smoke-quittieren-gesehen.mjs src/ShuttleLeitstelle.jsx"); process.exit(1); }
const tag = Math.random().toString(36).slice(2);
const src = fs.readFileSync(srcFile, "utf8");

if (typeof globalThis.window === "undefined") globalThis.window = { innerWidth: 1200, innerHeight: 800 };
if (typeof globalThis.document === "undefined") globalThis.document = { elementFromPoint: () => null };

const EXPORTS = "export { caseAckActive, emergencyCases, ACK_SNOOZE_MIN, ACK_CASE_TYPES, MissionEmergencyTab, dayNowMin, seedDrivers, seedLocations, seedMatrix, seedConfig };";

function aufraeumen() {
  for (const f of fs.readdirSync("/home/claude/repo")) {
    if (f.startsWith(".smk-ack-" + tag)) fs.unlinkSync("/home/claude/repo/" + f);
  }
}

function buildModule(source, suffix) {
  const copy = "/tmp/smk-ack-" + tag + "-" + suffix + ".jsx";
  fs.writeFileSync(copy, source + "\n" + EXPORTS + "\n");
  const out = "/home/claude/repo/.smk-ack-" + tag + "-" + suffix + ".mjs";
  try {
    execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`, { stdio: "pipe" });
  } catch (e) {
    // Genau der Fall bei der HEAD-Gegenprobe: dort gibt es weder caseAckActive
    // noch ACK_CASE_TYPES, der Export scheitert. Sauber melden statt Stacktrace.
    fs.unlinkSync(copy);
    aufraeumen();
    console.log("");
    console.log("QUITTIEREN-SMOKE NICHT LAUFFAEHIG gegen diese Quelle (" + suffix + "):");
    console.log("die Quittungs-Symbole fehlen dort. Erwartet fuer HEAD vor dem Umbau,");
    console.log("ein FEHLER fuer die aktuelle Arbeitsdatei.");
    process.exit(2);
  }
  fs.unlinkSync(copy);
  return out;
}

const checks = [];
const pruef = (name, ok, hint) => checks.push({ name, ok, hint });

const outNeu = buildModule(src, "neu");
const M = await import(outNeu);
const { caseAckActive, emergencyCases, ACK_SNOOZE_MIN, ACK_CASE_TYPES, MissionEmergencyTab, dayNowMin } = M;

const setup = {
  drivers: M.seedDrivers(),
  dispatchers: [{ id: "d1", name: "Chef" }],
  locations: M.seedLocations(),
  zones: ["Caldera"],
  matrix: M.seedMatrix(),
  config: M.seedConfig(),
};
const DRV = setup.drivers[0].id;
const MIN = 60000;
const T0 = 1800000000000; // fester Bezugspunkt, macht Teil 1 wanduhr-unabhaengig

// ---------------------------------------------------------------------------
// Teil 1: caseAckActive als reine Funktion
// ---------------------------------------------------------------------------
const ackFlight = { caseAckAt: T0, caseAckType: "flight", caseAckSev: "critical", caseAckLabel: "Flug annulliert – Fahrt prüfen/halten" };
const ackWait = { caseAckAt: T0, caseAckType: "waiting", caseAckSev: "warn", caseAckLabel: "Fahrer nicht gestartet · 7 min über Zeit" };

pruef("1. ohne caseAckAt -> nicht quittiert", caseAckActive({}, "flight", "critical", "x", T0) === false);
pruef("2. passende Quittung im Fenster -> quittiert",
  caseAckActive(ackFlight, "flight", "critical", ackFlight.caseAckLabel, T0 + 5 * MIN) === true);
pruef("3. Quittung nach ACK_SNOOZE_MIN abgelaufen -> Fall kommt zurueck",
  caseAckActive(ackFlight, "flight", "critical", ackFlight.caseAckLabel, T0 + (ACK_SNOOZE_MIN + 1) * MIN) === false);
pruef("4. Eskalation warn -> critical bricht die Quittung durch",
  caseAckActive(ackWait, "waiting", "critical", ackWait.caseAckLabel, T0 + 1 * MIN) === false);
pruef("5. anderer Falltyp greift nicht auf die Quittung zu",
  caseAckActive(ackWait, "nodriver", "warn", ackWait.caseAckLabel, T0 + 1 * MIN) === false);
pruef("6. flight: geaenderter Alarmtext bricht die Quittung durch (nur eine sev-Stufe)",
  caseAckActive(ackFlight, "flight", "critical", "gelandet, aber kein Fahrer unterwegs", T0 + 1 * MIN) === false);
pruef("7. waiting: mitlaufende Minutenzahl im Text bricht NICHT durch",
  caseAckActive(ackWait, "waiting", "warn", "Fahrer nicht gestartet · 9 min über Zeit", T0 + 1 * MIN) === true);
pruef("8. ACK_CASE_TYPES enthaelt genau flight/nodriver/waiting, NICHT issue",
  ACK_CASE_TYPES.length === 3 && ["flight", "nodriver", "waiting"].every((t) => ACK_CASE_TYPES.includes(t)) && !ACK_CASE_TYPES.includes("issue"));

// ---------------------------------------------------------------------------
// Teil 2: emergencyCases ueber den flight-Fall (wanduhr-unabhaengig)
// ---------------------------------------------------------------------------
const DAY = "2026-07-25";
const rideBase = {
  dayKey: DAY, date: DAY, time: "14:00", djName: "Testartist", fromId: "airport", toId: "sheraton",
  passengerCount: 2, issues: [], statusHistory: [], log: [], fromCustom: "", toCustom: "",
};
const flightRide = (extra) => ({ ...rideBase, id: "f1", status: "planned", assignedDriverId: DRV, flightNo: "LH123", flightStatus: "annulliert", ...extra });
const casesOf = (rides) => emergencyCases(setup, { rides, driverState: {}, messages: [], rev: 1 }, DAY);
const hasType = (cs, t) => cs.some((c) => c.type === t);

pruef("9. flight annulliert ohne Quittung -> Fall erscheint", hasType(casesOf([flightRide()]), "flight"));

const NOW = Date.now();
pruef("10. frische Quittung -> flight-Fall verschwindet",
  !hasType(casesOf([flightRide({ caseAckAt: NOW, caseAckType: "flight", caseAckSev: "critical", caseAckLabel: "Flug annulliert – Fahrt prüfen/halten" })]), "flight"));
pruef("11. abgelaufene Quittung -> flight-Fall ist wieder da",
  hasType(casesOf([flightRide({ caseAckAt: NOW - (ACK_SNOOZE_MIN + 1) * MIN, caseAckType: "flight", caseAckSev: "critical", caseAckLabel: "Flug annulliert – Fahrt prüfen/halten" })]), "flight"));
pruef("12. Quittung fuer anderen Typ laesst den flight-Fall stehen",
  hasType(casesOf([flightRide({ caseAckAt: NOW, caseAckType: "waiting", caseAckSev: "critical", caseAckLabel: "Flug annulliert – Fahrt prüfen/halten" })]), "flight"));

// issue-Faelle sind bewusst NICHT quittierbar: selbst mit gesetzter Quittung
// bleiben sie stehen (sie haben ihren eigenen "Problem erledigt"-Knopf).
const issueRide = { ...rideBase, id: "i1", status: "planned", assignedDriverId: DRV,
  issues: [{ id: "x1", type: "Panne", state: "open" }],
  caseAckAt: NOW, caseAckType: "issue", caseAckSev: "warn", caseAckLabel: "Panne" };
pruef("13. issue-Fall bleibt trotz gesetzter Quittung sichtbar", hasType(casesOf([issueRide]), "issue"));

// ---------------------------------------------------------------------------
// Teil 3: waiting/nodriver inkl. echter Eskalation (nur im sicheren Fenster)
// ---------------------------------------------------------------------------
const nowD = new Date();
const pad = (n) => String(n).padStart(2, "0");
const TODAY = `${nowD.getFullYear()}-${pad(nowD.getMonth() + 1)}-${pad(nowD.getDate())}`;
const nm = dayNowMin(TODAY);
const fmt = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const safeClock = Number.isFinite(nm) && nm >= 150 && nm <= 1290;
const casesToday = (rides) => emergencyCases(setup, { rides, driverState: {}, messages: [], rev: 1 }, TODAY);

if (safeClock) {
  const waitBase = { ...rideBase, dayKey: TODAY, date: TODAY, id: "w1", status: "accepted", assignedDriverId: DRV };
  const wWarn = { ...waitBase, time: fmt(nm - 8) };   // 8 min ueber Zeit -> warn
  const wCrit = { ...waitBase, time: fmt(nm - 25) };  // 25 min ueber Zeit -> critical

  const cW = casesToday([wWarn]).find((c) => c.type === "waiting");
  pruef("14. waiting 8 min ueber Zeit -> Fall mit sev warn", !!cW && cW.sev === "warn", cW && cW.sev);
  pruef("15. waiting quittiert (gleiche Stufe) -> Fall verschwindet",
    !hasType(casesToday([{ ...wWarn, caseAckAt: Date.now(), caseAckType: "waiting", caseAckSev: "warn", caseAckLabel: cW ? cW.label : "" }]), "waiting"));
  pruef("16. KERNFALL Eskalation: als warn quittiert, jetzt critical -> Fall ist wieder da",
    hasType(casesToday([{ ...wCrit, caseAckAt: Date.now(), caseAckType: "waiting", caseAckSev: "warn", caseAckLabel: cW ? cW.label : "" }]), "waiting"));

  const ndBase = { ...rideBase, dayKey: TODAY, date: TODAY, id: "n1", status: "planned", assignedDriverId: null };
  const ndWarn = { ...ndBase, time: fmt(nm + 30) };   // Start in 30 min -> warn
  const cN = casesToday([ndWarn]).find((c) => c.type === "nodriver");
  pruef("17. nodriver Start in 30 min -> Fall mit sev warn", !!cN && cN.sev === "warn", cN && cN.sev);
  pruef("18. nodriver quittiert -> Fall verschwindet",
    !hasType(casesToday([{ ...ndWarn, caseAckAt: Date.now(), caseAckType: "nodriver", caseAckSev: "warn", caseAckLabel: cN ? cN.label : "" }]), "nodriver"));
} else {
  console.log("HINWEIS Teil 3 uebersprungen (ausserhalb des sicheren Tagesfensters, nm=" + nm + ")");
}

// ---------------------------------------------------------------------------
// Teil 4: UI-Render des Tabs
// ---------------------------------------------------------------------------
let writes = 0;
function renderTab(mod, rides) {
  return renderToStaticMarkup(React.createElement(mod.MissionEmergencyTab, {
    setup, dyn: { rides, driverState: {}, messages: [], rev: 1 }, day: DAY,
    updateDyn: async () => { writes++; return { ok: true }; },
    by: "dispo:d1", onErr: () => {}, onAssign: () => {}, onWhatsApp: () => {}, onEdit: () => {},
  }));
}
let hFlight, hIssue;
try {
  hFlight = renderTab(M, [flightRide()]);
  hIssue = renderTab(M, [{ ...rideBase, id: "i2", status: "planned", assignedDriverId: DRV, issues: [{ id: "x2", type: "Panne", state: "open" }] }]);
} catch (e) { console.log("FEHLER Render: " + e.message); process.exit(1); }

pruef("19. flight-Fall wird ueberhaupt gerendert", hFlight.includes("Testartist"));
pruef("20. flight-Fall zeigt den Knopf 'Gesehen'", hFlight.includes(">Gesehen<"));
pruef("21. flight-Fall zeigt NICHT 'Problem erledigt'", !hFlight.includes("Problem erledigt"));
pruef("22. issue-Fall zeigt weiter 'Problem erledigt'", hIssue.includes("Problem erledigt"));
pruef("23. KERNFALL issue-Fall zeigt KEIN 'Gesehen'", !hIssue.includes(">Gesehen<"));
pruef("24. Hinweistext nennt die Snooze-Dauer", hFlight.includes(`${ACK_SNOOZE_MIN} Minuten`));
pruef("25. Render ist read-only (kein updateDyn)", writes === 0, "writes=" + writes);

// ---------------------------------------------------------------------------
// Teil 5: Gegenproben
// ---------------------------------------------------------------------------
const ANK_ZEIT = "return nowMs - r.caseAckAt < ACK_SNOOZE_MIN * 60000;";
const ANK_SEV = "if (r.caseAckType !== type || r.caseAckSev !== sev) return false;";
const ANK_TYPES = 'const ACK_CASE_TYPES = ["flight", "nodriver", "waiting"];';

pruef("GP-A-Setup: Mutationsanker Zeitfenster gefunden", src.includes(ANK_ZEIT));
const outA = buildModule(src.replace(ANK_ZEIT, "return true;"), "gpa");
const MA = await import(outA);
const casesA = MA.emergencyCases(setup, { rides: [flightRide({ caseAckAt: NOW - (ACK_SNOOZE_MIN + 1) * MIN, caseAckType: "flight", caseAckSev: "critical", caseAckLabel: "Flug annulliert – Fahrt prüfen/halten" })], driverState: {}, messages: [], rev: 1 }, DAY);
pruef("GP-A: ohne Zeitfenster bliebe die abgelaufene Quittung ewig (Pruefung 11 kippt)",
  !casesA.some((c) => c.type === "flight"));

pruef("GP-B-Setup: Mutationsanker sev-Vergleich gefunden", src.includes(ANK_SEV));
const outB = buildModule(src.replace(ANK_SEV, "if (r.caseAckType !== type) return false;"), "gpb");
const MB = await import(outB);
let gpB = null;
if (safeClock) {
  const wCritB = { ...rideBase, dayKey: TODAY, date: TODAY, id: "w1", status: "accepted", assignedDriverId: DRV, time: fmt(nm - 25),
    caseAckAt: Date.now(), caseAckType: "waiting", caseAckSev: "warn", caseAckLabel: "egal" };
  gpB = MB.emergencyCases(setup, { rides: [wCritB], driverState: {}, messages: [], rev: 1 }, TODAY);
  pruef("GP-B: ohne sev-Vergleich bricht die Eskalation nicht durch (Pruefung 16 kippt)",
    !gpB.some((c) => c.type === "waiting"));
} else {
  const fB = flightRide({ caseAckAt: NOW, caseAckType: "flight", caseAckSev: "warn", caseAckLabel: "Flug annulliert – Fahrt prüfen/halten" });
  gpB = MB.emergencyCases(setup, { rides: [fB], driverState: {}, messages: [], rev: 1 }, DAY);
  pruef("GP-B: ohne sev-Vergleich greift eine warn-Quittung auf den critical-Fall (kippt)",
    !gpB.some((c) => c.type === "flight"));
}

pruef("GP-C-Setup: Mutationsanker ACK_CASE_TYPES gefunden", src.includes(ANK_TYPES));
const outC = buildModule(src.replace(ANK_TYPES, 'const ACK_CASE_TYPES = ["flight", "nodriver", "waiting", "issue"];'), "gpc");
const MC = await import(outC);
let hIssueC;
try {
  hIssueC = renderTab(MC, [{ ...rideBase, id: "i2", status: "planned", assignedDriverId: DRV, issues: [{ id: "x2", type: "Panne", state: "open" }] }]);
} catch (e) { console.log("FEHLER Render (gpc): " + e.message); process.exit(1); }
pruef("GP-C: mit issue in ACK_CASE_TYPES bekaeme der issue-Fall 'Gesehen' (Pruefung 23 kippt)",
  hIssueC.includes(">Gesehen<"));

// --- Ausgabe ---
let bad = 0;
for (const c of checks) {
  console.log((c.ok ? "OK    " : "FAIL  ") + c.name + (c.ok ? "" : "  -- " + (c.hint || "")));
  if (!c.ok) bad++;
}
console.log("");
console.log(bad === 0
  ? "QUITTIEREN-SMOKE OK (" + checks.length + " Pruefungen, inkl. 3 Gegenproben)"
  : "SMOKE FAIL: " + bad + " von " + checks.length);

aufraeumen();
process.exit(bad === 0 ? 0 : 1);
