// ============================================================================
// Teilpaket G - Mehrbenutzer-/Lastsimulation der Artifact-Schreibinfrastruktur.
//
// Treibt viele Akteure (20 Fahrer + 2 Leitstellen + 3 Stage + Gaeste) mit
// gemischten, realistischen Operationen GLEICHZEITIG gegen EIN gemeinsames
// dyn-Objekt und prueft die Kern-Garantien der bestehenden CAS-Schreibschicht
// (runCasWrite, Z. 1179-1245 in src/ShuttleLeitstelle.jsx) unter Last:
//
//   (I)   Kein verlorenes Update: jede erfolgreich (ok:true) angewendete
//         Feld-Aenderung ist im Endstand vorhanden - auch wenn dutzende andere
//         Schreiber auf demselben Objekt gleichzeitig arbeiteten.
//   (II)  Atomare Appends verlieren nie: die Gesamtzahl der Eintraege in
//         issues[]/log[]/statusHistory[] im Endstand == Zahl der erfolgreichen
//         Append-Ops. Kein Ueberschreiben ganzer Arrays.
//   (III) Revision monoton und == Zahl der erfolgreichen Nicht-No-op-Schreiber.
//   (IV)  Rollen-Schreibgrenzen: Stage/Gast fassen NIE status oder
//         assignedDriverId an (strukturell + post-hoc geprueft).
//   (V)   Push genau einmal pro erfolgreichem kritischem Schreibvorgang,
//         nie bei No-op/Konflikt (Buchhaltung wie Session-2-Invariante).
//   (VI)  Statuswege nur vorwaerts entlang der definierten Reihenfolge.
//
// EHRLICHE EINORDNUNG - was dieser Test IST und was NICHT:
//   ECHT ausgefuehrt: der zeilengetreu aus der Quelle uebernommene CAS-Kern
//   (No-op-/Konflikt-Vertrag, Retry, serverseitige rev-Erhoehung) und die
//   atomare-Append-Semantik der App, unter hohem, gemischtem Aufkommen. Kein
//   Grep, echte Codeausfuehrung. Contention ist DETERMINISTISCH erzwungen
//   (Batch-Barriere, gemeinsame baseRev), nicht timing-/wanduhr-abhaengig ->
//   nicht flaky.
//   NICHT getestet (braucht echten Deploy): echte Supabase-Postgres-Row-Locks
//   unter realer Parallelitaet (dafuer separat: gegenprobe-teilpaket-h-rpc-
//   postgres.mjs gegen eine echte Postgres-Instanz), echtes Realtime-Fanout
//   auf ~25 Geraete, Netzlatenz/Retries, Browser-/Handy-/GPS-/Push-Verhalten.
//   Der Mock-sset spiegelt die write_dyn_if_unchanged-Semantik (bedingtes
//   UPDATE auf dyn_rev), ist aber KEIN Postgres.
//
// Aufruf: node smoke-teilpaket-g-last.mjs [pfad/zu/ShuttleLeitstelle.jsx]
// Pflicht-Gegenprobe am Ende: derselbe Lauf mit last-write-wins (ohne CAS) UND
// mit Array-Ersetzen-statt-Anhaengen MUSS Invarianten I bzw. II kippen.
// ============================================================================
import fs from "fs";

const SRC_PATH = process.argv[2] || "src/ShuttleLeitstelle.jsx";
const SRC = fs.readFileSync(SRC_PATH, "utf8");

