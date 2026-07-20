// Write-Contention-Test der gehaerteten zentralen Schreibinfrastruktur.
//
// Prueft VERHALTENSBEZOGEN die neuen Garantien von runCasWrite/enqueueWrite und
// des No-change-/Konflikt-Vertrags (NO_CHANGE / dynConflict), so wie sie in
// src/ShuttleLeitstelle.jsx im App-Root implementiert sind:
//   - Echter No-op schreibt NICHT und erhoeht die Revision NICHT (ok:true, unchanged:true).
//   - Fachlicher Konflikt schreibt NICHT, liefert unterscheidbaren Grund (ok:false, conflict:true, code).
//   - Zwei lokale Schreibaktionen desselben Clients laufen SERIALISIERT (nicht parallel).
//   - Ein Fehler blockiert die Queue nicht.
//   - Echter CAS-Konflikt -> Backoff -> Retry auf frischem Stand -> Erfolg.
//   - Nicht-retrybarer Fehler (RLS/Validierung, wirft) -> KEIN sechsfacher Retry.
//   - Mehrere konkurrierende Clients: einer gewinnt, andere retryen, am Ende alle drin.
//   - No-op unter Konkurrenz: nach Retry stellt der Mutator fest, dass der
//     Endzustand schon da ist -> No-op, kein weiterer Schreibversuch.
//   - Maximalversuche: kontrollierter Fehler, keine Endlosschleife, Diagnose stimmt.
//   - Session-2-Invarianten: Push genau einmal nach Erfolg, kein Push bei No-op/Konflikt.
//
// Die getestete Logik ist ZEILENGETREU aus src/ShuttleLeitstelle.jsx
// (NO_CHANGE/dynConflict/casBackoffMs, enqueueWrite, runCasWrite) repliziert.
// Der Mock-sset bildet die Semantik von write_dyn_if_unchanged nach (bedingtes
// UPDATE auf dyn_rev, bei Konflikt aktueller Serverstand zurueck; ECHTER Fehler
// wirft, genau wie sbSetDyn "if (error) throw error").
//
// Aufruf: node smoke-write-contention.mjs

