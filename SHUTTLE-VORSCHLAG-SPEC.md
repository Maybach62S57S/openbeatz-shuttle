# Shuttle-Leitstelle: Vorschlag-Knopf, Warnungen & Timetable

Bau-Anweisung fuer Claude Code. Open Beatz 2026, VIP-Shuttle-Dispatch.
Zieldatei: `ShuttleLeitstelle.jsx`. Datenquellen: `timetable_openbeatz.json`, `drivers_openbeatz.json` (liegen im selben Ordner wie diese Spec).

---

## 0. Absolute Regeln (nicht verhandelbar)

**Prioritaet bei Zielkonflikten** (ergaenzt nach Review, angeglichen an die Prioritaetenordnung der anderen Baustelle):
1. Stabilitaet 2. Datenintegritaet 3. Sicherheit 4. Rueckwaertskompatibilitaet 5. Nachvollziehbarkeit 6. Performance 7. Neue Funktionen.

1. **Erst lesen, dann Plan zeigen, dann bauen.** Bevor du Code aenderst: diese Spec lesen, die betroffenen Stellen in `ShuttleLeitstelle.jsx` lesen (Suche nach `rides`, der Assign-Funktion, dem AssignModal, `matchLoc`), und einen kurzen Umbauplan zeigen. Nicht ungefragt drauflosbauen.
2. **Rein additiv.** Der Kern (Zuteilung, Status, Realtime, Datenmodell) wird nicht umgebaut. Es wird nur ein lesender Vorschlag davorgehaengt und drei Anzeige-Features ergaenzt.
3. **Read-only bis zur Bestaetigung.** Der Vorschlag-Knopf schreibt NIE selbst. Bestaetigen loest die bestehende, gepruefte Assign-Funktion aus, denselben Pfad wie der manuelle Klick. Kein zweiter Schreibpfad.
4. **`matchLoc` NICHT anfassen.** Der bekannte Bug (hardcodiert auf 4 Orte, ~Z. 7676) bleibt unberuehrt. Die Positionierung laeuft ueber das Zonen-Alias-Mapping in dieser Spec, nicht ueber Distanzen.
5. **Kein Auto-Zuteilen, keine erfundenen IDs, kein stilles Uebernehmen.** Jede Zuteilung geht ueber die Leitstelle.
6. **Feature fuer Feature.** Reihenfolge in Abschnitt 1 einhalten. Nach jedem Feature testbar stoppen.
7. **Keine geratenen Werte.** Zeit-, Entfernungs- oder Kapazitaetswerte werden nie geschaetzt, wenn sie nicht aus echten Daten ableitbar sind.
8. **Keine stillen Default-Werte.** Fehlende Daten werden niemals durch `0`, leere Strings oder angenommene Standardwerte ersetzt. Bei fehlenden oder unvollständigen Daten liefert die Funktion einen nachvollziehbaren Ausschlussgrund (sichtbar im Vorschlag, z. B. "Fahrer X ausgeschlossen: Sitzzahl unbekannt"), statt die Fahrt/den Fahrer einfach zu ignorieren oder falsch anzunehmen.
9. **Reine Funktionen, keine Nebenwirkungen.** Alle Vorschlagsberechnungen (Ranking, Warnungen, Zusammenlegen-Vorschlaege) sind reine, lesende Funktionen ohne Datenmutation. Die reine Anzeige eines Vorschlags loest NIE einen Datenbank-, Realtime- oder `window.storage`-Schreibvorgang aus, auch nicht als Nebeneffekt (z. B. kein "Vorschlag angesehen"-Log, kein Cache-Write in dyn_data).
10. **Zeitzone und Zeitstempel.** Alle internen Zeitberechnungen mit vollstaendigen ISO-Zeitstempeln, eindeutige Zeitzone `Europe/Berlin`. Muss beim Einlesen von `ShuttleLeitstelle.jsx` als Erstes verifiziert werden: falls die App bereits ein anderes verbindliches Zeit-/Zeitzonen-Handling hat, gilt das bestehende, nicht diese Regel blind druebergestuelpt.
11. **Pro Phase: Risiken vorher, Regressionstest und Pruefbericht nachher.** Vor jeder Phase die betroffenen bestehenden Funktionen und Regressionsrisiken benennen (deckt sich mit der ohnehin etablierten Verifikations-Pipeline: esbuild, Dupli-Grep, Referenz-Cross-Check, Node-Tests). Nach jeder Phase konkrete manuelle Testfaelle + kurzer Pruefbericht, bevor die naechste Phase beginnt.

---

## 1. Bau-Reihenfolge (Phasen)

| Phase | Feature | Risiko | Warum diese Reihenfolge |
|-------|---------|--------|-------------------------|
| 1 | Zonen-Alias-Mapping + Fahrer-Rollen laden | niedrig | Fundament fuer alles Weitere |
| 2 | Vorschlag-Knopf (read-only Ranking + Bestaetigung) | mittel | Kern-Feature, alleine testbar |
| 3 | Timetable-Rubrik (JSON rendern) | sehr niedrig | harmlos, reine Anzeige |
| 4 | Warnungen (3 Typen) | mittel | braucht Timetable-Daten aus Phase 3 |
| 5 | Wartefahrten (Paar-Erkennung) | mittel | Sonderfall, zuletzt |

