# Übergabe: Fahrereinteilung Open Beatz 2026

Stand: 23.07.2026, Ende des Fahrerdaten-Chats.
Ersetzt `UEBERGABE-Fahrereinteilung-2026.md` in allen Punkten, die hier stehen.

---

## 1. Was in diesem Chat erledigt wurde

### Code, vier Commits auf `main`

```
acfa97c  Korrektur: Raphael Swiety hat 7 Sitze, nicht 6
81daca9  Doku: SQL-Nachtrag 23.07. (Orte, Matrix, Fahrer)
8a0a1d9  Nachtrag: LOC_MATRIX_NODE fuer die drei neuen Orts-IDs
d8f080a  Fahrerliste OB26 (23.07.) + drei neue Orte in matchLoc
```

**Anker für die nächste Session:** `src/ShuttleLeitstelle.jsx` = **13556 Zeilen**,
letzter Code-Commit `8a0a1d9`, HEAD `acfa97c`.

Inhalt:
- `DRIVER_PROFILES` enthält jetzt alle 23 Fahrer statt nur der 6 Abweichler.
  `availableFrom` für jeden, Philipp Baumeister auf `2026-07-25 16:00` korrigiert.
- Timmy-Team: Lukas Bieber raus, Amar Piljevic rein.
- `matchLoc` um `melter`, `flugplatz_herzo`, `bahnhof_puschendorf` erweitert.
  `melter` steht bewusst **vor** `karl_august`, sonst wird die Doppelnennung
  "MELTER - a Neighborhood Hotel + Karl August Hotel" still als Karl August verbucht.
- `LOC_MATRIX_NODE` um dieselben drei IDs ergänzt. Ohne das hätte der
  Vorschlag-Knopf bei 10 Fahrten "Fahrzeit unbekannt" gemeldet und jeden
  Fahrer aussortiert.

Verifikation: esbuild grün, Dubletten-Grep nur der bekannte Bestandsbefund
`function c` (Grep-Artefakt der `c3*`-Funktionen, identisch im HEAD),
JSX-Referenzabgleich identisch zum HEAD. Drei Smoke-Tests im Repo:
`smoke-orte-23-07.mjs`, `smoke-fahrer-23-07.mjs`, `smoke-matrixnode-23-07.mjs`,
alle mit Gegenprobe bei absichtlich kaputter Regel.

### Datenbank, von Jordan ausgeführt und gegengeprüft

Alles aus `DB-NACHTRAG-23-07.sql` ist durch: drei neue Orte, vier Matrix-Kanten,
vier Fahrzeugwechsel, Sandro Benz gelöscht, Raphael Swiety angelegt.
Kontrollabfrage bestätigt: **16 Cars / 64 Sitze, 7 Vans / 46 Sitze, 110 gesamt.**

---

## 2. Fahrerstand, final

23 Fahrer. Springer: Leon Merg, Philipp Stich (nur absoluter Notfall).
Timmy-Team: **Patrick Ibrahimi, Mustafa Ünver, Amar Piljevic.**

