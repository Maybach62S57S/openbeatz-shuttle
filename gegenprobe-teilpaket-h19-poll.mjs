// Teilpaket H (Chat 2), Frage H19: kann beim 3s-Poll eine AELTERE rev eine
// NEUERE lokale ueberschreiben?
//
// STAND NACH DEM POLL-/REVISIONS-FIX (Session "Poll-Absicherung"): H19 war der
// dokumentierte Beweis, dass das FRUEHERE Apply-Praedikat
//   prev && prev.rev === merged.rev && locSig === prevSig ? prev : merged
// genau diesen Rueckfall zuliess (eine langsame Poll-Antwort mit rev 4 hat den
// frischeren lokalen Stand rev 5 ueberschrieben). Der Fix ersetzt dieses
// Praedikat durch die reinen Helfer shouldAcceptRevision/shouldAcceptPolledDyn
// (monotoner Schutz: eine kleinere rev wird NIE uebernommen).
//
// Diese Gegenprobe ist deshalb von "beweist den Bug" auf "beweist, dass der Bug
// behoben ist" umgestellt: sie extrahiert die tatsaechlichen Helfer WOERTLICH
// aus dem Quelltext, ankert an ihrer realen Aufrufstelle im setDyn-Updater und
// zeigt, dass derselbe H19-Race-Fall jetzt korrekt beim frischeren Stand bleibt.
import fs from "fs";

const src = fs.readFileSync(process.argv[2] || "src/ShuttleLeitstelle.jsx", "utf8");

let pass = 0, fail = 0; const fails = [];
function ok(cond, msg) { if (cond) { pass++; console.log("OK  " + msg); } else { fail++; fails.push(msg); console.log("FAIL " + msg); } }

// --- Anker-Assertionen: brechen laut, falls der Fix verschwindet/sich aendert ---
// 1. Die beiden reinen Helfer stehen im Quelltext.
const revFnMatch = src.match(/function shouldAcceptRevision\([^)]*\) \{[\s\S]*?\n\}/);
const dynFnMatch = src.match(/function shouldAcceptPolledDyn\([^)]*\) \{[\s\S]*?\n\}/);
ok(!!revFnMatch, "Anker: shouldAcceptRevision im Quelltext vorhanden");
ok(!!dynFnMatch, "Anker: shouldAcceptPolledDyn im Quelltext vorhanden");
// 2. Der monotone Kern (kleinere rev nie uebernehmen) ist wirklich da.
ok(/return incomingRev >= currentRev;/.test(src), "Anker: monotoner Kern 'incomingRev >= currentRev' vorhanden");
// 3. Der reale setDyn-Updater ruft shouldAcceptPolledDyn mit prev.rev/merged.rev auf
//    (Kopplung an die echte Verwendung, nicht nur an die Definition).
ok(/const take = shouldAcceptPolledDyn\(prev \? prev\.rev : null, merged\.rev, prevSig, locSig\);/.test(src),
  "Anker: setDyn-Updater nutzt shouldAcceptPolledDyn(prev.rev, merged.rev, prevSig, locSig)");
// 4. Der reale setSetup-Updater nutzt denselben Revisions-Schutz.
ok(/if \(!shouldAcceptRevision\(prev \? prev\.rev : null, s\.rev\)\) return prev;/.test(src),
  "Anker: setSetup-Updater nutzt shouldAcceptRevision(prev.rev, s.rev)");

// --- Helfer WOERTLICH aus dem Quelltext ausfuehrbar machen (nicht neu getippt) ---
// eslint-disable-next-line no-new-func
const helpers = new Function(`${revFnMatch[0]}\n${dynFnMatch[0]}\nreturn { shouldAcceptRevision, shouldAcceptPolledDyn };`)();
const { shouldAcceptRevision, shouldAcceptPolledDyn } = helpers;

// Apply-Modell exakt wie im setDyn-Updater (Z. ~989):
//   const take = shouldAcceptPolledDyn(prev?.rev, merged.rev, prevSig, locSig);
//   return take ? merged : prev;
const applyPoll = (prev, merged, locSig, prevSig) =>
  shouldAcceptPolledDyn(prev ? prev.rev : null, merged.rev, prevSig, locSig) ? merged : prev;