**Vor Phase 1: Fahrer-Abgleich pruefen (siehe 2.2).** Drei Fahrer aus `drivers_openbeatz.json` (Leon Merg, Philipp Stich, Maximilian Schneider) stehen bisher nicht in der produktiven App. Das ist der allererste Check beim Einlesen von `ShuttleLeitstelle.jsx`, noch vor dem eigentlichen Umbauplan.

Live-Einzelumverteilung (Fahrer faellt aus / Flug spaet) ist NICHT Teil dieses Auftrags. Wird spaeter konzipiert und ist nur "Vorschlag fuer eine bereits zugeteilte Fahrt erneut aufrufen", also trivial sobald Phase 2 steht.

---

## 2. Datenmodell

### 2.1 Zonen-Alias-Mapping

Mehrere Ortsnamen zeigen auf eine logische Zone. Der Knopf braucht nur die Zone, keine Distanzen.

```
HOTEL-STADT   = Sheraton Carlton, Leonardo / City-Center / InterCity
KARL-AUGUST   = Karl August Hotel            (SEPARAT, praktisch nur Fr relevant, Timmy Trumpet)
MOEVENPICK    = Moevenpick Airport
NUE-GAT       = Airport Nuremberg / Private Jet GAT
MUC           = Airport Munich               (Langlaeufer, ~2 Std pro Richtung)
HBF           = Nuernberg HBF / Central Station
VENUE         = alle Stages/Zonen am Festival (Caldera, Stonelands, Darkwoods, Magical Forest, Zone III, House of Remix, Campingstage, Goa Garden, Gruener Stadl ...)
```

Implementierung: eine Funktion `zoneOf(ortsname)` mit Substring-Matching (case-insensitive), plus eine editierbare Alias-Tabelle im State, damit neue Schreibweisen ohne Code-Aenderung ergaenzt werden koennen. Sheraton und Leonardo gelten als dieselbe Zone (keine Fahrzeit untereinander). Karl August ist eine eigene Zone.

**Kein Raten bei unbekannten/mehrdeutigen Ortsnamen.** Liefert `zoneOf()` keinen eindeutigen Treffer (kein Match oder mehrere moegliche Zonen), wird NICHT automatisch eine Zone angenommen. Die betroffene Fahrt/der betroffene Fahrer wird mit sichtbarem Ausschlussgrund aus dem Ranking genommen ("Ort nicht zuordenbar: '<Text>'"), die Leitstelle kann die Alias-Tabelle manuell ergaenzen. Eine falsch geratene Zone waere hier gefaehrlicher als ein sichtbarer Ausschluss, weil sie den Vorschlag unbemerkt verfaelscht.

### 2.2 Fahrer-Rollen (aus `drivers_openbeatz.json`)

```
role: "regular"  -> normal im Ranking
role: "springer" -> nur vorschlagen, wenn KEIN regulaerer Fahrer den Filter passiert (absoluter Notfall)
available_from   -> Fahrer erst ab diesem Zeitpunkt im Pool (Philipp Baumeister: 2026-07-25 14:00)
vehicle          -> "van" oder "car"
seats            -> IMMER aus dem Feld `seats` des jeweiligen Fahrers lesen, NIE pauschal annehmen. Cars = 4, Vans sind fahrzeugspezifisch 6 oder 7 (siehe 11.2). Das gilt fuer jede Kapazitaetspruefung im Knopf, beim Zusammenlegen und bei den Warnungen.
```

Springer sind Leon Merg und Philipp Stich. Philipp Baumeister ist `regular` mit `available_from` (Empfehlung: regulaer ab Ankunft, nicht Springer; per Flag umstellbar).

**Vorbedingung, VOR Phase 1 zu pruefen: drei Fahrer aus `drivers_openbeatz.json` stehen noch nicht als Fahrer-Datensatz in der produktiven App.** Leon Merg, Philipp Stich (beide Springer) und Maximilian Schneider (Van, regulaer) sind bisher nicht ueber die normale Fahrer-Verwaltung der App angelegt. Das ist keine Aufgabe dieses Features, sondern eine echte Vorbedingung dafuer:
- Bevor Phase 1 das JSON gegen die echten Fahrer-Datensaetze abgleicht, muss geprueft werden, ob diese drei zwischenzeitlich schon angelegt wurden (evtl. unter leicht anderem Namen/Schreibweise).
- Falls nicht: sie muessen zuerst ganz regulaer ueber die bestehende Fahrer-Verwaltung der App angelegt werden (ausserhalb dieses Vorschlag-Knopf-Features, keine neue ID dafuer erfinden, Regel 5 in Abschnitt 0).
- Bis das erledigt ist, werden diese drei aus dem Vorschlag-Pool ausgeschlossen, mit sichtbarem Ausschlussgrund ("Fahrer noch nicht im System angelegt"), NICHT stillschweigend uebersprungen und NICHT mit einer erfundenen ID simuliert.
- Praktische Folge bis zur Anlage: die Springer-Notfall-Runde (Abschnitt 3) laeuft faktisch mit 0 statt 2 Springern, und die allgemeine Van-Kapazitaet (Abschnitt 11.2, 12.1) ist real bei 6 statt 7 Vans, weil Maximilian Schneiders Van fehlt. Maximilian Schneider gehoert NICHT zum Timmy-Team (das sind nur Patrick Ibrahimi, Mustafa Ünver, Lukas Bieber), betrifft also die allgemeine Van-Reserve, nicht den Timmy-Konvoi direkt.