let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push(m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} (erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)})`);

// ---------------------------------------------------------------------------
// (0) DRIFT-CHECK: die hier replizierte Logik muss noch der Quelle entsprechen.
//     Verankert an charakteristischen, unveraenderlichen Zeilen des CAS-Kerns
//     und der reinen Helfer. Aendert sich die Quelle, faellt dieser Test und
//     zwingt zur Aktualisierung (statt still zu driften).
// ---------------------------------------------------------------------------
const ankerCas = [
  "for (let attempt = 0; attempt < 6; attempt++) {",
  "const baseRev = cur.rev || 0;",
  "if (isNoChange(out)) {",
  "if (isDynConflict(out)) {",
  "next.rev = baseRev + 1;",
  "const result = await sset(key, next, baseRev);",
  "if (result.ok) {",
];
for (const a of ankerCas) ok(SRC.includes(a), `DRIFT: CAS-Anker fehlt in Quelle: ${JSON.stringify(a)}`);
const ankerHelfer = [
  'function isNoChange(v) { return v === NO_CHANGE; }',
  'function isDynConflict(v) { return !!(v && typeof v === "object" && v[DYN_CONFLICT]); }',
  'function shouldAcceptRevision(currentRev, incomingRev) {',
];
for (const a of ankerHelfer) ok(SRC.includes(a), `DRIFT: Helfer-Anker fehlt in Quelle: ${JSON.stringify(a)}`);

// ---------------------------------------------------------------------------
// (1) Reine Helfer - ZEILENGETREU aus src/ShuttleLeitstelle.jsx (Z. 63-99).
// ---------------------------------------------------------------------------
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
function shouldAcceptRevision(currentRev, incomingRev) {
  if (incomingRev == null) return false;
  if (currentRev == null) return true;
  return incomingRev >= currentRev;
}
const DYN_KEY = "obf:dyn:v5";
const emptyDyn = () => ({ rides: [], driverState: {}, rev: 0 });

// ---------------------------------------------------------------------------
// (2) runCasWrite - ZEILENGETREU aus der Quelle (Z. 1179-1245), nur Umgebung
//     (sget/sset/stats/onSuccess/onExhausted) injiziert. Kein Verhaltensfremd-
//     bau: die Schleife, der No-op-/Konflikt-Vertrag und die serverseitige
//     rev-Erhoehung sind identisch zur App.
// ---------------------------------------------------------------------------
function makeRunCasWrite({ sget, sset, stats }) {
  return async (key, getEmpty, mutator, kind, onSuccess, onExhausted) => {
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
        last = result.value;
        if (attempt < 5) await sleep(0); // Backoff-Platzhalter (deterministisch, kein Jitter im Test)
      }
      stats[S + "Failures"]++;
      stats[S + "MaxAttempts"] = Math.max(stats[S + "MaxAttempts"], attempts);
      if (last && onExhausted) onExhausted(last);
      return { ok: false, conflict: true, code: "MAX_RETRIES", value: last, error: "Mehrfacher Schreibkonflikt, bitte erneut versuchen." };
    } catch (e) {
      stats[S + "Failures"]++;
      return { ok: false, value: null, error: "Speicherfehler" };
    }
  };
}

// enqueueWrite - ZEILENGETREU aus der Quelle (Z. 1167-1171): Serialisierung
// pro Geraet. Jeder Akteur bekommt eine eigene Queue (eigenes Geraet).
function makeEnqueue() {
  const ref = { current: Promise.resolve() };
  const enqueue = (task) => {
    const run = ref.current.then(task, task);
    ref.current = run.then(() => {}, () => {});
    return run;
  };
  return enqueue;
}

function freshStats() {
  const s = {};
  for (const S of ["dyn", "setup"]) for (const k of ["Success", "Noop", "Conflicts", "Failures", "MaxAttempts"]) s[S + k] = 0;
  return s;
}

// ---------------------------------------------------------------------------
// (3) Mock-Server: write_dyn_if_unchanged-Semantik. sset akzeptiert nur, wenn
//     baseRev == server.rev; erhoeht dann serverseitig +1. Bei Konflikt kommt
//     der frische Serverstand zurueck (ok:false). unsafeSet = last-write-wins
//     OHNE CAS (nur fuer die Gegenprobe).
// ---------------------------------------------------------------------------
function makeStore(initial) {
  let server = structuredClone(initial);
  return {
    peek: () => structuredClone(server),
    sget: async () => structuredClone(server),
    sset: async (key, val, baseRev) => {
      if (baseRev === (server.rev || 0)) {
        const written = structuredClone(val);
        written.rev = (server.rev || 0) + 1;
        server = written;
        return { ok: true, value: structuredClone(server) };
      }
      return { ok: false, value: structuredClone(server) };
    },
    unsafeSet: async (key, val) => { const w = structuredClone(val); w.rev = (server.rev || 0) + 1; server = w; return { ok: true, value: structuredClone(server) }; },
  };
}

// ---------------------------------------------------------------------------
// (4) Szenario aufbauen: 40 Fahrten, jeweils einem Fahrer zugeordnet fuer die
//     Statuswege. STATUS_ORDER wie im Datenmodell (PROJEKT-ANWEISUNGEN.md).
// ---------------------------------------------------------------------------
const STATUS_ORDER = ["planned", "accepted", "enroute_pickup", "onboard", "done"];
const N_DRIVER = 20, N_DISPATCH = 2, N_STAGE = 3, N_GUEST = 6, N_RIDES = 40;
const APPEND_ALLOWED = { stage: ["issues"], guest: ["issues", "guestConfirmedAt", "guestAtPickupAt"] };

function buildRides() {
  const rides = [];
  for (let i = 0; i < N_RIDES; i++) {
    rides.push({
      id: "r" + i,
      assignedDriverId: "d" + (i % N_DRIVER), // jede Fahrt hat einen Fahrer
      status: "planned",
      note: "",
      guestConfirmedAt: null,
      guestAtPickupAt: null,
      issues: [],
      log: [],
      statusHistory: [],
    });
  }
  return rides;
}

// Ein "Op" ist eine Mutation + die Erwartung fuer die Reconciliation. role
// dient der Rollen-Schreibgrenzen-Pruefung. writes[] listet die top-level ride-
// Felder, die dieser Mutator anfasst (fuer Invariante IV).
function makeOps() {
  const ops = [];
  // Fahrer: Statuswege vorwaerts (jeder Fahrer schiebt seine Fahrten Schritt
  // fuer Schritt weiter) + statusHistory-Append + log-Append.
  for (let d = 0; d < N_DRIVER; d++) {
    const myRides = [];
    for (let i = 0; i < N_RIDES; i++) if (i % N_DRIVER === d) myRides.push("r" + i);
    for (const rid of myRides) {
      for (let s = 1; s < STATUS_ORDER.length; s++) {
        const target = STATUS_ORDER[s];
        ops.push({
          role: "driver", actor: "d" + d, rid, kind: "status", target,
          writes: ["status", "statusHistory", "log"],
          mut: (ride) => {
            ride.status = target;
            ride.statusHistory.push({ status: target, by: "driver:d" + d });
            ride.log.push({ ev: "status->" + target, by: "driver:d" + d });
          },
        });
      }
    }
  }
  // Leitstellen: Notiz-Edit (Feld) + log-Append. Zwei Dispatcher, damit sich
  // zwei "Leitstellen" auf denselben Fahrten treffen koennen.
  for (let dp = 0; dp < N_DISPATCH; dp++) {
    for (let i = 0; i < N_RIDES; i++) {
      ops.push({
        role: "dispatch", actor: "disp" + dp, rid: "r" + i, kind: "field",
        field: dp === 0 ? "note" : "assignedDriverId",
        writes: dp === 0 ? ["note", "log"] : ["assignedDriverId", "log"],
        mut: (ride) => {
          if (dp === 0) ride.note = "dispo0-final";
          else ride.assignedDriverId = "d" + (i % N_DRIVER); // Reassign (idempotent)
          ride.log.push({ ev: "dispo-edit", by: "dispo:disp" + dp });
        },
      });
    }
  }
  // Stage: NUR issues-Append (kein status, keine Zuteilung).
  for (let st = 0; st < N_STAGE; st++) {
    for (let i = 0; i < N_RIDES; i++) {
      ops.push({
        role: "stage", actor: "stage" + st, rid: "r" + i, kind: "append",
        writes: ["issues"],
        mut: (ride) => { ride.issues.push({ text: "stage-issue", by: "stage:S" + st, state: "open" }); },
      });
    }
  }
  // Gaeste: guestConfirmedAt/guestAtPickupAt-Flag + issues-Append. Kein status,
  // keine Zuteilung.
  for (let g = 0; g < N_GUEST; g++) {
    for (let i = 0; i < N_RIDES; i++) {
      if (i % N_GUEST !== g) continue;
      ops.push({
        role: "guest", actor: "guest" + g, rid: "r" + i, kind: "guest",
        writes: ["guestConfirmedAt", "guestAtPickupAt", "issues"],
        mut: (ride) => {
          ride.guestConfirmedAt = 1000 + g;
          ride.guestAtPickupAt = 2000 + g;
          ride.issues.push({ text: "guest-issue", by: "guest:G" + g, state: "open" });
        },
      });
    }
  }
  return ops;
}

// ---------------------------------------------------------------------------
// (5) Contention-Harness: DETERMINISTISCH. Ops werden in Batches gruppiert; in
//     jedem Batch lesen alle Akteure denselben baseRev (Barriere), dann wird
//     seriell committet -> der erste gewinnt, der Rest bekommt CAS-Konflikt und
//     wiederholt auf frischem Stand. So ist die Contention garantiert (nicht
//     timing-abhaengig) und die Retry-/Re-Apply-Wege werden bei JEDEM Lauf
//     durchlaufen. Jeder Akteur laeuft ueber seine eigene enqueueWrite-Queue.
// ---------------------------------------------------------------------------
async function runLoad({ store, stats, appendMode = "concat" }) {
  const runCas = makeRunCasWrite({ sget: store.sget, sset: store.sset, stats });
  const enqueueByActor = new Map();
  const enqOf = (a) => { if (!enqueueByActor.has(a)) enqueueByActor.set(a, makeEnqueue()); return enqueueByActor.get(a); };

  // Fuer die Push-Buchhaltung (Invariante V): kritisch = status-Wechsel oder
  // (Re)Zuteilung. Push GENAU dann, wenn onSuccess feuert (also nur bei ok).
  let pushCount = 0, pushCritical = 0;

  const applyOp = (op) => {
    // Gegenprobe-Schalter: bei appendMode="replace" ersetzt der Mutator das
    // Array statt anzuhaengen (bricht Atomaritaet).
    return (d) => {
      const ride = d.rides.find((x) => x.id === op.rid);
      if (!ride) return NO_CHANGE;
      if (appendMode === "replace") {
        // kaputte Variante: fuer Append-Ops nur DAS eine neue Element setzen.
        const before = JSON.stringify({ i: ride.issues, l: ride.log, h: ride.statusHistory });
        const patched = { ...ride };
        // Mutator normal laufen lassen, aber Arrays vorher leeren -> nur der
        // eigene Eintrag ueberlebt (simuliert Ganz-Array-Ueberschreiben).
        if (op.writes.includes("issues")) ride.issues = [];
        if (op.writes.includes("log")) ride.log = [];
        if (op.writes.includes("statusHistory")) ride.statusHistory = [];
        op.mut(ride);
        void before; void patched;
        return d;
      }
      op.mut(ride);
      return d;
    };
  };

  const commitOp = (op) => enqOf(op.actor)(() =>
    runCas(DYN_KEY, emptyDyn, applyOp(op), "dyn",
      (cur, applied) => {
        // onSuccess: seiteneffektfreie Nacharbeit + Push-Buchhaltung.
        pushCount++;
        if (op.kind === "status" || (op.kind === "field" && op.field === "assignedDriverId")) pushCritical++;
      },
      () => {}
    )
  );

  const ops = makeOps();
  // In Batches gruppieren: aufeinanderfolgende Ops verschiedener Akteure.
  const BATCH = 12;
  const results = [];
  for (let i = 0; i < ops.length; i += BATCH) {
    const batch = ops.slice(i, i + BATCH);
    // Alle Ops des Batches GLEICHZEITIG anstossen -> gemeinsame baseRev-Leserei,
    // deterministische CAS-Konflikte, Retry auf frischem Stand.
    const rs = await Promise.all(batch.map((op) => commitOp(op).then((r) => ({ op, r }))));
    results.push(...rs);
  }
  // Alle Queues leerlaufen lassen.
  for (const enq of enqueueByActor.values()) await enq(() => {});
  return { results, pushCount, pushCritical };
}

// ---------------------------------------------------------------------------
// (6) HAUPTLAUF mit CAS-Schutz - alle Invarianten muessen halten.
// ---------------------------------------------------------------------------
{
  const store = makeStore({ rides: buildRides(), driverState: {}, rev: 0 });
  const stats = freshStats();
  const { results, pushCount, pushCritical } = await runLoad({ store, stats });
  const final = store.peek();

  const okResults = results.filter((x) => x.r.ok && !x.r.unchanged);
  const nSuccess = okResults.length;

  // Kontext: wurde ueberhaupt echte Contention erzeugt? (sonst ist der Lasttest
  // wertlos). Deterministisch garantiert durch die Batch-Barriere.
  ok(stats.dynConflicts > 0, `LAST: echte Contention erzeugt (dynConflicts=${stats.dynConflicts} > 0)`);
  ok(stats.dynMaxAttempts >= 2, `LAST: Retry-Weg durchlaufen (maxAttempts=${stats.dynMaxAttempts} >= 2)`);

  // (III) Revision == Zahl erfolgreicher Nicht-No-op-Schreiber und monoton.
  eq(final.rev, nSuccess, `INV-III: rev == #erfolgreiche Schreiber (rev=${final.rev}, success=${nSuccess})`);
  eq(final.rev, stats.dynSuccess, "INV-III: rev == stats.dynSuccess");

  // (I) Kein verlorenes Update: jede erfolgreiche Feld-Op ist im Endstand.
  //   - Statuswege: jede Fahrt muss am Ende auf "done" stehen (alle 4 Schritte
  //     jedes Fahrers erfolgreich angewandt).
  let statusOk = true;
  for (const ride of final.rides) if (ride.status !== "done") { statusOk = false; break; }
  ok(statusOk, "INV-I: jede Fahrt erreichte Endstatus 'done' (keine Statuswege verloren)");
  //   - Dispo0-Notiz muss ueberall gesetzt sein (Feld-Op nie verloren).
  ok(final.rides.every((r) => r.note === "dispo0-final"), "INV-I: Dispo-Notiz auf allen Fahrten erhalten");
  //   - Gast-Flags gesetzt, wo ein Gast zustaendig war.
  let guestFlagsOk = true;
  for (let i = 0; i < N_RIDES; i++) { const g = i % N_GUEST; const r = final.rides.find((x) => x.id === "r" + i); if (r.guestConfirmedAt !== 1000 + g) { guestFlagsOk = false; break; } }
  ok(guestFlagsOk, "INV-I: Gast-Flags (guestConfirmedAt) korrekt gesetzt, nicht ueberschrieben");

  // (II) Atomare Appends verlieren nie. Erwartete Zahlen pro Array-Typ:
  //   issues: 3 Stage + 1 Gast (nur zustaendige Fahrten haben genau 1 Gast) pro Fahrt.
  //   log: 4 Fahrer-Status-Logs + 2 Dispo-Logs = 6 pro Fahrt.
  //   statusHistory: 4 pro Fahrt.
  let issuesTotal = 0, logTotal = 0, histTotal = 0;
  for (const r of final.rides) { issuesTotal += r.issues.length; logTotal += r.log.length; histTotal += r.statusHistory.length; }
  const expIssues = N_RIDES * N_STAGE + N_RIDES * 1;   // jede Fahrt: 3 Stage + genau 1 Gast
  const expLog = N_RIDES * (4 + N_DISPATCH);           // 4 Status + 2 Dispo
  const expHist = N_RIDES * 4;                          // 4 Status-Schritte
  eq(issuesTotal, expIssues, `INV-II: issues[] vollzaehlig (${issuesTotal}/${expIssues})`);
  eq(logTotal, expLog, `INV-II: log[] vollzaehlig (${logTotal}/${expLog})`);
  eq(histTotal, expHist, `INV-II: statusHistory[] vollzaehlig (${histTotal}/${expHist})`);

  // (IV) Rollen-Schreibgrenzen: kein status-Eintrag/Zuteilung stammt von Stage
  //   oder Gast; jede issue mit stage:/guest:-Herkunft ist erlaubt.
  //   Strukturell garantiert (die Mutatoren fassen nichts anderes an); hier
  //   zusaetzlich post-hoc: keine statusHistory-/log-Herkunft aus stage/guest,
  //   assignedDriverId nie von stage/guest.
  let scopeOk = true;
  for (const r of final.rides) {
    for (const h of r.statusHistory) if (String(h.by).startsWith("stage:") || String(h.by).startsWith("guest:")) scopeOk = false;
    for (const l of r.log) if (String(l.by).startsWith("stage:") || String(l.by).startsWith("guest:")) scopeOk = false;
  }
  ok(scopeOk, "INV-IV: Stage/Gast haben nie status/log geschrieben (Rollen-Schreibgrenze)");
  // Zusatz: die op-Definition selbst darf fuer stage/guest nur erlaubte Felder anfassen.
  let opScopeOk = true;
  for (const op of makeOps()) {
    if (op.role === "stage" || op.role === "guest") {
      const allow = APPEND_ALLOWED[op.role];
      for (const w of op.writes) if (!allow.includes(w)) opScopeOk = false;
    }
  }
  ok(opScopeOk, "INV-IV: Stage/Gast-Ops fassen strukturell nur erlaubte Felder an");

  // (V) Push-Buchhaltung: genau ein Push je erfolgreichem Schreiber, kritische
  //   Teilmenge = Status/Zuteilung. Nie mehr Pushes als erfolgreiche Schreiber.
  eq(pushCount, nSuccess, `INV-V: Push genau einmal je Erfolg (push=${pushCount}, success=${nSuccess})`);
  const expCritical = N_RIDES * 4 + N_RIDES; // 4 Status/Fahrt + 1 Reassign/Fahrt (disp1)
  eq(pushCritical, expCritical, `INV-V: kritische Pushes == Status+Zuteilung (${pushCritical}/${expCritical})`);

  // (VI) Statuswege nur vorwaerts: statusHistory jeder Fahrt ist eine Praefix-
  //   monotone Folge entlang STATUS_ORDER (keine Rueckspruenge/Sprunge).
  let orderOk = true;
  for (const r of final.rides) {
    let last = 0; // index von "planned"
    for (const h of r.statusHistory) {
      const idx = STATUS_ORDER.indexOf(h.status);
      if (idx !== last + 1) { orderOk = false; break; }
      last = idx;
    }
    if (!orderOk) break;
  }
  ok(orderOk, "INV-VI: statusHistory monoton vorwaerts entlang STATUS_ORDER");
}

