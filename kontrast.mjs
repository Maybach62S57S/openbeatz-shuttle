// WCAG-Kontrast der MC-Tokens. Nachtschicht, Handy im Auto, muede Augen:
// AA = 4.5 fuer normalen Text, 3.0 fuer grossen/fetten Text und UI-Elemente.
const hex = (h) => { h = h.replace("#",""); if (h.length===3) h=[...h].map(c=>c+c).join(""); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)); };
const rgba = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); const p = m[1].split(",").map(Number); return [p[0],p[1],p[2],p[3]??1]; };
const parse = (s) => s.startsWith("#") ? [...hex(s),1] : rgba(s);
const over = (fg, bg) => fg.slice(0,3).map((c,i) => c*fg[3] + bg[i]*(1-fg[3]));
const lum = (c) => { const [r,g,b] = c.slice(0,3).map(v => { v/=255; return v<=0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4; }); return 0.2126*r+0.7152*g+0.0722*b; };
const ratio = (a,b) => { const l1=lum(a), l2=lum(b); return ((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)); };

// Tokens LIVE aus MissionStyles lesen. Hartcodierte Werte wuerden nach der
// naechsten Aenderung eine Kontrast-Luege erzaehlen.
import fs from "fs";
const src = fs.readFileSync(process.argv[2] || "src/ShuttleLeitstelle.jsx", "utf8");
const tok = {};
for (const m of src.matchAll(/(--mc-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s*;/g)) tok[m[1].slice(5)] = m[2];
const need = (k) => { if (!tok[k]) { console.error("Token fehlt: --mc-" + k); process.exit(1); } return tok[k]; };
const BG = parse(need("bg")), PANEL = parse(need("panel")), INSET = parse(need("inset"));
const T = {};
for (const k of ["text","text-secondary","text-muted","st-new","st-assigned","st-enroute","st-done","st-problem","st-idle","brand"]) T[k] = need(k);
const flag = (r, gross=false) => { const n = gross?3.0:4.5; return r>=n ? "ok  " : r>=n*0.78 ? "KNAPP" : "ZU WENIG"; };

console.log("--- Text auf Panel (#12151b), Fliesstext, AA braucht 4.5 ---");
for (const [k,v] of Object.entries(T)) {
  const r = ratio(over(parse(v),PANEL), PANEL);
  console.log(("--mc-"+k).padEnd(20), r.toFixed(2).padStart(5), " ", flag(r));
}
console.log("\n--- Badge-Text auf seiner weichen Fuellung (ueber Panel), AA-gross 3.0 ---");
const SOFT = {}; for (const k of ["st-new","st-assigned","st-enroute","st-done","st-problem","st-idle"]) SOFT[k] = need(k + "-soft");
for (const [k,v] of Object.entries(SOFT)) {
  const bg = over(parse(v), PANEL);
  const r = ratio(parse(T[k]), bg);
  console.log(("mc-badge--"+k.replace("st-","")).padEnd(20), r.toFixed(2).padStart(5), " ", flag(r,true));
}
console.log("\n--- Sonstiges ---");
const bOn = parse(need("brand-on")), bBg = parse(need("brand"));
console.log("brand-on auf brand ".padEnd(20), ratio(bOn, bBg).toFixed(2).padStart(5), " ", flag(ratio(bOn,bBg),true), "(Speichern-Knopf)");
console.log("text-muted auf inset".padEnd(20), ratio(parse(T["text-muted"]), INSET).toFixed(2).padStart(5), " ", flag(ratio(parse(T["text-muted"]),INSET)));
console.log("text auf bg".padEnd(20), ratio(parse(T["text"]), BG).toFixed(2).padStart(5), " ", flag(ratio(parse(T["text"]),BG)));