| DB-ID | Name | Fzg | Fzg-ID | Sitze | verfügbar ab |
|---|---|---|---|---|---|
| leon-merg | Leon Merg | Car | SUV15 | 4 | 23.07. 14:00 (Springer) |
| philipp-stich | Philipp Stich | Car | SUV16 | 4 | 23.07. 15:00 (Springer) |
| jassin-salah | Jassin Salah | Car | SUV1 | 4 | 23.07. 22:00 |
| daniel-sakic | Daniel Sakic | Car | SUV2 | 4 | 24.07. 14:00 |
| tim-kostka | Tim Kostka | Car | SUV4 | 4 | 23.07. 14:00 |
| marian-mihalca | Marian Mihalca | Car | SUV5 | 4 | 23.07. 14:00 |
| philipp-baumeister | Philipp Baumeister | Car | SUV6 | 4 | 25.07. 16:00 |
| toni-penno | Toni Penno | Car | SUV8 | 4 | 24.07. 10:00 |
| marco-haney | Marco Haney | Car | SUV9 | 4 | 23.07. 15:00 |
| simon-schug | Simon Schug | Car | SUV10 | 4 | 23.07. 14:00 |
| bennet-f-ger | Bennet Füger | Car | SUV11 | 4 | 24.07. 14:00 |
| stefan-baumann | Stefan Baumann | Car | SUV12 | 4 | 23.07. 21:00 |
| karim-salah | Karim Salah | Car | SUV14 | 4 | 23.07. 22:00 |
| david-schneider | David Schneider | Car | SUV7 | 4 | 23.07. 16:00 |
| finn-steinmetz | Finn Steinmetz | Car | SUV17 | 4 | 23.07. 14:00 |
| lukas-bieber | Lukas Bieber | Car | SUV18 | 4 | 24.07. 15:00 |
| dominik-dittes | Dominik Dittes | Van | V8 | 6 | 23.07. 14:00 |
| bj-rn-korn | Björn Korn | Van | V2 | 6 | 23.07. 16:00 |
| amar-piljevic | Amar Piljevic | Van | V3 | 6 | 23.07. 16:00 (Timmy) |
| patrick-ibrahimi | Patrick Ibrahimi | Van | V4 | 7 | 23.07. 14:00 (Timmy) |
| mustafa-nver | Mustafa Ünver | Van | V5 | 8 | 23.07. 23:00 (Timmy) |
| raphael-swiety | Raphael Swiety | Van | V9 | 7 | 23.07. 16:00 |
| maximilian-schneider | Maximilian Schneider | Van | V7 | 6 | 23.07. 21:00 |

Die DB-IDs sind Slugs mit ersetzten Umlauten (`bennet-f-ger`, `bj-rn-korn`,
`mustafa-nver`). Nicht "korrigieren", die App erzeugt sie so.

Drei Vans über 6 Plätze: Mustafa 8, Patrick 7, Raphael 7. Das sind die
einzigen, die die drei 7-Personen-Fahrten der Liste fahren können.

---

## 3. Regelwerk, in diesem Chat von Jordan bestätigt

**Ergänzt und korrigiert das alte Regelwerk. Bei Widerspruch gilt das hier.**

- **Arbeitszeit ist Fahrzeit.** Immer wenn ein Fahrer nicht fährt, ist Pause.
  Damit ist die alte Unklarheit "Das erzaehlt als Pause" erledigt.
- **"Verfügbar ab" ist hart.** Alle Fahrer sind bis zum 27.07. durchgehend da,
  niemand reist vorher ab.
- **Startpunkt morgens und tagsüber: Sheraton.** Deckt sich mit Spec 10.1
  (Hotel-Standby Sheraton, Venue-Standby Caldera, Umschaltung grob 17:00).
- **Leerfahrten vermeiden, Repositionierung mitrechnen.** Die Spec-Regel
  "erst Verkettung prüfen, dann leer schicken" (10.2) gilt.
- **Rückfahr-Kontinuität nur bei Timmy Trumpet.** Sonst macht Jordan das manuell.
  Die App bevorzugt ausdrücklich **nicht** denselben Fahrer für Hin- und Rückfahrt.
- **Timmy Trumpet, Sonderregeln:**
  - Feste Fahrer, wer hinfährt, fährt auch zurück.
  - **Immer Van, auch bei nur 2 Personen.** Absolute Ausnahme, gilt nur für ihn.
  - Beim Konvoi drei Vans, weil zwei Hotels bedient werden (MELTER + Karl August).
- **Bündelung: erst mal weglassen.** Die App hat eigene Vorschläge. Die
  Bühnenregel bleibt wie sie ist, nicht anfassen.
- **Van-Vorzug bei 4 Personen: NICHT in die App bauen.** Ist heute nicht
  vorhanden (`suggestDrivers` kennt `vehicleType` gar nicht, einziger Filter ist
  `seats >= need`). Bewusste Entscheidung wegen Van-Knappheit, siehe Spec
  Abschnitt 12. Im Planungsentwurf von Hand berücksichtigen, wo ein Van frei steht.
