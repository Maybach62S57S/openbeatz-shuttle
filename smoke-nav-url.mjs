// Test der Navigations-Link-Erzeugung navUrlForRide.
// Ziel: Hotels/Flughafen (venue !== true) -> Adresse; Festival (venue true) ->
// exakte Koordinate (unveraendert); Custom/Fallbacks unveraendert.
import fs from "fs"; import { execSync } from "child_process";

const src = process.argv[2] || "src/ShuttleLeitstelle.jsx";
const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/nav-" + tag + ".jsx";
fs.writeFileSync(copy, fs.readFileSync(src, "utf8") + "\nexport { navUrlForRide };\n");
const out = "/home/claude/repo/.nav-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const m = await import(out); fs.rmSync(out, { force: true });
const { navUrlForRide } = m;

const setup = { locations: [
  { id: "airport", name: "Flughafen Nürnberg", address: "Flughafenstraße 100, 90411 Nürnberg", venue: false, lat: 49.4987, lng: 11.0669 },
  { id: "sheraton", name: "Sheraton Carlton Hotel Nürnberg", address: "Eilgutstraße 13–15, 90443 Nürnberg", venue: false, lat: 49.4450, lng: 11.0780 },
  { id: "moevenpick", name: "Mövenpick Hotel", address: "Flughafenstraße 100, 90411 Nürnberg", venue: false, lat: 49.4980, lng: 11.0620 },
  { id: "festival", name: "Open Beatz Festival", address: "Puschendorfer Straße 2, 91074 Herzogenaurach (VIP-Anfahrt über Puschendorf)", venue: true, lat: 49.52728, lng: 10.83139 },
  { id: "noaddr", name: "Ort ohne Adresse", venue: false, lat: 49.1, lng: 11.1 },
]};

let ok = 0, fail = 0;
const has = (name, url, needle) => { const g = url && url.includes(needle); console.log(`${g?"OK  ":"FAIL"} ${name}`); g?ok++:fail++; };
const eqUrl = (name, url, exp) => { const g = url === exp; console.log(`${g?"OK  ":"FAIL"} ${name}${g?"":"\n   war: "+url+"\n   soll:"+exp}`); g?ok++:fail++; };

const nav = (toId, toCustom = "") => navUrlForRide(setup, { toId, toCustom });
const enc = encodeURIComponent;

// Hotels/Flughafen -> Adresse (nicht mehr Koordinate)
has("1. Flughafen nutzt Adresse", nav("airport"), enc("Flughafenstraße 100, 90411 Nürnberg"));
{ const u = nav("airport"); const g = !u.includes("49.4987"); console.log(`${g?"OK  ":"FAIL"} 2. Flughafen enthaelt keine rohe Koordinate mehr`); g?ok++:fail++; }
has("3. Sheraton nutzt Adresse", nav("sheraton"), enc("Eilgutstraße 13–15, 90443 Nürnberg"));
has("4. Mövenpick nutzt Adresse", nav("moevenpick"), enc("Flughafenstraße 100, 90411 Nürnberg"));

// Festival (venue) -> exakte Koordinate, UNVERAENDERT
eqUrl("5. Festival nutzt exakt die Koordinate (unveraendert)", nav("festival"),
  `https://www.google.com/maps/dir/?api=1&destination=${enc("49.52728,10.83139")}&travelmode=driving`);
{ const u = nav("festival"); const g = !u.includes("Puschendorfer"); console.log(`${g?"OK  ":"FAIL"} 6. Festival nutzt NICHT die Adresse (kein Feld-Geocoding)`); g?ok++:fail++; }

// Ort ohne Adresse (venue false) -> faellt sauber auf Koordinate zurueck
has("7. Ort ohne Adresse faellt auf Koordinate", nav("noaddr"), enc("49.1,11.1"));

// Custom-Ziel ohne bekannten Ort -> toCustom-Text
has("8. Custom-Ziel nutzt toCustom-Text", nav("__custom", "Leonardo Royal Hotel Nürnberg"), enc("Leonardo Royal Hotel Nürnberg"));

// Kein Ort, kein Custom -> null (Button wird ausgeblendet)
{ const u = nav("__custom", ""); const g = u === null; console.log(`${g?"OK  ":"FAIL"} 9. Kein Ziel -> null`); g?ok++:fail++; }

// Robustheit: Festival in ALTDATEN ohne venue-Flag -> id-Anker greift, Koordinate
{ const s2 = { locations: [{ id: "festival", name: "Festival", address: "Puschendorfer Straße 2", lat: 49.52728, lng: 10.83139 }] };
  const u = navUrlForRide(s2, { toId: "festival", toCustom: "" });
  const g = u.includes(enc("49.52728,10.83139")) && !u.includes("Puschendorfer");
  console.log(`${g?"OK  ":"FAIL"} 10. Festival ohne venue-Flag nutzt trotzdem Koordinate`); g?ok++:fail++; }

console.log(`\nnavUrlForRide Test: ${ok} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
