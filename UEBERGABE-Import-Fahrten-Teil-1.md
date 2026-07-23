# Übergabe: Import der 284 Fahrten, Stand 23.07.2026 abends

## Wo wir stehen

Diese Session hat die Importdatei für die 284 realen Fahrten der 2026er Einteilung
gebaut und vollständig verifiziert. **Kein Code wurde verändert.** Repo-Stand
unverändert bei HEAD `5c5b2e9`, letzter Code-Commit `8a0a1d9`, `src/ShuttleLeitstelle.jsx`
= 13556 Zeilen.

Die fertige Datei liegt als Chat-Anhang vor: **`Import-Fahrten-OpenBeatz-2026.xlsx`**,
284 Zeilen. Falls sie im neuen Chat nicht mehr verfügbar ist, sag Bescheid, der
Bauplan steht komplett unten, dann wird sie neu erzeugt.

## Was noch offen ist (das ist der Auftrag für die neue Session)

1. **Datenbank leeren**, falls noch nicht geschehen (SQL unten).
2. **Datei hochladen** in der App (Einstellungen → Pickup-Liste importieren),
   Checkbox "Fahrer aus der Liste automatisch übernehmen" an.
3. **In der Vorschau stehenbleiben** und genau drei Zahlen prüfen:
   **284 Fahrten, 0 Fehlerzeilen, 284 Fahrer zugeordnet.**
   Weicht "Fahrer zugeordnet" ab: das ist wahrscheinlich der Umlaut-Fall
   unten (Mustafa Ünver / Björn Korn / Bennet Füger), nicht bestätigen,
   sondern mir die genaue Zahl schicken.
4. Erst wenn alle drei Zahlen stimmen: **284 importieren** klicken.
5. Danach stichprobenartig 2-3 Fahrten in der Fahrtenliste ansehen, insbesondere
   eine der zusammengelegten Sammelfahrten (z. B. die 15:15-Fahrt am 24.07.).

## SQL zum Leeren (falls noch nicht ausgeführt)

```sql
update settings
set dyn_data = jsonb_set(dyn_data, '{rides}', '[]'::jsonb),
    dyn_rev = dyn_rev + 1, updated_at = now()
where id = 1;
```

Kontrolle danach:

```sql
select jsonb_array_length(dyn_data->'rides') as fahrten_gesamt,
       (select count(*) from jsonb_each(dyn_data->'driverState')
        where value ? 'pushSubscription') as fahrer_mit_push
from settings where id = 1;
```

Erwartet: `fahrten_gesamt = 0`, `fahrer_mit_push = 7`. **Nicht** den UI-Knopf
"Alle Fahrten löschen" benutzen, der killt auch `driverState` und damit die
7 Push-Abos.

## Wichtige Befunde aus dieser Session

- **"Flughafen Nuernberg" (ue statt ü) matcht NICHT.** `matchLoc` verlangt
  `n(ü|u)rnberg`, also Nürnberg oder Nurnberg. In der Importdatei steht
  deshalb korrekt "Flughafen Nürnberg" mit echtem Umlaut. Verifiziert gegen
  die echte `matchLoc`-Funktion aus dem Quelltext.
- **`matchDriver` (Z. 11872) normalisiert KEINE Umlaute**, exakter
  Stringvergleich nach `toLowerCase()`. Betroffen: Mustafa **Ü**nver (15
  Fahrten), Björn Korn (10), Bennet Füger (13), zusammen 38 Fahrten. Ob das
  in der Live-DB passt, konnte ich nicht prüfen (kein DB-Zugriff), deshalb
  ist Punkt 3 oben so wichtig.
- **`festDayKey`**: 49 Fahrten liegen zwischen 00:00 und 05:59 und werden
  automatisch dem Vortag zugeordnet (Nachtschicht-Logik, kein Fehler,
  Aufteilung: 2× 23.07., 26× 24.07., 19× 25.07., 2× 26.07.).
- **`festivalDates` in der Live-DB war unvollständig** (nur 23./24.07.
  eingetragen). Der Import ergänzt das selbst vor dem Schreiben der Fahrten
  (Code Z. ~11557-11560), kein Handlungsbedarf.
- Zwei **Befunde außerhalb des Sessionumfangs, nicht angefasst:**
  `parseDate` akzeptiert `32/13/2026`, `parseTime` akzeptiert `99:99` (nur
  Formatprüfung, keine Wertebereichsprüfung). Für diesen Import irrelevant,
  da alle Werte aus der echten Excel stammen. Für eine spätere Session.

## Die 9 Zusammenlegungen (bereits umgesetzt in der Datei)

Aus 300 Rohzeilen wurden durch Merge 284 Fahrten. Entscheidungen und
Fahrerzuteilung:

| Gruppe | Zeilen | Fahrer | Pax | Hinweis |
|---|---|---|---|---|
| G1 | Z25+Z26 | Maximilian Schneider (Van 6) | 6 | Sheraton-Regel greift für Leonardo |
| G2 | Z30-33 | **Dominik Dittes** (Van 6, umbesetzt) | 5 | urspr. 4 Fahrer hatten nur Cars |
| G3 | Z97,101,102 | Tim Kostka (Car 4) | 4 | passt exakt |
| G5 | Z171+172 | Patrick Ibrahimi (Van 7) | 5 | |
| G6 | Z223-225 | Patrick Ibrahimi (Van 7) | 6 | Ziel Mövenpick gesetzt, Sheraton-Stopp in Notiz |
| G7 | Z238-240 | **Mustafa Ünver** (Van 8, umbesetzt) | **5** | Pax-Spalte sagte 3, Notiz sagte 5, ich habe 5 angesetzt |
| G8 | Z242-244 | Amar Piljevic (Van 6) | 6 | passt exakt |
| G9 | Z278+279 | Raphael Swiety (Van 7) | 4 | Fahrer mit mehr Pax gewinnt (meine Konvention) |
| G10 | Z308-310 | Tim Kostka (Car 4) | 3 | |

**G4 (Z128 Kobosil / Z129 Tye Vie) bewusst NICHT zusammengelegt**, Ziele sind
Stonelands vs. Caldera, also real verschiedene Fahrten. Notiz war kein
Merge-Auftrag, nur ein Hinweis, dass Kobosils Videograph in Tye Vies
Personenzahl mitzählt.

**6 von 26 Bündelungsvorschlägen** aus dem Original-Excel wurden weggelassen,
weil sie tote Zeilennummern referenziert hätten (die betroffenen Zeilen sind
durch die Merges verschwunden). 62 Fahrten tragen einen Bündelungstext in der
Notiz, Format: `Buendelung: Z.., Z.. (XP, ..., Versatz X min, Ersparnis X min)`.

## Bauplan der Importdatei (falls neu erzeugt werden muss)

Quelle: `Fahrereinteilung-OpenBeatz-2026-ENTWURF_1.xlsx`, Blatt "Einteilung"
(300 Datenzeilen, 4 Tagestrenner) und Blatt "Bündelungsvorschläge".

Header exakt: `ID, Datum, Zeit, Artist, Von, Nach, Pax, Treffpunkt, Fahrer, Notiz`
(alle 10 treffen einen Alias in `parseRow`, verifiziert). Datei muss `.xlsx`
sein (App liest nur `.xlsx/.xls`, kein CSV), Datum/Zeit-Spalten als Text
formatieren, nicht als Excel-Datum.

Verifikationskette, die ich in dieser Session gefahren habe (bei Neubau
wiederholen):
1. `matchLoc`, `parseDate`, `parseTime` **verbatim aus dem Quelltext**
   extrahieren (nicht nachbauen), inkl. der `pad`-Hilfsfunktion (Z. 714).
2. Gegenprobe: ungültiges Datum/Zeit muss abgelehnt werden, sonst misst der
   Test nichts.
3. Alle 10 Header gegen die Alias-Listen aus `parseRow` (Z. 11880 ff.) prüfen.
4. Jede Zeile: Datum, Zeit, Ort (beide Richtungen), Fahrer (gegen
   `drivers_openbeatz.json`, **ohne** Umlaut-Normalisierung, das macht die
   App auch nicht), IDs eindeutig, Pax gültig.
5. **Wichtigster Schritt:** die fertige Datei mit **SheetJS** (`xlsx`-Paket,
   `XLSX.read(buf, {type:'array', cellDates:true})` + `sheet_to_json`)
   zurücklesen, exakt wie `onFile` in der App (Z. 11530 ff.), nicht nur die
   Rohdaten prüfen. Das deckt Formatfallen ab, die reine Funktionstests
   übersehen.

## Rahmen (unverändert)

Keine Code-Änderung ohne Verdrahtungsplan und Freigabe. Festival läuft bis
27.07., Produktiv-DB ist scharf, Preview ist keine Sandbox. Deutsch,
informell, keine Gedankenstriche, korrekte Umlaute. Freeze war bis 20.07.,
seither aufgehoben, Löschungen sind seit 21.07. wieder grundsätzlich erlaubt
(Jordans Freigabe vom 20.07.). Proaktiv warnen, bevor der Chat zu voll wird.

PIN-Sicherheitsthema (Klartext-PINs, clientseitiger Login-Vergleich): nicht
proaktiv ansprechen, nur wenn Jordan es selbst bringt.