- **Variante B steht:** Excel liefert die importierbare Fahrtenliste plus
  Bündelungsvorschläge, die Zuteilung macht Jordan in der App.
  Der Import bringt **nur Fahrten**, keine Fahrerzuteilung.

---

## 4. Die Fahrtenliste 2026

Datei: `Pickups_-_OPEN_BEATZ_FESTIVAL_2026-5.xlsx`, ein Blatt "Pickups",
Spalten `Created | Last Edited | Mode | Driver | Vehicle | # | Passengers |
Artist | Date | Time | From | To | Meeting Point | Notes`.

**Nicht im Repo. Jordan muss sie im neuen Chat erneut hochladen.**

- **309 Zeilen**, keine einzige Lücke bei Date/Time/From/To/#/Artist.
- Driver und Vehicle komplett leer, also keine Zuteilung drin.
- Pro Tag: 23.07. **9**, 24.07. **71**, 25.07. **119**, 26.07. **104**, 27.07. **6**.
- Personenzahl: 1P=74, 2P=123, 3P=47, 4P=35, 5P=11, 6P=16, 7P=3.
  30 Fahrten brauchen zwingend einen Van, 3 davon einen mit mindestens 7 Sitzen.
- **Jordans Bündelungswünsche stecken in der Spalte `Notes`**, deshalb sind sie
  nie separat angekommen. 27 Zeilen mit "shared shuttle with...", "Sammelshuttle1",
  "Zusammen mit Jowi" usw.
- Gegenprobe über Zeit plus Strecke: **27 Gruppen, 56 Zeilen betroffen.**
  Fahren alle Gruppen zusammen, sinkt die Zahl echter Fahrzeugbewegungen von
  309 auf **280**. Die Notizen decken sich fast durchgehend mit der Zeitgleichheit.
- **Ortserkennung: alle 618 Ortsangaben werden getroffen, 0 unbekannt**
  (vor dem Commit waren es 8). Nachgewiesen mit `smoke-orte-23-07.mjs`, das
  `matchLoc` verbatim aus der Quelle zieht.

### Timmy-Konvoi, so sieht er wirklich aus

14 Zeilen. Der Konvoi am 24.07. 22:45:

```
Z68  MELTER          2P -> Caldera
Z69  Karl August     3P -> Caldera
Z70  Karl August     3P -> Caldera
```

8 Personen aus zwei Hotels. Identisch bei der Rückfahrt 25.07. 01:00 und beim
Transfer zum Privatjet GAT 25.07. 10:00. Daher drei Vans.

Achtung: der Team-Badge im Code hängt an `TEAM_ACTIVE_DAY = "2026-07-24"`,
zwei der drei Konvoifahrten fallen kalendarisch auf den 25.07.

---

## 5. Offene Punkte

### Blocker für die Einteilung

1. **Atopia, 12 Personen.** Zwei Zeilen, exakt gleiche Zeit, exakt gleiche
   Strecke, je 6 Personen: 24.07. 13:00 Sheraton -> Caldera und 25.07. 02:30
   zurück. Passt in kein Fahrzeug. **Absichtlich zwei Vans parallel oder ist
   eine Zeile ein Duplikat?** Jordan hat das noch nicht beantwortet.

2. **Testfahrten in der DB.** Jordan sagte erst "DB ist leer", später "es sind
   Testfahrten drin, die müssen sowieso alle gelöscht werden". Vor dem Import
   Bestand prüfen (`select count(*) from rides`) und bestätigen lassen, dass
   nichts Echtes dazwischenliegt. Reihenfolge beim Aufräumen: erst Fahrten,
   dann alles andere.

### Zu prüfen

3. **`driver_category` in der DB.** Die Abfrage D0 wurde nicht separat
   zurückgemeldet. Falls die Spalten `driver_category` / `available_from` /
   `team_group` existieren, **gewinnen sie über `DRIVER_PROFILES` im Code**
   (`fromDbDriver`, Z. 160 ff.). `driver_category` hat `not null default
   'regular'`, dann wären Leon Merg und Philipp Stich **keine Springer mehr**
   und liefen normal im Vorschlag mit. Muss einmal geprüft werden:
   `select id, driver_category, available_from, team_group from drivers;`
   Kommt "column does not exist", ist alles gut.

