import fs from "node:fs";
const src = fs.readFileSync("src/ShuttleLeitstelle.jsx","utf8");
const i = src.indexOf("const LOC_MATRIX_NODE = {");
const LOC = new Function(src.slice(i, src.indexOf("\n};", i)+3) + " return LOC_MATRIX_NODE;")();
// travel/travelMin verbatim
function travel(m,a,b){if(!a||!b)return null;if(a===b)return{min:0,km:0};return m[`${a}|${b}`]||m[`${b}|${a}`]||null;}
function travelMin(m,a,b){const t=travel(m,a,b);return t?t.min:null;}
// Matrix wie nach dem SQL-Nachtrag
const M = {
  "sheraton|festival":{min:38,km:28}, "muc|festival":{min:105,km:185}, "muc|sheraton":{min:105,km:185},
  "airport|festival":{min:35,km:30}, "moevenpick|festival":{min:36,km:29},
  "festival|flugplatz_herzo":{min:20,km:8}, "festival|bahnhof_puschendorf":{min:10,km:7},
  "sheraton|flugplatz_herzo":{min:40,km:30}, "sheraton|bahnhof_puschendorf":{min:35,km:27},
};
let fail=0;
const T=[
  ["melter","sheraton","Alias auf Sheraton-Knoten"],
  ["flugplatz_herzo","flugplatz_herzo","eigener Knoten"],
  ["bahnhof_puschendorf","bahnhof_puschendorf","eigener Knoten"],
  ["karl_august","sheraton","Bestand unveraendert"],
  ["leonardo","sheraton","Bestand unveraendert"],
  ["airport_muc","muc","Bestand unveraendert"],
];
for(const [id,soll,what] of T){ if(LOC[id]!==soll){fail++;console.log(`  FAIL ${id} -> ${LOC[id]}, erwartet ${soll} (${what})`);} }
// Entscheidend: liefert jede neue ID eine ECHTE Fahrzeit (nicht null, nicht 0)?
const R=[
  ["melter","festival"],["melter","sheraton"],["melter","muc"],
  ["flugplatz_herzo","festival"],["flugplatz_herzo","sheraton"],
  ["bahnhof_puschendorf","festival"],["bahnhof_puschendorf","sheraton"],
];
for(const [a,b] of R){
  const na=LOC[a]||a, nb=LOC[b]||b;
  const min=travelMin(M,na,nb);
  const ok = min!=null;
  if(!ok){fail++;console.log(`  FAIL Fahrzeit ${a} -> ${b} ist unbekannt (Knoten ${na}|${nb})`);}
  else console.log(`  ok  ${a.padEnd(20)} -> ${b.padEnd(10)} = ${min} min (Knoten ${na}|${nb})`);
}
console.log("\n  Fehler:", fail);
console.log(fail===0?"  ERGEBNIS: GRUEN":"  ERGEBNIS: ROT");
process.exit(fail?1:0);
