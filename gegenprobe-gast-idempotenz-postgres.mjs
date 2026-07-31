// Goldstandard-Verhaltensnachweis "Gast-Idempotenz": echte Aufrufe der drei
// Gast-RPCs gegen eine echte lokale Postgres-Instanz (nicht simuliert, nicht
// gemockt). Prueft genau die Funktionen aus supabase-schema.sql, 1:1 dort
// eingespielt.
//
// Ergaenzt smoke-gast-idempotenz.mjs: der Smoke prueft die STRUKTUR am
// Quelltext (und laeuft ueberall), dieser Test prueft das VERHALTEN inklusive
// echter Nebenlaeufigkeit (parallele Verbindungen, echte Row-Locks). Beides
// zusammen deckt "Guard ist da" UND "Guard wirkt".
//
// KEIN Teil der Standard-Regression und bewusst NICHT in package.json:
// braucht eine echte lokale Postgres-Instanz + das npm-Paket "pg" (nur fuer
// diesen Verifikationslauf, die App selbst spricht ueber @supabase/supabase-js).
// Reproduktion:
//   1. postgresql installieren, Dienst starten
//   2. CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
//      CREATE DATABASE openbeatz_gi; CREATE EXTENSION pgcrypto; (in openbeatz_gi)
//   3. supabase-schema.sql unveraendert einspielen (psql -f)
//   4. In einem separaten Scratch-Verzeichnis: npm install pg
//   5. Verbindungsdaten unten anpassen, dann:
//      node gegenprobe-gast-idempotenz-postgres.mjs
// Beruehrt an keiner Stelle die echte Supabase-Produktivinstanz.
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  host: "127.0.0.1", port: 5432, user: "postgres", password: "th_local_test",
  database: process.env.GI_DB || "openbeatz_gi",
  max: 20,
});

let pass = 0, fail = 0; const fails = [];
function ok(cond, msg) {
  if (cond) { pass++; console.log("OK   " + msg); }
  else { fail++; fails.push(msg); console.log("FAIL " + msg); }
}

const TOKEN = "tok-timmy", DJ = "Timmy Trumpet", RIDE = "r1", FREMD = "r2";

async function resetAll() {
  await pool.query(`
    insert into settings (id, dispatchers, locations, matrix, zones, config, dyn_rev, dyn_data)
    values (1,'[]','[]','{}','[]','{}',0, $1::jsonb)
    on conflict (id) do update set dyn_rev = 0, dyn_data = excluded.dyn_data
  `, [JSON.stringify({
    rides: [
      { id: RIDE, djName: DJ, status: "planned", issues: [], log: [] },
      { id: FREMD, djName: "Anderer DJ", status: "planned", issues: [], log: [] },
    ],
  })]);
  await pool.query(
    `insert into guest_tokens (token, dj_name) values ($1,$2) on conflict (token) do nothing`,
    [TOKEN, DJ]);
}

async function state() {
  const { rows } = await pool.query(`
    select dyn_rev,
           jsonb_array_length(coalesce(dyn_data->'rides'->0->'log','[]'::jsonb))    as logs,
           jsonb_array_length(coalesce(dyn_data->'rides'->0->'issues','[]'::jsonb)) as issues,
           (dyn_data->'rides'->0->'guestConfirmedAt') is not null as confirmed,
           (dyn_data->'rides'->0->'guestAtPickupAt')  is not null as atpickup,
           dyn_data->'rides'->1 as fremd
    from settings where id = 1`);
  return rows[0];
}

async function call(fn, args) {
  const ph = args.map((_, i) => `$${i + 1}`).join(",");
  const { rows } = await pool.query(`select ${fn}(${ph}) as r`, args);
  return rows[0].r;
}