4. **Zwei geschätzte Fahrzeiten.** `sheraton|flugplatz_herzo` = 40 min und
   `sheraton|bahnhof_puschendorf` = 35 min sind von Claude geschätzt, nicht von
   Jordan bestätigt. Jordans echte Werte waren nur Festival -> Flugplatz 20 min
   und Festival -> Puschendorf 10 min.

5. **PIN für Raphael Swiety.** Leer angelegt, kann sich ohne PIN nicht
   einloggen. In der App unter Einstellungen -> Fahrer-Telefonnummern setzen.
   Seine Nummer: `4915251471504`.
   (`+49 176 60006239` gehört Maximilian Schneider, nicht Raphael.)

6. **Sandro Benz' Handy.** Falls das Gerät noch im Umlauf ist: der Login liegt
   im `localStorage` des Geräts, nicht in der DB. Einmal ausloggen lassen.

### Bekannt und bewusst so

- `melter -> sheraton` ergibt 0 min Fahrzeit, weil beide auf denselben
  Matrix-Knoten zeigen. Gleiches Bestandsverhalten wie `karl_august` und
  `leonardo`. In der Pickup-Liste gibt es keine Fahrt MELTER <-> Sheraton.
- Die Spalte `drivers.active` wird von der App **nicht ausgewertet**. Sie wird
  gelesen und gemappt, aber nirgends zum Filtern benutzt. Deaktivieren versteckt
  einen Fahrer also nicht, nur Löschen wirkt.

---

## 6. Nächste Schritte

1. Atopia-Frage klären (Punkt 5.1).
2. Einteilungsentwurf bauen: 309 Fahrten auf 23 Fahrer, unter dem Regelwerk
   aus Abschnitt 3. Ausgabe Excel, deutsch, mit sichtbaren Leerfahrten und
   Standzeiten, ohne Einzelblatt pro Fahrer.
3. Importdatei für die App aufbereiten (nur Fahrten, keine Zuteilung).
4. Trockenlauf: Stufe 1 komplett ohne DB (Prüfbericht: Ortserkennung,
   Datenlücken, Duplikate, Auffälligkeiten), Stufe 2 Sichtprüfung durch Jordan,
   Stufe 3 Mini-Import von 3 Fahrten, prüfen, entfernen, dann voller Import.
5. Vor dem Import klären, wie sich der Schwung wieder entfernen lässt
   (Import-Kennzeichen am Datensatz, falls das Datenmodell so etwas hergibt).

---

## 7. Arbeitsregeln

- Deutsch, informell, keine Gedankenstriche, korrekte Umlaute.
- Ehrliche Risikoeinschätzung zuerst, dann bauen. Keine stillen Alleingänge.
- Vor jeder Code-Änderung Verdrahtungsplan und Freigabe. Danach volle
  Verifikationskette: esbuild, Dubletten-Grep, JSX-Referenzabgleich,
  Smoke-Tests, Diff-Nachweis. Zu jedem Test eine Gegenprobe mit absichtlich
  kaputter Regel, sonst beweist er nichts.
- Rein additiv wo möglich, kleinstmöglicher Eingriff, keine Breaking Changes.
- Commit-Messages mit Umlauten über `/tmp/msg.txt` und `git commit -F`.
- `git fetch` unmittelbar vor jedem Push.
- Beim Klonen `npm install esbuild` nötig, aber `package.json` und
  `package-lock.json` danach mit `git checkout --` zurücksetzen, die gehören
  nicht in den Commit.
- Nur eine Session gleichzeitig offen.
- **Festival läuft bis 27.07. Produktiv und Preview hängen an derselben
  Supabase. Preview ist keine Sandbox.**
- PAT pro Session frisch, direkt nach dem Klonen aus der Remote-URL scrubben,
  für den Push kurz wieder setzen und sofort danach erneut scrubben.
  Der PAT aus diesem Chat ist zu widerrufen.
- Jordan proaktiv warnen, bevor der Chat zu voll wird.
