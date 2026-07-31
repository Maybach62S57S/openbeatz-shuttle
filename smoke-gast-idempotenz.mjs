// Session "Gast-Idempotenz auf DB-Ebene": sichert die Haertung der drei
// Gast-RPCs in supabase-schema.sql ab (guest_confirm_pickup, guest_at_pickup,
// guest_report_issue + interner Helfer _guest_patch_ride).
//
// HINTERGRUND: Die drei RPCs setzten ihren Zeitstempel bzw. haengten ihren
// Issue-Eintrag BEDINGUNGSLOS an. Ein Retry (Netzfehler, Antwort kam beim
// Client nicht an) oder ein zweiter Tab erzeugte damit doppelte Log-/Issue-
// Eintraege und zaehlte dyn_rev unnoetig hoch. Der Client-Schutz greift nur
// im Artifact-Pfad; der Supabase-Pfad geht direkt in den RPC.
//
// WAS DIESER TEST IST UND WAS NICHT: Er prueft die STRUKTUR des SQL am
// Quelltext (Anker), damit die Haertung nicht unbemerkt wieder herausfaellt.
// Er fuehrt KEIN SQL aus und ersetzt deshalb nicht den Verhaltensnachweis.
// Den liefert gegenprobe-gast-idempotenz-postgres.mjs gegen eine echte
// Postgres-Instanz (nicht Teil der Standard-Suite, siehe Kopf dort).
//
// Jede Pflichtpruefung hat eine Gegenprobe: der Quelltext wird gezielt
// mutiert (Guard entfernt) und der Test muss das erkennen. Sonst wuerde der
// Test nur sich selbst messen.
//
// Reiner Node-Test, keine Imports ausser node:fs.
import fs from "fs";

const path = process.argv[2] || "supabase-schema.sql";
const sql = fs.readFileSync(path, "utf8");

let pass = 0, fail = 0; const fails = [];
function ok(cond, msg) {
  if (cond) { pass++; console.log("OK   " + msg); }
  else { fail++; fails.push(msg); console.log("FAIL " + msg); }
}

// ---------------------------------------------------------------------------
// Die Nachtrag-Sektion isolieren. Wichtig: die ALTE (ungehaertete) Definition
// steht weiter oben in derselben Datei und bleibt dort als Dokumentation
// stehen. Wuerde der Test die ganze Datei durchsuchen, wuerden die Anker
// unten auch auf der alten Sektion anschlagen und nichts beweisen.
// ---------------------------------------------------------------------------
const MARKER = "Nachtrag Gast-Idempotenz (DB-Ebene)";
const idx = sql.indexOf(MARKER);
ok(idx > 0, "Nachtrag-Sektion 'Gast-Idempotenz' in der Datei gefunden");
const nachtrag = idx > 0 ? sql.slice(idx) : "";
const davor = idx > 0 ? sql.slice(0, idx) : sql;

// Vorbedingung: die alte Sektion existiert wirklich noch davor. Damit ist
// belegt, dass die Isolierung oben nicht nur zufaellig funktioniert.
ok(/create or replace function _guest_patch_ride\(p_token text, p_ride text, p_patch jsonb, p_log_event text, p_log_detail text\)/.test(davor),
  "Vorbedingung: alte 5-Parameter-Definition steht weiterhin oberhalb (rein additiver Nachtrag)");

// ===========================================================================
// TEIL 1: _guest_patch_ride - Guard, Nachpruefung, Signatur
// ===========================================================================

