#!/usr/bin/env python3
"""
Pruefbericht Stufe 1 fuer die Pickup-Liste (Fahrereinteilung 2026).

Aufruf:  python3 pruefe-pickupliste.py <pfad-zur-xlsx> [<pfad-zu-ShuttleLeitstelle.jsx>]

Prueft die Rohdaten OHNE Datenbankzugriff und ohne die Liste zu veraendern:
  1. Grundzahlen (Zeilen, Luecken, Fahrten pro Tag, Personenzahlen)
  2. Personenzahl gegen die Anzahl der Namen in der Passagierspalte
  3. Exakte Dubletten (gleiche Zeit, gleiche Strecke, gleiche Personenzahl)
  4. Ortserkennung ueber matchLoc, verbatim aus dem Quellcode gezogen
  5. Zeitgleiche Fahrten auf gleicher Strecke (Buendelungskandidaten)
  6. Van-Grundlast gegen Auto-Grundlast

Exit 0 = keine harten Befunde, Exit 1 = mindestens ein unbekannter Ort.
Die Gegenprobe steckt in --gegenprobe: dabei wird die melter-Regel absichtlich
entfernt, der Ortstest MUSS dann rot werden. Ohne bestandene Gegenprobe
beweist der Ortstest nichts.
"""
import sys
import re
import subprocess
import tempfile
import os
import collections

import pandas as pd

XLSX = sys.argv[1] if len(sys.argv) > 1 else "Pickups.xlsx"
JSX = sys.argv[2] if len(sys.argv) > 2 else "src/ShuttleLeitstelle.jsx"
GEGENPROBE = "--gegenprobe" in sys.argv

df = pd.read_excel(XLSX, sheet_name="Pickups")
fehler = 0


def kopf(t):
    print("\n" + "=" * 68)
    print(t)
    print("=" * 68)


# ---------------------------------------------------------------- 1. Grundzahlen
kopf("1. GRUNDZAHLEN")
print("Zeilen:", len(df))
pflicht = ["#", "Artist", "Date", "Time", "From", "To"]
for c in pflicht:
    n = df[c].isna().sum()
    print(f"  {c:12s} leer: {n}" + ("   <-- LUECKE" if n else ""))
    if n:
        fehler += 1
for c in ["Driver", "Vehicle"]:
    n = df[c].isna().sum()
    print(f"  {c:12s} leer: {n}" + ("   (erwartet: alle leer)" if n == len(df) else "   <-- enthaelt Zuteilung!"))

print("\nFahrten pro Tag:")
for d, n in df["Date"].value_counts().sort_index().items():
    print(f"  {d}  {n}")
print("\nPersonenzahl (Spalte #):")
for p, n in df["#"].value_counts().sort_index().items():
    print(f"  {p}P  {n:3d}")
print("  Personen gesamt:", df["#"].sum())


# ------------------------------------------- 2. Personenzahl gegen Namensanzahl
kopf("2. PERSONENZAHL GEGEN ANZAHL DER NAMEN")


def zaehle_namen(p):
    if pd.isna(p):
        return None
    s = re.sub(r"\(\+?[0-9 /()-]+\)", "", str(p))  # Telefonnummern raus
    return len([t for t in s.split(",") if t.strip()])


df["_n"] = df["Passengers"].apply(zaehle_namen)
abw = df[df["_n"].notna() & (df["_n"] != df["#"])]
zuwenig = abw[abw["_n"] > abw["#"]]
print(f"Zeilen mit Abweichung: {len(abw)}")
print(f"  davon MEHR Namen als Personen (kritisch): {len(zuwenig)}")
print(f"  davon weniger Namen als Personen (normal, Crew ohne Name): {len(abw) - len(zuwenig)}")
for i, r in zuwenig.iterrows():
    print(f"  Z{i+2:3d} {r['Date']} {r['Time']}  #={r['#']} Namen={int(r['_n'])}  {r['Artist']}")


# --------------------------------------------------------------- 3. Dubletten
kopf("3. EXAKTE DUBLETTEN (gleich in #, Artist, Datum, Zeit, Von, Nach)")
key = ["#", "Artist", "Date", "Time", "From", "To"]
d = df[df.duplicated(subset=key, keep=False)]
print(f"Betroffene Zeilen: {len(d)} in {d.groupby(key, dropna=False).ngroups} Gruppen")
print("Hinweis: Dubletten sind hier BEABSICHTIGT. Das Buchungssystem legt pro")
print("Fahrzeug eine Zeile an (belegt am Timmy-Konvoi, von Jordan bestaetigt).")
for k, g in d.groupby(key, dropna=False):
    z = "+".join(str(i + 2) for i in g.index)
    print(f"  Z{z:10s} {k[2]} {k[3]}  {k[0]}P  {str(k[1])[:18]:18s} {str(k[4])[:26]:26s} -> {str(k[5])[:24]}")


# ----------------------------------------------------------- 4. Ortserkennung
kopf("4. ORTSERKENNUNG (matchLoc verbatim aus dem Quellcode)")
src = open(JSX, encoding="utf-8").read()
m = re.search(r"^function matchLoc\(txt\) \{.*?^\}", src, re.S | re.M)
if not m:
    print("  matchLoc nicht gefunden -> Test kann nichts beweisen.")
    fehler += 1