// ---------------------------------------------------------------------------
// T1: guest_confirm_pickup - Erstaufruf schreibt, Retry ist ein No-op.
// ---------------------------------------------------------------------------
async function t1_confirmRetry() {
  await resetAll();
  const a = await call("guest_confirm_pickup", [TOKEN, RIDE]);
  const s1 = await state();
  const b = await call("guest_confirm_pickup", [TOKEN, RIDE]);
  const s2 = await state();

  ok(a === true, "T1a: Erstaufruf meldet Erfolg");
  ok(s1.confirmed === true, "T1b: Zeitstempel ist gesetzt");
  ok(b === true, "T1c: Retry meldet ebenfalls Erfolg (No-op, kein Fehler beim Gast)");
  ok(s2.dyn_rev === s1.dyn_rev, `T1d: Retry bumpt dyn_rev NICHT (${s1.dyn_rev} -> ${s2.dyn_rev})`);
  ok(s2.logs === 1, `T1e: Retry erzeugt keinen zweiten Log-Eintrag (logs=${s2.logs})`);
}

// ---------------------------------------------------------------------------
// T2: guest_at_pickup - dieselbe Zusicherung, eigenes Feld.
// ---------------------------------------------------------------------------
async function t2_atPickupRetry() {
  await resetAll();
  const a = await call("guest_at_pickup", [TOKEN, RIDE]);
  const b = await call("guest_at_pickup", [TOKEN, RIDE]);
  const s = await state();

  ok(a === true && b === true, "T2a: Erstaufruf und Retry melden beide Erfolg");
  ok(s.dyn_rev === 1, `T2b: nur EIN Schreibvorgang (dyn_rev=${s.dyn_rev})`);
  ok(s.logs === 1, `T2c: nur EIN Log-Eintrag (logs=${s.logs})`);
  ok(s.atpickup === true, "T2d: Zeitstempel gesetzt");
}

// ---------------------------------------------------------------------------
// T3: die beiden Aktionen blockieren sich NICHT gegenseitig. Waeren die
// Idempotenz-Felder vertauscht, wuerde "at pickup" durch ein vorheriges
// "confirm" faelschlich geschluckt.
// ---------------------------------------------------------------------------
async function t3_keineGegenseitigeBlockade() {
  await resetAll();
  await call("guest_confirm_pickup", [TOKEN, RIDE]);
  const b = await call("guest_at_pickup", [TOKEN, RIDE]);
  const s = await state();

  ok(b === true, "T3a: at_pickup nach confirm wird ausgefuehrt");
  ok(s.confirmed === true && s.atpickup === true, "T3b: beide Zeitstempel gesetzt");
  ok(s.dyn_rev === 2, `T3c: zwei echte Schreibvorgaenge (dyn_rev=${s.dyn_rev})`);
  ok(s.logs === 2, `T3d: zwei Log-Eintraege (logs=${s.logs})`);
}

// ---------------------------------------------------------------------------
// T4: guest_report_issue - Retry im Fenster ist ein No-op, echte neue
// Meldungen kommen weiterhin durch.
// ---------------------------------------------------------------------------
async function t4_issueDedupe() {
  await resetAll();
  const a = await call("guest_report_issue", [TOKEN, RIDE, "Verspaetung", "Stau A3"]);
  const b = await call("guest_report_issue", [TOKEN, RIDE, "Verspaetung", "Stau A3"]);
  let s = await state();
  ok(a === true && b === true, "T4a: Erstmeldung und sofortiger Retry melden beide Erfolg");
  ok(s.issues === 1, `T4b: Retry erzeugt KEINEN zweiten Issue-Eintrag (issues=${s.issues})`);
  ok(s.dyn_rev === 1, `T4c: Retry bumpt dyn_rev nicht (dyn_rev=${s.dyn_rev})`);

  await call("guest_report_issue", [TOKEN, RIDE, "Auto kaputt", ""]);
  s = await state();
  ok(s.issues === 2, `T4d: anderer Typ ist eine echte neue Meldung (issues=${s.issues})`);

  await call("guest_report_issue", [TOKEN, RIDE, "Verspaetung", "jetzt 40 Minuten"]);
  s = await state();
  ok(s.issues === 3, `T4e: gleicher Typ mit anderer Notiz ist eine echte neue Meldung (issues=${s.issues})`);
}

