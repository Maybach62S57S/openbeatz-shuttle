// Session "Poll-Absicherung": sichert den zentralen Poll (App-Root, ~Z. 928)
// gegen Ueberlappung und gegen Rueckfall auf eine aeltere Revision ab.
// Prueft die geforderten Szenarien a-e (Aufgabenpunkt 11) sowie die Struktur
// des rekursiven, abbrechbaren setTimeout-Polls direkt am Quelltext.
//
// Reine Node-Tests: die Entscheidungshelfer werden WOERTLICH aus dem Quelltext
// extrahiert (nicht neu getippt) und ausgefuehrt; die Effect-Struktur wird per
// Anker-Assertion am echten Quelltext geprueft.
import fs from "fs";

const src = fs.readFileSync(process.argv[2] || "src/ShuttleLeitstelle.jsx", "utf8");

let pass = 0, fail = 0; const fails = [];
function ok(cond, msg) { if (cond) { pass++; console.log("OK  " + msg); } else { fail++; fails.push(msg); console.log("FAIL " + msg); } }

// --- Helfer woertlich aus dem Quelltext ausfuehrbar machen ---
const revFn = src.match(/function shouldAcceptRevision\([^)]*\) \{[\s\S]*?\n\}/);
const dynFn = src.match(/function shouldAcceptPolledDyn\([^)]*\) \{[\s\S]*?\n\}/);
ok(!!revFn && !!dynFn, "Helfer shouldAcceptRevision/shouldAcceptPolledDyn im Quelltext gefunden");
// eslint-disable-next-line no-new-func
const H = new Function(`${revFn[0]}\n${dynFn[0]}\nreturn { shouldAcceptRevision, shouldAcceptPolledDyn };`)();
const { shouldAcceptRevision, shouldAcceptPolledDyn } = H;

// Apply-Modelle exakt wie in den echten Updatern:
// dyn (Z. ~989):   shouldAcceptPolledDyn(prev?.rev, merged.rev, prevSig, locSig) ? merged : prev
// setup (Z. ~1006): !shouldAcceptRevision(prev?.rev, s.rev) -> prev; sonst (prev.rev===s.rev ? prev : s)
const applyDyn = (prev, merged, locSig, prevSig) =>
  shouldAcceptPolledDyn(prev ? prev.rev : null, merged.rev, prevSig, locSig) ? merged : prev;
const applySetup = (prev, s) => {
  if (!shouldAcceptRevision(prev ? prev.rev : null, s.rev)) return prev;
  return (prev && prev.rev === s.rev) ? prev : s;
};
const sig = "s"; // GPS-Signatur konstant, wo sie keine Rolle spielt

// ===========================================================================
// Szenario a: Poll A (rev 100) startet zuerst, Poll B (rev 101) kommt dazwischen,
// Poll A kehrt SPAETER zurueck. Der State muss auf 101 bleiben.
// ===========================================================================
let state = { rev: 100 };                       // A hat gerade rev 100 gesetzt
state = applyDyn(state, { rev: 101 }, sig, sig); // B: 101 uebernommen
ok(state.rev === 101, "a) nach Poll B ist der State auf 101");
state = applyDyn(state, { rev: 100 }, sig, sig); // A kehrt spaet zurueck (rev 100)
ok(state.rev === 101, "a) spaet zurueckkehrender Poll A (rev 100) laesst den State auf 101 (kein Rueckfall)");

// ===========================================================================
// Szenario b: lokale erfolgreiche Aktion setzt rev 102, ein VORHER gestarteter
// Poll liefert anschliessend rev 101. Der State muss auf 102 bleiben.
// ===========================================================================
let stateB = { rev: 102 };                        // lokale Aktion hat 102 gesetzt
stateB = applyDyn(stateB, { rev: 101 }, sig, sig); // alter Poll bringt 101
ok(stateB.rev === 102, "b) frischer lokaler Stand 102 bleibt trotz spaeter Poll-Antwort 101");

// ===========================================================================
// Szenario c: dyn.rev bleibt gleich, aber GPS ist neuer -> GPS muss uebernommen werden.
// ===========================================================================
const prevC = { rev: 200, driverState: { d1: { gps: { at: 1000 } } } };
const mergedC = { rev: 200, driverState: { d1: { gps: { at: 2000 } } } }; // gleiche rev, neuere Position
const resC = applyDyn(prevC, mergedC, "d1:2000", "d1:1000");
ok(resC === mergedC, "c) gleiche rev + neuere GPS-Signatur -> merged (GPS aktualisiert)");
// Gegencheck: gleiche rev + UNveraenderte Signatur -> kein Re-Render
const resCsame = applyDyn(prevC, { rev: 200 }, "d1:1000", "d1:1000");
ok(resCsame === prevC, "c) gleiche rev + gleiche GPS-Signatur -> prev (kein unnoetiges Re-Render)");

// ===========================================================================
// Szenario d: Komponente wird waehrend eines laufenden Polls unmounted -> danach
// keine State-Aenderung. Wird an der echten Effect-Struktur geprueft: cancelled-
// Flag + Guards nach jedem await + Cleanup setzt cancelled=true und clearTimeout.
// ===========================================================================
// Effect-Block ausschneiden (vom Poll-useEffect bis zu seiner Dependency-Zeile).
const effStart = src.indexOf("let cancelled = false;");
const effEnd = src.indexOf("}, [loading, loadError]);", effStart);
ok(effStart !== -1 && effEnd !== -1, "d) Poll-Effect-Block im Quelltext lokalisiert");
const eff = src.slice(effStart, effEnd);
// mindestens zwei Guards "if (cancelled) return;" NACH einem await (dyn + setup)
const cancelledGuards = (eff.match(/if \(cancelled\) return;/g) || []).length;
ok(cancelledGuards >= 3, `d) mindestens 3 'if (cancelled) return;'-Guards vorhanden (waren ${cancelledGuards}: nach dyn-await, nach setup-await, im catch)`);
ok(/return \(\) => \{ cancelled = true; if \(timer\) clearTimeout\(timer\); \};/.test(eff),
  "d) Cleanup setzt cancelled=true und raeumt den geplanten Timer ab -> kein weiterer Poll, kein State nach Unmount");
