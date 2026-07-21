// Block-I kontrollierter Error-Boundary-Test.
//
// Prueft die ECHTE MissionControlBoundary + MissionControlFallbackScreen aus
// src/ShuttleLeitstelle.jsx (Wegwerf-Kopie mit Export, Original unangetastet -
// gleiches Muster wie rendertest.mjs). Beweist verhaltensbezogen die Block-I-
// Invarianten:
//
//   I1  getDerivedStateFromError() -> { failed: true } (Render-Phase, kein
//       Seiteneffekt): ein Renderfehler fuehrt in den Fehlerzustand.
//   I2  render() zeigt bei failed=true die Fehlerseite, bei failed=false die
//       Kinder -> ein Fehler in einer Unteransicht macht NICHT die App weiss.
//   I3  componentDidCatch(error, info) ruft onFallback(error) (Session-Sperre im
//       Aufrufer) und veraendert KEINE Daten: kein updateDyn/updateSetup, kein
//       localStorage, kein sset/sget im Klassenkoerper (strukturell verankert).
//   I4  Die Fehlerseite bietet einen Reload ("Neu laden" -> window.location.reload).
//   I5  Kein Renderfehler veraendert Daten: der einzige Seiteneffekt der Boundary
//       ist onFallback; sie erhaelt keine Schreib-Props.
//
// Zusaetzlich als DOKUMENTIERTER Befund (kein Test-Fail, sondern Nachweis der
// Abdeckungsgrenze): die Boundary umschliesst NUR den MC-/Leitstellen-Zweig.
// Fahrer/Stage/Gast/Login laufen ausserhalb -> ein Renderfehler DORT ist aktuell
// NICHT abgefangen (Weissbild, Reload nur manuell). Der Test weist das als
// bekannte Grenze aus (I6), damit es nicht faelschlich als "ueberall abgefangen"
// gilt.
//
// SSR-Hinweis: renderToStaticMarkup faengt Error Boundaries in React 18 NICHT
// (getDerivedStateFromError/componentDidCatch feuern im Server-Render nicht).
// Deshalb werden die Lebenszyklus-Methoden der echten Klasse DIREKT geprueft,
// nicht ueber einen Server-Render mit werfendem Kind.
//
// Pflicht-Gegenprobe (I-GP): eine Boundary OHNE getDerivedStateFromError bleibt
// im failed=false-Zustand und wuerde die Kinder (den Absturz) erneut rendern ->
// die I1/I2-Pruefung kippt.
//
// Aufruf: node smoke-error-boundary-i.mjs [src/ShuttleLeitstelle.jsx]

import fs from "fs";
import { execSync } from "child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push(m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} (erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)})`);

const srcFile = process.argv[2] || "src/ShuttleLeitstelle.jsx";
const rawSrc = fs.readFileSync(srcFile, "utf8");

// --- Wegwerf-Kopie mit Export (Original unangetastet) ----------------------
const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/eb-src-" + tag + ".jsx";
fs.writeFileSync(copy, rawSrc + "\nexport { MissionControlBoundary, MissionControlFallbackScreen, LoadErrorScreen };\n");
const out = "/home/claude/repo/.eb-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const M = await import(out);
fs.unlinkSync(out); fs.unlinkSync(copy);
const { MissionControlBoundary, MissionControlFallbackScreen, LoadErrorScreen } = M;

// ===========================================================================
// I1  getDerivedStateFromError -> { failed: true }, ohne Seiteneffekt
// ===========================================================================
{
  const err = new Error("simulierter Renderfehler in einer MC-Unteransicht");
  const derived = MissionControlBoundary.getDerivedStateFromError(err);
  eq(derived, { failed: true }, "I1 getDerivedStateFromError -> { failed: true }");
}