// ---------------------------------------------------------------------------
// T5: das Dedup-Fenster ist ENDLICH. Ein identischer Report ausserhalb des
// Fensters muss wieder durchgehen, sonst koennte ein Gast dasselbe Problem
// spaeter nicht erneut melden.
// ---------------------------------------------------------------------------
async function t5_fensterIstEndlich() {
  await resetAll();
  await call("guest_report_issue", [TOKEN, RIDE, "Verspaetung", "Stau A3"]);

  // Vorhandenen Eintrag kuenstlich altern lassen (25 s > 20 s Fenster).
  await pool.query(`
    update settings set dyn_data = jsonb_set(dyn_data, '{rides,0,issues}', (
      select jsonb_agg(iss || jsonb_build_object('at', (extract(epoch from now())*1000)::bigint - 25000))
      from jsonb_array_elements(dyn_data->'rides'->0->'issues') as iss))
    where id = 1`);

  const r = await call("guest_report_issue", [TOKEN, RIDE, "Verspaetung", "Stau A3"]);
  const s = await state();
  ok(r === true, "T5a: identische Meldung ausserhalb des Fensters wird angenommen");
  ok(s.issues === 2, `T5b: sie erzeugt einen echten zweiten Eintrag (issues=${s.issues})`);
}

// ---------------------------------------------------------------------------
// T6: Fehlerfaelle melden weiterhin false (No-op darf sie nicht verschlucken).
// ---------------------------------------------------------------------------
async function t6_fehlerfaelle() {
  await resetAll();
  ok(await call("guest_confirm_pickup", ["tok-falsch", RIDE]) === false,
    "T6a: unbekannter Token -> false");
  ok(await call("guest_confirm_pickup", [TOKEN, "gibt-es-nicht"]) === false,
    "T6b: unbekannte ride-id -> false");
  ok(await call("guest_report_issue", ["tok-falsch", RIDE, "x", ""]) === false,
    "T6c: unbekannter Token bei report_issue -> false");

  // Und zwar auch dann noch, wenn das Feld auf der EIGENEN Fahrt schon
  // gesetzt ist (die Nachpruefung darf nicht auf fremde Fahrten durchschlagen).
  await call("guest_confirm_pickup", [TOKEN, RIDE]);
  ok(await call("guest_confirm_pickup", [TOKEN, "gibt-es-nicht"]) === false,
    "T6d: unbekannte ride-id bleibt false, auch wenn die eigene Fahrt gesetzt ist");
}

// ---------------------------------------------------------------------------
// T7: Sicherheitsgrenze. Ein gueltiger Token darf keine fremde Fahrt
// beruehren, auch wenn die ride-id bekannt ist.
// ---------------------------------------------------------------------------
async function t7_sicherheitsgrenze() {
  await resetAll();
  const vorher = (await state()).fremd;
  const a = await call("guest_confirm_pickup", [TOKEN, FREMD]);
  const b = await call("guest_report_issue", [TOKEN, FREMD, "Verspaetung", "x"]);
  const s = await state();

  ok(a === false, "T7a: confirm auf fremde Fahrt -> false");
  ok(b === false, "T7b: report_issue auf fremde Fahrt -> false");
  ok(JSON.stringify(s.fremd) === JSON.stringify(vorher),
    "T7c: fremde Fahrt ist unveraendert geblieben");
  ok(s.dyn_rev === 0, `T7d: kein Schreibvorgang ausgeloest (dyn_rev=${s.dyn_rev})`);
}

// ---------------------------------------------------------------------------
// T8: ECHTE Nebenlaeufigkeit. Der eigentliche Kern: der Guard sitzt in der
// WHERE-Bedingung des UPDATE und ist damit Teil der atomaren Anweisung. N
// wirklich gleichzeitige Verbindungen duerfen zusammen nur EINEN Schreib-
// vorgang erzeugen. Eine separate Vorab-Pruefung wuerde hier durchfallen.
// ---------------------------------------------------------------------------
async function t8_nebenlaeufig(n) {
  await resetAll();
  const res = await Promise.all(
    Array.from({ length: n }, () => call("guest_confirm_pickup", [TOKEN, RIDE])));
  const s = await state();

  ok(res.every((r) => r === true), `T8a: alle ${n} gleichzeitigen Aufrufe melden Erfolg`);
  ok(s.dyn_rev === 1, `T8b: trotzdem nur EIN Schreibvorgang (dyn_rev=${s.dyn_rev})`);
  ok(s.logs === 1, `T8c: trotzdem nur EIN Log-Eintrag (logs=${s.logs})`);
}