### 2.3 Anforderungen an `rides[]`

Der Knopf leitet alles aus dem bestehenden `rides[]` ab, keine neuen Pflichtfelder im Kern. Er braucht pro Fahrt: Startzone, Zielzone (via `zoneOf`), geplante Zeit, Personenzahl, zugeteilter Fahrer (falls vorhanden), Status. Falls ein Feld fehlt: im Plan melden, NICHT raten.

---

## 3. Feature: Vorschlag-Knopf (Phase 2, Kern)

### Ausloeser
Bei einer offenen Fahrt (kein Fahrer zugeteilt) erscheint im AssignModal / an der Fahrt ein Knopf "Fahrer vorschlagen". Er liefert die Top 3 Fahrer mit kurzer Begruendung. Leitstelle bestaetigt einen -> bestehende Assign-Funktion schreibt.

### Zwei Modi
- **Geplant (Inbound / Airport):** feste Zeiten. Kann auch vorab zugeteilt werden.
- **Live (Rueckfahrt / Outbound):** wird abends spontan aufgerufen, wenn die Fahrt faellig ist. Rechnet auf dem realen Stand des Moments.

Die Logik ist in beiden Modi identisch, nur der Zeitpunkt des Aufrufs unterscheidet sich.

### Harte Filter (muss alle erfuellen, sonst raus)
1. **Verfuegbar:** `role` erlaubt (regular; springer nur in Notfall-Runde, s.u.) UND `available_from` liegt vor der Fahrtzeit.
2. **Frei im Fenster:** keine laufende oder zugeteilte Fahrt im Zeitfenster [Fahrtzeit minus Anfahrt] bis [Fahrtzeit plus Fahrtdauer plus 15 Min Puffer].
3. **Sitze reichen:** `seats >= Personenzahl`.
4. **Fahrzeugtyp passt:** ab 5 Personen zwingend `van`.

### Zwei-Runden-Springer-Logik
- Runde 1: nur `regular`-Fahrer durch die Filter. Gibt es Treffer -> ranken, fertig. Springer erscheinen NICHT.
- Runde 2 (nur wenn Runde 1 leer): Springer dazunehmen, ranken, und im UI klar als "NOTFALL-Springer" markieren.

### Score (nur auf die gefilterte Menge; hoeher = besser)
Position dominiert, Fairness bricht nur Gleichstaende.

```
Position:
  Fahrer steht in der Startzone der Fahrt        +100
  Fahrer steht in einer Nachbarzone              +40
    (HOTEL-STADT <-> KARL-AUGUST <-> HBF gelten als benachbart;
     VENUE ist zu allen Hotelzonen "eine Fahrt entfernt", also +40 wenn Fahrer am VENUE und Start Hotel, oder umgekehrt)
  sonst / weit weg (z.B. MUC)                     +0

Fairness (Lastausgleich), gedeckelt:
  je nach heutiger Last des Fahrers              0 bis +30
    (wenig Fahrten/Fahrminuten heute -> hoeherer Bonus; Deckel 30, damit Position nie ueberstimmt wird)
```

"Fahrer steht in Zone X" = Zielzone seiner letzten abgeschlossenen oder laufenden Fahrt. Hat er heute noch keine Fahrt, gilt seine Standby-Zone (Default HOTEL-STADT tagsueber, VENUE ab 17:00; als einfache Regel oder editierbar).

**KEINE Kontinuitaet.** Gleicher Fahrer bringt Artist hin und zurueck wird NICHT bevorzugt. Reine Effizienz plus Fairness.

### UI-Ausgabe (Beispiel)
```
1. Finn Steinmetz (Van)   am VENUE, 3 Fahrten heute      [Bestaetigen]
2. Toni Penno (Car)       Hotel-Zone, 2 Fahrten heute    [Bestaetigen]
3. Marco Haney (Car)      Hotel-Zone, 4 Fahrten heute    [Bestaetigen]
```
Begruendung sichtbar, Entscheidung bei der Leitstelle. Nie Auto-Zuteilung.

---

## 4. Feature: Rueckfahrt-Lebenszyklus (Teil von Phase 2)

Rueckfahrten (Startzone VENUE) werden NICHT vorab Fahrern zugeteilt. Die gelisteten Zeiten sind Schaetzungen, keine Termine.

**Korrektur: Runde Uhrzeiten (:00/:15/:30/:45) sind KEIN zuverlaessiger Beweis fuer "geschaetzt".** Auch echte, fest geplante Hinfahrten liegen auf runden Werten (siehe Gesamtuebersicht-Excel, z. B. mehrere Hinfahrten Fr 24.07 auf 15:00/15:15/17:00). Die Unterscheidung "geplant/fest" vs. "geschaetzt" darf ausschliesslich ueber eines der folgenden laufen:
- ein bereits vorhandenes eindeutiges Feld in `rides[]`,
- einen bestehenden Ride-Typ (z. B. falls Hin-/Rueckfahrt schon als Typ unterschieden wird),
- eine vorhandene Kennzeichnung,
- oder eine spaeter ausdruecklich freigegebene additive Kennzeichnung.
Welche dieser Optionen tatsaechlich existiert, wird beim Einlesen von `ShuttleLeitstelle.jsx` in Phase 1/2 geprueft und im Umbauplan gemeldet. Findet sich nichts Eindeutiges, wird NICHTS geraten, sondern der Punkt zur Freigabe vorgelegt (z. B. neues additives Feld), bevor irgendetwas an der Unterscheidung gebaut wird.