// P1: der neue Parameter existiert.
const hatParam = /create or replace function _guest_patch_ride\([\s\S]{0,400}?p_idempotent_field text/.test(nachtrag);
ok(hatParam, "P1: _guest_patch_ride hat den Parameter p_idempotent_field");

// P2: KEIN Default-Wert. Mit "default null" waere die neue Version auch mit
// 5 Argumenten aufrufbar -> Aufrufe waeren mehrdeutig, sobald die alte
// 5-Parameter-Version gleichzeitig existiert (passiert beim erneuten
// Einspielen der kompletten Datei). Regressionsanker: dieser Fehler ist im
// Bau real aufgetreten und wurde per Dreifach-Einspielung nachgewiesen.
ok(!/p_idempotent_field text default/i.test(nachtrag),
  "P2: p_idempotent_field hat KEINEN Default-Wert (sonst mehrdeutige Aufrufe)");

// P3: der Guard steckt in der WHERE-Bedingung des UPDATE, ist also Teil der
// atomaren Anweisung. Eine separate Vorab-Pruefung waere retry-sicher, aber
// NICHT race-sicher.
ok(/and \(p_idempotent_field is null or coalesce\(e->>p_idempotent_field, ''\) = ''\)/.test(nachtrag),
  "P3: Guard steht in der WHERE-Bedingung des UPDATE (race-sicher, nicht nur retry-sicher)");

// P4: Nachpruefung unterscheidet "Fahrt gibt es nicht" von "schon gesetzt".
ok(/v_already_set/.test(nachtrag) && /coalesce\(e->>p_idempotent_field, ''\) <> ''/.test(nachtrag),
  "P4: Nachpruefung unterscheidet 'Fahrt/Token passt nicht' von 'bereits gesetzt'");

// P5: No-op meldet Erfolg (true), nicht Fehler. Sonst bekommt der Gast bei
// einem legitimen Retry eine Fehlermeldung, obwohl alles in Ordnung ist.
ok(/if v_already_set then\s*\n\s*return true;/.test(nachtrag),
  "P5: bereits gesetzt -> return true (sauberer No-op, keine Fehlermeldung beim Gast)");

// P6: der echte Fehlerfall gibt weiterhin false zurueck.
ok(/\n  return false;\nend \$\$;/.test(nachtrag),
  "P6: Fahrt/Token passt nicht -> weiterhin return false");

// P7: die alte 5-Parameter-Version wird explizit weggeraeumt (Zombie-Overload).
ok(/drop function if exists _guest_patch_ride\(text, text, jsonb, text, text\);/.test(nachtrag),
  "P7: alte 5-Parameter-Version wird explizit gedroppt (kein Zombie-Overload)");

// P8: DROP und Neuanlage in EINER Transaktion, sonst entsteht ein Zeitfenster,
// in dem guest_confirm_pickup/guest_at_pickup ins Leere zeigen.
const bg = nachtrag.indexOf("\nbegin;");
const cm = nachtrag.lastIndexOf("\ncommit;");
const dropPos = nachtrag.indexOf("drop function if exists _guest_patch_ride");
ok(bg > 0 && cm > bg && dropPos > bg && dropPos < cm,
  "P8: DROP und Neuanlage liegen gemeinsam in einer Transaktion (begin/commit)");

// ===========================================================================
// TEIL 2: die drei RPCs - richtiges Feld, unveraenderte Signatur
// ===========================================================================

// P9/P10: jeder RPC uebergibt GENAU sein eigenes Zeitstempel-Feld als
// Idempotenz-Schluessel. Ein vertauschtes Feld waere fatal: dann wuerde
// z. B. "at pickup" blockiert, weil vorher "confirm" gesetzt wurde.
const confirmFn = (nachtrag.match(/create or replace function guest_confirm_pickup[\s\S]*?\$\$;/) || [""])[0];
const atPickupFn = (nachtrag.match(/create or replace function guest_at_pickup[\s\S]*?\$\$;/) || [""])[0];

ok(/'guestConfirmedAt'\);/.test(confirmFn) && /jsonb_build_object\('guestConfirmedAt'/.test(confirmFn),
  "P9: guest_confirm_pickup nutzt guestConfirmedAt als Idempotenz-Schluessel");
ok(/'guestAtPickupAt'\);/.test(atPickupFn) && /jsonb_build_object\('guestAtPickupAt'/.test(atPickupFn),
  "P10: guest_at_pickup nutzt guestAtPickupAt als Idempotenz-Schluessel");

// P11: die beiden Felder sind NICHT vertauscht (expliziter Kreuz-Check).
ok(!/'guestAtPickupAt'\);/.test(confirmFn) && !/'guestConfirmedAt'\);/.test(atPickupFn),
  "P11: Kreuz-Check - die beiden Idempotenz-Felder sind nicht vertauscht");

// P12: die oeffentlichen Signaturen bleiben unveraendert. Aendern sie sich,
// werden die GRANTs weiter oben ungueltig und der Gast-Link faellt aus.
ok(/create or replace function guest_confirm_pickup\(p_token text, p_ride text\)/.test(nachtrag),
  "P12a: guest_confirm_pickup behaelt Signatur (text, text)");
ok(/create or replace function guest_at_pickup\(p_token text, p_ride text\)/.test(nachtrag),
  "P12b: guest_at_pickup behaelt Signatur (text, text)");