async function t9_nebenlaeufigIssues(n) {
  await resetAll();
  const res = await Promise.all(
    Array.from({ length: n }, () => call("guest_report_issue", [TOKEN, RIDE, "Verspaetung", "Stau A3"])));
  const s = await state();

  ok(res.every((r) => r === true), `T9a: alle ${n} gleichzeitigen Meldungen melden Erfolg`);
  ok(s.issues === 1, `T9b: trotzdem nur EIN Issue-Eintrag (issues=${s.issues})`);
  ok(s.dyn_rev === 1, `T9c: trotzdem nur EIN Schreibvorgang (dyn_rev=${s.dyn_rev})`);
}

// ---------------------------------------------------------------------------
// T10: Struktur in der DB - kein Zombie-Overload, Signaturen unveraendert,
// Ausfuehrungsrechte noch gueltig. Aendert sich eine Signatur, greifen die
// GRANTs aus dem Hauptschema nicht mehr und der Gast-Link faellt live aus.
// ---------------------------------------------------------------------------
async function t10_struktur() {
  const { rows: helper } = await pool.query(`
    select p.oid::regprocedure::text as sig from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='_guest_patch_ride'`);
  ok(helper.length === 1,
    `T10a: genau EINE _guest_patch_ride-Version, kein Zombie-Overload (${helper.length})`);
  ok(helper.length === 1 && helper[0].sig.includes("text,text,jsonb,text,text,text"),
    "T10b: es ist die neue 6-Parameter-Version");

  const { rows: rpcs } = await pool.query(`
    select p.proname,
           p.oid::regprocedure::text as sig,
           has_function_privilege('anon', p.oid, 'EXECUTE') as anon_ok,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_ok
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public'
      and p.proname in ('guest_confirm_pickup','guest_at_pickup','guest_report_issue')
    order by p.proname`);
  ok(rpcs.length === 3, `T10c: alle drei Gast-RPCs vorhanden (${rpcs.length})`);
  ok(rpcs.every((r) => r.anon_ok && r.auth_ok),
    "T10d: anon und authenticated duerfen alle drei weiterhin ausfuehren");

  const sigs = Object.fromEntries(rpcs.map((r) => [r.proname, r.sig]));
  ok(/guest_confirm_pickup\(text,text\)/.test(sigs.guest_confirm_pickup || ""),
    "T10e: guest_confirm_pickup behaelt Signatur (text,text)");
  ok(/guest_at_pickup\(text,text\)/.test(sigs.guest_at_pickup || ""),
    "T10f: guest_at_pickup behaelt Signatur (text,text)");
  ok(/guest_report_issue\(text,text,text,text\)/.test(sigs.guest_report_issue || ""),
    "T10g: guest_report_issue behaelt Signatur (text,text,text,text)");
}

