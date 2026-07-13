// Slice 8 – rideListEmpty: passender leerer-Zustand-Text + Reset-Zuordnung.
let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.log("FAIL:", name); } };
const eq = (name, a, b) => ok(name + ` (got ${JSON.stringify(a)})`, JSON.stringify(a) === JSON.stringify(b));

// ---- verbatim aus dem Code -------------------------------------------------
function rideListEmpty({ total, query, filterLabel }) {
  const q = (query || "").trim();
  if (!total) return { text: "Noch keine Fahrten an diesem Tag.", reset: null };
  if (q) return { text: `Nichts gefunden für „${q}“.`, reset: "search" };
  if (filterLabel) return { text: `Keine Fahrten im Filter „${filterLabel}“.`, reset: "filter" };
  return { text: "Keine Fahrten in dieser Ansicht.", reset: null };
}

// 1) Gar keine Fahrten am Tag -> kein Reset (Daten fehlen), egal was sonst gesetzt ist
eq("total 0, nichts sonst", rideListEmpty({ total: 0, query: "", filterLabel: null }),
  { text: "Noch keine Fahrten an diesem Tag.", reset: null });
eq("total 0 schlaegt Suche", rideListEmpty({ total: 0, query: "Solomun", filterLabel: "Offen" }),
  { text: "Noch keine Fahrten an diesem Tag.", reset: null });
eq("total undefined -> wie 0", rideListEmpty({ total: undefined, query: "x" }),
  { text: "Noch keine Fahrten an diesem Tag.", reset: null });

// 2) Suche aktiv, kein Treffer -> reset "search", Query im Text
eq("Suche ohne Treffer", rideListEmpty({ total: 12, query: "Solomun", filterLabel: null }),
  { text: "Nichts gefunden für „Solomun“.", reset: "search" });

// 3) Filter blendet alles aus (keine Suche) -> reset "filter", Label im Text
eq("Filter leer", rideListEmpty({ total: 12, query: "", filterLabel: "Aktiv" }),
  { text: "Keine Fahrten im Filter „Aktiv“.", reset: "filter" });

// 4) Weder Suche noch Nicht-Standard-Filter (praktisch unerreichbar) -> Fallback, kein Reset
eq("Fallback", rideListEmpty({ total: 12, query: "", filterLabel: null }),
  { text: "Keine Fahrten in dieser Ansicht.", reset: null });

// 5) Vorrang: Suche schlaegt Filter (kleinerer Reset-Schritt zuerst)
eq("Suche vor Filter", rideListEmpty({ total: 12, query: "abc", filterLabel: "Erledigt" }),
  { text: "Nichts gefunden für „abc“.", reset: "search" });

// 6) Nur-Whitespace-Query zaehlt als leer -> faellt auf Filter/Fallback
eq("Whitespace-Query = leer -> Filter", rideListEmpty({ total: 12, query: "   ", filterLabel: "Offen" }),
  { text: "Keine Fahrten im Filter „Offen“.", reset: "filter" });
eq("Whitespace-Query = leer -> Fallback", rideListEmpty({ total: 12, query: "  ", filterLabel: null }),
  { text: "Keine Fahrten in dieser Ansicht.", reset: null });

// 7) Query wird getrimmt im Anzeigetext
eq("Query getrimmt", rideListEmpty({ total: 5, query: "  Tale Of Us  ", filterLabel: null }),
  { text: "Nichts gefunden für „Tale Of Us“.", reset: "search" });

console.log(`\n${pass}/${pass + fail} bestanden` + (fail ? ` (${fail} FEHLGESCHLAGEN)` : ""));
process.exit(fail ? 1 : 0);
