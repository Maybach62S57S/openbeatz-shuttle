// Slice 7 – Ein-Tap-Zuteilen: Test der sicherheitskritischen Logik.
// (a) assignOneTap traegt exakt den wouldResetLiveStatus-Guard -> pruefen, dass er
//     im realen Ein-Tap-Fall (unzugeteilt = "planned") NICHT feuert, aber defensiv
//     bei einer schon laufenden Fahrt schon.
// (b) Chip-Auswahl = Filter+Sort+slice(0,2) aus suggestDrivers -> pruefen, dass ein
//     Chip NIE einen harten Konflikt (overlap/zu klein/offenes Problem) anbietet und
//     die zwei besten (feasible-first, dann Score) zuerst kommen.

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; } else { fail++; console.log("FAIL:", name); } };

// ---- (a) Guard verbatim aus dem Code ------------------------------------
function wouldResetLiveStatus(status, currentDriverId, targetDriverId) {
  if (!status || status === "planned" || status === "cancelled") return false;
  return (targetDriverId || null) !== (currentDriverId || null);
}
// Der Ein-Tap-Wrapper fragt genau dann, wenn wouldResetLiveStatus true ist.
const wouldConfirm = (r, driverId) => wouldResetLiveStatus(r.status, r.assignedDriverId, driverId);

// Realer Fall: Chips erscheinen NUR auf unzugeteilten Karten -> Status "planned",
// kein zugeteilter Fahrer. Ein Tap teilt einen Fahrer zu -> kein Confirm.
ok("unzugeteilt+geplant -> kein Confirm",
  wouldConfirm({ status: "planned", assignedDriverId: null }, "d1") === false);
ok("unzugeteilt+undefined-Status -> kein Confirm",
  wouldConfirm({ status: undefined, assignedDriverId: null }, "d1") === false);
ok("unzugeteilt aber laufend (nur theoretisch) + Fahrer setzen -> Confirm",
  wouldConfirm({ status: "onboard", assignedDriverId: null }, "d1") === true);
ok("laufend + Fahrerwechsel -> Confirm",
  wouldConfirm({ status: "enroute_pickup", assignedDriverId: "d1" }, "d2") === true);
ok("laufend + gleicher Fahrer (No-Op) -> kein Confirm",
  wouldConfirm({ status: "onboard", assignedDriverId: "d1" }, "d1") === false);
ok("storniert -> nie Confirm",
  wouldConfirm({ status: "cancelled", assignedDriverId: "d1" }, "d2") === false);

// ---- (b) Chip-Auswahl: Filter+Sort+slice(0,2) verbatim aus suggestDrivers -----
// (nur der reine Tail, der ueber schon bewertete eval-Objekte laeuft)
const pickChips = (scored) => scored
  .filter((x) => x.eligible && !x.overlap && !x.hasIssue)
  .sort((a, b) => (a.feasible !== b.feasible ? (a.feasible ? -1 : 1) : a.score - b.score))
  .slice(0, 2);

const D = (id, extra) => ({ driver: { id }, eligible: true, overlap: false, hasIssue: false, feasible: true, score: 10, ...extra });

// Mix aus guten, knappen und hart-konfligierenden Fahrern
const scored = [
  D("gutA", { feasible: true, score: 5 }),
  D("konflikt", { overlap: true, score: 1 }),       // harter Konflikt -> raus
  D("zuKlein", { eligible: false, score: 0 }),        // zu klein -> raus
  D("problem", { hasIssue: true, score: 0 }),         // offenes Problem -> raus
  D("knappB", { feasible: false, score: 2 }),         // knapp, aber eligible+kein overlap
  D("gutB", { feasible: true, score: 8 }),
];
const chips = pickChips(scored);

ok("nie mehr als 2 Chips", chips.length === 2);
ok("Chip bietet NIE overlap an", chips.every((x) => !x.overlap));
ok("Chip bietet NIE ineligible an", chips.every((x) => x.eligible));
ok("Chip bietet NIE Fahrer-mit-Problem an", chips.every((x) => !x.hasIssue));
ok("beste zwei feasible zuerst (gutA vor gutB nach Score)",
  chips[0].driver.id === "gutA" && chips[1].driver.id === "gutB");

// Wenn nur ein feasible + ein knapper eligible uebrig sind: feasible zuerst, knapp danach
const chips2 = pickChips([D("knapp", { feasible: false, score: 1 }), D("gut", { feasible: true, score: 9 })]);
ok("feasible schlaegt knapp trotz schlechterem Score", chips2[0].driver.id === "gut" && chips2[1].driver.id === "knapp");

// Nur knappe eligible Fahrer -> Chips zeigen die zwei besten knappen (Modal-konsistent)
const chips3 = pickChips([D("knappHi", { feasible: false, score: 30 }), D("knappLo", { feasible: false, score: 3 }), D("knappMid", { feasible: false, score: 12 })]);
ok("nur knappe: nach Score sortiert (Lo, Mid)", chips3[0].driver.id === "knappLo" && chips3[1].driver.id === "knappMid");

// Gar kein tauglicher Fahrer -> keine Chips (RideCard faellt dann auf den Voll-Modal-Knopf)
const chips4 = pickChips([D("x", { overlap: true }), D("y", { eligible: false }), D("z", { hasIssue: true })]);
ok("kein tauglicher Fahrer -> 0 Chips (Fallback auf 'Fahrer zuteilen')", chips4.length === 0);

console.log(`\n${pass}/${pass + fail} bestanden` + (fail ? ` (${fail} FEHLGESCHLAGEN)` : ""));
process.exit(fail ? 1 : 0);