Status pro Rueckfahrt:
```
geplant   -> geschaetzte Zeit sichtbar, kein Fahrer
faellig   -> Leitstelle aktiviert (Klick), kein automatischer Trigger
Vorschlag -> Knopf nennt besten freien Fahrer
zugeteilt -> Leitstelle bestaetigt, Assign-Funktion schreibt
laeuft    -> unterwegs
erledigt
```

**Praezisierung: "Set endet" ist in Phase 2 KEIN technischer Trigger.** Der Uebergang geplant -> faellig passiert ausschliesslich durch einen manuellen Klick der Leitstelle. Die App hat in Phase 2 noch keinen Zugriff auf echte Set-Endzeiten (die Timetable-Daten kommen erst in Phase 3). "Set endet" beschreibt nur den realen Anlass, warum die Leitstelle klickt (eigene Kenntnis, Funk, Artist meldet sich), nicht ein App-Ereignis. Ab Phase 3/4 kann die App das mit Timetable-Anzeige und Warnungen unterstuetzen (z. B. "Set X endet in 10 Min" sichtbar machen), aber der Statuswechsel selbst bleibt in jeder Phase ein manueller Klick, nie automatisch ausgeloest, das waere sonst ein stiller Automatismus entgegen den Absoluten Regeln.
Geplante Zeiten bleiben als Orientierung sichtbar ("gegen 23:00 kommen 5 Rueckfahrten"), aber klar als geplant markiert. Der Knopf greift beim Uebergang faellig -> zugeteilt.

**Klarstellung (Entscheidung diese Runde):** Diese sechs Stufen sind eine rein abgeleitete UI-Anzeige-Ebene, KEIN neues persistentes Statusfeld. Sie werden zur Laufzeit aus dem bestehenden `status` (planned/accepted/enroute_pickup/onboard/done/cancelled) plus Zeit/Zuteilung berechnet, es wird nichts Neues in `rides[]` gespeichert oder in der DB angelegt. Damit bleibt Regel 7 der ChatGPT-Ergaenzung (keine neuen persistenten Felder ohne Freigabe) automatisch eingehalten. Falls sich beim Lesen von `ShuttleLeitstelle.jsx` zeigt, dass eine reine Ableitung nicht reicht, muss das als eigener Punkt zur Freigabe vorgelegt werden, bevor irgendwas Neues gespeichert wird.

---

## 5. Feature: Timetable-Rubrik (Phase 3)

Eigener Tab/Rubrik "Timetable". Rendert `timetable_openbeatz.json` (229 Sets, 10 Stages). Filterbar nach Tag und Stage, suchbar nach Artist. Zweck: schneller Nachschlagezugriff fuer die Leitstelle.

Wichtig: Festival-Tag laeuft ca. 14:00 bis 06:00 des Folgetags. Sets nach Mitternacht sind im JSON bereits auf den echten Kalendertag gerollt (z.B. Timmy Trumpet Fr-Nacht -> 2026-07-25 00:00). Beim Rendern nicht erneut verschieben.

Dieses JSON ist gleichzeitig die Datenquelle fuer die Warnungen (Abschnitt 6).

---

## 6. Feature: Warnungen (Phase 4)

Drei Typen. Alle brauchen die Set-Zeiten aus dem Timetable-JSON und eine saubere Festival-Tag-Zeitrechnung (ueber Mitternacht).

1. **Fehlplanung.** Rueckfahrt liegt vor Set-Ende des Artists, ODER Ankunft (Fahrtzeit plus Fahrtdauer) liegt nach Set-Start. Rot.
2. **Knapp.** Ankunftspuffer unter 15 Min vor Set-Start, ODER Wendezeit zwischen zwei Fahrten desselben Fahrers zu eng. Gelb.
3. **Verspaetungs-Risiko (live).** Laufende Fahrt zieht sich, oder Fahrer ist zur faelligen Zeit noch nicht los -> naechste Zusage gefaehrdet. Gelb/Rot je nach Naehe.

**Wichtiger Hinweis zur Artist-Verknuepfung:** Namen in der Pickup-Liste und im Timetable stimmen nicht immer exakt ueberein (b2b-Sets, mehrere Sets pro Artist, Kurznamen wie "GaG" fuer "Gestoert aber Geil"). Die Verknuepfung braucht: normalisierten Namensvergleich, Beruecksichtigung mehrerer Sets pro Artist, und den korrekten Festival-Tag. Rote oder kritische Warnungen (Typ 1 und 2 oben) duerfen NUR bei eindeutigem Artist-und-Set-Match erzeugt werden. Bei uneindeutiger Zuordnung erscheint stattdessen ein neutraler Hinweis "Timetable-Zuordnung pruefen" statt einer roten/gelben Warnung, keine reine Stille mehr: eine ungeklaerte Zuordnung soll auffallen, aber nicht als Fehlalarm rot aufleuchten. Ein grober Minuten-Vergleich ohne Tagesgrenze produziert Falschmeldungen bei Nacht-Sets, das unbedingt vermeiden.

