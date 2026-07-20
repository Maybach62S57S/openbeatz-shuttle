// Goldstandard-Haertetest Teilpaket H (Chat 2): echte parallele RPC-Aufrufe gegen
// eine echte lokale Postgres-Instanz (nicht simuliert/gemockt). Prueft die exakt
// gleichen Funktionen wie im Supabase-Schema (supabase-schema.sql), 1:1 dort
// eingespielt. Verbindung ueber TCP/scram wie ein echter Client.
//
// KEIN Teil der Standard-Regression (npm run / node *.mjs ueber die Quelle) und
// bewusst NICHT in package.json aufgenommen: braucht eine echte lokale Postgres-
// Instanz + das npm-Paket "pg" (nur fuer diesen Verifikationslauf, nicht von der
// App selbst benutzt, die App spricht ueber @supabase/supabase-js). Reproduktion:
//   1. postgresql installieren, Dienst starten
//   2. Rollen/Extension: CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
//      CREATE EXTENSION pgcrypto; (in einer frischen DB, z.B. "openbeatz_th")
//   3. supabase-schema.sql unveraendert in diese DB einspielen (psql -f)
//   4. In einem separaten Scratch-Verzeichnis: npm install pg
//   5. Verbindungsdaten unten (host/user/password/database) anpassen, dann:
//      node gegenprobe-teilpaket-h-rpc-postgres.mjs
// Beruehrt an keiner Stelle die echte Supabase-Produktivinstanz.
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  host: "127.0.0.1", port: 5432, user: "postgres", password: "th_local_test",
  database: "openbeatz_th",
});

let pass = 0, fail = 0; const fails = [];
function ok(cond, msg) { if (cond) { pass++; console.log("OK  " + msg); } else { fail++; fails.push(msg); console.log("FAIL " + msg); } }

async function resetDyn() {
  await pool.query(`update settings set dyn_rev = 0, dyn_data = '{"rides":[],"driverState":{}}'::jsonb where id = 1`);
}
async function resetSetup() {
  await pool.query(`update settings set setup_rev = 0, dispatchers='[]', locations='[]', matrix='{}', zones='["Caldera","Zone 3","Stonelands"]', config='{}' where id = 1`);
  await pool.query(`delete from drivers`);
}

// ---------------------------------------------------------------------------
// T1: N wirklich gleichzeitige Aufrufe von write_dyn_if_unchanged mit
// DEMSELBEN p_expected_rev=0 (klassisches "20 Fahrer/Dispatcher schreiben
// gleichzeitig"-Szenario). Erwartung: GENAU EINER bekommt ok=true, der Rest
// ok=false + aktuellen Serverstand zurueck. Kein verlorenes Update, kein
// Doppel-Erfolg, keine Exception.
// ---------------------------------------------------------------------------
async function t1_concurrentDynWrites(n) {
  await resetDyn();
  const calls = Array.from({ length: n }, (_, i) =>
    pool.query(
      `select * from write_dyn_if_unchanged($1, $2, '{}'::jsonb)`,
      [0, JSON.stringify([{ id: "r" + i, marker: i }])]
    )
  );
  const results = await Promise.all(calls);
  const oks = results.filter(r => r.rows[0].ok === true);
  const notOks = results.filter(r => r.rows[0].ok === false);
  ok(oks.length === 1, `T1a: genau 1 von ${n} gleichzeitigen Schreibern gewinnt (war ${oks.length})`);
  ok(notOks.length === n - 1, `T1b: die restlichen ${n - 1} bekommen ok=false (war ${notOks.length})`);
  // Jeder Verlierer muss den JEWEILS AKTUELLEN Serverstand zurueckbekommen,
  // nicht seinen eigenen Stand und nicht einen veralteten.
  const finalRow = (await pool.query(`select dyn_rev, dyn_data from settings where id=1`)).rows[0];
  const allLosersSeeCurrentRev = notOks.every(r => r.rows[0].rev === finalRow.dyn_rev);
  ok(allLosersSeeCurrentRev, `T1c: alle Verlierer sehen die tatsaechlich aktuelle Server-rev (${finalRow.dyn_rev})`);
  const winnerRide = oks[0].rows[0].rides;
  ok(JSON.stringify(finalRow.dyn_data.rides) === JSON.stringify(winnerRide), `T1d: DB-Endstand entspricht exakt der Gewinner-Payload (kein Mischzustand)`);
  ok(finalRow.dyn_rev === 1, `T1e: dyn_rev steht nach einem Gewinner exakt auf 1 (war ${finalRow.dyn_rev})`);
}

