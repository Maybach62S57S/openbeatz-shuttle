// Smoke: Einstellungen, stille Schreibfehler sichtbar machen.
//
// Hintergrund: in SettingsTab liefen vier Schreibpfade als fire-and-forget,
// also updateSetup ohne await und ohne Ergebnispruefung. Scheiterte das
// Speichern, bekam die Leitstelle davon nichts mit:
//   1. setMatrix          Fahrzeit-Matrix (Grundlage von evaluateInsertion
//                         und suggestDrivers, also aller Fahrervorschlaege)
//   2. Festival-Tag aendern
//   3. Festival-Tag entfernen
//   4. Festival-Tag hinzufuegen (hatte zwar await, ignorierte aber das
//      Ergebnis und leerte danach IMMER das Eingabefeld, hat also aktiv
//      Erfolg vorgetaeuscht)
//
// Prueft:
//  Teil 1  setMatrix als echtes Verhalten: die Funktion wird aus der Quelle
//          extrahiert und mit gestubbtem updateSetup/setMatrixErr ausgefuehrt.
//          Erfolg -> keine Meldung, Fehlschlag -> Meldung, res null -> Meldung,
//          Erfolg nach Fehlschlag -> Meldung wird wieder geleert. Ausserdem:
//          der Wert wird korrekt aus "min/km" geparst und geschrieben.
//  Teil 2  Quelltext-Anker fuer alle vier Handler (await + Ergebnispruefung).
//  Teil 3  Reihenfolge beim Hinzufuegen: setNewFestDate("") steht NACH der
//          Fehlerpruefung, nicht davor.
//  Teil 4  UI: beide Anzeigestellen vorhanden, nutzen die bestehende
//          Problem-Farbe, und SettingsTab rendert weiterhin ohne Absturz.
//  Teil 5  Gegenproben: await entfernt, Ergebnispruefung entfernt,
//          setNewFestDate wieder vorgezogen -> die jeweils zustaendige
//          Pruefung MUSS kippen.
//
// Original unangetastet. Aufruf: node smoke-einstellungen-schreibfehler.mjs src/ShuttleLeitstelle.jsx

import fs from "fs";
import { execSync } from "child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const srcFile = process.argv[2];
if (!srcFile) { console.log("Aufruf: node smoke-einstellungen-schreibfehler.mjs src/ShuttleLeitstelle.jsx"); process.exit(1); }
const tag = Math.random().toString(36).slice(2);
const src = fs.readFileSync(srcFile, "utf8");

if (typeof globalThis.window === "undefined") globalThis.window = { innerWidth: 1200, innerHeight: 800 };
if (typeof globalThis.document === "undefined") globalThis.document = { elementFromPoint: () => null };

const checks = [];
const pruef = (name, ok, hint) => checks.push({ name, ok, hint });

// ---------------------------------------------------------------------------
// Hilfsmittel: setMatrix aus der Quelle schneiden und wirklich ausfuehren.
// Kein Nachbau von Hand: der Rumpf kommt woertlich aus der Datei, damit der
// Test nicht von der Quelle abdriften kann.
// ---------------------------------------------------------------------------
function schneideSetMatrix(source) {
  const start = source.indexOf("const setMatrix = ");
  if (start < 0) return null;
  // bis zur schliessenden Zeile "  };" der Pfeilfunktion
  const ende = source.indexOf("\n  };", start);
  if (ende < 0) return null;
  return source.slice(start, ende + 5);
}

async function fahreSetMatrix(source, { okAntwort }) {
  const code = schneideSetMatrix(source);
  if (!code) return { fehlt: true };
  const geschrieben = [];
  let fehlerText = null;
  const updateSetup = async (mut) => {
    const s = { matrix: {} };
    mut(s);
    geschrieben.push(s.matrix);
    return okAntwort;
  };
  const setMatrixErr = (t) => { fehlerText = t; };
  // eslint-disable-next-line no-new-func
  const bau = new Function("updateSetup", "setMatrixErr", `${code}\nreturn setMatrix;`);
  const fn = bau(updateSetup, setMatrixErr);
  await fn("airport", "sheraton", "35/28");
  return { geschrieben, fehlerText };
}

