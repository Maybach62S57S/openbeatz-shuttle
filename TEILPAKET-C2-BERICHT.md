# Teilpaket C2 - Abschlussbericht: sicheres Artist-Matching

## Ziel

Fahrten der Leitstelle sollen ihrem wahrscheinlichen Timetable-Set zugeordnet
und diese Zuordnung nachvollziehbar sichtbar gemacht werden. Rein lesend,
robust, ohne falsche Sicherheit. Aufbauend auf der bereits vorhandenen,
rein lesenden Timetable-Schicht aus C1.

## Datenanalyse (Pflicht-Schritt vor der Implementierung)

- **Kanonisches Ride-Artist-Feld: `ride.djName`.** Belegt durch alle drei
  Befuellungswege: Beispieldaten (`makeExampleRides`), Excel-Import (`parseRow`,
  Header-Aliase `artist/dj/djname/kuenstler`) und das Formular (Feld
  "DJ / Artist"). Die uebrigen Felder scheiden als Artist-Quelle aus:
  `passengers` = Begleit-/Passagiernamen (mit Telefonnummern), `notes` =
  Freitext-Bemerkung, `type` = klassifizierter Fahrttyp. Es wird deshalb kein
  Artist aus beliebigem Freitext geraten.
- **`djName` kann leer sein** (der Import zaehlt namenlose Fahrten sogar
  explizit) und enthaelt pro Fahrt genau einen Artist - auch wenn der Timetable
  fuer diesen Slot ein B2B-Set fuehrt.
- **Alias-Befund:** Ein Abgleich aller Beispiel-Ride-Artists gegen die echten
  Timetable-Sets zeigt, dass die grossen Headliner der Fahrten gar nicht im
  Timetable stehen. Es liess sich damit **keine aus den Daten belegbare
  Alias-Regel** ableiten. Entsprechend der Vorgabe ("keine erfundenen Aliase")
  ist die Alias-Tabelle bewusst leer und bleibt zentral erweiterbar.
- **`&` ist mehrdeutig:** Der echte Timetable enthaelt Einzel-Kuenstler mit "&"
  im Namen (z. B. "Harris & Ford", "2 Engel & Charlie", "Vero & Sleepwell").
  "&" darf daher nie als B2B-Trenner gelten - nur `b2b` / `back to back` /
  `vs` / `vs.` trennen.

## Umgesetzt (rein additiv, rein lesend)

Neue reine Funktionen (ohne Nebenwirkung):

- `normalizeArtistName` - Vergleichs-Normalisierung: Gross/Klein, deutsche
  Umlaute ausgeschrieben (oe/ae/ue) UND als Umlaut identisch, ss/ß, typografische
  Apostrophe, dekorative Sonderzeichen/Bindestriche zu Leerzeichen, "&" -> "and".
  Der sichtbare Originalname wird nie veraendert. Kein Fuzzy/keine Aehnlichkeit.
- `ARTIST_ALIASES` (leer) + `buildArtistAliasIndex` - deterministischer
  Alias-Index; mehrdeutige Aliase (zeigen auf mehr als einen Kuenstler) werden
  verworfen, damit nie zwischen zwei Kuenstlern geraten wird.
- `extractTimetableArtists` - trennt B2B-/vs.-Sets in ihre Mitglieder; "&"
  bleibt Teil eines einzelnen Namens; der Original-Set-Name bleibt erhalten.
- `rideFestivalDirection` - Hinfahrt (zum Festival) / Rueckfahrt (vom Festival)
  / sonstige, aus den Ride-Endpunkten.
- `rideCanonicalArtist` - kanonischer Ride-Artist (nur `djName`).
- `buildTimetableMatchIndex` - Indizes ueber die (aus C1) normalisierten,
  gueltigen Timetable-Eintraege, pro Artist (inkl. B2B-Mitglieder) und pro
  Betriebstag. Nutzt die C1-Normalisierung, kein Neuparsen der Zeiten.
- `pickByTime` - waehlt bei mehreren Kandidaten desselben Tages das zeitlich
  plausibelste Set (richtungsabhaengig), ohne je einen Match zu erzeugen.
- `matchRideToTimetable` - zentrale Funktion. Reihenfolge streng:
  1) exakter normalisierter Name, 2) expliziter Alias, 3) eindeutiges
  B2B-Mitglied. Zeit wird ausschliesslich zur Auswahl unter bereits
  Artist-gematchten Kandidaten genutzt, nie zur Match-Erzeugung. Statuswerte:
  `exact`, `alias`, `b2b_member`, `multiple_candidates`, `no_match`,
  `missing_artist`, `invalid_artist`. Liefert zusaetzlich eine Diagnose
  (verwendeter Name, Fahrtrichtung, Kandidaten, ausgeschlossene Sets).