ok(/create or replace function guest_report_issue\(p_token text, p_ride text, p_type text, p_note text\)/.test(nachtrag),
  "P12c: guest_report_issue behaelt Signatur (text, text, text, text)");

// P13: es werden KEINE neuen GRANTs vergeben (waeren bei gleicher Signatur
// ueberfluessig; ein GRANT hier waere ein Hinweis auf eine Signaturaenderung).
ok(!/grant execute on function guest_(confirm_pickup|at_pickup|report_issue)/.test(nachtrag),
  "P13: keine neuen GRANTs noetig (Signaturen unveraendert)");

// ===========================================================================
// TEIL 3: guest_report_issue - Dedup ueber Zeitfenster
// ===========================================================================
const issueFn = (nachtrag.match(/create or replace function guest_report_issue[\s\S]*?\nend \$\$;/) || [""])[0];

// P14: Dedup-Fenster ist definiert und endlich (kein permanenter Sperrzustand).
ok(/v_dedupe_window_ms constant bigint := 20000;/.test(issueFn),
  "P14: Dedup-Fenster als benannte Konstante (20000 ms)");

// P15: der Dedup-Guard steckt im WHERE des UPDATE (wieder: race-sicher).
ok(/and not exists \(\s*\n\s*select 1 from jsonb_array_elements\(coalesce\(e->'issues'/.test(issueFn),
  "P15: Dedup-Guard steht als not-exists in der WHERE-Bedingung des UPDATE");

// P16: dedupliziert wird ueber Typ UND Notiz UND Urheber UND Zeitfenster.
// Faellt eine dieser Bedingungen weg, wird zu aggressiv geblockt.
ok(/iss->>'type'/.test(issueFn) && /iss->>'note'/.test(issueFn),
  "P16a: Dedup vergleicht Typ UND Notiz");
ok(/iss->>'by' = 'guest:' \|\| v_dj/.test(issueFn),
  "P16b: Dedup gilt nur fuer Eintraege DIESES Gastes");
ok(/\(v_now - coalesce\(\(iss->>'at'\)::bigint, 0\)\) < v_dedupe_window_ms/.test(issueFn),
  "P16c: Dedup gilt nur innerhalb des Zeitfensters (spaetere Meldung bleibt moeglich)");

// P17: auch hier No-op als Erfolg melden.
ok(/if v_dup then\s*\n\s*return true;/.test(issueFn),
  "P17: erkanntes Retry-Duplikat -> return true (No-op)");

// ===========================================================================
// TEIL 4: Sicherheitsgrenze darf nicht aufgeweicht worden sein
// ===========================================================================
// Die Fahrt wird weiterhin ueber id UND passenden djName gesucht. Ohne den
// djName-Vergleich koennte ein Gast mit gueltigem Token fremde Fahrten
// patchen, wenn er die ride-id kennt oder raet.
const djChecks = (nachtrag.match(/lower\(trim\(coalesce\(e->>'djName',''\)\)\) = lower\(trim\(v_dj\)\)/g) || []).length;
ok(djChecks >= 4, `P18: djName-Abgleich weiterhin an allen Stellen vorhanden (${djChecks} Treffer, erwartet >= 4)`);

const idChecks = (nachtrag.match(/e->>'id' = p_ride/g) || []).length;
ok(idChecks >= 4, `P19: ride-id-Abgleich weiterhin an allen Stellen vorhanden (${idChecks} Treffer, erwartet >= 4)`);

// P20: security definer + fixierter search_path bleiben erhalten.
const sdCount = (nachtrag.match(/security definer/g) || []).length;
const spCount = (nachtrag.match(/set search_path = public/g) || []).length;
ok(sdCount === 4, `P20a: alle vier Funktionen weiterhin security definer (${sdCount})`);
ok(spCount === 4, `P20b: alle vier Funktionen mit fixiertem search_path (${spCount})`);

// ===========================================================================
// GEGENPROBEN: Quelltext gezielt kaputtmachen, Pruefung MUSS kippen.
// ===========================================================================
console.log("\n--- Gegenproben ---");
let gp = 0, gpFail = 0;
function gegenprobe(name, mutiert, pruefung) {
  const kipptJetzt = !pruefung(mutiert);
  if (kipptJetzt) { gp++; console.log("OK   " + name + " (kippt wie erwartet)"); }
  else { gpFail++; console.log("FAIL " + name + " -- Pruefung misst nichts!"); fails.push("GP: " + name); }
}

// Kontrolle: am UNVERAENDERTEN Text muessen dieselben Pruefungen halten.
const pruefGuard = (t) => /and \(p_idempotent_field is null or coalesce\(e->>p_idempotent_field, ''\) = ''\)/.test(t);
const pruefNoDefault = (t) => !/p_idempotent_field text default/i.test(t);
const pruefDrop = (t) => /drop function if exists _guest_patch_ride\(text, text, jsonb, text, text\);/.test(t);
const pruefDedupeBy = (t) => /iss->>'by' = 'guest:' \|\| v_dj/.test(t);
const pruefDedupeWindow = (t) => /\(v_now - coalesce\(\(iss->>'at'\)::bigint, 0\)\) < v_dedupe_window_ms/.test(t);
const pruefNoop = (t) => /if v_already_set then\s*\n\s*return true;/.test(t);

ok(pruefGuard(nachtrag) && pruefNoDefault(nachtrag) && pruefDrop(nachtrag) &&
   pruefDedupeBy(nachtrag) && pruefDedupeWindow(nachtrag) && pruefNoop(nachtrag),
  "GP-Kontrolle: alle gleich zu mutierenden Pruefungen halten am echten Text");

// GP1: WHERE-Guard entfernt -> das UPDATE trifft wieder bedingungslos.
gegenprobe("GP1 Guard aus der WHERE-Bedingung entfernt",
  nachtrag.replace(/\s*and \(p_idempotent_field is null or coalesce\(e->>p_idempotent_field, ''\) = ''\)/, ""),
  pruefGuard);

// GP2: Default-Wert wieder eingebaut -> mehrdeutige Aufrufe (der reale Fehler).
gegenprobe("GP2 'default null' wieder eingebaut",
  nachtrag.replace(/p_idempotent_field text\n\)/, "p_idempotent_field text default null\n)"),
  pruefNoDefault);

// GP3: DROP entfernt -> alte Version bliebe als Zombie-Overload liegen.
gegenprobe("GP3 DROP der alten 5-Parameter-Version entfernt",
  nachtrag.replace(/drop function if exists _guest_patch_ride\(text, text, jsonb, text, text\);/, ""),
  pruefDrop);

// GP4: Urheber-Bedingung im Dedup entfernt -> ein Gast koennte den Report
// eines anderen Gastes als sein eigenes Duplikat "erben".
gegenprobe("GP4 Urheber-Bedingung im Dedup entfernt",
  nachtrag.replace(/\s*and iss->>'by' = 'guest:' \|\| v_dj/g, ""),
  pruefDedupeBy);

// GP5: Zeitfenster entfernt -> dauerhafte Sperre, spaetere echte Meldung
// desselben Problems ginge verloren.
gegenprobe("GP5 Zeitfenster-Bedingung im Dedup entfernt",
  nachtrag.replace(/\s*and \(v_now - coalesce\(\(iss->>'at'\)::bigint, 0\)\) < v_dedupe_window_ms/g, ""),
  pruefDedupeWindow);

// GP6: No-op meldet Fehler statt Erfolg -> Gast sieht bei legitimem Retry
// faelschlich "Could not confirm".
gegenprobe("GP6 No-op meldet false statt true",
  nachtrag.replace(/if v_already_set then\s*\n\s*return true;/, "if v_already_set then\n      return false;"),
  pruefNoop);

// GP7: djName-Abgleich entfernt -> Sicherheitsgrenze weg.
gegenprobe("GP7 djName-Abgleich entfernt (Sicherheitsgrenze)",
  nachtrag.replace(/lower\(trim\(coalesce\(e->>'djName',''\)\)\) = lower\(trim\(v_dj\)\)/g, "true"),
  (t) => ((t.match(/lower\(trim\(coalesce\(e->>'djName',''\)\)\) = lower\(trim\(v_dj\)\)/g) || []).length >= 4));

// ===========================================================================
console.log("");
if (fails.length) {
  console.log("Fehlgeschlagen:");
  for (const f of fails) console.log("  - " + f);
}
console.log(`GAST-IDEMPOTENZ-SMOKE: ${pass} OK, ${fail} FAIL  |  Gegenproben: ${gp} griffen, ${gpFail} griffen nicht`);
process.exit(fail === 0 && gpFail === 0 ? 0 : 1);