// ---------------------------------------------------------------------------
// Teil 1: setMatrix, echtes Verhalten
// ---------------------------------------------------------------------------
const okLauf = await fahreSetMatrix(src, { okAntwort: { ok: true, value: {} } });
pruef("1. setMatrix aus der Quelle extrahierbar", !okLauf.fehlt,
  "const setMatrix = ... nicht gefunden, Anker geaendert?");

if (!okLauf.fehlt) {
  // Der Erfolgspfad ruft setMatrixErr("") auf (Meldung leeren), der Wert ist
  // danach also der leere String und nicht null. Beides gilt als "keine Meldung".
  pruef("2. Erfolg -> keine Fehlermeldung", !okLauf.fehlerText);
  pruef("3. Erfolg -> Wert korrekt geparst und geschrieben",
    okLauf.geschrieben.length === 1 && okLauf.geschrieben[0]["airport|sheraton"]?.min === 35
    && okLauf.geschrieben[0]["airport|sheraton"]?.km === 28);

  const failLauf = await fahreSetMatrix(src, { okAntwort: { ok: false, error: "CAS-Konflikt" } });
  pruef("4. Fehlschlag -> Meldung wird gesetzt", typeof failLauf.fehlerText === "string" && failLauf.fehlerText.length > 0);
  pruef("5. Fehlschlag -> Meldung uebernimmt den Fehlertext aus dem Ergebnis",
    failLauf.fehlerText === "CAS-Konflikt");

  const nullLauf = await fahreSetMatrix(src, { okAntwort: null });
  pruef("6. Ergebnis null (Ausnahmefall) -> Meldung trotzdem gesetzt",
    typeof nullLauf.fehlerText === "string" && nullLauf.fehlerText.length > 0);
  pruef("7. Ergebnis null -> verstaendlicher Ersatztext statt leer",
    (nullLauf.fehlerText || "").toLowerCase().includes("fahrzeit"));

  // Meldung muss nach einem geglueckten zweiten Versuch wieder verschwinden,
  // sonst bleibt eine alte Fehlermeldung fuer immer stehen.
  const codeM = schneideSetMatrix(src);
  let txt = "ALT";
  const upd = async () => ({ ok: true, value: {} });
  // eslint-disable-next-line no-new-func
  const fn2 = new Function("updateSetup", "setMatrixErr", `${codeM}\nreturn setMatrix;`)(upd, (t) => { txt = t; });
  await fn2("a", "b", "10/5");
  pruef("8. Erfolg nach Fehlschlag -> alte Meldung wird geleert", txt === "");
}