// ---------------------------------------------------------------------------
// GEGENPROBE: die alte, ungehaertete Version einspielen und zeigen, dass die
// zentralen Zusicherungen dort NACHWEISLICH kippen. Ohne diesen Schritt
// koennte der Test gruen sein, ohne irgendetwas zu messen. Am Ende wird die
// gehaertete Version wieder eingespielt.
// ---------------------------------------------------------------------------
const ALT_SQL = `
create or replace function _guest_patch_ride_alt(p_token text, p_ride text, p_patch jsonb, p_log_event text, p_log_detail text)
returns boolean language plpgsql security definer set search_path = public as $ALT$
declare
  v_dj text; v_rows int; v_now bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  select dj_name into v_dj from guest_tokens where token = p_token;
  if v_dj is null then return false; end if;
  update settings s
  set dyn_data = jsonb_set(s.dyn_data, '{rides}', (
        select jsonb_agg(case
          when elem->>'id' = p_ride and lower(trim(coalesce(elem->>'djName',''))) = lower(trim(v_dj))
            then (elem || p_patch || jsonb_build_object('updatedAt', v_now))
                 || jsonb_build_object('log', coalesce(elem->'log','[]'::jsonb) || jsonb_build_array(
                      jsonb_build_object('event', p_log_event, 'at', v_now, 'by', 'guest:' || v_dj, 'detail', p_log_detail)))
          else elem end)
        from jsonb_array_elements(coalesce(s.dyn_data->'rides','[]'::jsonb)) as elem)),
      dyn_rev = dyn_rev + 1, updated_at = now()
  where s.id = 1 and exists (
    select 1 from jsonb_array_elements(coalesce(s.dyn_data->'rides','[]'::jsonb)) as e
    where e->>'id' = p_ride and lower(trim(coalesce(e->>'djName',''))) = lower(trim(v_dj)));
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end $ALT$;

create or replace function guest_confirm_pickup(p_token text, p_ride text)
returns boolean language sql security definer set search_path = public as $ALT$
  select _guest_patch_ride_alt(p_token, p_ride,
    jsonb_build_object('guestConfirmedAt', (extract(epoch from now()) * 1000)::bigint),
    'guest_confirm', 'Confirmed pickup info');
$ALT$;
`;

async function gegenprobe(schemaPfad) {
  console.log("\n--- Gegenprobe: alte, ungehaertete Version einspielen ---");
  let gp = 0, gpFail = 0;
  const gpOk = (cond, msg) => {
    if (cond) { gp++; console.log("OK   " + msg); }
    else { gpFail++; fails.push("GP: " + msg); console.log("FAIL " + msg + " -- Test misst nichts!"); }
  };

  await pool.query(ALT_SQL);
  await resetAll();
  const a = await call("guest_confirm_pickup", [TOKEN, RIDE]);
  const b = await call("guest_confirm_pickup", [TOKEN, RIDE]);
  const s = await state();

  gpOk(a === true && b === true, "GP1a: alte Version meldet bei beiden Aufrufen Erfolg");
  gpOk(s.dyn_rev === 2, `GP1b: alte Version bumpt dyn_rev DOPPELT (${s.dyn_rev}, gehaertet waere 1)`);
  gpOk(s.logs === 2, `GP1c: alte Version erzeugt ZWEI Log-Eintraege (${s.logs}, gehaertet waere 1)`);

  // Gehaertete Version wiederherstellen und beweisen, dass der Unterschied
  // wirklich an der Funktion haengt und nicht am Testablauf.
  const fs = await import("node:fs");
  await pool.query(fs.readFileSync(schemaPfad, "utf8"));
  await pool.query(`drop function if exists _guest_patch_ride_alt(text, text, jsonb, text, text)`);
  await resetAll();
  await call("guest_confirm_pickup", [TOKEN, RIDE]);
  await call("guest_confirm_pickup", [TOKEN, RIDE]);
  const s2 = await state();
  gpOk(s2.dyn_rev === 1 && s2.logs === 1,
    `GP2: nach Wiederherstellung wieder idempotent (dyn_rev=${s2.dyn_rev}, logs=${s2.logs})`);

  return { gp, gpFail };
}

(async () => {
  const schemaPfad = process.argv[2] || "supabase-schema.sql";
  try {
    await t1_confirmRetry();
    await t2_atPickupRetry();
    await t3_keineGegenseitigeBlockade();
    await t4_issueDedupe();
    await t5_fensterIstEndlich();
    await t6_fehlerfaelle();
    await t7_sicherheitsgrenze();
    await t8_nebenlaeufig(12);
    await t9_nebenlaeufigIssues(12);
    await t10_struktur();
    const { gp, gpFail } = await gegenprobe(schemaPfad);

    console.log("");
    if (fails.length) {
      console.log("Fehlgeschlagen:");
      for (const f of fails) console.log("  - " + f);
    }
    console.log(`GAST-IDEMPOTENZ POSTGRES: ${pass} OK, ${fail} FAIL  |  Gegenproben: ${gp} griffen, ${gpFail} griffen nicht`);
    process.exitCode = (fail === 0 && gpFail === 0) ? 0 : 1;
  } catch (e) {
    console.error("ABBRUCH:", e?.message || e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