---

## 7. Feature: Wartefahrten (Phase 5)

Ausnahme vom Rueckfahr-Pool: bei Soundcheck, Visual-Check, Programming, Interview bleibt der Fahrer vor Ort und macht die Rueckfahrt selbst.

Erkennung: Hinfahrt und Rueckfahrt desselben Artists innerhalb eines kurzen Fensters (unter ca. 2,5 Std) werden als **moeglicher** Paar-Kandidat erkannt. Zusaetzlich: Donnerstagnacht generell als Wartefahrt-Verdachtsfall (spaete Sets).

**Korrektur: Keine automatische Erzeugung oder Bestaetigung allein aufgrund der Heuristik.** Die Zeitfenster-Heuristik erzeugt NUR einen sichtbaren Hinweis an der betroffenen Fahrt ("Moegliche Wartefahrt pruefen"). Erst wenn die Leitstelle das ausdruecklich bestaetigt, wird das Paar tatsaechlich aus dem Rueckfahr-Pool genommen und der Fahrer gebunden. Ohne Bestaetigung bleibt die Rueckfahrt regulaer im Pool und wird ganz normal ueber den Vorschlag-Knopf behandelt.

Achtung: Die aktuelle Pickup-Liste labelt Wartefahrten nur in 2 Faellen im Freitext (Blasterjaxx "Return after soundcheck", Felix Jaehn "Interview"). Auf Freitext ist kein Verlass. Die App braucht ein explizites Flag pro Fahrt-Paar, gesetzt entweder durch die Zeitfenster-Heuristik oder manuell durch die Leitstelle.

**Offener Freigabepunkt (Entscheidung diese Runde: noch nicht festgelegt).** Ein Flag pro Fahrt-Paar ist ein neues persistentes Feld (siehe Regel 7/8 in Abschnitt 0) und darf nach den Absoluten Regeln nicht einfach erfunden werden. Feldname, Speicherort (auf welcher/welchen der beiden Fahrten des Paares) und ob es in `rides[]` oder separat liegt, werden NICHT jetzt in der Spec festgelegt, sondern erst beim Einlesen von `ShuttleLeitstelle.jsx` zu Beginn von Phase 5 vorgeschlagen und von der Leitstelle ausdruecklich freigegeben, bevor Code entsteht.

---

## 8. Datendateien

- `timetable_openbeatz.json` — 229 Sets, Festival-Tag-korrekt. Quelle fuer Timetable-Rubrik und Warnungen.
- `drivers_openbeatz.json` — 23 Fahrer mit Rolle, Fahrzeug, Verfuegbarkeit.

Beide ins Repo legen (Vorschlag: `/docs` oder wo die App Assets laedt).

---

## 9. Offene Beobachtungspunkte (nicht bauen, nur im Blick behalten)

- **Van-Kapazitaet:** 7 Vans (korrigiert, siehe 11.2). Bei vielen gleichzeitigen 5+-pax-Gruppen im Peak koennte es eng werden, konkret Freitagnacht ca. 22:45-01:00 (3 Timmy-Vans fest gebunden, Rest-Puffer im Peak nur 1 freier Van). Der Fahrzeugtyp-Filter macht das sichtbar; falls der Knopf oft keinen freien Van findet, ist das das Signal. Siehe auch Abschnitt 12 (Vorrangregel bei Van-Knappheit).
- **Standby-Zonen-Default:** die 17:00-Umschaltung (tagsueber Hotel, abends Venue) ist eine Vereinfachung. Falls im Betrieb zu grob, spaeter ein optionales Fahrer-Status-Flag (verfuegbar/Pause) nachruesten, rein additiv.
- **Peak-Lage:** realistisch 18 bis 19 Fahrer gleichzeitig an Sa/So im Abend- und Nacht-Peak. Bei 20 bis 21 regulaeren Fahrern plus 2 Springern knapp, aber mit Buendelung tragbar.

---

## 10. Nachtrag: Standby-Punkte, Leerfahrten, Zusammenlegen (ergaenzt nach Praxis-Ruecksprache)

### 10.1 Standby-Punkte (konkret)

- **Venue-Standby: Caldera (Mainstage).** Freie Fahrer sammeln sich abends dort. Sie stehen real etwas verstreut an den Buehnen, lassen sich aber schnell bewegen, deshalb genuegt Caldera als logischer Sammelpunkt fuer die Positionslogik.
- **Hotel-Standby: Sheraton.** Tagsueber Sammelpunkt der Hotel-Zone.
- Umschaltung grob 17:00: davor Schwerpunkt Hotel-Standby, danach Venue-Standby. Als Default fuer die "Standby-Zone eines Fahrers ohne bisherige Fahrt" (siehe Abschnitt 3, Position-Score).

### 10.2 Leerfahrten / Rueckstellung (in den Rueckfahr-Lebenszyklus einbauen)

