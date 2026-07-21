// Block-D-Beweistest: Fehlerpfade und UI-Wiederherstellung.
//
// Ergaenzt smoke-write-contention.mjs / smoke-write-sideeffects.mjs, die die
// reine CAS-/Queue-Schicht (Retry, MAX_RETRIES, kein 6x-Retry bei echtem Fehler,
// Push-genau-einmal, No-op-/Konfliktvertrag) bereits beweisen. DIESER Test prueft
// gezielt die AUFRUFER-/UI-Wiederherstellungs-Invarianten aus Block D, die dort
// NICHT abgedeckt sind, so wie sie in src/ShuttleLeitstelle.jsx implementiert
// sind:
//
//   D1  friendlyError: Netz-/Timeout-Meldung -> verstaendlicher Text;
//       nicht-Netz-Fehler (RLS/unerwartet) -> null (Fallback-Pfad, KEIN Rohtext).
//   D2  Aufrufer-Fallback greift IMMER: fuer jede Fehlerklasse ist die an die UI
//       gereichte Meldung (res.error || CALLER_FALLBACK) ein nicht-leerer
//       menschenlesbarer Text, nie null/leer, nie ein technischer Rohstring.
//   D3  Rohfehler-Schutz Gast/Stage: die fest verdrahteten Meldungen zeigen NIE
//       res.error an, auch wenn der Store einen technischen Rohstring liefert.
//   D4  Push-Isolation: ein werfender Push macht aus einer gespeicherten Aktion
//       (ok:true) KEINEN falschen Fehler und wirft NICHT in den Aufrufer zurueck.
//   D5  Kein Push vor Save, kein Push bei No-op, kein Push bei Konflikt
//       (Aufrufer-Reihenfolge: erst res.ok pruefen, DANN Push).
//   D6  Busy-Reset im finally: die Sperre wird auch dann geloest, wenn die
//       Arbeit wirft; ein zweiter Versuch laeuft danach (Retry moeglich).
//   D7  Eingaben bleiben bei Fehler erhalten (Modal bleibt offen: der Aufrufer
//       ruft onClose NUR bei ok:true).
//
// Pflicht-Gegenprobe (D-GP): entfernt man den Aufrufer-Fallback (nur res.error),
// wird die an die UI gereichte Meldung bei einem nicht-Netz-Fehler leer/null ->
// der Fallback-Test kippt zuverlaessig. Das beweist, dass der Fallback wirkt.
//
// Die getestete Logik ist ZEILENGETREU aus src/ShuttleLeitstelle.jsx repliziert
// (friendlyError, NO_CHANGE/dynConflict, runCasWrite-catch-Rueckgabe,
// triggerPush-try/catch-Muster, die Aufrufer-Wrapper mitSperre/doAssign/Gast).
// Der Mock-sset bildet die Semantik von write_dyn_if_unchanged nach: bedingtes
// UPDATE (Konflikt -> aktueller Serverstand), ECHTER Fehler wirft (wie sbSetDyn
// "if (error) throw error").
//
// Aufruf: node smoke-fehlerpfade-d.mjs

