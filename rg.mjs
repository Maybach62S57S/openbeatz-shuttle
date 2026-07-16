import fs from "fs";
import { parse } from "@babel/parser";

const file = process.argv[2] || "/home/claude/repo/src/ShuttleLeitstelle.jsx";
const src = fs.readFileSync(file, "utf8");
const ast = parse(src, { sourceType: "module", plugins: ["jsx"] });

// Top-Level-Funktionen + ihre Textbereiche
const tops = [];
for (const n of ast.program.body) {
  if (n.type === "FunctionDeclaration" && n.id) tops.push({ name: n.id.name, start: n.start, end: n.end });
  if (n.type === "VariableDeclaration") {
    for (const d of n.declarations) {
      if (d.id?.type === "Identifier" && d.init)
        tops.push({ name: d.id.name, start: d.start, end: d.end, konst: !/Function|ArrowFunction/.test(d.init.type) });
    }
  }
  if (n.type === "ExportDefaultDeclaration" && n.declaration?.type === "FunctionDeclaration" && n.declaration.id)
    tops.push({ name: n.declaration.id.name, start: n.start, end: n.end });
}
tops.sort((a, b) => a.start - b.start);
const owner = (pos) => { let o = null; for (const t of tops) if (pos >= t.start && pos < t.end && !t.konst) o = t; return o?.name || null; };

// Alle JSX-Elemente + Identifier-Referenzen einsammeln
const edges = new Map();   // parent -> Set(child)
const add = (p, c) => { if (!p || !c) return; if (!edges.has(p)) edges.set(p, new Set()); edges.get(p).add(c); };
const topNames = new Set(tops.map((t) => t.name));

const walk = (node) => {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach(walk); return; }
  if (node.type === "JSXOpeningElement") {
    let nm = node.name;
    while (nm && nm.type === "JSXMemberExpression") nm = nm.object;
    if (nm?.type === "JSXIdentifier" && /^[A-Z]/.test(nm.name)) add(owner(node.start), nm.name);
  }
  // Identifier-Referenz (z.B. className={inp}) -> Abhaengigkeit auf Konstante
  if (node.type === "Identifier" && topNames.has(node.name)) add(owner(node.start), node.name);
  for (const k of Object.keys(node)) { if (k === "loc" || k === "start" || k === "end") continue; walk(node[k]); }
};
walk(ast.program.body);

const reach = (root) => {
  const seen = new Set(); const q = [root];
  while (q.length) { const c = q.pop(); for (const k of (edges.get(c) || [])) if (!seen.has(k)) { seen.add(k); q.push(k); } }
  return seen;
};

const roles = ["DriverApp", "StageApp", "GuestApp"];
const tabu = new Set();
for (const r of roles) for (const x of reach(r)) tabu.add(x);
const mc = reach("MissionControl");

const targets = ["RideForm", "AssignModal", "WhatsAppModal", "Modal", "Field", "inp", "LocSelect", "RideHistory", "SettingsTab",
                 "IssueModal", "StageIssueModal", "GuestIssueModal", "MissionStyles",
                 // Session 27b: SettingsTab und seine sieben Unterbausteine
                 "DriverPhones", "DispatcherUsers", "AccessPinsSection", "GuestLinksSection",
                 "PushSettingsSection", "AuditLogSection", "ReportSection"];
console.log("Komponente".padEnd(20), "| von MissionControl | von Fahrer/Stage/Gast");
console.log("-".repeat(66));
for (const t of targets)
  console.log(t.padEnd(20), "|", (mc.has(t) ? "ja " : "nein").padEnd(18), "|", tabu.has(t) ? "JA -> TABU" : "nein");

// Pro Ziel: was haengt transitiv darunter und ist gleichzeitig TABU?
// (Das ist die Liste, die man beim Umbauen NICHT anfassen darf.)
const nur = process.argv[3] ? process.argv.slice(3) : null;
if (nur) {
  console.log("\nTabu-Kinder je Ziel (transitiv, inkl. Konstanten):");
  console.log("-".repeat(66));
  for (const t of nur) {
    const kinder = reach(t);
    const treffer = [...kinder].filter((k) => tabu.has(k)).sort();
    console.log(t.padEnd(20), "->", treffer.length ? treffer.join(", ") : "(keine)");
  }
}

console.log("\n--- Kinder von RideForm ---");
console.log([...(edges.get("RideForm") || [])].sort().join(", "));
console.log("\n--- Kinder von AssignModal ---");
console.log([...(edges.get("AssignModal") || [])].sort().join(", "));
console.log("\n--- Kinder von WhatsAppModal ---");
console.log([...(edges.get("WhatsAppModal") || [])].sort().join(", "));
console.log("\n--- Welche Rollen-Apps erreichen Field/inp? Pfad-Check ---");
for (const r of roles) {
  const s = reach(r);
  console.log(r + ":", ["Field", "inp", "LocSelect", "Modal", "RideHistory"].filter((x) => s.has(x)).join(", ") || "(keine)");
}