// ---------------------------------------------------------------------------
// SZENARIO (unveraendert gegenueber der urspruenglichen H19-Analyse):
// Race zwischen langsamer Poll-Antwort und schnellem lokalem Schreiben.
//   t=0    Poll-Request P1 abgeschickt (liest rev=4).
//   t=100  Nutzer weist eine Fahrt zu (updateDyn), lokaler State SOFORT auf rev=5.
//   t=900  P1s Antwort (rev=4, vor der Zuteilung gelesen) trifft ERST JETZT ein.
// ---------------------------------------------------------------------------
const prevAfterLocalWrite = { rev: 5, rides: [{ id: "r1", assignedDriverId: "d1" }] }; // frisch, nach Zuteilung
const stalePollResponse   = { rev: 4, rides: [{ id: "r1", assignedDriverId: null }] }; // P1, vor der Zuteilung gelesen
const locSig = "unveraendert", prevSig = "unveraendert"; // GPS-Signatur hier konstant

const resultCurrent = applyPoll(prevAfterLocalWrite, stalePollResponse, locSig, prevSig);
ok(resultCurrent === prevAfterLocalWrite,
  "H19 BEHOBEN: die AELTERE Poll-Antwort (rev 4) wird jetzt verworfen, der frischere lokale Stand (rev 5) bleibt -> kein Ruecksprung mehr");

// Der naechste, echte Poll (rev 5, jetzt konsistent) wird weiterhin uebernommen
// (kein Verschlucken korrekter Aktualisierungen).
const nextPollLater = { rev: 5, rides: [{ id: "r1", assignedDriverId: "d1" }] };
ok(applyPoll(stalePollResponse, nextPollLater, locSig, prevSig) === nextPollLater,
  "nach dem stale-Fall: der echte neuere Poll (rev 5 ueber rev 4) wird korrekt uebernommen");
// gleiche rev + unveraenderte GPS-Signatur -> kein unnoetiges Re-Render (prev bleibt)
const sameRevSameGps = { rev: 5, rides: [{ id: "r1", assignedDriverId: "d1" }] };
ok(applyPoll(prevAfterLocalWrite, sameRevSameGps, locSig, prevSig) === prevAfterLocalWrite,
  "gleiche rev + unveraenderte Sig -> kein unnoetiges Re-Render (prev bleibt)");
// echte neuere Serverdaten (rev 6) werden normal uebernommen
const normalNewer = { rev: 6, rides: [{ id: "r1", assignedDriverId: "d2" }] };
ok(applyPoll(prevAfterLocalWrite, normalNewer, locSig, prevSig) === normalNewer,
  "Normalfall: echte neuere Serverdaten (rev 6) werden weiterhin uebernommen");
// gleiche rev, aber FRISCHERE GPS-Signatur -> uebernehmen (Punkt 6)
const sameRevNewGps = { rev: 5, rides: prevAfterLocalWrite.rides };
ok(applyPoll(prevAfterLocalWrite, sameRevNewGps, "gps-neu", prevSig) === sameRevNewGps,
  "gleiche rev + frischere GPS-Signatur -> uebernehmen (GPS aktualisiert sich weiter)");

// ---------------------------------------------------------------------------
// GEGENPROBE: beweist, dass der obige Befund wirklich am monotonen Schutz haengt
// und nicht am Testaufbau. Ein bewusst KAPUTTER Helfer (ohne Monotonie, nimmt
// jede rev) laesst denselben Race-Fall wieder auf den aelteren Stand kippen.
// ---------------------------------------------------------------------------
const brokenAccept = (prevRev, incomingRev, prevSig, incomingSig) =>
  (prevRev != null && prevRev === incomingRev && prevSig === incomingSig) ? false : true; // altes buggy Verhalten
const applyPollBroken = (prev, merged, ls, ps) =>
  brokenAccept(prev ? prev.rev : null, merged.rev, ps, ls) ? merged : prev;
ok(applyPollBroken(prevAfterLocalWrite, stalePollResponse, locSig, prevSig) === stalePollResponse,
  "GEGENPROBE: ohne Monotonie-Schutz kippt derselbe Fall wieder auf rev 4 -> Befund misst wirklich den Schutz, nicht den Testaufbau");

// Und die reinen Rev-Entscheidungen direkt (Punkt 4/5):
ok(shouldAcceptRevision(5, 4) === false, "shouldAcceptRevision(5,4) === false (kleinere rev nie)");
ok(shouldAcceptRevision(5, 5) === true, "shouldAcceptRevision(5,5) === true (gleiche rev erlaubt)");
ok(shouldAcceptRevision(5, 6) === true, "shouldAcceptRevision(5,6) === true (groessere rev)");
ok(shouldAcceptRevision(null, 4) === true, "shouldAcceptRevision(null,4) === true (lokal noch nichts)");

console.log(`\nH19 Poll-Race-Analyse (Fix-Nachweis): ${pass} OK, ${fail} FAIL`);
if (fails.length) console.log("Fehlgeschlagen:\n- " + fails.join("\n- "));
process.exit(fail > 0 ? 1 : 0);