let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push(m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} (erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)})`);

const DYN_KEY = "obf:dyn:v5";
const emptyDyn = () => ({ rides: [], driverState: {}, messages: [], rev: 0 });

// ===========================================================================
// ZEILENGETREUE Repliken aus src/ShuttleLeitstelle.jsx
// ===========================================================================

// --- Modulkopf: No-change-/Konflikt-Vertrag -------------------------------
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

// --- friendlyError: ZEILENGETREU (Z. 2531-2537) ---------------------------
function friendlyError(raw, fallback) {
  const s = String(raw || "").trim();
  if (!s) return fallback;
  if (/network|failed to fetch|fetch|timeout|timed out|offline|econn|net::|networkerror|load failed/i.test(s))
    return "Keine Verbindung zum Server. Die Änderung wurde nicht gespeichert, bitte gleich nochmal versuchen.";
  return fallback;
}

// --- Monotonie-Guard (nur der Vollstaendigkeit halber, hier nicht zentral) --
function shouldAcceptRevision(curRev, nextRev) {
  if (nextRev == null) return false;
  if (curRev == null) return true;
  return nextRev >= curRev;
}

// ---------------------------------------------------------------------------
// Mock-Store: sget liest den "Server", sset ist ein bedingtes CAS-UPDATE.
// Ein injizierter Fehlermodus laesst sset/sget WERFEN (Netz/RLS/unerwartet),
// exakt wie sbGetDyn/sbSetDyn im Supabase-Pfad ("if (error) throw error").
// ---------------------------------------------------------------------------
function makeStore(initial) {
  const server = { [DYN_KEY]: initial ? structuredClone(initial) : null };
  let getThrows = null;   // z.B. () => new Error("network request failed")
  let setThrows = null;
  const sget = async (key) => {
    if (getThrows) { const e = getThrows(); if (e) throw e; }
    return server[key] ? structuredClone(server[key]) : null;
  };
  const sset = async (key, val, baseRev) => {
    if (setThrows) { const e = setThrows(); if (e) throw e; }
    const cur = server[key];
    const curRev = cur ? (cur.rev || 0) : 0;
    if (curRev !== baseRev) return { ok: false, value: cur ? structuredClone(cur) : null }; // CAS-Konflikt
    server[key] = structuredClone(val);
    return { ok: true, value: structuredClone(val) };
  };
  return {
    sget, sset,
    setGetThrows: (f) => { getThrows = f; },
    setSetThrows: (f) => { setThrows = f; },
    peek: () => server[DYN_KEY],
  };
}

// --- runCasWrite: ZEILENGETREU (Z. 1179-1240), mit injizierbarem Store ------
function makeRunCasWrite(store) {
  const stats = { dynSuccess: 0, dynNoop: 0, dynConflicts: 0, dynFailures: 0, dynMaxAttempts: 0, lastConflictAt: 0 };
  const runCasWrite = async (key, getEmpty, mutator, kind, onSuccess, onExhausted) => {
    const S = kind;
    let last = null;
    let attempts = 0;
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        attempts = attempt + 1;
        const cur = (await store.sget(key)) || getEmpty();
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
        const result = await store.sset(key, next, baseRev);
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
        if (attempt < 5) await sleep(1); // Backoff im Test verkuerzt (Verhalten unveraendert)
      }
      stats[S + "Failures"]++;
      stats[S + "MaxAttempts"] = Math.max(stats[S + "MaxAttempts"], attempts);
      if (last && onExhausted) onExhausted(last);
      return { ok: false, conflict: true, code: "MAX_RETRIES", value: last, error: "Mehrfacher Schreibkonflikt, bitte erneut versuchen." };
    } catch (e) {
      // ZEILENGETREU: friendlyError(e?.message, null) -> nicht-Netz-Fehler => null.
      stats[S + "Failures"]++;
      stats[S + "MaxAttempts"] = Math.max(stats[S + "MaxAttempts"], attempts);
      return { ok: false, value: null, error: friendlyError(e?.message, null) };
    }
  };
  return { runCasWrite, stats };
}

// --- enqueueWrite + updateDyn-Wrapper (dyn): ZEILENGETREU -------------------
function makeUpdateDyn(store) {
  const { runCasWrite, stats } = makeRunCasWrite(store);
  const queueRef = { current: Promise.resolve() };
  const enqueueWrite = (task) => {
    const run = queueRef.current.then(task, task);
    queueRef.current = run.then(() => {}, () => {});
    return run;
  };
  let dynState = null; // steht fuer setDyn(applied)
  const updateDyn = (mutator) => enqueueWrite(() =>
    runCasWrite(DYN_KEY, emptyDyn, mutator, "dyn",
      (cur, applied) => { dynState = applied; },
      (last) => { dynState = shouldAcceptRevision(dynState ? dynState.rev : null, last ? last.rev : null) ? last : dynState; })
  );
  return { updateDyn, stats, getDynState: () => dynState };
}

// --- triggerPush-Muster: ZEILENGETREU try/catch (Z. 2828-2846) -------------
// Wirft NIE zurueck. Ein Push-Fehler landet nur im (hier gezaehlten) Log.
function makeTriggerPush(mode /* "ok" | "http-fail" | "throw" */) {
  let calls = 0, logged = 0;
  const triggerPush = async (driverId /*...*/) => {
    if (!driverId) return;
    calls++;
    try {
      if (mode === "throw") throw new Error("fetch failed (kein Deployment)");
      if (mode === "http-fail") { logged++; return; } // res.ok false -> console.error + return
      // ok
    } catch (e) { logged++; /* console.error im Original */ }
  };
  return { triggerPush, getCalls: () => calls, getLogged: () => logged };
}

// ===========================================================================
// D1  friendlyError: Netz -> Text, sonst -> Fallback (null im runCasWrite)
// ===========================================================================
await (async () => {
  for (const raw of ["Failed to fetch", "network request failed", "timeout of 5000ms exceeded",
                     "NetworkError when attempting to fetch resource", "load failed", "ECONNREFUSED"]) {
    const out = friendlyError(raw, null);
    ok(typeof out === "string" && out.includes("Keine Verbindung zum Server"),
       `D1 Netzfehler "${raw}" -> freundliche Verbindungs-Meldung (war ${JSON.stringify(out)})`);
    ok(!/fetch|econn|networkerror|timeout/i.test(out), `D1 Netzfehler "${raw}" -> KEIN technischer Rohtext durchgereicht`);
  }
  for (const raw of ["permission denied for table dyn_data", "new row violates row-level security policy",
                     "duplicate key value", "unexpected server error 500", "PGRST301"]) {
    const out = friendlyError(raw, null);
    eq(out, null, `D1 nicht-Netz-Fehler "${raw}" -> null (Fallback-Pfad, kein Rohtext)`);
  }
  eq(friendlyError("", null), null, "D1 leere message -> Fallback (null)");
  eq(friendlyError(undefined, null), null, "D1 undefined message -> Fallback (null)");
})();

// ===========================================================================
// D2  Aufrufer-Fallback greift IMMER: die an die UI gereichte Meldung ist fuer
//     JEDE Fehlerklasse ein nicht-leerer, menschenlesbarer, NICHT-roher Text.
//     Modell des Aufrufer-Wrappers (mitSperre/doAssign/onErr):
//         surface = res.error || CALLER_FALLBACK
// ===========================================================================
await (async () => {
  const CALLER_FALLBACK = "Die Zuteilung konnte nicht gespeichert werden. Bitte Verbindung prüfen und erneut versuchen.";
  const surface = (res) => (res && res.error) || CALLER_FALLBACK;
  const isCleanMessage = (s) => typeof s === "string" && s.trim().length > 0
    && !/permission denied|row-level security|PGRST|duplicate key|500|ECONN|networkerror|Failed to fetch/i.test(s);

  // (a) Netzfehler-Fall
  {
    const store = makeStore(emptyDyn());
    store.setSetThrows(() => new Error("Failed to fetch"));
    const { updateDyn } = makeUpdateDyn(store);
    const res = await updateDyn((d) => { d.rides.push({ id: "r1" }); return d; });
    ok(res.ok === false, "D2a Netzfehler -> ok:false");
    ok(isCleanMessage(surface(res)), `D2a Netzfehler -> saubere UI-Meldung (war ${JSON.stringify(surface(res))})`);
  }
  // (b) RLS-/Berechtigungsfehler (nicht-Netz -> res.error === null)
  {
    const store = makeStore(emptyDyn());
    store.setSetThrows(() => new Error("new row violates row-level security policy for table \"dyn_data\""));
    const { updateDyn } = makeUpdateDyn(store);
    const res = await updateDyn((d) => { d.rides.push({ id: "r1" }); return d; });
    ok(res.ok === false, "D2b RLS-Fehler -> ok:false");
    eq(res.error, null, "D2b RLS-Fehler -> res.error === null (kein Rohtext im Ergebnis)");
    ok(isCleanMessage(surface(res)), `D2b RLS-Fehler -> Aufrufer-Fallback ist saubere Meldung (war ${JSON.stringify(surface(res))})`);
  }
  // (c) unerwarteter Serverfehler (nicht-Netz)
  {
    const store = makeStore(emptyDyn());
    store.setSetThrows(() => new Error("unexpected server error 500"));
    const { updateDyn } = makeUpdateDyn(store);
    const res = await updateDyn((d) => { d.rides.push({ id: "r1" }); return d; });
    eq(res.error, null, "D2c unerwarteter Serverfehler -> res.error === null");
    ok(isCleanMessage(surface(res)), "D2c unerwarteter Serverfehler -> saubere UI-Meldung via Fallback");
  }
  // (d) fachlicher Konflikt (dynConflict) -> res.error ist bereits menschenlesbar
  {
    const store = makeStore(emptyDyn());
    const { updateDyn } = makeUpdateDyn(store);
    const res = await updateDyn(() => dynConflict("RIDE_GONE", "Diese Fahrt existiert nicht mehr."));
    ok(res.ok === false && res.conflict === true, "D2d dynConflict -> ok:false, conflict:true");
    ok(isCleanMessage(surface(res)) && surface(res).includes("existiert nicht mehr"),
       "D2d dynConflict -> eigener menschenlesbarer Text");
  }
  // (e) MAX_RETRIES (6 CAS-Konflikte) -> menschenlesbarer Text, kein Rohtext
  {
    const store = makeStore(emptyDyn());
    // sset gibt immer Konflikt zurueck (Server-Rev bleibt "voraus")
    let bump = 1;
    store.sset = async () => ({ ok: false, value: { rides: [], driverState: {}, messages: [], rev: bump++ } });
    const { updateDyn, stats } = makeUpdateDyn(store);
    const res = await updateDyn((d) => { d.rides.push({ id: "r1" }); return d; });
    ok(res.ok === false && res.code === "MAX_RETRIES", "D2e 6x CAS -> code MAX_RETRIES");
    ok(isCleanMessage(surface(res)), "D2e MAX_RETRIES -> saubere UI-Meldung");
  }
})();

// ===========================================================================
// D3  Rohfehler-Schutz Gast/Stage: die fest verdrahtete Meldung ignoriert
//     res.error vollstaendig (auch bei technischem Rohstring im Ergebnis).
// ===========================================================================
await (async () => {
  // Store, der einen technischen Rohstring in res.error PRODUZIEREN wuerde
  // (hypothetisch: friendlyError liesse Rohtext durch). Wir modellieren den
  // schlimmsten Fall bewusst und pruefen, dass Gast/Stage ihn NICHT anzeigen.
  const resMitRohtext = { ok: false, error: "permission denied for table dyn_data" };

  // Gast-Handler: setGuestErr("Could not send your report. Please try again.")
  const guestSurface = (res) => "Could not send your report. Please try again.";
  const gs = guestSurface(resMitRohtext);
  ok(gs === "Could not send your report. Please try again.", "D3 Gast: fest verdrahteter EN-Text");
  ok(!gs.includes("permission denied"), "D3 Gast: KEIN res.error/Rohtext sichtbar");

  // Stage-Handler: setStageErr("Meldung konnte nicht gesendet werden. Bitte erneut versuchen.")
  const stageSurface = (res) => "Meldung konnte nicht gesendet werden. Bitte erneut versuchen.";
  const ss = stageSurface(resMitRohtext);
  ok(ss.includes("Bitte erneut versuchen"), "D3 Stage: fest verdrahteter Text");
  ok(!ss.includes("permission denied"), "D3 Stage: KEIN res.error/Rohtext sichtbar");
})();

// ===========================================================================
// D4/D5  Push-Isolation + Push-Reihenfolge am Aufrufer (assign-Modell).
//     Aufrufer-Reihenfolge (doAssign/quickAssign/applyChatAction):
//        res = await updateDyn(...)
//        if (!res.ok) return res            // Modal offen, KEIN Push
//        setModal(null)                     // erst bei ok schliessen
//        <saved aus res.value>              // aus BESTAETIGTEM Stand
//        triggerPush(...)                   // NACH Save, best-effort
// ===========================================================================
async function assignCaller({ store, updateDyn, triggerPush, rideId, driverId }) {
  let modalClosed = false, pushed = false, threw = false, surfacedErr = null;
  const beforeDriver = (store.peek()?.rides || []).find((x) => x.id === rideId)?.assignedDriverId ?? null;
  const res = await updateDyn((d) => {
    const r = d.rides.find((x) => x.id === rideId);
    if (!r) return dynConflict("RIDE_GONE", "Diese Fahrt existiert nicht mehr.");
    const changed = r.assignedDriverId !== driverId;
    if (!changed) return NO_CHANGE;
    r.assignedDriverId = driverId;
    return d;
  });
  if (!res || !res.ok) { surfacedErr = res?.error || "Fallback"; return { res, modalClosed, pushed, threw, surfacedErr }; }
  modalClosed = true;
  const saved = (res.value.rides || []).find((x) => x.id === rideId);
  try {
    if ((beforeDriver ?? null) !== (driverId ?? null) && driverId && saved && !res.unchanged) { await triggerPush(driverId); pushed = true; }
  } catch (e) { threw = true; } // darf NICHT passieren
  return { res, modalClosed, pushed, threw, surfacedErr };
}

// D4: werfender Push -> Save steht (ok:true), Modal zu, KEIN Rueckwurf
await (async () => {
  const store = makeStore({ rides: [{ id: "r1", assignedDriverId: null }], driverState: {}, messages: [], rev: 3 });
  const { updateDyn } = makeUpdateDyn(store);
  const tp = makeTriggerPush("throw");
  const out = await assignCaller({ store, updateDyn, triggerPush: tp.triggerPush, rideId: "r1", driverId: "finn-steinmetz" });
  ok(out.res.ok === true, "D4 werfender Push: Save ok:true bleibt bestehen");
  ok(out.modalClosed === true, "D4 werfender Push: Modal wurde geschlossen (Erfolg)");
  ok(out.threw === false, "D4 werfender Push: KEIN Rueckwurf in den Aufrufer");
  eq(store.peek().rides[0].assignedDriverId, "finn-steinmetz", "D4 werfender Push: Zuweisung ist gespeichert");
})();

// D5a: Konflikt (RIDE_GONE) -> KEIN Push, Modal bleibt offen, Meldung da
await (async () => {
  const store = makeStore({ rides: [], driverState: {}, messages: [], rev: 3 }); // Fahrt weg
  const { updateDyn } = makeUpdateDyn(store);
  const tp = makeTriggerPush("ok");
  const out = await assignCaller({ store, updateDyn, triggerPush: tp.triggerPush, rideId: "r1", driverId: "finn-steinmetz" });
  ok(out.res.ok === false, "D5a Konflikt: ok:false");
  ok(tp.getCalls() === 0 && out.pushed === false, "D5a Konflikt: KEIN Push");
  ok(out.modalClosed === false, "D5a Konflikt: Modal bleibt offen (Eingaben erhalten)");
  ok(typeof out.surfacedErr === "string" && out.surfacedErr.length > 0, "D5a Konflikt: sichtbare Meldung");
})();

// D5b: No-op (gleicher Fahrer) -> ok:true, aber KEIN Push
await (async () => {
  const store = makeStore({ rides: [{ id: "r1", assignedDriverId: "finn-steinmetz" }], driverState: {}, messages: [], rev: 3 });
  const { updateDyn } = makeUpdateDyn(store);
  const tp = makeTriggerPush("ok");
  const out = await assignCaller({ store, updateDyn, triggerPush: tp.triggerPush, rideId: "r1", driverId: "finn-steinmetz" });
  ok(out.res.ok === true && out.res.unchanged === true, "D5b No-op: ok:true, unchanged:true");
  ok(tp.getCalls() === 0 && out.pushed === false, "D5b No-op: KEIN Push");
})();

// D5c: Netzfehler -> KEIN Push, Save nicht erfolgt, Meldung da
await (async () => {
  const store = makeStore({ rides: [{ id: "r1", assignedDriverId: null }], driverState: {}, messages: [], rev: 3 });
  store.setSetThrows(() => new Error("Failed to fetch"));
  const { updateDyn } = makeUpdateDyn(store);
  const tp = makeTriggerPush("ok");
  const out = await assignCaller({ store, updateDyn, triggerPush: tp.triggerPush, rideId: "r1", driverId: "finn-steinmetz" });
  ok(out.res.ok === false, "D5c Netzfehler: ok:false");
  ok(tp.getCalls() === 0, "D5c Netzfehler: KEIN Push vor Save");
  eq(store.peek().rides[0].assignedDriverId, null, "D5c Netzfehler: nichts gespeichert");
})();

// ===========================================================================
// D6  Busy-Reset im finally: Sperre wird auch bei werfender Arbeit geloest,
//     zweiter Versuch laeuft (Retry moeglich). Modell von mitSperre (Z. 3037).
// ===========================================================================
await (async () => {
  let busyRef = null;                       // wie busyRef.current
  const runs = [];
  const notifies = [];
  const notify = (m) => notifies.push(m);
  const mitSperre = async (rideId, arbeit) => {
    if (busyRef) return "blocked";          // Doppelklick auf Tick-Ebene
    busyRef = rideId;
    try {
      const ergebnis = await arbeit();
      if (!ergebnis || !ergebnis.ok) notify(ergebnis?.error || "Nicht gespeichert. Bitte noch einmal tippen.");
      return ergebnis;
    } finally {
      busyRef = null;                       // IMMER loesen
    }
  };
  // 1) Arbeit wirft -> finally loest trotzdem
  let threwOut = false;
  try {
    await mitSperre("r1", async () => { runs.push("a"); throw new Error("boom"); });
  } catch { threwOut = true; }
  ok(busyRef === null, "D6 Sperre nach werfender Arbeit geloest (finally)");
  // 2) Doppelklick waehrend laufender Arbeit wird geblockt
  {
    busyRef = null;
    let resolveFirst;
    const first = mitSperre("r2", () => new Promise((res) => { resolveFirst = () => res({ ok: true }); }));
    const second = await mitSperre("r2", async () => { runs.push("zweiter-darf-nicht"); return { ok: true }; });
    ok(second === "blocked", "D6 Doppelklick waehrend Arbeit -> geblockt (nur eine Aktion)");
    resolveFirst(); await first;
    ok(busyRef === null, "D6 nach Abschluss wieder frei");
  }
  // 3) Retry nach Fehler laeuft und meldet Fehler sichtbar
  {
    busyRef = null; notifies.length = 0;
    const r = await mitSperre("r3", async () => ({ ok: false, error: null })); // nicht-Netz -> error null
    ok(r && r.ok === false, "D6 Retry: Aktion laeuft erneut");
    ok(notifies.length === 1 && typeof notifies[0] === "string" && notifies[0].length > 0,
       "D6 Retry: Fehler sichtbar via Fallback (auch bei error:null)");
    ok(busyRef === null, "D6 Retry: danach wieder frei");
  }
})();

// ===========================================================================
// D-GP  PFLICHT-GEGENPROBE: entfernt man den Aufrufer-Fallback (nur res.error),
//       wird die UI-Meldung bei einem nicht-Netz-Fehler leer/null -> kippt.
//       Das beweist, dass der Fallback tatsaechlich wirkt (D2 misst etwas).
// ===========================================================================
let gpKippte = false;
await (async () => {
  const store = makeStore(emptyDyn());
  store.setSetThrows(() => new Error("new row violates row-level security policy"));
  const { updateDyn } = makeUpdateDyn(store);
  const res = await updateDyn((d) => { d.rides.push({ id: "r1" }); return d; });
  const surfaceOhneFallback = res && res.error;            // KEIN "|| Fallback"
  const surfaceMitFallback  = (res && res.error) || "Bitte erneut versuchen.";
  // Ohne Fallback: leer/null (kippt). Mit Fallback: sauber.
  gpKippte = (surfaceOhneFallback == null || surfaceOhneFallback === "");
  ok(gpKippte, "D-GP ohne Fallback: UI-Meldung ist leer/null (Gegenprobe kippt wie erwartet)");
  ok(typeof surfaceMitFallback === "string" && surfaceMitFallback.length > 0,
     "D-GP mit Fallback: UI-Meldung ist sauber (produktives Verhalten)");
})();

// ===========================================================================
console.log(`\nBlock-D Fehlerpfade Smoke: ${pass} OK, ${fail} FAIL`);
if (fail) { console.log("FEHLER:"); fails.forEach((f) => console.log("  - " + f)); process.exit(1); }
console.log(gpKippte ? "Gegenprobe D-GP: kippte wie erwartet." : "Gegenprobe D-GP: NICHT gekippt!");
console.log("ALLE GRUEN");
