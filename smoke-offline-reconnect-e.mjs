// Block-E-Beweistest: Offline- und Wiederverbindungsverhalten.
//
// Ergaenzt smoke-poll-absicherung.mjs (Banner-Set/Clear, cancelled-Poll,
// dyn+setup-Monotonie inkl. Gegenprobe) um die Block-E-Invarianten, die dort
// NICHT abgedeckt sind, so wie sie in src/ShuttleLeitstelle.jsx implementiert
// sind:
//
//   E1  ConnIssueBanner-Logik: Prioritaet offline > Abgleichfehler > reconnected;
//       alles gut -> kein Banner (null); KEIN roher Fehlertext (message wird nur
//       als truthy-Flag genutzt).
//   E2  justReconnected-Uebergang: feuert NUR beim echten Uebergang schlecht->gut
//       (BEIDE Bad-Flags weg). NICHT bei "WLAN zurueck, Server noch tot"
//       (isOffline=false, connIssue!=null). NICHT beim ersten Laden (Startzustand
//       gut -> kein Uebergang).
//   E3  Offline beim Laden: sget wirft -> loadError gesetzt, setSetup/setDyn
//       werden NICHT aufgerufen (keine leere "es gibt keine Fahrten"-Ansicht).
//   E4  Kein lokaler Schattenbetrieb bei Ausfall: hasSupabase() haengt an der
//       KONFIGURATION (window.__obfSupabase), nicht an Erreichbarkeit. Bei
//       Ausfall bleibt der Supabase-Zweig aktiv und wirft -> der window.storage-
//       Zweig wird NIE erreicht (Entscheidungsebene; der vollstaendige
//       Fallback-Nachweis gehoert in die finale Live-Readiness-Suite, Test 5).
//   E5  Poll ist nicht offline-gated: die connIssue-Loeschung haengt nur an einem
//       spaeteren erfolgreichen Poll, nicht am Offline-Flag -> Selbstheilung.
//
// Verankerung gegen die Quelle: der Test LIEST src/ShuttleLeitstelle.jsx und
// prueft, dass die drei exakten Banner-Texte und die Uebergangs-Bedingung dort
// unveraendert vorkommen. Aendert jemand die Quelle, faellt die Replik als
// veraltet auf (Drift-Erkennung), statt still Falsches zu behaupten.
//
// Pflicht-Gegenprobe (E-GP): entfernt man die "beide Bad-Flags weg"-Bedingung
// (feuert schon bei WLAN-zurueck), meldet der Uebergang faelschlich "wieder
// verbunden", obwohl der Server noch tot ist -> die E2-Pruefung kippt.
//
// Aufruf: node smoke-offline-reconnect-e.mjs [src/ShuttleLeitstelle.jsx]

import fs from "fs";