// ---------------------------------------------------------------------------
// Teil 2: Quelltext-Anker fuer alle vier Handler
// ---------------------------------------------------------------------------
const hatAwaitSetMatrix = /const setMatrix = async \([^)]*\) => \{[\s\S]{0,400}?await updateSetup\(/.test(src);
pruef("9. setMatrix ist async und wartet auf updateSetup", hatAwaitSetMatrix);
pruef("10. setMatrix prueft das Ergebnis und meldet", /if \(!res \|\| !res\.ok\) setMatrixErr\(/.test(src));

pruef("11. Festival-Tag aendern wartet und meldet",
  /Festival-Tag konnte nicht geaendert werden/.test(src) && /onChange=\{async \(e\) => \{[\s\S]{0,500}?await updateSetup\(/.test(src));
pruef("12. Festival-Tag entfernen wartet und meldet",
  /Festival-Tag konnte nicht entfernt werden/.test(src) && /onClick=\{async \(\) => \{[\s\S]{0,400}?await updateSetup\(/.test(src));
pruef("13. Festival-Tag hinzufuegen prueft das Ergebnis",
  /Festival-Tag konnte nicht hinzugefuegt werden/.test(src));

pruef("14. alle vier Meldungen laufen ueber die beiden neuen States",
  (src.match(/setFestErr\(/g) || []).length >= 6 && (src.match(/setMatrixErr\(/g) || []).length >= 2);

// ---------------------------------------------------------------------------
// Teil 3: Reihenfolge beim Hinzufuegen
// ---------------------------------------------------------------------------
function reihenfolgeHinzufuegen(source) {
  const i = source.indexOf("Festival-Tag konnte nicht hinzugefuegt werden");
  if (i < 0) return null;
  // Fenster ab der Fehlerpruefung bis kurz danach
  const fenster = source.slice(i, i + 300);
  const posLeeren = fenster.indexOf('setNewFestDate("")');
  return { gefunden: true, leerenNachPruefung: posLeeren > 0 };
}
const rf = reihenfolgeHinzufuegen(src);
pruef("15. Hinzufuegen-Handler mit Fehlerpruefung gefunden", !!rf);
pruef("16. Feld wird ERST NACH der Fehlerpruefung geleert (kein vorgetaeuschter Erfolg)",
  !!rf && rf.leerenNachPruefung,
  "setNewFestDate(\"\") steht vor der Pruefung -> Feld leert sich auch im Fehlerfall");

// Der Handler muss im Fehlerfall abbrechen, sonst laeuft das Leeren doch durch.
pruef("17. Fehlerfall bricht mit return ab",
  /setFestErr\(res\?\.error \|\| "Festival-Tag konnte nicht hinzugefuegt werden[^"]*"\); return; \}/.test(src));

// ---------------------------------------------------------------------------
// Teil 4: UI-Anzeigestellen + Render ohne Absturz
// ---------------------------------------------------------------------------
pruef("18. Anzeigestelle Festival-Tage vorhanden",
  /\{festErr && <div className="text-xs mt-2" style=\{\{ color: "var\(--mc-st-problem\)" \}\}>\{festErr\}<\/div>\}/.test(src));
pruef("19. Anzeigestelle Fahrzeit-Matrix vorhanden",
  /\{matrixErr && <div className="text-xs mt-2" style=\{\{ color: "var\(--mc-st-problem\)" \}\}>\{matrixErr\}<\/div>\}/.test(src));
pruef("20. beide nutzen die bestehende Problem-Farbe (keine neue Optik)",
  (src.match(/var\(--mc-st-problem\)" \}\}>\{(festErr|matrixErr)\}/g) || []).length === 2);

function aufraeumen() {
  for (const f of fs.readdirSync("/home/claude/repo")) {
    if (f.startsWith(".smk-einst-" + tag)) fs.unlinkSync("/home/claude/repo/" + f);
  }
}
function buildModule(source, suffix) {
  const copy = "/tmp/smk-einst-" + tag + "-" + suffix + ".jsx";
  fs.writeFileSync(copy, source + "\nexport { SettingsTab, seedDrivers, seedLocations, seedMatrix, seedConfig };\n");
  const out = "/home/claude/repo/.smk-einst-" + tag + "-" + suffix + ".mjs";
  try {
    execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`, { stdio: "pipe" });
  } catch (e) {
    fs.unlinkSync(copy);
    return null;
  }
  fs.unlinkSync(copy);
  return out;
}

const outNeu = buildModule(src, "neu");
if (outNeu) {
  const M = await import(outNeu);
  const setup = {
    drivers: M.seedDrivers(), dispatchers: [{ id: "d1", name: "Chef" }],
    locations: M.seedLocations(), zones: ["Caldera"], matrix: M.seedMatrix(),
    config: M.seedConfig(), guestTokens: [],
  };
  const dyn = { rides: [], driverState: {}, messages: [], rev: 1 };
  let html = "";
  let krachte = false;
  try {
    html = renderToStaticMarkup(React.createElement(M.SettingsTab, {
      setup, dyn, day: "2026-07-25", updateSetup: async () => ({ ok: true, value: {} }),
      updateDyn: async () => ({ ok: true, value: {} }), onPreviewGuest: () => {},
    }));
  } catch (e) { krachte = true; }
  pruef("21. SettingsTab rendert weiterhin ohne Absturz", !krachte);
  pruef("22. Fahrzeit-Matrix wird weiterhin gerendert", html.includes("Fahrzeit-Matrix"));
  pruef("23. Festival-Tage wird weiterhin gerendert", html.includes("Festival-Tage"));
  // Ohne Fehler darf KEINE Meldung im Markup stehen (Startzustand ist "").
  pruef("24. im Normalzustand steht keine Fehlermeldung im Markup",
    !html.includes("Fahrzeit konnte nicht gespeichert werden") && !html.includes("Festival-Tag konnte nicht"));
  aufraeumen();
} else {
  pruef("21. SettingsTab rendert weiterhin ohne Absturz", false, "Build fehlgeschlagen");
}

// ---------------------------------------------------------------------------
// Teil 5: Gegenproben. Jede mutiert die Quelle so, dass genau eine Pruefung
// oben kippen MUSS. Kippt sie nicht, misst der Test nichts.
// ---------------------------------------------------------------------------
const gp = [];
const gpPruef = (name, ok, hint) => gp.push({ name, ok, hint });

// GP-A: Ergebnispruefung in setMatrix entfernen -> Pruefung 4 muss kippen.
const ankerA = 'if (!res || !res.ok) setMatrixErr(';
gpPruef("GP-A-Setup: Mutationsanker setMatrix-Pruefung gefunden", src.includes(ankerA));
if (src.includes(ankerA)) {
  const mutA = src.replace(ankerA, 'if (false) setMatrixErr(');
  const lauf = await fahreSetMatrix(mutA, { okAntwort: { ok: false, error: "CAS-Konflikt" } });
  // Mit ausgehebelter Pruefung laeuft der else-Zweig, die Meldung bleibt also
  // leer, obwohl das Speichern scheiterte. Genau das laesst Pruefung 4 kippen.
  gpPruef("GP-A: ohne Ergebnispruefung bleibt der Fehlschlag still (Pruefung 4 kippt)",
    !lauf.fehlerText);
}

// GP-B: await in setMatrix entfernen -> Pruefung 9 muss kippen.
const ankerB = 'const res = await updateSetup((s) => { s.matrix[';
gpPruef("GP-B-Setup: Mutationsanker await gefunden", src.includes(ankerB));
if (src.includes(ankerB)) {
  const mutB = src.replace(ankerB, 'const res = updateSetup((s) => { s.matrix[');
  gpPruef("GP-B: ohne await faellt der Anker weg (Pruefung 9 kippt)",
    !/const setMatrix = async \([^)]*\) => \{[\s\S]{0,400}?await updateSetup\(/.test(mutB));
}

// GP-C: setNewFestDate wieder VOR die Fehlerpruefung ziehen -> Pruefung 16 kippt.
const ankerC = `if (!res || !res.ok) { setFestErr(res?.error || "Festival-Tag konnte nicht hinzugefuegt werden, bitte erneut versuchen."); return; }
              setFestErr("");
              setNewFestDate("");`;
gpPruef("GP-C-Setup: Mutationsanker Reihenfolge gefunden", src.includes(ankerC));
if (src.includes(ankerC)) {
  const mutC = src.replace(ankerC, `setNewFestDate("");
              if (!res || !res.ok) { setFestErr(res?.error || "Festival-Tag konnte nicht hinzugefuegt werden, bitte erneut versuchen."); return; }
              setFestErr("");`);
  const rfC = reihenfolgeHinzufuegen(mutC);
  gpPruef("GP-C: vorgezogenes Leeren wird erkannt (Pruefung 16 kippt)",
    !!rfC && rfC.leerenNachPruefung === false);
}

// GP-D: Anzeigestelle entfernen -> Pruefung 19 muss kippen.
const ankerD = '{matrixErr && <div className="text-xs mt-2"';
gpPruef("GP-D-Setup: Mutationsanker Anzeigestelle gefunden", src.includes(ankerD));
if (src.includes(ankerD)) {
  const mutD = src.replace(ankerD, '{false && <div className="text-xs mt-2"');
  gpPruef("GP-D: ohne Anzeigestelle bliebe die Meldung unsichtbar (Pruefung 19 kippt)",
    !/\{matrixErr && <div className="text-xs mt-2" style=\{\{ color: "var\(--mc-st-problem\)" \}\}>\{matrixErr\}<\/div>\}/.test(mutD));
}

// ---------------------------------------------------------------------------
// Ausgabe
// ---------------------------------------------------------------------------
let fail = 0;
for (const c of checks) {
  console.log((c.ok ? "OK   " : "FAIL ") + c.name + (c.ok || !c.hint ? "" : "  -- " + c.hint));
  if (!c.ok) fail++;
}
console.log("");
let gpFail = 0;
for (const c of gp) {
  console.log((c.ok ? "OK   " : "FAIL ") + c.name + (c.ok || !c.hint ? "" : "  -- " + c.hint));
  if (!c.ok) gpFail++;
}
console.log("");
if (fail === 0 && gpFail === 0) {
  console.log(`EINSTELLUNGEN-SCHREIBFEHLER-SMOKE OK (${checks.length} Pruefungen, inkl. ${gp.length} Gegenproben-Schritte)`);
} else {
  console.log(`SMOKE FEHLGESCHLAGEN: ${fail} Pruefung(en), ${gpFail} Gegenprobe(n)`);
  process.exit(1);
}