Rueckfahrten zeigen fast immer vom Venue weg. Nach Ankunft am Hotel steht der Fahrer dort, wo abends kaum Bedarf ist, und muss leer zum Venue-Standby zurueck. Das ist der Normalfall, nicht die Ausnahme. Regeln:

1. **"Bereit erst nach Standby-Rueckkehr".** Ein Fahrer zaehlt fuer den Vorschlag-Knopf erst wieder als verfuegbar, wenn er zurueck am Standby ist, nicht schon bei Ankunft am Hotel. Sein "frei ab" = Ankunft Ziel + Leerfahrt zurueck zum aktiven Standby. Sonst schlaegt der Knopf Fahrer vor, die noch 40 Min Leerfahrt vor sich haben.
2. **Rueckstellung ist in v1 rein virtuell, KEIN neuer Ride-Datensatz.** Wenn die Leitstelle eine Rueckfahrt bestaetigt, wird die Rueckstellung zum Standby NUR:
   - virtuell in der Verfuegbarkeitsberechnung beruecksichtigt (fliesst in "frei ab" aus Punkt 1 ein),
   - als Hinweis fuer Leitstelle oder Fahrer angezeigt ("dann zurueck zum Standby Caldera"),
   - zur Berechnung des naechsten moeglichen Einsatzzeitpunkts genutzt.
   Es wird in v1 KEINE zusaetzliche "Folge-Anweisung" oder Rueckstellungsfahrt als eigener Datensatz in `rides[]` erzeugt. Ein echter, vom Fahrer abhakbarer Datensatz waere ein neues Feature mit eigenem Datenmodell-Bedarf und muesste separat zur Freigabe vorgelegt werden, nicht Teil von v1.
3. **Erst Verkettung pruefen, dann leer schicken.** Bevor die Rueckstellung als Leerfahrt rausgeht, prueft die App, ob am Zielort (oder auf dem Weg) eine Anschlussaufgabe ansteht: ein faelliger Pickup am selben Hotel, oder eine weitere Rueckfahrt in dieselbe Richtung. Wenn ja, verketten statt leer fahren. Das ist der eigentliche Effizienzhebel.
4. **Kein proaktives Repositioning in v1.** Die App schickt NICHT von sich aus Fahrer leer irgendwohin, weil sie einen kuenftigen Mangel vermutet. Nur reaktive Rueckstellung plus Verkettung. Proaktives Vorpositionieren ist spaeter, wenn ueberhaupt.

### 10.3 Rueckfahrten zusammenlegen (v1: nur Analyse und Vorschlag, kein echtes Zusammenfuehren)

**Korrektur: In v1 duerfen vorhandene Ride-Datensaetze NICHT automatisch zusammengefuehrt, geloescht oder in einen neuen Sammelfahrt-Datensatz umgewandelt werden.** Das war in der vorherigen Fassung nicht klar genug getrennt. Wie eine bestaetigte Zusammenlegung sauber ueber den bestehenden Assign-Pfad abgebildet werden kann, ohne neue Datensaetze zu erzeugen oder bestehende zu loeschen, ist technisch noch nicht geklaert und wird NICHT in v1 gebaut, sondern separat entworfen und freigegeben, sobald es so weit ist.

Fuer v1 gilt nur:

1. **Manuell (Analyse-Ebene):** Die Leitstelle kann zwei oder mehr offene Rueckfahrten markieren, die zusammen fahren koennten (gleiche oder nahe Zielzone, Sitze reichen). Das ist in v1 eine reine Anzeige/Markierung, keine Datenmutation.
2. **Vorgeschlagen (Analyse-Ebene):** Die App erkennt automatisch zusammenlegbare Rueckfahrten (gleiche Zielzone, Startzeiten nah beieinander, kombinierte Personenzahl passt in ein Fahrzeug) und zeigt sie als Vorschlag "Diese 2-3 Rueckfahrten koennten zusammen fahren". Das ist in v1 ebenfalls nur eine Anzeige, keine Ausfuehrung.

Die tatsaechliche Zuteilung bleibt in v1 pro einzelner Fahrt ueber den normalen Vorschlag-Knopf/Assign-Pfad, die Leitstelle spricht die Artists vor Ort an und teilt jede Fahrt einzeln zu (z. B. alle auf denselben Fahrer). Das eigentliche "zu einem Datensatz verschmelzen" ist explizit NICHT Teil von v1.

Kriterien fuer den Auto-Vorschlag (Startwerte, editierbar): gleiche Zielzone, Startzeit-Differenz unter 20 Min, kombinierte Personenzahl <= Fahrzeugsitze (siehe 2.2, fahrzeugspezifisch). Der Vorschlag ist unverbindlich und aendert nichts.

### 10.4 Bau-Reihenfolge Ergaenzung

Diese Punkte reihen sich hinter den bestehenden Phasen ein:
- Standby-Punkte (10.1): fliesst in Phase 1 (Positionslogik) mit ein, kein eigener Schritt.
- Leerfahrt-Rueckstellung (10.2): direkt nach Phase 2 (Vorschlag-Knopf), rein virtuell/Hinweis, kein neuer Datensatz (siehe Korrektur oben).
- Zusammenlegen (10.3): eigene kleine Phase nach den Warnungen, vor der Wartefahrt-Paarung. Scope in v1 nur Erkennung/Anzeige (Analyse-Ebene), das echte Zusammenfuehren von Datensaetzen ist explizit ausgeklammert und braucht eine eigene, spaetere Freigabe.