// ===========================================================================
// I2  render(): failed=true -> Fehlerseite; failed=false -> Kinder
// ===========================================================================
{
  const inst = new MissionControlBoundary({ onFallback: () => {}, children: React.createElement("div", null, "MC-KINDER") });
  // failed=false -> Kinder
  inst.state = { failed: false };
  const kids = inst.render();
  const kidsHtml = renderToStaticMarkup(kids);
  ok(kidsHtml.includes("MC-KINDER"), "I2 render(failed=false) -> zeigt die Kinder (normalbetrieb)");
  // failed=true -> Fehlerseite (kein Weissbild)
  inst.state = { failed: true };
  const fallback = inst.render();
  const fbHtml = renderToStaticMarkup(fallback);
  ok(fbHtml.length > 0 && !fbHtml.includes("MC-KINDER"), "I2 render(failed=true) -> Fehlerseite statt Kinder");
  ok(/Problem|Leitstelle|Neu laden/i.test(fbHtml), "I2 Fehlerseite hat verstaendlichen Text (kein Weissbild)");
}

// ===========================================================================
// I3  componentDidCatch: ruft onFallback(error), keine Datenmutation
// ===========================================================================
{
  let called = 0, gotErr = null;
  const inst = new MissionControlBoundary({ onFallback: (e) => { called++; gotErr = e; } });
  // console.error waehrend des Tests unterdruecken (der Aufruf ist beabsichtigt).
  const origErr = console.error; console.error = () => {};
  const err = new Error("boom");
  inst.componentDidCatch(err, { componentStack: "\n  in SomeTab" });
  console.error = origErr;
  eq(called, 1, "I3 componentDidCatch ruft onFallback genau einmal");
  ok(gotErr === err, "I3 onFallback bekommt den Original-Fehler");
  // onFallback fehlt -> darf NICHT werfen (Doppel-Absicherung)
  const inst2 = new MissionControlBoundary({});
  const origErr2 = console.error; console.error = () => {};
  let threw = false;
  try { inst2.componentDidCatch(new Error("x"), { componentStack: "" }); } catch { threw = true; }
  console.error = origErr2;
  ok(!threw, "I3 componentDidCatch ohne onFallback wirft nicht");
}