// ---------------------------------------------------------------------------
// (7) PFLICHT-GEGENPROBE A: last-write-wins (unsafeSet, kein CAS). Invariante I
//     (kein verlorenes Update) MUSS kippen: dispo-Notiz und Statuswege gehen
//     unter, weil konkurrierende Schreiber sich blind ueberschreiben.
// ---------------------------------------------------------------------------
{
  const store = makeStore({ rides: buildRides(), driverState: {}, rev: 0 });
  const stats = freshStats();
  // sset durch unsafeSet ersetzen (kein rev-Check).
  const unsafeStore = { ...store, sset: store.unsafeSet };
  const runCas = makeRunCasWrite({ sget: unsafeStore.sget, sset: unsafeStore.sset, stats });
  // Minimaler Nachbau der Batch-Barriere mit unsafeSet:
  const ops = makeOps();
  const enqueueByActor = new Map();
  const enqOf = (a) => { if (!enqueueByActor.has(a)) enqueueByActor.set(a, makeEnqueue()); return enqueueByActor.get(a); };
  const applyOp = (op) => (d) => { const ride = d.rides.find((x) => x.id === op.rid); if (!ride) return NO_CHANGE; op.mut(ride); return d; };
  const BATCH = 12;
  for (let i = 0; i < ops.length; i += BATCH) {
    const batch = ops.slice(i, i + BATCH);
    await Promise.all(batch.map((op) => enqOf(op.actor)(() => runCas(DYN_KEY, emptyDyn, applyOp(op), "dyn", () => {}, () => {}))));
  }
  for (const enq of enqueueByActor.values()) await enq(() => {});
  const final = store.peek();
  // Erwartung: mind. EINE Invariante I ist verletzt (verlorene Updates).
  const alleDone = final.rides.every((r) => r.status === "done");
  const alleNotiz = final.rides.every((r) => r.note === "dispo0-final");
  let issuesTotal = 0; for (const r of final.rides) issuesTotal += r.issues.length;
  const expIssues = N_RIDES * N_STAGE + N_RIDES * 1;
  const etwasVerloren = !alleDone || !alleNotiz || issuesTotal < expIssues;
  ok(etwasVerloren, `GP-A: ohne CAS gehen Updates verloren (Gegenprobe greift: done=${alleDone}, notiz=${alleNotiz}, issues=${issuesTotal}/${expIssues})`);
}