---

## 11. Nachtrag: Van-Restkapazitaet nutzen (ergaenzt nach Kapazitaets-Analyse)

### 11.1 Hintergrund

Van-Fahrten (5+ Personen-Gruppen, Timmy-Konvoi) haben im Schnitt ca. 2,8 freie Sitze pro Fahrt (Analyse ueber 51 Van-Hinfahrten: 0 bis 6 frei, abhaengig vom Fahrzeug — reale Kapazitaet pro Van ist NICHT einheitlich 7, siehe 11.2). Diese freien Sitze lohnen sich nur, wenn zeitgleich ein Auto-Kandidat auf derselben Strecke faellig ist — die pure Restkapazitaet allein spart nichts, es braucht einen echten Treffer.

### 11.2 Van-Kapazitaeten sind fahrzeugspezifisch, NICHT pauschal

Reale Sitzzahlen pro Van (Passagiere, Fahrer ausgeschlossen), Stand dieser Analyse:
```
Patrick Ibrahimi:      7 Sitze
Mustafa Ünver:          7 Sitze
Lukas Bieber:           6 Sitze
Amar Piljevic:          6 Sitze
Finn Steinmetz:         6 Sitze
Björn Korn:             6 Sitze
Maximilian Schneider:   6 Sitze
```
Die App darf NICHT pauschal "Van = 7 Sitze" annehmen. Die Sitzzahl ist ein Attribut des jeweiligen Fahrzeugs/Fahrers in `drivers_openbeatz.json` (Feld `seats`) und muss bei jeder Kapazitaetspruefung (Vorschlag-Knopf, Zusammenlegen, Warnungen) am konkreten Fahrer abgelesen werden, nicht angenommen werden.

### 11.3 Erweiterung des Vorschlag-Knopfs / Zusammenlegen-Features (Abschnitt 10.3)

Bei einer kleinen faelligen Fahrt (Hin- oder Rueckfahrt, Gruppengroesse klein genug fuers Auto) prueft die App zusaetzlich zu anderen Autos auch:

**Gibt es einen bereits fahrenden oder geplanten Van auf derselben Strecke (gleiche Zone-zu-Zone-Verbindung), dessen Startzeit innerhalb von ca. 20 Minuten liegt, und dessen freie Kapazitaet (`seats des Van-Fahrers` minus `aktuell zugewiesene Personen`) die neue Gruppe aufnehmen kann?**

Wenn ja: dieser Van erscheint als zusaetzliche Option im Vorschlag/Zusammenlegen-Vorschlag ("X könnte im Van von [Fahrer] mitfahren, noch Y Plaetze frei"). Wie bei jeder Zusammenlegung ist das ein Vorschlag, keine automatische Zuteilung — die Leitstelle bestaetigt, ggf. nach Rueckfrage beim Artist.

### 11.4 Einordnung (aus der Analyse)

Bei strikter Anwendung des bestehenden Buendelungs-Kriteriums (gleiche Strecke, <=20 Min Zeitfenster) lassen sich nur wenige Auto-Fahrten pro Tag sinnvoll in Van-Restplaetze ziehen (in der Analyse: 0-2 pro Tag, 6 insgesamt über 4 Tage von 98 Auto-Einheiten). Das ist kein Ersatz fuer eine eigene Optimierungsroutine, sondern ein einfacher Zusatz-Check im ohnehin vorhandenen Zusammenlegen-Vorschlag. Erwarteter Nutzen: klein, aber ohne Zusatzkosten, da derselbe Mechanismus wie 10.3 verwendet wird, nur mit Vans als zusaetzlichem Ziel-Pool statt nur andere Autos.

---

## 12. Nachtrag: Vorrangregel fuer echte 5+-Personen-Fahrten bei Van-Knappheit

### 12.1 Hintergrund

Vans sind das knappe Gut (7 insgesamt, siehe 11.2; im Peak Freitagnacht ca. 22:45-01:00 nur 1 freier Puffer-Van, weil 3 Vans fest im Timmy-Konvoi stehen). Die bestehende Grundregel trennt zwar schon "Car-Komfortlimit 3" von "Van-Buendelung nur fuer echte 5+-Gruppen" (Abschnitt 0/Grundentscheidungen), das reicht aber nicht automatisch aus: auch reine 5+-Kombinationen aus dem Zusammenlegen-Feature (10.3) oder der Van-Restkapazitaets-Nutzung (11) koennen in einer Van-knappen Phase einen Van binden, der kurz danach fuer eine **echte** Artist-Gruppe (5, 6 oder 7 Personen, die laut Hartfilter Abschnitt 3 Punkt 4 zwingend einen Van braucht und sich nicht auf Cars aufteilen laesst) fehlt.

**Kernregel:** Eine echte Fahrt mit mehr als 4 Personen hat bei der Van-Zuteilung IMMER Vorrang vor einer zusammengelegten/kombinierten Fahrt, die einen Van nur aus Komfort- oder Buendelungs-Gruenden belegt (also einer Kombination, deren einzelne Teile grundsaetzlich auch mit Cars fahrbar waeren). Eine Zusammenlegung darf niemals dazu fuehren, dass eine tatsaechlich van-pflichtige Gruppe deswegen nicht stattfinden kann.

