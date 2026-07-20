// Teilpaket H (Chat 2), Frage H19: kann beim 3s-Poll eine AELTERE rev eine
// NEUERE lokale ueberschreiben?
//
// Extrahiert die tatsaechliche, im Quelltext stehende Apply-Praedikat-Zeile
// (Z. 951, siehe Anker-Assertion unten) WOERTLICH und prueft sie gegen ein
// Race-Szenario: ein Poll-Request wird VOR einem lokalen Schreibvorgang
// gestartet, seine Antwort trifft aber ERST NACH dem lokalen Schreibvorgang
// ein (normale Netzwerk-Nebenlaeufigkeit, keine Konstruktion). Die Antwort
// traegt dann eine AELTERE rev als der bereits lokal gesetzte, frischere
// Stand.
import fs from "fs";

const src = fs.readFileSync(process.argv[2] || "src/ShuttleLeitstelle.jsx", "utf8");
const lines = src.split("\n");
const LINE_NO = 951; // 1-indexiert, wie im Editor/View
const line = lines[LINE_NO - 1];

let pass = 0, fail = 0; const fails = [];
function ok(cond, msg) { if (cond) { pass++; console.log("OK  " + msg); } else { fail++; fails.push(msg); console.log("FAIL " + msg); } }

// Anker-Assertion: bricht laut statt still falsch zu messen, falls sich die
// Zeile/Zeilennummer seit dieser Analyse verschoben hat.
ok(line.includes("setDyn((prev) => (prev && prev.rev === merged.rev") && line.includes("locSig === prevSig ? prev : merged"),
  `Anker Z.${LINE_NO} stimmt noch mit dem tatsaechlichen Quelltext ueberein`);

// Das Praedikat selbst woertlich aus der Zeile herausschneiden (nicht neu
// getippt) und als echte Funktion ausfuehren.
const predSrc = line.match(/\(prev\) => \((.*)\)\);?\s*$/)[1];
ok(predSrc === "prev && prev.rev === merged.rev && locSig === prevSig ? prev : merged",
  "Praedikat woertlich extrahiert (unveraendert gegenueber bekanntem Stand)");
// eslint-disable-next-line no-new-func
const applyPoll = new Function("prev", "merged", "locSig", "prevSig", `return (${predSrc});`);

// ---------------------------------------------------------------------------
// SZENARIO: Race zwischen langsamer Poll-Antwort und schnellem lokalem Schreiben.
//
// t=0    Poll-Request P1 wird abgeschickt (liest zu diesem Zeitpunkt rev=4).
// t=100  Nutzer weist eine Fahrt zu (updateDyn), Server-CAS erfolgreich,
//        lokaler State wird SOFORT auf rev=5 gesetzt (Z. 1043 setDyn(applied)).
// t=900  P1s Antwort (rev=4, VOR der Zuteilung gelesen) trifft JETZT erst ein
//        (normale Netzwerk-Latenz/Jitter, kein Sonderfall) und ruft den
//        Poll-Handler auf, der `applyPoll` mit merged=P1-Antwort aufruft.
// ---------------------------------------------------------------------------
const prevAfterLocalWrite = { rev: 5, rides: [{ id: "r1", assignedDriverId: "d1" }] }; // frisch, nach Zuteilung
const stalePollResponse   = { rev: 4, rides: [{ id: "r1", assignedDriverId: null }] }; // P1, vor der Zuteilung gelesen
const locSig = "unveraendert", prevSig = "unveraendert"; // GPS-Signatur spielt hier keine Rolle, konstant gehalten

const resultCurrent = applyPoll(prevAfterLocalWrite, stalePollResponse, locSig, prevSig);
const raceExists = resultCurrent === stalePollResponse;
ok(raceExists,
  `H19 bestaetigt: aktuelles Praedikat (Z.${LINE_NO}) uebernimmt die AELTERE Poll-Antwort (rev 4) ueber den frischeren lokalen Stand (rev 5) -> UI faellt kurzzeitig zurueck`);

// Einordnung der Tragweite: KEIN Datenverlust in der DB (die betrifft nur den
// naechsten sget()-Aufruf, der wieder den echten Serverstand liest), sondern
// eine bis zu einem POLL_MS (3s) sichtbare Ruecksprung-Anzeige im Browser
// dieses einen Nutzers. Selbstheilend: der naechste Poll (3s spaeter) liest
// wieder den echten (inzwischen weiterhin rev=5 oder hoeher) Serverstand,
// merged.rev !== prev.rev (=4) -> wird dann korrekt uebernommen.
const nextPollLater = { rev: 5, rides: [{ id: "r1", assignedDriverId: "d1" }] }; // 3s spaeter, jetzt konsistent
const selfHealed = applyPoll(stalePollResponse, nextPollLater, locSig, prevSig);
ok(selfHealed === nextPollLater, "Selbstheilung: der naechste (echte) Poll-Zyklus korrigiert den Ruecksprung wieder auf den aktuellen Stand");

// ---------------------------------------------------------------------------
// GEGENPROBE: beweist, dass der obige Befund wirklich das Praedikat misst und
// nicht zufaellig immer "Race" zurueckgibt. Ein monotoner Schutz
// (merged.rev < prev.rev -> NICHT uebernehmen) macht denselben Testfall
// erwartungsgemaess gruen -> zeigt, dass ein Fix isoliert an genau dieser
// Stelle wirken wuerde, ohne den Rest der Poll-Logik anzufassen.
// ---------------------------------------------------------------------------
const predSrcFixed = "prev && (merged.rev < prev.rev || (prev.rev === merged.rev && locSig === prevSig)) ? prev : merged";
const applyPollFixed = new Function("prev", "merged", "locSig", "prevSig", `return (${predSrcFixed});`);
const resultFixed = applyPollFixed(prevAfterLocalWrite, stalePollResponse, locSig, prevSig);
ok(resultFixed === prevAfterLocalWrite,
  "GEGENPROBE: mit monotonem Schutz (merged.rev < prev.rev -> verwerfen) bleibt derselbe Race-Fall beim frischeren lokalen Stand -> Befund haengt wirklich am Praedikat, nicht am Testaufbau");
// und der Normalfall (echte neuere Serverdaten) funktioniert mit dem Schutz unveraendert weiter:
const normalNewer = { rev: 6, rides: [{ id: "r1", assignedDriverId: "d2" }] };
const resultFixedNormal = applyPollFixed(prevAfterLocalWrite, normalNewer, locSig, prevSig);
ok(resultFixedNormal === normalNewer, "Gegenprobe-Fix bricht den Normalfall nicht: echte neuere Serverdaten (rev 6) werden weiterhin uebernommen");

console.log(`\nH19 Poll-Race-Analyse: ${pass} OK, ${fail} FAIL`);
if (fails.length) console.log("Fehlgeschlagen:\n- " + fails.join("\n- "));
process.exit(fail > 0 ? 1 : 0);