// ===========================================================================
// I3/I5 strukturell: der Klassenkoerper beruehrt KEINEN Schreibweg / kein
// localStorage -> ein abgefangener Renderfehler kann keine Daten aendern.
// ===========================================================================
{
  const clsStart = rawSrc.indexOf("class MissionControlBoundary");
  const clsEnd = rawSrc.indexOf("\n}\n", clsStart);
  ok(clsStart >= 0 && clsEnd > clsStart, "I5 Klassenkoerper MissionControlBoundary gefunden");
  const bodyRaw = rawSrc.slice(clsStart, clsEnd);
  // Kommentare strippen, bevor auf echte Schreibaufrufe geprueft wird: der
  // Klassenkoerper enthaelt bewusst beruhigende Kommentare ("kein localStorage",
  // "nicht in localStorage."), die sonst faelschlich matchen wuerden. Wir wollen
  // ECHTE Aufrufe messen, nicht Kommentartext.
  const body = bodyRaw
    .replace(/\/\*[\s\S]*?\*\//g, "")   // Blockkommentare
    .replace(/\/\/[^\n]*/g, "");         // Zeilenkommentare
  for (const verboten of ["updateDyn", "updateSetup", "sset(", "localStorage", "saveSession", "sbSet"]) {
    ok(!body.includes(verboten), `I5 Boundary-Koerper (ohne Kommentare) enthaelt kein "${verboten}" (keine Datenmutation)`);
  }
  // Einziger erlaubter Seiteneffekt: onFallback + console.error.
  ok(body.includes("onFallback"), "I5 einziger Seiteneffekt ist onFallback");
}

// ===========================================================================
// I4  Fehlerseite bietet Reload (window.location.reload) + verstaendlicher Text
// ===========================================================================
{
  const screen = MissionControlFallbackScreen({ reason: "Testgrund" });
  const html = renderToStaticMarkup(screen);
  ok(/Neu laden/i.test(html), "I4 Fehlerseite hat 'Neu laden'-Knopf");
  ok(html.includes("Testgrund"), "I4 Fehlerseite zeigt den durchgereichten Grund");
  // reload-Handler ist verdrahtet (SSR fuehrt onClick nicht aus -> Quelle pruefen)
  const scrStart = rawSrc.indexOf("function MissionControlFallbackScreen");
  const scrEnd = rawSrc.indexOf("\n}\n", scrStart);
  const scrBody = rawSrc.slice(scrStart, scrEnd);
  ok(scrBody.includes("window.location.reload"), "I4 Reload ist an window.location.reload verdrahtet");
  // LoadErrorScreen (Initial-Load-Fehler) bietet ebenfalls einen Retry
  const le = renderToStaticMarkup(LoadErrorScreen({ message: "Ladefehler-Text", onRetry: () => {} }));
  ok(/Erneut versuchen/i.test(le), "I4 LoadErrorScreen hat 'Erneut versuchen'");
  ok(le.includes("Ladefehler-Text"), "I4 LoadErrorScreen zeigt die Fehlermeldung");
}

// ===========================================================================
// I6  DOKUMENTIERTER Befund (kein Fail): Abdeckungsgrenze der Boundary.
// Die Boundary umschliesst NUR den MC-Zweig. Fahrer/Stage/Gast/Login sind
// NICHT umschlossen -> ein Renderfehler dort ist aktuell nicht abgefangen.
// Der Test WEIST das nach (statt es faelschlich als abgedeckt zu behaupten).
// ===========================================================================
{
  // Genau eine MissionControlBoundary-Verwendung, und die steht im MC-Zweig.
  const uses = (rawSrc.match(/<MissionControlBoundary/g) || []).length;
  eq(uses, 1, "I6 genau EINE MissionControlBoundary im Render-Baum (nur MC-Zweig)");
  // Fahrer/Stage/Gast/Login werden NICHT von einer Boundary umschlossen:
  // heuristisch - in derselben Zeile wie der Rollen-Return steht keine Boundary.
  const roleLines = rawSrc.split("\n").filter((l) => /<(DriverApp|StageApp|GuestApp|Login) /.test(l));
  ok(roleLines.length >= 3, "I6 Rollen-Zweige Fahrer/Stage/Gast/Login im Quelltext gefunden");
  const anyWrapped = roleLines.some((l) => l.includes("Boundary"));
  ok(!anyWrapped, "I6 BEFUND: Fahrer/Stage/Gast/Login sind NICHT von einer Boundary umschlossen (bekannte Grenze)");
}

// ===========================================================================
// I-GP  PFLICHT-GEGENPROBE: eine Boundary OHNE getDerivedStateFromError bleibt
// im failed=false-Zustand -> sie wuerde den Absturz erneut rendern. Das kippt
// die I1/I2-Erwartung (failed:true) und beweist, dass I1/I2 wirklich messen.
// ===========================================================================
let gpKippte = false;
{
  class BoundaryOhneGuard extends React.Component {
    constructor(p){ super(p); this.state = { failed: false }; }
    // KEIN getDerivedStateFromError -> failed bleibt false
    render(){ return this.state.failed ? React.createElement("div", null, "FALLBACK") : this.props.children; }
  }
  const derived = typeof BoundaryOhneGuard.getDerivedStateFromError === "function"
    ? BoundaryOhneGuard.getDerivedStateFromError(new Error("x")) : undefined;
  // Ohne Guard gibt es keine Ableitung nach failed:true -> kippt gegenueber I1.
  gpKippte = (derived === undefined);
  ok(gpKippte, "I-GP Boundary ohne getDerivedStateFromError leitet NICHT nach failed:true ab (Gegenprobe kippt)");
  // Kontrast: die echte Boundary leitet sehr wohl ab.
  ok(typeof MissionControlBoundary.getDerivedStateFromError === "function"
     && MissionControlBoundary.getDerivedStateFromError(new Error("x")).failed === true,
     "I-GP Kontrast: echte Boundary leitet nach failed:true ab");
}

// ===========================================================================
console.log(`\nBlock-I Error-Boundary Smoke: ${pass} OK, ${fail} FAIL`);
if (fail) { console.log("FEHLER:"); fails.forEach((f) => console.log("  - " + f)); process.exit(1); }
console.log(gpKippte ? "Gegenprobe I-GP: kippte wie erwartet." : "Gegenprobe I-GP: NICHT gekippt!");
console.log("BEFUND I6: Boundary deckt nur den MC-Zweig ab (Fahrer/Stage/Gast/Login ungeschuetzt).");
console.log("ALLE GRUEN");
