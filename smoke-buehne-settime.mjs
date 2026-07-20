// Smoke: echte Buehne + Set-Zeit in Fahrer-App und Leitstellen-Fahrtenliste.
// Testet die ECHTE Funktion ttStageSet (angehaengter Export + esbuild + Import,
// byte-identisch am Quelltext) gegen die realen TIMETABLE_RAW-Daten, plus
// Struktur-Anker fuer die drei Render-Einbaustellen, plus Pflicht-Gegenprobe.
//
// Lauf: node smoke-buehne-settime.mjs src/ShuttleLeitstelle.jsx
import fs from "fs";
import { execSync } from "child_process";

const srcFile = process.argv[2] || "src/ShuttleLeitstelle.jsx";
const src = fs.readFileSync(srcFile, "utf8");
const tag = Math.random().toString(36).slice(2);
const copy = "/tmp/bs-src-" + tag + ".jsx";
fs.writeFileSync(copy, src + "\nexport { ttStageSet, TIMETABLE_RAW, normalizeTimetableEntries, buildTimetableMatchIndex, festDayKey };\n");
const out = "/home/claude/repo/.bs-" + tag + ".mjs";
execSync(`./node_modules/.bin/esbuild ${copy} --bundle=false --format=esm --jsx=automatic --outfile=${out}`);
const mod = await import(out);
const { ttStageSet, TIMETABLE_RAW, normalizeTimetableEntries, buildTimetableMatchIndex, festDayKey } = mod;

const ttEntries = normalizeTimetableEntries(TIMETABLE_RAW);
const ttIndex = buildTimetableMatchIndex(ttEntries);

let ok = 0, fail = 0;
const eq = (name, got, exp) => {
  const g = JSON.stringify(got), e = JSON.stringify(exp);
  if (g === e) { ok++; } else { fail++; console.log(`FAIL ${name}\n  got ${g}\n  exp ${e}`); };
};
const truthy = (name, v) => { if (v) ok++; else { fail++; console.log(`FAIL ${name} (erwartet wahrheitswert)`); } };
const falsy = (name, v) => { if (!v) ok++; else { fail++; console.log(`FAIL ${name} (erwartet null/leer, got ${JSON.stringify(v)})`); } };

// Hilfsbau: eine Fahrt mit Datum/Zeit/Artist. dayKey wie im echten Import.
const ride = (date, time, djName) => ({ date, time, djName, dayKey: festDayKey(date, time) });

// --- 1) Magical-Forest-Act: echte Buehne + Set-Zeit, NICHT "Caldera" ---------
// Dennis Reif spielt Fr 24.07 auf Magical Forest 17:00-18:00 (Z. ~5040).
{
  const r = ride("2026-07-24", "15:30", "Dennis Reif");
  const s = ttStageSet(r, ttEntries, ttIndex);
  truthy("Dennis Reif -> Treffer", s);
  eq("Dennis Reif Buehne", s && s.stage, "Magical Forest");
  eq("Dennis Reif Set-Start", s && s.start, "17:00");
  eq("Dennis Reif Set-Ende", s && s.end, "18:00");
}

// --- 2) Darkwoods-Act ---------------------------------------------------------
// Die Gebrueder Brett, Fr 24.07 Darkwoods 23:00-00:00 (Z. ~5064).
{
  const r = ride("2026-07-24", "21:30", "Die Gebrüder Brett");
  const s = ttStageSet(r, ttEntries, ttIndex);
  truthy("Gebrueder Brett -> Treffer", s);
  eq("Gebrueder Brett Buehne", s && s.stage, "Darkwoods");
}

// --- 3) Caldera-Act: zeigt korrekt "CALDERA" (kein Fehlverhalten) -------------
// Alle Farben, Fr 24.07 CALDERA 19:45-20:45 (Z. ~5014).
{
  const r = ride("2026-07-24", "18:15", "Alle Farben");
  const s = ttStageSet(r, ttEntries, ttIndex);
  truthy("Alle Farben -> Treffer", s);
  eq("Alle Farben Buehne", s && s.stage, "CALDERA");
}

// --- 4) Kein Timetable-Treffer -> null (Fahrer sieht dann nichts) ------------
{
  const r = ride("2026-07-24", "15:00", "Voellig Unbekannter Act XYZ");
  falsy("Unbekannt -> null", ttStageSet(r, ttEntries, ttIndex));
}

// --- 5) Leerer Artist -> null ------------------------------------------------
{
  const r = ride("2026-07-24", "15:00", "");
  falsy("Leerer Artist -> null", ttStageSet(r, ttEntries, ttIndex));
}

// --- 6) Set-Zeit-Format: "HH:MM", nicht ISO ----------------------------------
{
  const r = ride("2026-07-24", "15:30", "Dennis Reif");
  const s = ttStageSet(r, ttEntries, ttIndex);
  truthy("Set-Start Format HH:MM", s && /^\d{2}:\d{2}$/.test(s.start));
}

// --- Struktur-Anker: die drei Render-Einbaustellen sind verdrahtet -----------
// (a) Fahrer: StageSet-Komponente definiert + an beiden Karten gerendert.
truthy("Anker: StageSet definiert", /const StageSet = \(\{ ride \}\) =>/.test(src));
{
  const nach = src.split("{nextRide.zone && <ZoneChip zone={nextRide.zone} />}")[1] || "";
  truthy("Anker: StageSet in Naechste-Fahrt-Karte", /^\s*<\/div>\s*<StageSet ride=\{nextRide\} \/>/.test(nach.slice(0, 80)));
}
{
  const nach = src.split('{r.zone && <ZoneChip zone={r.zone} className="ml-1" />}')[1] || "";
  truthy("Anker: StageSet in Fahrer-Liste", /<StageSet ride=\{r\} \/>/.test(nach.slice(0, 120)));
}
// (b) Leitstelle: Fahrtenliste berechnet ttSet und rendert Badge.
truthy("Anker: ttSet in Fahrtenliste berechnet", /const ttSet = ttStageSet\(r, ttEntries, ttIndex\);/.test(src));
truthy("Anker: ttSet-Badge gerendert", /\{ttSet && \(/.test(src));

// --- Gegenprobe: neutralisierte Variante muss die Positiv-Faelle kippen -------
// Beweist, dass die obigen Zusicherungen wirklich etwas messen.
{
  const broken = src
    .replace(
      /function ttStageSet\(ride, timetableEntries, index\) \{[\s\S]*?\n\}/,
      "function ttStageSet(ride, timetableEntries, index) { return null; }"
    );
  const bcopy = "/tmp/bs-broken-" + tag + ".jsx";
  fs.writeFileSync(bcopy, broken + "\nexport { ttStageSet, TIMETABLE_RAW, normalizeTimetableEntries, buildTimetableMatchIndex, festDayKey };\n");
  const bout = "/home/claude/repo/.bs-broken-" + tag + ".mjs";
  execSync(`./node_modules/.bin/esbuild ${bcopy} --bundle=false --format=esm --jsx=automatic --outfile=${bout}`);
  const bmod = await import(bout);
  const bs = bmod.ttStageSet(ride("2026-07-24", "15:30", "Dennis Reif"), ttEntries, ttIndex);
  falsy("Gegenprobe: kaputte Funktion liefert null", bs);
  fs.unlinkSync(bcopy); fs.unlinkSync(bout);
}

fs.unlinkSync(copy); fs.unlinkSync(out);
console.log(`\nsmoke-buehne-settime: ${ok} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