Neue UI (nur Leitstelle, neutral, keine Ampel-Warnfarben):

- `TimetableMatchInfo` + `renderDiagnostics` - kleiner Info-Kasten mit dem
  zugeordneten Set bzw. dem passenden Hinweis, plus aufklappbare Diagnose.
- Eingebunden in `RideForm` (live unter dem Feld "DJ / Artist", reagiert beim
  Tippen) und `AssignModal` (Zuteilungsdialog, zur festen Fahrt).

Betriebstag ausschliesslich ueber den bestehenden Helfer `festDayKey`
(00:00-05:59 = Nacht des Vortags) - keine zweite Datumslogik.

## Bewusst NICHT enthalten (spaetere Teilpakete)

Farbliche/kritische Zeitwarnungen (C3), automatische Aenderungen von
Zeit/Status/Fahrer, Fuzzy-Matching, Levenshtein, phonetische Aehnlichkeit,
Tippfehlerkorrektur.

## Verifikation

- esbuild gruen, keine doppelten Funktionsnamen.
- JSX-Referenz-Cross-Check: alle im C2-Block genutzten Komponenten/Bezeichner
  sind definiert bzw. importiert (`Clock` bereits vorhanden).
- `rendertest.mjs`: alle 5 Referenzwerte konstant (App-Root 25053, IssueModal
  2452, StageIssueModal 2413, GuestIssueModal 2895, Field ohne mc 101) - C2 ist
  rein additiv und liegt nicht im gemessenen Render-Pfad.
- `kontrast.mjs`: 0 Kontrast-Fehler. `pruefe.mjs`: keine undefinierten
  `var(--mc-*)`; Diff gegen den C1-Stand zeigt exakt: 2 geaenderte Bausteine
  (RideForm, AssignModal = die Einbindungspunkte), 15 neue, 0 entfernte.
- `smoke-teilpaket-c2.mjs`: 65/65 Logiktests gegen die echten Quellfunktionen
  (Normalisierung, Alias, B2B, Matching-Reihenfolge, Tag/Richtung/Zeit,
  Mehrdeutigkeit, Read-only) inkl. Gegenproben.
- `smoke-teilpaket-c2-ui.mjs`: 14/14 (alle Statusfaelle rendern ohne Absturz,
  neutrale Ausgabe ohne Alarmfarbe; statische Read-only-Analyse der gesamten
  C2-Schicht - kein Schreibvorgang; die lokale `Map.delete` beim Alias-Aufbau
  ist kein Persistenz-Schreibweg und wird korrekt nicht als solcher gewertet;
  Gegenprobe bestaetigt echte Messung).
- Bestehende Tests unveraendert gruen: C1-Logik 40/40, C1-UI 16/16 (Test-Anker
  robuster gemacht - der C2-Block liegt zwischen TimetableTab und
  MissionDriversTab, deshalb grenzt der Test den TimetableTab-Koerper jetzt
  klammer-genau ab; Gegenprobe belegt, dass er weiterhin echt misst; TimetableTab
  selbst ist byte-identisch), Springer/A 34/34, One-Tap 14/14, Personenzahl
  24/24, Ridelist 10/10.

## Regressionsrisiken

- Sehr gering: rein additive Funktionen; die einzigen Eingriffe in
  Bestandskomponenten sind zwei rein anzeigende Einbindungen (je ein
  `TimetableMatchInfo`) plus zwei `useMemo` fuer die normalisierten Timetable-
  Daten in RideForm/AssignModal. Keine Handler, keine Felder, keine
  Speicherpfade beruehrt.
- Die Match-Anzeige in RideForm reagiert live auf den Formular-State; die in
  AssignModal auf die feste Fahrt.

## Geaenderte / neue Dateien

- `src/ShuttleLeitstelle.jsx` - C2-Schicht + zwei Einbindungen (10072 -> 10536
  Zeilen).
- `smoke-teilpaket-c2.mjs`, `smoke-teilpaket-c2-ui.mjs` - neue Proof-Skripte.
- `smoke-teilpaket-c1-ui.mjs` - Test-Anker robuster (keine Logikaenderung).
- Ruecksetzpunkt: Tag `pre-teilpaket-C2` = `2fb4ca2` (Codestand von C1, VOR C2;
  lag bereits lokal und auf origin).