### 12.2 Umsetzung im Vorschlag-Knopf / Zusammenlegen (10.3) / Van-Restkapazitaet (11)

1. **Van-Reserve-Check vor jeder Komfort-Zusammenlegung.** Bevor eine Zusammenlegung vorgeschlagen wird, die selbst einen Van benoetigen wuerde (kombinierte Personenzahl > 4, aber aus Fahrten entstanden, die einzeln auch Cars waeren), prueft die App die freien Vans im relevanten Zeitfenster. Ist die Reserve knapp (Schwellwert vorerst: <= 1 freier Van im Fenster), wird die Zusammenlegung NICHT automatisch als Standard-Vorschlag angezeigt, sondern mit Warnhinweis ("Van-Reserve knapp, blockiert ggf. eine echte 5+-Fahrt") versehen. Die Leitstelle entscheidet dann bewusst statt dass die App das unkommentiert vorschlaegt.
2. **Echte 5+-Fahrt sticht Komfort-Kombi.** Ist eine echte 5+-Personen-Fahrt bereits faellig oder absehbar faellig (z. B. laut Timetable in Kuerze), und ein Van waere durch eine reine Komfort-Zusammenlegung gebunden, bekommt die echte Fahrt im Vorschlag-Knopf Vorrang: ihr wird zuerst ein freier Van zugeteilt, die Komfort-Zusammenlegung wird zurueckgestellt oder falls moeglich auf Cars aufgeteilt.
3. **Van-Restkapazitaet (Abschnitt 11) nur wenn's die Van-Reserve nicht gefaehrdet.** Bevor Auto-Fahrgaeste in die Restplaetze eines fahrenden Vans gezogen werden, kurz gegenpruefen, ob dieser Van dadurch verspaetet zum Standby zurueckkommt (siehe 10.2, "frei ab") und dadurch fuer eine absehbare naechste 5+-Fahrt fehlen wuerde. Im Zweifel: Restkapazitaet-Vorschlag unterlassen.
4. **Offene Frage fuer die Bau-Phase:** wie "absehbar faellige 5+-Fahrt" technisch erkannt wird (z. B. ueber die geschaetzten Rueckfahrzeiten aus der Timetable-Kopplung, Abschnitt 6) ist hier noch nicht spezifiziert und muss beim Bau von Phase 2/10.3 konkretisiert werden, nicht geraten.

Diese Regel aendert die Grundentscheidung "Komfortlimit 3 / Van-Buendelung fuer echte 5+-Gruppen reserviert" nicht, sie erzwingt sie nur zusaetzlich bei Ressourcen-Konflikten zur Laufzeit.

---

## 13. Nachtrag: "Set beendet"-Hinweis in der Rueckfahrt-Liste (noise-arm, nach Ruecksprache)

### 13.1 Hintergrund

Nicht jeder Artist will sofort nach Set-Ende zurueckgefahren werden, das ist der Normalfall, nicht die Ausnahme (genau deswegen laufen Rueckfahrten live/manuell statt automatisiert, siehe Praezisierung in Abschnitt 4). Bisher offen war: wie merkt die Leitstelle ueberhaupt, dass ein Set mit offener Rueckfahrt zu Ende ist, ohne alle 229 Timetable-Sets anzuzeigen oder mit Popups zu nerven.

### 13.2 Loesung (Entscheidung: stiller Hinweis, kein Popup)

- Direkt an der betroffenen Rueckfahrt in der bestehenden Rueckfahrt-Liste (Abschnitt 4) erscheint ein kleines, stilles Badge/Label "Set beendet", sobald das zugehoerige Set laut Timetable-JSON (Abschnitt 5) vorbei ist.
- KEIN Popup, KEIN Toast, KEINE Benachrichtigung. Faellt nur auf, wenn die Leitstelle die Liste ohnehin ansieht.
- Betrifft ausschliesslich Rueckfahrten, die bereits in `rides[]` existieren (also nur tatsaechlich auf der Shuttle-Liste stehende Artists), NICHT alle Sets der Timetable.
- Nutzt dieselbe Artist-Verknuepfungslogik wie die Warnungen (Abschnitt 6): normalisierter Namensvergleich, mehrere Sets pro Artist, korrekter Festival-Tag. Bei uneindeutigem Match: KEIN Badge, still weglassen statt zu raten, keine zweite Matching-Logik extra bauen.
- Das Badge aendert nichts am Status. Die Rueckfahrt bleibt "geplant", bis die Leitstelle sie manuell auf "faellig" setzt (siehe Abschnitt 4). Reine Zusatzinfo, kein Trigger, keine Datenmutation (Regel 9, Abschnitt 0).

### 13.3 Bau-Einordnung

Braucht Timetable-Daten (Phase 3) und dieselbe Matching-Logik wie die Warnungen (Phase 4). Sinnvoll direkt nach Phase 4 als kleine Ergaenzung zur Rueckfahrt-Liste aus Phase 2, sobald beide Voraussetzungen stehen. Kein eigener Status, keine neuen Felder, reine Anzeige.