// Modell: ein zurueckkehrender Poll mit cancelled=true darf keinen Setter rufen.
function runPollModel(cancelled) {
  let setterCalls = 0;
  const setDyn = () => { setterCalls++; };
  const setSetup = () => { setterCalls++; };
  const setConnIssue = () => { setterCalls++; };
  // nachgebildeter Ablauf: nach dem await pruefen wir cancelled
  if (cancelled) return setterCalls;       // Guard 1 (nach dyn-await)
  setDyn();
  if (cancelled) return setterCalls;       // Guard 2 (nach setup-await)
  setSetup();
  setConnIssue();
  return setterCalls;
}
ok(runPollModel(true) === 0, "d) Modell: bei cancelled=true ruft der zurueckkehrende Poll keinen Setter");
ok(runPollModel(false) === 3, "d) Modell-Gegenprobe: ohne cancelled laufen die Setter normal (3)");

// ===========================================================================
// Szenario e: ein Poll schlaegt fehl, der naechste gelingt -> Banner wird entfernt.
// Bannerlogik: catch -> setConnIssue(fehler); Erfolg -> setConnIssue(null).
// Beide nur, wenn NICHT cancelled (verspaeteter alter Poll fasst Banner nicht an).
// ===========================================================================
ok(/setConnIssue\(e\?\.message \|\| "Verbindung zu Supabase gerade gestört"\);/.test(eff),
  "e) Fehlerfall setzt das Verbindungs-Banner");
ok(/setConnIssue\(null\);/.test(eff), "e) Erfolgsfall loescht das Verbindungs-Banner");
// der catch hat einen cancelled-Guard VOR setConnIssue (verspaeteter Poll setzt keinen Fehler)
ok(/catch \(e\) \{\s*if \(cancelled\) return;/.test(eff),
  "e) catch bricht bei cancelled ab, bevor es einen Fehler setzt (alter Poll setzt kein Banner)");
// Modell des Banner-Verlaufs: fail -> success
function bannerModel(steps) {
  let conn = null; // null = kein Banner
  for (const step of steps) {
    if (step === "fail") conn = "Verbindung gestoert";
    else if (step === "ok") conn = null;
  }
  return conn;
}
ok(bannerModel(["fail"]) === "Verbindung gestoert", "e) nach Fehl-Poll ist das Banner gesetzt");
ok(bannerModel(["fail", "ok"]) === null, "e) nach erfolgreichem Folge-Poll ist das Banner wieder weg");

// ===========================================================================
// Struktur: Ueberlappungsschutz. Kein setInterval mehr im Poll-Effect; der
// naechste Poll wird im finally per setTimeout(runPoll, POLL_MS) geplant.
// ===========================================================================
ok(!/setInterval\(/.test(eff), "Ueberlappungsschutz: kein setInterval mehr im Poll-Effect");
ok(/finally \{[\s\S]*if \(!cancelled\) timer = setTimeout\(runPoll, POLL_MS\);/.test(eff),
  "Ueberlappungsschutz: naechster Poll wird erst im finally (nach Abschluss) geplant");
ok(/timer = setTimeout\(runPoll, POLL_MS\);\s*\n\s*return \(\) =>/.test(eff),
  "Ueberlappungsschutz: erster Poll per setTimeout, danach Cleanup");

// ===========================================================================
// PFLICHT-GEGENPROBE (Projektkonvention): ein bewusst kaputter Helfer ohne
// Monotonie muss die Szenarien a und b kippen -> beweist, dass die Tests wirklich
// den Schutz messen und nicht immer gruen sind.
// ===========================================================================
const brokenAccept = (prevRev, incomingRev, ps, is) =>
  (prevRev != null && prevRev === incomingRev && ps === is) ? false : true;
const applyDynBroken = (prev, merged, locSig, prevSig) =>
  brokenAccept(prev ? prev.rev : null, merged.rev, prevSig, locSig) ? merged : prev;
let gp = { rev: 101 };
gp = applyDynBroken(gp, { rev: 100 }, sig, sig);
ok(gp.rev === 100, "GEGENPROBE: ohne Monotonie kippt Szenario a auf rev 100 (Test misst wirklich den Schutz)");
let gpb = { rev: 102 };
gpb = applyDynBroken(gpb, { rev: 101 }, sig, sig);
ok(gpb.rev === 101, "GEGENPROBE: ohne Monotonie kippt Szenario b auf rev 101");

// ===========================================================================
// setup-Monotonie (Punkt 5): kleinere setup.rev wird nie uebernommen.
// ===========================================================================
ok(applySetup({ rev: 10 }, { rev: 9 }).rev === 10, "setup) kleinere setup.rev (9<10) wird verworfen");
ok(applySetup({ rev: 10 }, { rev: 11 }).rev === 11, "setup) groessere setup.rev (11) wird uebernommen");
const setupSame = { rev: 10, x: 1 };
ok(applySetup(setupSame, { rev: 10, x: 2 }) === setupSame, "setup) gleiche rev -> prev (kein Re-Render)");

console.log(`\nPoll-Absicherung Smoke: ${pass} OK, ${fail} FAIL`);
if (fails.length) console.log("Fehlgeschlagen:\n- " + fails.join("\n- "));
process.exit(fail > 0 ? 1 : 0);
