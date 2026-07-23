# Prüfbericht Stufe 1: Pickup-Liste 2026

Stand: 23.07.2026, Ende Fahrereinteilung Teil 2.
Datei: `Pickups_-_OPEN_BEATZ_FESTIVAL_2026-5.xlsx`, Blatt "Pickups".
**Die Liste liegt nicht im Repo, sie muss pro Session neu hochgeladen werden.**

Reproduzierbar mit:
```
python3 pruefe-pickupliste.py <pfad.xlsx> src/ShuttleLeitstelle.jsx
python3 pruefe-pickupliste.py <pfad.xlsx> src/ShuttleLeitstelle.jsx --gegenprobe
```
Normallauf muss `ERGEBNIS: OK` liefern, die Gegenprobe muss
`Gegenprobe BESTANDEN` melden. Ohne bestandene Gegenprobe beweist der
Ortstest nichts.

---

## 1. Bestätigt gegen Übergabe Abschnitt 4

Alles deckt sich, keine Abweichung:

- **309 Zeilen**, keine Lücke bei `#`, `Artist`, `Date`, `Time`, `From`, `To`.
- `Driver` und `Vehicle` in allen 309 Zeilen leer, also keine Zuteilung enthalten.
- Fahrten pro Tag: 23.07. **9**, 24.07. **71**, 25.07. **119**, 26.07. **104**, 27.07. **6**.
- Personenzahl: 1P=74, 2P=123, 3P=47, 4P=35, 5P=11, 6P=16, 7P=3. Summe 773 Personen.
- 27 Zeilen mit Bündelungs- oder Mitfahrbezug in `Notes`.
- **Ortserkennung: 618 Ortsangaben, 0 unbekannt**, 24 verschiedene Ortstexte.

## 2. Gegenprobe zur Ortserkennung

Mit entfernter `melter`-Regel fallen 5 Angaben aus und der Test wird rot.
Wichtiger Nebenbefund: die zwei Doppelnennungen
"MELTER - a Neighborhood Hotel + Karl August Hotel" werden dann **still als
`karl_august` verbucht**, ohne als unbekannt aufzufallen. Nur die reine
MELTER-Zeile fliegt auf. Das belegt, warum die Reihenfolge `melter` vor
`karl_august` in `matchLoc` zwingend ist.

## 3. Atopia geklärt: zwei Fahrzeuge, kein Duplikat

Die Suche nach exakten Dubletten liefert **fünf Paare**:

```
Z 69 + Z 70   24.07. 22:45   Karl August -> Caldera    je 3P   Timmy Trumpet
Z 90 + Z 91   25.07. 01:00   Caldera -> Karl August    je 3P   Timmy Trumpet
Z111 + Z112   25.07. 10:00   Karl August -> GAT        je 3P   Timmy Trumpet
Z 19 + Z 20   24.07. 13:00   Sheraton -> Caldera       je 6P   Atopia
Z108 + Z109   25.07. 02:30   Caldera -> Sheraton       je 6P   Atopia
```

Beim Timmy-Konvoi ist unstrittig, dass zwei identische Karl-August-Zeilen zwei
Vans bedeuten (von Jordan als drei Vans pro Konvoi bestätigt). **Das
Buchungssystem legt also pro Fahrzeug eine Zeile an.** Damit sind die beiden
Atopia-Paare ebenfalls zwei Fahrzeuge, keine Doppelerfassung.
`Notes` bestätigt das inhaltlich: "Verschiedene Goa Garden Artists", also
ein Sammelshuttle mehrerer Acts.

**Von Jordan freigegeben: so einteilen, wie eingetragen. Zwei Vans pro Richtung.**

Der identische `Created`-Zeitstempel ist als Duplikat-Indikator unbrauchbar,
er tritt auch bei den gewollten Timmy-Doppelbuchungen auf.

## 4. Neun Zeitfenster brauchen zwingend zwei Fahrzeuge

Gruppen mit gleicher Zeit und gleicher Strecke, deren Personensumme über
8 liegt (größter Van: Mustafa Ünver, 8 Sitze):

```
24.07. 13:00   2 Zeilen   12P   Sheraton   -> Festival    (Atopia)
24.07. 16:00   2 Zeilen    9P   Leonardo   -> Festival
25.07. 00:30   3 Zeilen   12P   Festival   -> Leonardo
25.07. 02:30   2 Zeilen   12P   Festival   -> Sheraton     (Atopia)
25.07. 21:00   2 Zeilen    9P   Mövenpick  -> Festival
26.07. 00:30   4 Zeilen   11P   Festival   -> Mövenpick
26.07. 01:30   3 Zeilen   10P   Festival   -> Leonardo
26.07. 02:15   2 Zeilen    9P   Festival   -> Leonardo
26.07. 23:30   3 Zeilen   10P   Festival   -> Sheraton
```