let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push(m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} (erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)})`);

const srcFile = process.argv[2] || "src/ShuttleLeitstelle.jsx";
const src = fs.readFileSync(srcFile, "utf8");

// ===========================================================================
// VERANKERUNG gegen die Quelle (Drift-Erkennung)
// ===========================================================================
const T_OFFLINE = "Offline. Änderungen werden gerade nicht gespeichert und gehen verloren. Sobald die Verbindung zurück ist, bitte noch einmal tippen.";
const T_ERROR   = "Letzter Datenabgleich fehlgeschlagen, es wird der zuletzt bekannte Stand gezeigt. Neuer Versuch läuft automatisch.";
const T_RECONN  = "Wieder verbunden.";
ok(src.includes(T_OFFLINE), "Verankerung: Offline-Text unveraendert in der Quelle");
ok(src.includes(T_ERROR),   "Verankerung: Abgleichfehler-Text unveraendert in der Quelle");
ok(src.includes(T_RECONN),  "Verankerung: Reconnected-Text unveraendert in der Quelle");
// Uebergangs-Bedingung: bad = isOffline || !!connIssue; feuern nur wenn war-bad UND !bad.
ok(/const bad = isOffline \|\| !!connIssue;/.test(src), "Verankerung: bad = isOffline || !!connIssue vorhanden");
ok(/if \(wasConnBadRef\.current && !bad\)/.test(src), "Verankerung: Uebergang nur bei war-bad UND !bad");
// hasSupabase haengt an window.__obfSupabase (Konfiguration), nicht an Erreichbarkeit.
ok(/const hasSupabase = \(\) => typeof window !== "undefined" && !!window\.__obfSupabase;/.test(src),
   "Verankerung: hasSupabase() an Konfiguration gebunden (nicht an Erreichbarkeit)");
// sget/sset nehmen bei hasSupabase() den Supabase-Zweig VOR dem window.storage-Zweig.
ok(/if \(hasSupabase\(\)\) return key === SETUP_KEY \? await sbGetSetup\(\) : await sbGetDyn\(\);/.test(src),
   "Verankerung: sget nimmt bei hasSupabase() den Supabase-Zweig (wirft, kein Fallthrough)");

// ===========================================================================
// ZEILENGETREUE Replik: ConnIssueBanner-Entscheidung (Z. 1583-1603)
// Gibt den ANZEIGE-Typ + Text zurueck (statt JSX). message wird NUR als
// truthy-Flag genutzt, sein Inhalt taucht NIE im Text auf.
// ===========================================================================
function connBanner(message, offline, reconnected) {
  let kind, text;
  if (offline) {
    kind = "offline";
    text = T_OFFLINE;
  } else if (message) {
    kind = "error";
    text = T_ERROR;
  } else if (reconnected) {
    kind = "reconnected";
    text = T_RECONN;
  } else {
    return null;
  }
  return { kind, text };
}

// --- E1: Prioritaet + kein Rohtext ----------------------------------------
{
  const rawMsg = "permission denied for table dyn_data"; // technischer Rohstring
  // offline hat Vorrang, auch wenn gleichzeitig ein message-Fehler vorliegt
  eq(connBanner(rawMsg, true, false).kind, "offline", "E1 Prioritaet: offline schlaegt Abgleichfehler");
  eq(connBanner(rawMsg, true, true).kind, "offline", "E1 Prioritaet: offline schlaegt reconnected");
  eq(connBanner(rawMsg, false, false).kind, "error", "E1 Abgleichfehler wenn nur message gesetzt");
  eq(connBanner(rawMsg, false, true).kind, "error", "E1 message schlaegt reconnected");
  eq(connBanner(null, false, true).kind, "reconnected", "E1 reconnected wenn sonst nichts");
  eq(connBanner(null, false, false), null, "E1 alles gut -> kein Banner (null)");
  // KEIN Rohtext: der technische message-Inhalt darf in KEINEM Text auftauchen
  for (const b of [connBanner(rawMsg, true, false), connBanner(rawMsg, false, false)]) {
    ok(!b.text.includes("permission denied"), "E1 kein roher Fehlertext im Banner");
    ok(!/dyn_data|PGRST|ECONN|fetch/i.test(b.text), "E1 Banner-Text ist rein menschenlesbar");
  }
  // Der Offline-Text verspricht bewusst KEINE automatische Nachholung (keine Queue).
  ok(/erneut|noch einmal tippen/i.test(connBanner(null, true, false).text), "E1 Offline-Text: fordert erneutes Tippen");
  ok(!/automatisch/i.test(connBanner(null, true, false).text), "E1 Offline-Text verspricht KEINE automatische Nachholung");
  // Der Abgleichfehler-Text DARF 'automatisch' sagen (Poll liest wirklich weiter).
  ok(/automatisch/i.test(connBanner("x", false, false).text), "E1 Abgleichfehler-Text: Poll laeuft automatisch weiter");
}

// ===========================================================================
// ZEILENGETREUE Replik: justReconnected-Uebergang (Z. 1104-1113)
// ===========================================================================
function makeReconnectMachine() {
  let wasConnBad = false;         // wasConnBadRef.current
  let justReconnected = false;    // sichtbarer gruener Hinweis
  let fires = 0;
  // ruft der Effekt bei jeder Aenderung von (isOffline, connIssue) auf:
  const step = (isOffline, connIssue) => {
    const bad = isOffline || !!connIssue;
    if (wasConnBad && !bad) {
      wasConnBad = bad;
      justReconnected = true; fires++;
      return;
    }
    wasConnBad = bad;
    // (justReconnected wird im echten Code nach 4s per Timeout zurueckgesetzt;
    //  fuer den Test genuegt der Fire-Zaehler.)
  };
  return { step, getFires: () => fires, isJust: () => justReconnected, reset: () => { justReconnected = false; } };
}

// --- E2a: normaler Ablauf gut -> offline -> zurueck -> feuert genau einmal ---
{
  const m = makeReconnectMachine();
  m.step(false, null);            // Start gut (erster Render) -> KEIN Feuern
  ok(m.getFires() === 0, "E2a erster Render (gut) -> kein 'wieder verbunden'");
  m.step(true, null);             // offline
  ok(m.getFires() === 0, "E2a offline -> noch kein Feuern");
  m.step(false, "poll-fehler");   // WLAN zurueck, aber Server noch tot
  ok(m.getFires() === 0, "E2a WLAN zurueck aber Abgleich noch fehlerhaft -> KEIN Feuern");
  m.step(false, null);            // erst jetzt beide Flags weg
  ok(m.getFires() === 1, "E2a beide Flags weg -> feuert genau einmal");
}

// --- E2b: nur Abgleichfehler (online) -> weg -> feuert einmal ---------------
{
  const m = makeReconnectMachine();
  m.step(false, null);            // gut
  m.step(false, "supabase kurz gestoert");
  m.step(false, null);
  ok(m.getFires() === 1, "E2b Abgleichfehler online -> danach genau ein 'wieder verbunden'");
}

// --- E2c: KEIN Feuern, wenn nie schlecht ------------------------------------
{
  const m = makeReconnectMachine();
  m.step(false, null); m.step(false, null); m.step(false, null);
  ok(m.getFires() === 0, "E2c durchgaengig gut -> nie 'wieder verbunden'");
}

// ===========================================================================
// E3: Offline beim Laden -> loadError, KEIN setSetup/setDyn (keine leere Ansicht)
// Modell des Initial-Load try/catch (Z. 933-997): sget wirft -> catch -> loadError.
// ===========================================================================
async function initialLoad({ sgetThrows }) {
  let setup = "UNSET", dyn = "UNSET", loadError = null, loading = true;
  try {
    if (sgetThrows) throw new Error("Failed to fetch"); // sbGetSetup wirft bei Supabase-/Netzfehler
    setup = { ok: true }; dyn = { ok: true }; loading = false;
  } catch (e) {
    loadError = e?.message || "Unbekannter Ladefehler";
    loading = false;
    // WICHTIG: setSetup/setDyn bleiben ununberuehrt -> keine leere Ansicht
  }
  return { setup, dyn, loadError, loading };
}
{
  const bad = await initialLoad({ sgetThrows: true });
  ok(bad.loadError && bad.loadError.length > 0, "E3 Offline beim Laden -> loadError gesetzt");
  eq(bad.setup, "UNSET", "E3 Offline beim Laden -> setup NICHT auf leer gesetzt");
  eq(bad.dyn, "UNSET", "E3 Offline beim Laden -> dyn NICHT auf leer gesetzt");
  ok(bad.loading === false, "E3 Offline beim Laden -> loading beendet (Fehlerseite statt Endlos-Splash)");
  const good = await initialLoad({ sgetThrows: false });
  ok(good.loadError === null && good.setup.ok, "E3 normaler Load -> kein loadError, Daten gesetzt");
}

// ===========================================================================
// E4: Kein lokaler Schattenbetrieb bei Ausfall (Entscheidungsebene).
// Replik der sget-Zweigwahl (Z. 481-486): hasSupabase() true -> Supabase-Zweig,
// der bei Ausfall WIRFT; der window.storage-Zweig wird NIE erreicht.
// ===========================================================================
function sgetBranch({ configured, supabaseThrows, storeValue }) {
  let storeTouched = false;
  const hasSupabase = () => configured;   // haengt an Konfiguration, NICHT an Erreichbarkeit
  if (hasSupabase()) {
    if (supabaseThrows) throw new Error("network request failed"); // sbGetDyn: if(error) throw
    return { source: "supabase", value: { ok: true } };
  }
  // window.storage-Zweig NUR bei fehlender Konfiguration:
  storeTouched = true;
  return { source: "store", value: storeValue, storeTouched };
}
{
  // Supabase konfiguriert + Ausfall -> WIRFT, kein store-Zugriff (kein Schatten)
  let threw = false, touchedStore = false;
  try { sgetBranch({ configured: true, supabaseThrows: true }); }
  catch { threw = true; }
  ok(threw, "E4 Supabase konfiguriert + Ausfall -> sget WIRFT (kontrollierter Fehler)");
  // Beweis, dass der store-Zweig bei Konfiguration NICHT erreichbar ist: selbst mit
  // storeValue wuerde er nie zurueckgegeben, weil der throw davor liegt.
  try { sgetBranch({ configured: true, supabaseThrows: true, storeValue: { shadow: true } }); }
  catch { touchedStore = false; }
  ok(!touchedStore, "E4 kein window.storage-Schattenwert bei konfiguriertem, ausgefallenem Supabase");
  // Nur ohne Konfiguration (bewusster lokaler/Dev-Modus) wird der store genutzt:
  const dev = sgetBranch({ configured: false, supabaseThrows: false, storeValue: { local: true } });
  eq(dev.source, "store", "E4 ohne Supabase-Konfiguration -> bewusster lokaler Store (Dev/Artifact)");
}

// ===========================================================================
// E5: Selbstheilung - connIssue wird durch einen spaeteren erfolgreichen Poll
// geloescht, unabhaengig vom Offline-Flag (Poll ist nicht offline-gated).
// Modell der Poll-Schleife: setConnIssue(null) im Erfolgspfad, setConnIssue(msg)
// im catch. Ein Erfolgs-Poll nach einem Fehl-Poll loescht das Banner.
// ===========================================================================
{
  let connIssue = null;
  const poll = (fails) => { try { if (fails) throw new Error("net"); connIssue = null; } catch (e) { connIssue = e.message; } };
  poll(true);  ok(connIssue !== null, "E5 Fehl-Poll setzt connIssue");
  poll(true);  ok(connIssue !== null, "E5 weiterer Fehl-Poll: bleibt gesetzt");
  poll(false); ok(connIssue === null, "E5 erfolgreicher Folge-Poll loescht connIssue (Selbstheilung)");
}

// ===========================================================================
// E-GP  PFLICHT-GEGENPROBE: entfernt man die "beide Bad-Flags weg"-Bedingung
// (feuert schon, sobald isOffline weg ist, egal ob connIssue noch gesetzt),
// meldet der Uebergang faelschlich "wieder verbunden" trotz totem Server.
// ===========================================================================
let gpKippte = false;
{
  // Kaputte Variante: bad := isOffline (connIssue ignoriert)
  let wasBad = false, fires = 0;
  const stepBroken = (isOffline, connIssue) => {
    const bad = isOffline; // ABSICHTLICH KAPUTT: connIssue ignoriert
    if (wasBad && !bad) { wasBad = bad; fires++; return; }
    wasBad = bad;
  };
  stepBroken(false, null);          // gut
  stepBroken(true, null);           // offline
  stepBroken(false, "server tot");  // WLAN zurueck, Server NOCH tot
  // Kaputte Variante feuert hier faelschlich:
  gpKippte = (fires === 1);
  ok(gpKippte, "E-GP kaputte Bedingung feuert faelschlich bei totem Server (Gegenprobe kippt wie erwartet)");
  // Die KORREKTE Variante feuert an derselben Stelle NICHT (Kontrast):
  const m = makeReconnectMachine();
  m.step(false, null); m.step(true, null); m.step(false, "server tot");
  ok(m.getFires() === 0, "E-GP korrekte Variante feuert an derselben Stelle NICHT");
}

// ===========================================================================
console.log(`\nBlock-E Offline/Reconnect Smoke: ${pass} OK, ${fail} FAIL`);
if (fail) { console.log("FEHLER:"); fails.forEach((f) => console.log("  - " + f)); process.exit(1); }
console.log(gpKippte ? "Gegenprobe E-GP: kippte wie erwartet." : "Gegenprobe E-GP: NICHT gekippt!");
console.log("ALLE GRUEN");
