import fs from "node:fs";
const profSrc = fs.readFileSync("/tmp/prof.js","utf8");
const DRIVER_PROFILES = new Function(profSrc + " return DRIVER_PROFILES;")();
// normDriverName verbatim aus der Quelle
function normDriverName(d){const full=`${(d&&d.firstName)||""} ${(d&&d.lastName)||""}`;
 return full.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
const prof = (d) => DRIVER_PROFILES[normDriverName(d)] || null;

// SOLL aus der Fahrerliste OB26 (PDF, 23.07.2026)
const SOLL = [
 ["Leon","Merg","springer","2026-07-23 14:00",null],
 ["Philipp","Stich","springer","2026-07-23 15:00",null],
 ["Jassin","Salah","regular","2026-07-23 22:00",null],
 ["Daniel","Sakic","regular","2026-07-24 14:00",null],
 ["Tim","Kostka","regular","2026-07-23 14:00",null],
 ["Marian","Mihalca","regular","2026-07-23 14:00",null],
 ["Philipp","Baumeister","regular","2026-07-25 16:00",null],
 ["Toni","Penno","regular","2026-07-24 10:00",null],
 ["Marco","Haney","regular","2026-07-23 15:00",null],
 ["Simon","Schug","regular","2026-07-23 14:00",null],
 ["Bennet","Füger","regular","2026-07-24 14:00",null],
 ["Stefan","Baumann","regular","2026-07-23 21:00",null],
 ["Karim","Salah","regular","2026-07-23 22:00",null],
 ["David","Schneider","regular","2026-07-23 16:00",null],
 ["Finn","Steinmetz","regular","2026-07-23 14:00",null],
 ["Lukas","Bieber","regular","2026-07-24 15:00",null],
 ["Dominik","Dittes","regular","2026-07-23 14:00",null],
 ["Björn","Korn","regular","2026-07-23 16:00",null],
 ["Amar","Piljevic","regular","2026-07-23 16:00","timmy-team"],
 ["Patrick","Ibrahimi","regular","2026-07-23 14:00","timmy-team"],
 ["Mustafa","Ünver","regular","2026-07-23 23:00","timmy-team"],
 ["Raphael","Swiety","regular","2026-07-23 16:00",null],
 ["Maximilian","Schneider","regular","2026-07-23 21:00",null],
];
let fail=0;
for (const [fn,ln,cat,af,team] of SOLL){
  const p = prof({firstName:fn,lastName:ln});
  if(!p){fail++;console.log(`  FAIL kein Profil: ${fn} ${ln} (norm: "${normDriverName({firstName:fn,lastName:ln})}")`);continue;}
  if(p.driverCategory!==cat){fail++;console.log(`  FAIL ${fn} ${ln}: Kategorie ${p.driverCategory}, erwartet ${cat}`);}
  if(p.availableFrom!==af){fail++;console.log(`  FAIL ${fn} ${ln}: availableFrom ${p.availableFrom}, erwartet ${af}`);}
  if((p.teamGroup||null)!==team){fail++;console.log(`  FAIL ${fn} ${ln}: teamGroup ${p.teamGroup}, erwartet ${team}`);}
}
// Sandro Benz darf NICHT mehr drin sein
if (prof({firstName:"Sandro",lastName:"Benz"})) { fail++; console.log("  FAIL: Sandro Benz steht noch in DRIVER_PROFILES"); }
// Lukas Bieber darf NICHT mehr im Timmy-Team sein
if ((prof({firstName:"Lukas",lastName:"Bieber"})||{}).teamGroup) { fail++; console.log("  FAIL: Lukas Bieber noch im Team"); }
const teams = Object.entries(DRIVER_PROFILES).filter(([,v])=>v.teamGroup==="timmy-team").map(([k])=>k);
console.log("  Profile gesamt:", Object.keys(DRIVER_PROFILES).length, "| geprueft:", SOLL.length);
console.log("  Timmy-Team:", teams.join(", "));
if (teams.length!==3){fail++;console.log("  FAIL: Timmy-Team hat nicht 3 Mitglieder");}
console.log("  Fehler:", fail);
console.log(fail===0 ? "\n  ERGEBNIS: GRUEN" : "\n  ERGEBNIS: ROT");
process.exit(fail===0?0:1);