Keine Entscheidung nötig, wird automatisch als Doppelbelegung geplant.

## 5. Abweichende Zählung der Bündelungsgruppen

Die Übergabe nennt 27 Gruppen mit 56 Zeilen. Dieser Bericht kommt auf
**52 Gruppen mit 115 Zeilen**. Kein Widerspruch, sondern ein anderes
Kriterium: die alte Zählung nahm nur Gruppen mit passender `Notes`-Angabe,
diese nimmt jede Zeit- und Streckengleichheit. Für die Einteilung ist die
größere Zahl die relevante, weil auch Fahrten ohne Notiz zusammengelegt
werden können.

## 6. Van-Grundlast: die Vans sind unterausgelastet

```
zwingend Van (5+ Personen)      30
Timmy-Konvoi (immer Van)        14
van-pflichtig gesamt            43
Rest, mit Auto fahrbar         266

7 Vans nur mit Pflichtfahrten   6,1 Fahrten pro Fahrer
16 Cars mit dem Rest           16,6 Fahrten pro Fahrer
gleichverteilt auf 23 Fahrer   13,4 Fahrten pro Fahrer
```

**Befund, gegen die ursprüngliche Erwartung:** Bei reiner Pflichtzuteilung
fahren die Van-Fahrer nur gut ein Drittel dessen, was die Auto-Fahrer fahren.
Bündelungen verschieben Last von den Autos zu den Vans und wirken damit
**ausgleichend, nicht belastend**. Bündelungen wegzulassen, um die Vans zu
schonen, würde das Ungleichgewicht verschärfen.

Vorbehalt: gezählt sind Fahrten, nicht Fahrzeit. Eine gebündelte Fahrt mit
Zwischenstopp dauert länger. Bei 6,1 gegen 16,6 dreht sich der Abstand
dadurch aber nicht um. Endgültig belastbar erst mit Fahrzeiten aus der Matrix.

---

## 7. Von Jordan in dieser Session entschieden

- **Atopia:** wie eingetragen einteilen, zwei Vans pro Richtung.
- **Sammelshuttle1 am 23.07.** (Z2 15:00 / Z3 16:00, eine Stunde Differenz
  trotz gemeinsamer Notiz): fällt weg, Tag ist durch.
- **Fabian Farell Z4/Z10** (`#`=2, aber 3 Namen, Notiz "eventuell Noisetime
  5pax total"): fällt weg, Tag ist durch.
- **Fairness-Maß:** Hauptmaß ist **Fahrzeit in Stunden**, Fahrtenzahl steht
  als zweite Spalte daneben.
- **Fairness-Grenze:** Van-Fahrer maximal **25 Prozent** über dem Durchschnitt
  der Auto-Fahrer. Als Deckel nach oben, nicht als Bremse. Wird er erreicht,
  wandert die nächste Bündelung auf Autos statt auf den Van.
- Vans werden aktiv mit normalen Fahrten aufgefüllt, damit sie überhaupt in
  die Nähe der Auto-Auslastung kommen.

## 8. Weitere gefundene Punkte für spätere Sessions

- **`life360_name` wird bei jedem Speichern geleert.** Die Spalte existiert in
  `drivers` mit `not null default ''`, `toDbDriver` kennt sie nicht, die
  Speicher-RPC macht `coalesce(d->>'life360_name', '')` und schreibt das
  Ergebnis im Upsert zurück. Jedes Speichern von Fahrerdaten aus der App setzt
  sie also auf Leerstring. Laut `supabase-schema.sql` Z. 234 ist der
  Life360-Sync aufgegeben (Cloudflare-Block), daher vermutlich folgenlos.
  Nicht angefasst.
- **11 Zeilen haben weniger Namen als Personen** (Crew ohne Namenserfassung).
  Unkritisch, `#` ist die sichere Obergrenze.

## 9. Nicht geprüft, bleibt offen

- **Bestand in `rides`.** Vor dem Import weiterhin `select count(*) from rides`
  und Bestätigung, dass nichts Echtes dazwischenliegt (Übergabe 5.2).
- **Zwei geschätzte Fahrzeiten** `sheraton|flugplatz_herzo` = 40 min und
  `sheraton|bahnhof_puschendorf` = 35 min sind weiterhin unbestätigt
  (Übergabe 5.4).
- **PIN für Raphael Swiety** weiterhin leer (Übergabe 5.5).