// ---------------------------------------------------------------------------
// (8) PFLICHT-GEGENPROBE B: Array-Ersetzen statt Anhaengen (appendMode=replace)
//     BEI intaktem CAS. Invariante II (atomare Appends) MUSS kippen: die
//     Append-Arrays behalten nur je einen Eintrag pro letzter Schreiboperation.
// ---------------------------------------------------------------------------
{
  const store = makeStore({ rides: buildRides(), driverState: {}, rev: 0 });
  const stats = freshStats();
  await runLoad({ store, stats, appendMode: "replace" });
  const final = store.peek();
  let issuesTotal = 0, logTotal = 0, histTotal = 0;
  for (const r of final.rides) { issuesTotal += r.issues.length; logTotal += r.log.length; histTotal += r.statusHistory.length; }
  const expIssues = N_RIDES * N_STAGE + N_RIDES * 1;
  const expLog = N_RIDES * (4 + N_DISPATCH);
  const expHist = N_RIDES * 4;
  const appendsVerloren = issuesTotal < expIssues || logTotal < expLog || histTotal < expHist;
  ok(appendsVerloren, `GP-B: Array-Ersetzen laesst Appends verlieren (Gegenprobe greift: issues=${issuesTotal}/${expIssues}, log=${logTotal}/${expLog}, hist=${histTotal}/${expHist})`);
}

// ---- Ergebnis ------------------------------------------------------------
console.log(`\nTeilpaket G Mehrbenutzer-/Lastsimulation: ${pass} OK, ${fail} FAIL`);
if (fail) { for (const f of fails) console.log("  FAIL:", f); process.exit(1); }