// ---------------------------------------------------------------------------
// T2: Stale rev kann NIE eine neuere ueberschreiben, auch nicht nachtraeglich.
// A schreibt erfolgreich (rev 0->1). B versucht danach NOCHMAL mit dem alten
// rev=0 zu schreiben (so als haette B den Erfolg von A verpasst/nicht
// mitbekommen). Erwartung: B schlaegt fehl, Serverstand von A bleibt exakt
// erhalten.
// ---------------------------------------------------------------------------
async function t2_staleRevNeverWins() {
  await resetDyn();
  const a = await pool.query(`select * from write_dyn_if_unchanged($1, $2, '{}'::jsonb)`, [0, JSON.stringify([{ id: "a" }])]);
  ok(a.rows[0].ok === true, "T2a: A (rev 0) schreibt erfolgreich");
  const b = await pool.query(`select * from write_dyn_if_unchanged($1, $2, '{}'::jsonb)`, [0, JSON.stringify([{ id: "b-stale" }])]);
  ok(b.rows[0].ok === false, "T2b: B mit demselben (jetzt veralteten) rev=0 schlaegt fehl");
  const row = (await pool.query(`select dyn_rev, dyn_data from settings where id=1`)).rows[0];
  ok(row.dyn_rev === 1, `T2c: Server-rev bleibt bei 1 (A's Schreibvorgang), war ${row.dyn_rev}`);
  ok(JSON.stringify(row.dyn_data.rides) === JSON.stringify([{ id: "a" }]), "T2d: A's Daten unveraendert erhalten, B's Daten NICHT durchgekommen");
}

// ---------------------------------------------------------------------------
// T3: 20 echte parallele Schreiber (realistisches Festival-Szenario: bis zu
// ~22 Fahrer + Leitstellen-Nutzer), Retry-Schleife pro "Client" bis Erfolg.
// Erwartung: nach Ablauf aller Retries haben ALLE ihren Versuch durchbekommen
// (rev steigt exakt um die Anzahl der Clients, keiner geht verloren, keiner
// doppelt gezaehlt).
// ---------------------------------------------------------------------------
async function t3_retryLoopAllEventuallySucceed(n) {
  await resetDyn();
  async function clientWithRetry(idx) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const cur = (await pool.query(`select dyn_rev, dyn_data from settings where id=1`)).rows[0];
      const rides = [...(cur.dyn_data.rides || []), { id: "client" + idx }];
      const res = await pool.query(`select * from write_dyn_if_unchanged($1, $2, '{}'::jsonb)`, [cur.dyn_rev, JSON.stringify(rides)]);
      if (res.rows[0].ok) return attempt + 1;
    }
    throw new Error("client " + idx + " gab nach 50 Versuchen auf");
  }
  const attemptsPerClient = await Promise.all(Array.from({ length: n }, (_, i) => clientWithRetry(i)));
  const finalRow = (await pool.query(`select dyn_rev, dyn_data from settings where id=1`)).rows[0];
  ok(finalRow.dyn_rev === n, `T3a: nach ${n} Clients mit Retry steht dyn_rev exakt auf ${n} (war ${finalRow.dyn_rev})`);
  ok(finalRow.dyn_data.rides.length === n, `T3b: alle ${n} Client-Eintraege sind in rides gelandet, keiner verloren (war ${finalRow.dyn_data.rides.length})`);
  const ids = finalRow.dyn_data.rides.map(r => r.id);
  ok(new Set(ids).size === n, "T3c: keine doppelten/kollidierten Eintraege (jede id genau einmal)");
}

// ---------------------------------------------------------------------------
// T4: write_setup_and_drivers_if_unchanged - echte Transaktions-Atomaritaet.
// Zwingt den Fahrer-Teil zum Scheitern (Constraint-Verletzung: vehicle_type
// ausserhalb des check-Constraints) und prueft, dass dann AUCH der
// settings-Teil zurueckgerollt wird (kein Teilerfolg).
// ---------------------------------------------------------------------------
async function t4_setupDriversTransactionRollback() {
  await resetSetup();
  const before = (await pool.query(`select setup_rev, locations from settings where id=1`)).rows[0];
  const badDrivers = JSON.stringify([{ id: "d-bad", first_name: "Test", last_name: "Fahrer", vehicle_type: "Ufo", vehicle_id: "X1", seats: 4 }]);
  let threw = false;
  try {
    await pool.query(
      `select * from write_setup_and_drivers_if_unchanged($1,$2,$3,$4,$5,$6,$7,$8)`,
      [before.setup_rev, "[]", JSON.stringify([{ id: "loc1" }]), "{}", '["Caldera"]', "{}", badDrivers, true]
    );
  } catch (e) {
    threw = e.message.includes("vehicle_type") || e.message.includes("check constraint") || e.code === "23514";
  }
  ok(threw, "T4a: Constraint-Verletzung im Fahrer-Teil wirft (nicht stillschweigend ignoriert)");
  const after = (await pool.query(`select setup_rev, locations from settings where id=1`)).rows[0];
  ok(after.setup_rev === before.setup_rev, `T4b: settings-Teil NICHT geschrieben trotz erfolgreicher CAS-Bedingung (Rollback), setup_rev unveraendert (${after.setup_rev})`);
  ok(JSON.stringify(after.locations) === JSON.stringify(before.locations), "T4c: locations unveraendert (kein Teilzustand)");
  const driverCount = (await pool.query(`select count(*)::int as c from drivers`)).rows[0].c;
  ok(driverCount === 0, `T4d: kein Fahrer wurde angelegt (Rollback erfasst auch den Insert-Teil), war ${driverCount}`);
}