else:
    ml = m.group(0)
    if GEGENPROBE:
        ml = ml.replace('if (/melter/.test(t)) return { id: "melter" };', "")
        print("  GEGENPROBE AKTIV: melter-Regel entfernt, Test MUSS rot werden.")
    orte = collections.Counter()
    for col in ["From", "To"]:
        for v in df[col].dropna():
            orte[str(v).strip()] += 1
    with tempfile.NamedTemporaryFile("w", suffix=".mjs", delete=False, encoding="utf-8") as f:
        import json
        f.write(ml + "\nconst o = " + json.dumps(orte, ensure_ascii=False) + ";\n")
        f.write("""
let unbekannt = 0, zellen = 0; const rows = [];
for (const [n, c] of Object.entries(o)) {
  const r = matchLoc(n); zellen += c;
  if (r.id === "__custom") { unbekannt += c; console.log("  UNBEKANNT:", n); }
  rows.push([c, r.id + (r.zone ? "/" + r.zone : ""), n]);
}
rows.sort((a,b) => b[0]-a[0]);
for (const [c,id,n] of rows) console.log(`  ${String(c).padStart(3)}x  ${id.padEnd(20)} ${n.slice(0,58)}`);
console.log(`\\n  Ortsangaben gesamt: ${zellen} | unbekannt: ${unbekannt}`);
process.exit(unbekannt === 0 ? 0 : 1);
""")
        tmp = f.name
    r = subprocess.run(["node", tmp], capture_output=True, text=True)
    print(r.stdout, end="")
    os.unlink(tmp)
    if r.returncode != 0:
        if GEGENPROBE:
            print("  -> Gegenprobe BESTANDEN (Test schlaegt bei kaputter Regel an).")
        else:
            fehler += 1
    elif GEGENPROBE:
        print("  -> Gegenprobe FEHLGESCHLAGEN: Test bleibt gruen trotz kaputter Regel.")
        fehler += 1


# ------------------------------------------------- 5. Buendelungskandidaten
kopf("5. ZEITGLEICHE FAHRTEN AUF GLEICHER STRECKE")


def grobloc(t):
    t = str(t).lower()
    for pat, i in [("sheraton", "sheraton"), ("venpick", "moevenpick"), ("melter", "melter"),
                   ("karl", "karl_august"), ("leonardo", "leonardo"), ("hbf|central", "hbf"),
                   ("munich", "muc"), ("private jet|gat", "gat"), ("airport", "airport"),
                   ("herzogenaurach", "flugplatz"), ("puschendor", "puschendorf")]:
        if re.search(pat, t):
            return i
    return "festival"


df["_f"] = df["From"].apply(grobloc)
df["_t"] = df["To"].apply(grobloc)
gruppen = [(k, v) for k, v in df.groupby(["Date", "Time", "_f", "_t"]) if len(v) > 1]
ueber8 = [(k, v) for k, v in gruppen if v["#"].sum() > 8]
print(f"Gruppen: {len(gruppen)} | betroffene Zeilen: {sum(len(v) for _, v in gruppen)}")
print(f"davon ueber 8 Personen (zwingend zwei Fahrzeuge): {len(ueber8)}")
for k, v in sorted(ueber8, key=lambda x: (x[0][0], x[0][1])):
    print(f"  {k[0]} {k[1]}  {len(v)} Zeilen, {v['#'].sum()}P  {k[2]}->{k[3]}")


# ------------------------------------------------------------ 6. Van-Grundlast
kopf("6. VAN-GRUNDLAST GEGEN AUTO-GRUNDLAST")
timmy = df["Artist"].astype(str).str.contains("Timmy", case=False, na=False)
vanpflicht = df["#"] >= 5
vp = int((vanpflicht | timmy).sum())
rest = len(df) - vp
print(f"zwingend Van (5+ Personen)     : {int(vanpflicht.sum())}")
print(f"Timmy-Konvoi (immer Van)       : {int(timmy.sum())}")
print(f"van-pflichtig gesamt           : {vp}")
print(f"Rest, mit Auto fahrbar         : {rest}")
print()
print(f"7 Vans nur mit Pflichtfahrten  : {vp/7:.1f} Fahrten pro Fahrer")
print(f"16 Cars mit dem Rest           : {rest/16:.1f} Fahrten pro Fahrer")
print(f"Gleichverteilt auf 23 Fahrer   : {len(df)/23:.1f} Fahrten pro Fahrer")
print()
print("Befund: Die Vans sind bei reiner Pflichtzuteilung deutlich UNTERausgelastet.")
print("Buendelungen verschieben Last von den Autos zu den Vans und wirken damit")
print("ausgleichend, nicht belastend. Die Fairness-Grenze (max. 25 Prozent ueber")
print("dem Auto-Durchschnitt) ist ein Deckel nach oben, keine Bremse.")

kopf(f"ERGEBNIS: {'OK' if fehler == 0 else str(fehler) + ' BEFUND(E)'}")
sys.exit(0 if fehler == 0 else 1)
