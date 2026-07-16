// (1) Pruefsummen: welche Top-Level-Bausteine haben sich geaendert?
// (2) var(--mc-*)-Check: jede benutzte Variable muss in MissionStyles definiert sein.
import fs from "fs";
import crypto from "crypto";
import { parse } from "@babel/parser";

const tops = (src) => {
  const ast = parse(src, { sourceType: "module", plugins: ["jsx"] });
  const m = new Map();
  const put = (name, node) => m.set(name, crypto.createHash("sha1").update(src.slice(node.start, node.end)).digest("hex").slice(0, 12));
  for (const n of ast.program.body) {
    if (n.type === "FunctionDeclaration" && n.id) put(n.id.name, n);
    else if (n.type === "VariableDeclaration") for (const d of n.declarations) { if (d.id?.type === "Identifier") put(d.id.name, d); }
    else if (n.type === "ExportDefaultDeclaration" && n.declaration?.id) put(n.declaration.id.name, n);
  }
  return m;
};

const a = tops(fs.readFileSync(process.argv[2], "utf8"));
const b = tops(fs.readFileSync(process.argv[3], "utf8"));

const geaendert = [], neu = [], weg = [];
for (const [k, v] of b) { if (!a.has(k)) neu.push(k); else if (a.get(k) !== v) geaendert.push(k); }
for (const k of a.keys()) if (!b.has(k)) weg.push(k);

console.log("Bausteine vorher:", a.size, "| nachher:", b.size);
console.log("GEAENDERT (" + geaendert.length + "):", geaendert.join(", ") || "(keine)");
console.log("NEU (" + neu.length + "):", neu.join(", ") || "(keine)");
console.log("ENTFERNT (" + weg.length + "):", weg.join(", ") || "(keine)");
const identisch = [...b.keys()].filter((k) => a.has(k) && a.get(k) === b.get(k));
console.log("BYTE-IDENTISCH:", identisch.length, "von", a.size);
for (const k of ["DriverApp", "StageApp", "GuestApp", "IssueModal", "StageIssueModal", "GuestIssueModal", "MissionStyles", "Field", "inp", "SettingsTab", "LocSelect"])
  console.log("  " + k.padEnd(18), a.get(k) === b.get(k) ? "unveraendert" : ">>> GEAENDERT <<<");

// --- var(--mc-*)-Check ---
const src = fs.readFileSync(process.argv[3], "utf8");
const ms = src.slice(src.indexOf("function MissionStyles"), src.indexOf("// --- Basiskomponenten"));
const definiert = new Set([...ms.matchAll(/(--mc-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const benutzt = new Set([...src.matchAll(/var\((--mc-[a-z0-9-]+)\)/g)].map((m) => m[1]));
// dynamisch gebaute: var(--mc-st-${key}) -> alle MC_STATUS-Keys
const dyn = [...src.matchAll(/var\(--mc-st-\$\{[^}]+\}([a-z-]*)\)/g)].map((m) => m[1]);
console.log("\n--- var(--mc-*)-Check ---");
console.log("definiert:", definiert.size, "| benutzt (statisch):", benutzt.size);
const fehlend = [...benutzt].filter((v) => !definiert.has(v));
console.log("UNDEFINIERT BENUTZT:", fehlend.length ? ">>> " + fehlend.join(", ") : "keine");
for (const suf of dyn) {
  const keys = ["new", "assigned", "enroute", "done", "problem", "idle"];
  const bad = keys.filter((k) => !definiert.has(`--mc-st-${k}${suf}`));
  console.log(`dynamisch var(--mc-st-\${key}${suf}):`, bad.length ? ">>> fehlt: " + bad.join(",") : "alle 6 definiert");
}