// T5: Gegenkontrolle - derselbe Aufruf mit GUELTIGEN Daten geht in EINER
// Transaktion durch (settings UND drivers zusammen).
async function t5_setupDriversTransactionSuccess() {
  await resetSetup();
  const before = (await pool.query(`select setup_rev from settings where id=1`)).rows[0];
  const goodDrivers = JSON.stringify([{ id: "d-ok", first_name: "Anna", last_name: "Berg", vehicle_type: "Van", vehicle_id: "V1", seats: 6 }]);
  const res = await pool.query(
    `select * from write_setup_and_drivers_if_unchanged($1,$2,$3,$4,$5,$6,$7,$8)`,
    [before.setup_rev, "[]", JSON.stringify([{ id: "loc1" }]), "{}", '["Caldera"]', "{}", goodDrivers, true]
  );
  ok(res.rows[0].ok === true, "T5a: gueltiger kombinierter Aufruf liefert ok=true");
  const after = (await pool.query(`select setup_rev from settings where id=1`)).rows[0];
  ok(after.setup_rev === before.setup_rev + 1, `T5b: setup_rev korrekt um 1 erhoeht (${after.setup_rev})`);
  const driver = (await pool.query(`select * from drivers where id='d-ok'`)).rows[0];
  ok(!!driver && driver.vehicle_type === "Van", "T5c: Fahrer in DERSELBEN Transaktion tatsaechlich angelegt");
}

// GEGENPROBE: beweist, dass der Test wirklich etwas misst (nicht nur immer
// gruen ist). Simuliere die kaputte, NICHT-atomare Variante ("lesen->
// vergleichen->schreiben" ohne WHERE-Bedingung auf die rev) und zeige, dass
// GENAU DASSELBE T1-Szenario dann verlorene Updates produziert.
async function gegenprobe_naiveWriteLosesUpdates(n) {
  await resetDyn();
  // Naive Variante: SELECT dyn_rev, dann UPDATE ohne CAS-Bedingung (klassisches
  // Read-Check-Write MIT Luecke, genau das Muster, das write_dyn_if_unchanged
  // ersetzen soll).
  async function naiveWrite(idx) {
    const cur = (await pool.query(`select dyn_rev, dyn_data from settings where id=1`)).rows[0];
    // absichtliche Verzoegerung, um das Race-Window zu vergroessern (in echt
    // reicht oft schon die Netzwerklaufzeit zwischen SELECT und UPDATE)
    await new Promise(r => setTimeout(r, 5));
    const rides = [...(cur.dyn_data.rides || []), { id: "naive" + idx }];
    await pool.query(`update settings set dyn_data = jsonb_set(dyn_data, '{rides}', $1::jsonb), dyn_rev = dyn_rev + 1 where id=1`, [JSON.stringify(rides)]);
  }
  await Promise.all(Array.from({ length: n }, (_, i) => naiveWrite(i)));
  const finalRow = (await pool.query(`select dyn_data from settings where id=1`)).rows[0];
  const gotAll = finalRow.dyn_data.rides.length === n;
  // Diese Gegenprobe soll FEHLSCHLAGEN (Updates verloren) -> beweist, dass T1-3
  // oben wirklich die CAS-Absicherung messen und nicht zufaellig gruen sind.
  ok(!gotAll, `GEGENPROBE: naive read-check-write OHNE CAS verliert bei ${n} Parallelschreibern Updates (bekam ${finalRow.dyn_data.rides.length} von ${n} - <${n} beweist die Luecke)`);
}

await t1_concurrentDynWrites(20);
await t2_staleRevNeverWins();
await t3_retryLoopAllEventuallySucceed(20);
await t4_setupDriversTransactionRollback();
await t5_setupDriversTransactionSuccess();
await gegenprobe_naiveWriteLosesUpdates(20);

console.log(`\nGoldstandard-CAS-Haertetest (echtes Postgres): ${pass} OK, ${fail} FAIL`);
if (fails.length) console.log("Fehlgeschlagen:\n- " + fails.join("\n- "));
await pool.end();
process.exit(fail > 0 ? 1 : 0);