let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push(m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} (erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)})`);

const DYN_KEY = "obf:dyn:v5";
const emptyDyn = () => ({ rides: [], driverState: {}, messages: [], rev: 0 });

// ===========================================================================
// ZEILENGETREUE Repliken aus src/ShuttleLeitstelle.jsx (Modulkopf)
// ===========================================================================
const NO_CHANGE = Symbol("dyn-no-change");
const DYN_CONFLICT = Symbol("dyn-conflict");
function dynConflict(code, message) {
  return { [DYN_CONFLICT]: true, code: code || "CONFLICT", message: message || "Die Aktion ist nicht mehr moeglich, der Stand hat sich geaendert." };
}
function isNoChange(v) { return v === NO_CHANGE; }
function isDynConflict(v) { return !!(v && typeof v === "object" && v[DYN_CONFLICT]); }
function casBackoffMs(attempt) {
  const base = 25 * 2 ** attempt;
  const jitter = Math.random() * 40;
  return Math.min(base + jitter, 300);
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
// friendlyError-Stub: die echte Funktion liefert bei Netzfehlern Text, sonst
// null; fuer die Tests reicht die Durchreichung der message.
const friendlyError = (msg) => msg || "Speicherfehler";

// ---- enqueueWrite: ZEILENGETREU (Kette bleibt fehler-neutral) --------------
function makeEnqueue() {
  const queueRef = { current: Promise.resolve() };
  const enqueueWrite = (task) => {
    const run = queueRef.current.then(task, task);
    queueRef.current = run.then(() => {}, () => {});
    return run;
  };
  return { enqueueWrite, queueRef };
}

// ---- runCasWrite: ZEILENGETREU (nur sget/sset/onSuccess/onExhausted injiziert) ----
function makeRunCasWrite({ sget, sset, stats, noBackoff = false }) {
  return async function runCasWrite(key, getEmpty, mutator, kind, onSuccess, onExhausted) {
    const S = kind;
    let last = null;
    let attempts = 0;
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        attempts = attempt + 1;
        const cur = (await sget(key)) || getEmpty();
        const baseRev = cur.rev || 0;
        const out = mutator(structuredClone(cur));
        if (isNoChange(out)) {
          stats[S + "Noop"]++;
          stats[S + "MaxAttempts"] = Math.max(stats[S + "MaxAttempts"], attempts);
          return { ok: true, unchanged: true, value: cur };
        }
        if (isDynConflict(out)) {
          stats[S + "MaxAttempts"] = Math.max(stats[S + "MaxAttempts"], attempts);
          return { ok: false, conflict: true, code: out.code, value: cur, error: out.message };
        }
        const next = out;
        next.rev = baseRev + 1;
        const result = await sset(key, next, baseRev);
        if (result.ok) {
          const applied = result.value || next;
          if (onSuccess) onSuccess(cur, applied);
          stats[S + "Success"]++;
          stats[S + "MaxAttempts"] = Math.max(stats[S + "MaxAttempts"], attempts);
          return { ok: true, value: applied };
        }
        stats[S + "Conflicts"]++;
        stats.lastConflictAt = Date.now();
        last = result.value;
        if (attempt < 5 && !noBackoff) {
          await sleep(casBackoffMs(attempt));
        }
      }
      stats[S + "Failures"]++;
      stats[S + "MaxAttempts"] = Math.max(stats[S + "MaxAttempts"], attempts);
      if (last && onExhausted) onExhausted(last);
      return { ok: false, conflict: true, code: "MAX_RETRIES", value: last, error: "Mehrfacher Schreibkonflikt, bitte erneut versuchen." };
    } catch (e) {
      stats[S + "Failures"]++;
      stats[S + "MaxAttempts"] = Math.max(stats[S + "MaxAttempts"], attempts);
      return { ok: false, value: null, error: friendlyError(e?.message) };
    }
  };
}

function freshStats() {
  return {
    dynSuccess: 0, dynNoop: 0, dynConflicts: 0, dynFailures: 0, dynMaxAttempts: 0,
    setupSuccess: 0, setupNoop: 0, setupConflicts: 0, setupFailures: 0, setupMaxAttempts: 0,
    lastConflictAt: 0,
  };
}

// ---- Mock-Store mit echtem CAS (wie write_dyn_if_unchanged) -----------------
// failMode: null | "throw-once" | "throw-always" | "conflict-n"
function makeStore(initial, opts = {}) {
  let server = structuredClone(initial);
  let throwsLeft = opts.throwTimes || 0;
  let conflictsLeft = opts.conflictTimes || 0;
  let writes = 0;
  return {
    peek: () => structuredClone(server),
    writes: () => writes,
    sget: async () => structuredClone(server),
    sset: async (key, val, baseRev) => {
      // Echter, nicht-retrybarer Fehler: wirft (wie sbSetDyn bei RLS/Netz/Validierung).
      if (throwsLeft > 0) { throwsLeft--; throw new Error("RLS: permission denied"); }
      // Optionale Mikroverzoegerung VOR dem CAS-Check: modelliert die reale
      // Netzwerk-/RPC-Latenz. Erst dadurch koennen zwei OHNE Queue gestartete
      // Aktionen beide rev 0 lesen, bevor der erste sset committet (echte
      // Erstkollision). Mit Queue passiert das nicht, weil der zweite Lauf erst
      // nach Abschluss des ersten startet.
      if (opts.setLatency) await new Promise((r) => setTimeout(r, opts.setLatency));
      // Kuenstlicher CAS-Konflikt (ein Konkurrent kam dazwischen), ohne den
      // Serverstand fachlich zu aendern: erzwingt Retry.
      if (conflictsLeft > 0) { conflictsLeft--; server.rev = (server.rev || 0) + 1; }
      if (baseRev === (server.rev || 0)) {
        const written = structuredClone(val);
        written.rev = (server.rev || 0) + 1;
        server = written;
        writes++;
        return { ok: true, value: structuredClone(server) };
      }
      return { ok: false, value: structuredClone(server) };
    },
    competitorWrite: (mutator) => { const n = mutator(structuredClone(server)); n.rev = (server.rev || 0) + 1; server = n; },
  };
}

// ===========================================================================
// Szenario 1: Echter No-op
// ===========================================================================
{
  const store = makeStore({ rides: [{ id: "r1", assignedDriverId: "finn" }], rev: 7 });
  const stats = freshStats();
  const run = makeRunCasWrite({ sget: store.sget, sset: store.sset, stats });
  let pushed = 0; let setDynCalls = 0;
  const res = await run(DYN_KEY, emptyDyn, (d) => {
    const r = d.rides.find((x) => x.id === "r1");
    if (r.assignedDriverId === "finn") return NO_CHANGE; // schon zugewiesen
    r.assignedDriverId = "finn"; return d;
  }, "dyn", () => { setDynCalls++; });
  if (res.ok && !res.unchanged) pushed++; // wie ein Aufrufer: Push nur bei echter Aenderung
  ok(res.ok === true, "S1: No-op meldet ok:true");
  ok(res.unchanged === true, "S1: No-op meldet unchanged:true");
  eq(store.writes(), 0, "S1: KEIN sset-Schreibvorgang");
  eq(store.peek().rev, 7, "S1: Revision unveraendert (7)");
  eq(stats.dynNoop, 1, "S1: Diagnose dynNoop=1");
  eq(stats.dynSuccess, 0, "S1: Diagnose dynSuccess=0");
  eq(setDynCalls, 0, "S1: onSuccess (setDyn) NICHT aufgerufen");
  eq(pushed, 0, "S1: kein Push-Pfad (unchanged)");
}

// ===========================================================================
// Szenario 2: Fachlicher Konflikt
// ===========================================================================
{
  const store = makeStore({ rides: [], rev: 3 }); // erwartete Fahrt ist weg
  const stats = freshStats();
  const run = makeRunCasWrite({ sget: store.sget, sset: store.sset, stats });
  let pushed = 0;
  const res = await run(DYN_KEY, emptyDyn, (d) => {
    const r = d.rides.find((x) => x.id === "r1");
    if (!r) return dynConflict("RIDE_GONE", "Diese Fahrt gibt es nicht mehr.");
    r.assignedDriverId = "finn"; return d;
  }, "dyn", () => {});
  if (res.ok) pushed++;
  ok(res.ok === false, "S2: Konflikt meldet ok:false");
  ok(res.conflict === true, "S2: Konflikt-Flag gesetzt");
  eq(res.code, "RIDE_GONE", "S2: unterscheidbarer Code");
  ok(typeof res.error === "string" && res.error.length > 0, "S2: sachliche Fehlermeldung vorhanden");
  eq(store.writes(), 0, "S2: KEIN Schreibvorgang");
  eq(store.peek().rev, 3, "S2: Revision unveraendert (3)");
  eq(pushed, 0, "S2: kein Push bei Konflikt");
  eq(stats.dynSuccess, 0, "S2: kein Erfolg gezaehlt");
}

// ===========================================================================
// Szenario 3: Zwei lokale gleichzeitige Schreibaktionen -> serialisiert
// ===========================================================================
{
  const store = makeStore({ rides: [{ id: "r1" }, { id: "r2" }], rev: 0 }, { setLatency: 8 });
  const stats = freshStats();
  const { enqueueWrite } = makeEnqueue();
  // Gleiche Latenz-Bedingung wie GP1 (unten): der EINZIGE Unterschied zwischen
  // S3 und GP1 ist die Queue. Mit Queue startet der zweite Lauf erst nach
  // Abschluss des ersten -> kein Konflikt. Ohne Queue (GP1) lesen beide rev 0,
  // waehrend der erste sset noch in der Latenz haengt -> Erstkollision.
  const run = makeRunCasWrite({ sget: store.sget, sset: store.sset, stats });
  // Beobachtung der zeitlichen Ueberlappung: jeder Mutatorlauf markiert Start/Ende.
  let active = 0, maxActive = 0; const order = [];
  const wrap = (name, mut) => async () => {
    active++; maxActive = Math.max(maxActive, active);
    order.push("start:" + name);
    const r = await run(DYN_KEY, emptyDyn, mut, "dyn", () => {});
    order.push("end:" + name);
    active--;
    return r;
  };
  const p1 = enqueueWrite(wrap("A", (d) => { d.rides.find((x) => x.id === "r1").assignedDriverId = "finn"; return d; }));
  const p2 = enqueueWrite(wrap("B", (d) => { d.rides.find((x) => x.id === "r2").assignedDriverId = "bjoern"; return d; }));
  const [rA, rB] = await Promise.all([p1, p2]);
  ok(rA.ok && rB.ok, "S3: beide Aktionen erfolgreich");
  eq(maxActive, 1, "S3: NIE zwei Mutatorlaeufe gleichzeitig aktiv (serialisiert)");
  eq(order, ["start:A", "end:A", "start:B", "end:B"], "S3: deterministische Reihenfolge A dann B");
  // Beide Aenderungen sind drin, keine hat die andere ueberschrieben:
  const s = store.peek();
  eq(s.rides.find((x) => x.id === "r1").assignedDriverId, "finn", "S3: r1 = finn");
  eq(s.rides.find((x) => x.id === "r2").assignedDriverId, "bjoern", "S3: r2 = bjoern");
  eq(s.rev, 2, "S3: zwei serielle Schreibvorgaenge (rev 0 -> 2), keine Erstkollision");
  eq(stats.dynConflicts, 0, "S3: KEINE lokale Erstkollision (Queue verhindert sie)");
}

// ===========================================================================
// Szenario 4: Fehler blockiert Queue nicht
// ===========================================================================
{
  const store = makeStore({ rides: [{ id: "r1" }], rev: 0 }, { throwTimes: 1 }); // erster sset wirft
  const stats = freshStats();
  const { enqueueWrite } = makeEnqueue();
  const run = makeRunCasWrite({ sget: store.sget, sset: store.sset, stats });
  const p1 = enqueueWrite(() => run(DYN_KEY, emptyDyn, (d) => { d.rides[0].assignedDriverId = "finn"; return d; }, "dyn", () => {}));
  const p2 = enqueueWrite(() => run(DYN_KEY, emptyDyn, (d) => { d.rides[0].assignedDriverId = "bjoern"; return d; }, "dyn", () => {}));
  const r1 = await p1;
  const r2 = await p2;
  ok(r1.ok === false, "S4: erste Aktion schlaegt kontrolliert fehl (sset warf)");
  ok(r2.ok === true, "S4: zweite Aktion laeuft danach TROTZDEM (Queue nicht blockiert)");
  eq(store.peek().rides[0].assignedDriverId, "bjoern", "S4: zweite Aenderung ist gespeichert");
}

// ===========================================================================
// Szenario 5: CAS-Konflikt mit Retry (Backoff, frischer Reload, dann Erfolg)
// ===========================================================================
{
  const store = makeStore({ rides: [{ id: "r1", assignedDriverId: null }], rev: 5 }, { conflictTimes: 1 });
  const stats = freshStats();
  const run = makeRunCasWrite({ sget: store.sget, sset: store.sset, stats });
  let mutatorRuns = 0; let pushes = 0;
  const res = await run(DYN_KEY, emptyDyn, (d) => {
    mutatorRuns++;
    const r = d.rides.find((x) => x.id === "r1");
    r.assignedDriverId = "finn"; return d;
  }, "dyn", () => {});
  if (res.ok && !res.unchanged) pushes++;
  ok(res.ok === true, "S5: nach Retry erfolgreich");
  eq(mutatorRuns, 2, "S5: Mutator lief zweimal (auf frisch geladenem Stand erneut)");
  eq(stats.dynConflicts, 1, "S5: genau ein CAS-Konflikt gezaehlt");
  eq(store.peek().rides[0].assignedDriverId, "finn", "S5: Endzustand gespeichert");
  eq(pushes, 1, "S5: Nebenwirkung (Push) genau EINMAL, nach Erfolg");
  eq(store.writes(), 1, "S5: genau ein echter Schreibvorgang (der erste kollidierte vor dem Write)");
}

// ===========================================================================
// Szenario 6: Nicht-retrybarer Fehler (RLS) -> kein sechsfacher Retry
// ===========================================================================
{
  const store = makeStore({ rides: [{ id: "r1" }], rev: 0 }, { throwTimes: 99 }); // wirft immer
  const stats = freshStats();
  const run = makeRunCasWrite({ sget: store.sget, sset: store.sset, stats });
  const res = await run(DYN_KEY, emptyDyn, (d) => { d.rides[0].assignedDriverId = "finn"; return d; }, "dyn", () => {});
  ok(res.ok === false, "S6: kontrollierter Fehler");
  ok(!res.conflict, "S6: NICHT als Konflikt markiert (echter Fehler)");
  eq(stats.dynMaxAttempts, 1, "S6: nur EIN Versuch (kein 6x-Retry bei RLS-Fehler)");
  eq(stats.dynConflicts, 0, "S6: kein Konflikt gezaehlt");
  eq(stats.dynFailures, 1, "S6: Diagnose dynFailures=1");
}

// ===========================================================================
// Szenario 7: Mehrere konkurrierende Clients (3 unabhaengige Mutationen)
// ===========================================================================
{
  // Alle drei lesen dieselbe Ausgangsrevision, schreiben unabhaengige Fahrten.
  // Gemeinsamer Server, drei getrennte Clients (je eigene Queue). Einer gewinnt
  // je Runde, die anderen retryen auf frischem Stand. Am Ende sind alle drin.
  const shared = makeStore({ rides: [{ id: "r1" }, { id: "r2" }, { id: "r3" }], rev: 0 });
  const mkClient = () => {
    const stats = freshStats();
    const run = makeRunCasWrite({ sget: shared.sget, sset: shared.sset, stats });
    const { enqueueWrite } = makeEnqueue();
    return { stats, go: (mut) => enqueueWrite(() => run(DYN_KEY, emptyDyn, mut, "dyn", () => {})) };
  };
  const cA = mkClient(), cB = mkClient(), cC = mkClient();
  const results = await Promise.all([
    cA.go((d) => { d.rides.find((x) => x.id === "r1").assignedDriverId = "finn"; return d; }),
    cB.go((d) => { d.rides.find((x) => x.id === "r2").assignedDriverId = "bjoern"; return d; }),
    cC.go((d) => { d.rides.find((x) => x.id === "r3").assignedDriverId = "amar"; return d; }),
  ]);
  ok(results.every((r) => r.ok), "S7: alle drei Clients letztlich erfolgreich");
  const s = shared.peek();
  eq(s.rides.find((x) => x.id === "r1").assignedDriverId, "finn", "S7: r1 erhalten");
  eq(s.rides.find((x) => x.id === "r2").assignedDriverId, "bjoern", "S7: r2 erhalten");
  eq(s.rides.find((x) => x.id === "r3").assignedDriverId, "amar", "S7: r3 erhalten (keine Mutation ueberschrieben)");
  eq(s.rev, 3, "S7: genau drei Schreibvorgaenge angewendet");
  const totalConflicts = cA.stats.dynConflicts + cB.stats.dynConflicts + cC.stats.dynConflicts;
  ok(totalConflicts >= 1, "S7: mindestens ein Client musste wegen Konkurrenz retryen");
}

// ===========================================================================
// Szenario 8: No-op unter Konkurrenz
//   Client A will r1 auf "finn" setzen. Bevor A schreibt, hat B r1 bereits auf
//   "finn" gesetzt (Konflikt). A laedt frisch, stellt fest: schon "finn" -> No-op.
// ===========================================================================
{
  const store = makeStore({ rides: [{ id: "r1", assignedDriverId: null }], rev: 0 });
  const stats = freshStats();
  // sset, das beim ERSTEN Versuch einen Konflikt erzeugt UND dabei den Server
  // schon auf den Zielzustand bringt (so als haette B das getan).
  let first = true;
  const sset = async (key, val, baseRev) => {
    if (first) {
      first = false;
      store.competitorWrite((d) => { d.rides.find((x) => x.id === "r1").assignedDriverId = "finn"; return d; });
      return { ok: false, value: store.peek() };
    }
    return store.sset(key, val, baseRev);
  };
  const run = makeRunCasWrite({ sget: store.sget, sset, stats });
  let pushes = 0;
  const res = await run(DYN_KEY, emptyDyn, (d) => {
    const r = d.rides.find((x) => x.id === "r1");
    if (r.assignedDriverId === "finn") return NO_CHANGE; // schon im Zielzustand
    r.assignedDriverId = "finn"; return d;
  }, "dyn", () => {});
  if (res.ok && !res.unchanged) pushes++;
  ok(res.ok === true, "S8: endet kontrolliert mit ok:true");
  ok(res.unchanged === true, "S8: als No-op erkannt");
  eq(stats.dynConflicts, 1, "S8: der erste Versuch war ein echter Konflikt");
  eq(stats.dynNoop, 1, "S8: danach No-op");
  eq(store.writes(), 0, "S8: KEIN eigener Schreibvorgang (B hatte via competitorWrite geschrieben)");
  eq(pushes, 0, "S8: kein doppelter Push");
}

// ===========================================================================
// Szenario 9: Maximalversuche -> kontrollierter Fehler, keine Endlosschleife
// ===========================================================================
{
  // Server-rev tickt bei JEDEM sset-Versuch weiter (Dauer-Konkurrenz) -> nie Erfolg.
  const store = makeStore({ rides: [{ id: "r1" }], rev: 0 }, { conflictTimes: 999 });
  const stats = freshStats();
  const run = makeRunCasWrite({ sget: store.sget, sset: store.sset, stats, noBackoff: true });
  let exhaustedVal = null;
  const res = await run(DYN_KEY, emptyDyn, (d) => { d.rides[0].assignedDriverId = "finn"; return d; }, "dyn", () => {}, (last) => { exhaustedVal = last; });
  ok(res.ok === false, "S9: kontrollierter Fehlschlag nach Maximalversuchen");
  eq(res.code, "MAX_RETRIES", "S9: Code MAX_RETRIES");
  eq(stats.dynMaxAttempts, 6, "S9: genau 6 Versuche (bestehende Maximalanzahl)");
  eq(stats.dynConflicts, 6, "S9: sechs Konflikte gezaehlt");
  eq(stats.dynFailures, 1, "S9: ein endgueltiger Fehlschlag gezaehlt");
  ok(exhaustedVal !== null, "S9: onExhausted mit aktuellem Serverstand aufgerufen (setDyn(last)-Ersatz)");
}

// ===========================================================================
// Szenario 10: Session-2-Invarianten (Push genau einmal, nie bei No-op/Konflikt)
// ===========================================================================
{
  // (a) Erfolg mit Retry: genau ein Push.
  const s1 = makeStore({ rides: [{ id: "r1" }], rev: 0 }, { conflictTimes: 2 });
  const st1 = freshStats();
  const run1 = makeRunCasWrite({ sget: s1.sget, sset: s1.sset, stats: st1 });
  let pushA = 0; const fixedId = "i-STABLE"; const seenIds = new Set();
  const rA = await run1(DYN_KEY, emptyDyn, (d) => {
    const r = d.rides[0]; r.issues = r.issues || []; r.issues.push({ id: fixedId }); seenIds.add(fixedId); return d;
  }, "dyn", () => {});
  if (rA.ok && !rA.unchanged) pushA++;
  eq(pushA, 1, "S10a: Push GENAU einmal trotz mehrfacher Mutatorlaeufe (Retry)");
  eq(s1.peek().rides[0].issues.filter((i) => i.id === fixedId).length, 1, "S10a: stabile ID -> nur EIN Issue trotz Retry (kein Doppel)");

  // (b) No-op: kein Push.
  const s2 = makeStore({ rides: [{ id: "r1", guestConfirmedAt: 123 }], rev: 1 });
  const st2 = freshStats();
  const run2 = makeRunCasWrite({ sget: s2.sget, sset: s2.sset, stats: st2 });
  let pushB = 0;
  const rB = await run2(DYN_KEY, emptyDyn, (d) => {
    const r = d.rides[0]; if (r.guestConfirmedAt) return NO_CHANGE; r.guestConfirmedAt = 999; return d;
  }, "dyn", () => {});
  if (rB.ok && !rB.unchanged) pushB++;
  eq(pushB, 0, "S10b: kein Push bei No-op");
  eq(s2.peek().rev, 1, "S10b: Revision unveraendert bei No-op");

  // (c) Konflikt: kein Push.
  const s3 = makeStore({ rides: [], rev: 4 });
  const st3 = freshStats();
  const run3 = makeRunCasWrite({ sget: s3.sget, sset: s3.sset, stats: st3 });
  let pushC = 0;
  const rC = await run3(DYN_KEY, emptyDyn, (d) => {
    const r = d.rides.find((x) => x.id === "r1"); if (!r) return dynConflict("RIDE_GONE", "weg"); r.x = 1; return d;
  }, "dyn", () => {});
  if (rC.ok) pushC++;
  eq(pushC, 0, "S10c: kein Push bei Konflikt");
  eq(s3.peek().rev, 4, "S10c: Revision unveraendert bei Konflikt");
}

// ===========================================================================
// PFLICHT-GEGENPROBE 1: OHNE Queue starten zwei lokale Schreibaktionen parallel
// ===========================================================================
{
  const store = makeStore({ rides: [{ id: "r1" }, { id: "r2" }], rev: 0 }, { setLatency: 8 });
  const stats = freshStats();
  // Gleiche Latenz wie S3, aber OHNE Queue: beide Aktionen lesen rev 0, waehrend
  // der erste sset noch in der Latenz haengt -> genau die Erstkollision, die die
  // Queue in S3 verhindert.
  const run = makeRunCasWrite({ sget: store.sget, sset: store.sset, stats });
  let active = 0, maxActive = 0;
  const wrap = (mut) => async () => {
    active++; maxActive = Math.max(maxActive, active);
    const r = await run(DYN_KEY, emptyDyn, mut, "dyn", () => {});
    active--; return r;
  };
  // OHNE enqueueWrite: beide direkt starten -> muessen NACHWEISBAR parallel laufen.
  const p1 = wrap((d) => { d.rides.find((x) => x.id === "r1").assignedDriverId = "finn"; return d; })();
  const p2 = wrap((d) => { d.rides.find((x) => x.id === "r2").assignedDriverId = "bjoern"; return d; })();
  await Promise.all([p1, p2]);
  ok(maxActive === 2, "GP1: ohne Queue laufen zwei Aktionen NACHWEISBAR parallel (maxActive=2)");
  // ... und erzeugen dadurch eine lokale Erstkollision (Konflikt), die die Queue verhindert haette:
  ok(stats.dynConflicts >= 1, "GP1: ohne Queue entsteht die lokale Erstkollision (Konflikt >= 1)");
}

// ===========================================================================
// PFLICHT-GEGENPROBE 2: OHNE No-op-Erkennung schreibt ein unveraenderter Mutator
// ===========================================================================
{
  const store = makeStore({ rides: [{ id: "r1", assignedDriverId: "finn" }], rev: 7 });
  const stats = freshStats();
  const run = makeRunCasWrite({ sget: store.sget, sset: store.sset, stats });
  // Der Mutator gibt (wie die ALTE Welt) einfach d zurueck, auch wenn nichts
  // fachlich zu tun ist -> MUSS schreiben und die Revision erhoehen.
  const res = await run(DYN_KEY, emptyDyn, (d) => {
    const r = d.rides.find((x) => x.id === "r1");
    // KEIN "if (already) return NO_CHANGE" -> alte Semantik
    r.assignedDriverId = "finn"; // effektiv unveraendert, aber wird geschrieben
    return d;
  }, "dyn", () => {});
  ok(res.ok === true && !res.unchanged, "GP2: ohne No-op-Vertrag wird als normaler Schreibvorgang behandelt");
  eq(store.writes(), 1, "GP2: NACHWEISBAR ein Schreibvorgang trotz fachlicher Unveraenderung");
  eq(store.peek().rev, 8, "GP2: Revision erhoeht (7 -> 8), genau der Effekt, den NO_CHANGE verhindert");
  eq(stats.dynNoop, 0, "GP2: kein No-op gezaehlt (Kontrast zu S1)");
}

// ===========================================================================
console.log(`\nWrite-Contention Smoke: ${pass} OK, ${fail} FAIL`);
if (fail) { console.log("FEHLER:"); fails.forEach((f) => console.log("  - " + f)); process.exit(1); }
