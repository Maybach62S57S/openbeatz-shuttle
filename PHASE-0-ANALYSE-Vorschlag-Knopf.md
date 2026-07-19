# Phase 0: Analyse zum Vorschlag-Knopf (SHUTTLE-VORSCHLAG-SPEC)

Rein lesende Analyse, kein produktiver Code geaendert. Grundlage: `src/ShuttleLeitstelle.jsx`
(9076 Zeilen), `timetable_openbeatz.json`, sowie die Anweisung `SHUTTLE-VORSCHLAG-SPEC_1.md`.
Stand: 19.07.2026, main = fa2fb95.

Alle Zeilennummern sind vom Analysetag und koennen sich verschieben. Immer per Suche gegenpruefen.

---

## Der wichtigste Befund vorab

**Der Kern des Auftrags existiert schon und laeuft live.** Die App hat bereits einen
lesenden, reisezeit-bewussten Fahrervorschlag mit Rangliste und Begruendung. Betroffene
Funktionen:

- `computeDriverStats` (Z. 1480): Fahrten, Fahrminuten, aktiv/fertig, "frei ab", aktuelle Position pro Fahrer.
- `evaluateInsertion` (Z. 1517): reine Pruefung eines Fahrers gegen eine Fahrt. Sitzplatzcheck (`driver.seats >= need`), Zeitkonflikt per Intervallpruefung (`T < e && end > s`), Anfahrt zur Abholung, Folgefahrt-Enge, unbekannte Zeiten, offene Problemmeldung. Liefert `feasible` plus Klartext-Gruende in `problems[]`.
- `suggestDrivers` (Z. 1573): bewertet und sortiert alle Fahrer, filtert Ungeeignete raus.
- `reasonText` (Z. 1590): baut die sichtbare Begruendung ("X Sitze", "ca. Y min zum Pickup", "passt gut", Warnungen).

Diese Funktionen sind bereits im UI verdrahtet:

- `AssignModal` nutzt `suggestDrivers` (Z. 3764) und zeigt die Vorschlaege mit `reasonText` (Z. 3834).
- Die Rueckfahr-Ansicht zeigt `suggestDrivers(...).slice(0, 3)`, also die Top 3 (Z. 5732).
- Die Timeline-Schnellzuteilung nutzt `evaluateInsertion` (Z. 6160).

Es gibt ausserdem eine echte **Fahrzeit-Matrix** (`setup.matrix` plus `travelMin`, Z. 670),
die pro Setup in Supabase liegt (Z. 134, 194). Die Spec nimmt an, es gebe keine Fahrzeiten.

**Folge:** Ein Neubau des Vorschlag-Motors waere eine Duplizierung bestehender Funktionen
und verstiesse gegen die Absoluten Regeln der Spec selbst (rein additiv, keine Duplizierung).
Der richtige Weg ist nicht bauen, sondern den vorhandenen Motor gezielt erweitern, und zwar
nur um die Teile, die wirklich neu sind (Springer, available_from, Zonen-Aliasse, Timetable,
Warnungen, Wartefahrten).

---

## A. Ist-Zustand

Eine React-Einzeldatei rendert vier Oberflaechen aus derselben Datenbasis: Leitstelle (dispo),
Fahrer-App (driver), Stage-App (stage), Gast-Ansicht (guest). Die Rolle steckt in
`session.role` (Z. 739), nicht in einem Fahrer-Attribut.

Datenwege:

- **Setup-Daten** (`setup`): Fahrer, Orte, Fahrzeit-Matrix, Config, Dispatcher. Kommen aus Supabase (Z. 130 folgende).
- **Dynamische Daten** (`dyn`): die Fahrten (`dyn.rides`). Aenderungen laufen ueber `updateDyn(...)`, das den neuen Stand persistiert und via Realtime verteilt.
- **Audit-Log**: jede Fahrt hat `r.log[]`, gefuellt ueber `logRide(r, event, by, detail)` (Z. 679).

Feste Orte sind genau vier (Z. 479 bis 482): `airport` (Flughafen Nuernberg), `moevenpick`,
`sheraton`, `festival`. Das deckt sich mit "4 feste Orte" aus der Projektbeschreibung.

## B. Verifizierte Datenstrukturen

### B.1 Fahrt (`rides[]`), tatsaechlich genutzte Felder

Ermittelt aus allen `r.<feld>`-Zugriffen im Code (haeufigste zuerst):

| Feld | Bedeutung | Typ / Beispiel |
|---|---|---|
| `id` | eindeutige Fahrt-ID | String |
| `status` | Status | siehe B.3 |
| `time` | geplante Uhrzeit | "HH:MM"-String |
| `date` | Kalendertag der Fahrt | "YYYY-MM-DD" |
| `dayKey` | Festival-Tag-Schluessel | String |
| `assignedDriverId` | zugeteilter Fahrer (oder leer) | Fahrer-`id` oder null |
| `fromId` / `toId` | Start / Ziel (Verweis auf die 4 festen Orte) | Orts-`id` |
| `fromCustom` / `toCustom` | freier Ortstext, wenn kein fester Ort | String |
| `zone` | Festivalzone (bei Ziel `festival`) | String, z. B. "Caldera" |
| `passengerCount` | Personenzahl | Zahl |
| `passengers` | Namen/Kontakte als Freitext | String |
| `estDurationMin` | geschaetzte Fahrtdauer | Zahl oder null |
| `scheduledArrival` / `estimatedArrival` / `actualArrival` | Ankunftszeiten | |
| `flightNo` / `flightStatus` / `airline` / `terminal` | Flugdaten (Inbound) | |
| `meetingPoint` | Treffpunkt | String |
| `notes` | Notiz | String |
| `type` | Fahrttyp | String |
| `onDemand` | Merkmal | Bool |
| `issues[]` | Problemmeldungen | Array |
| `log[]` / `statusHistory` | Audit-Verlauf | Array |
| `updatedAt` | letzte Aenderung | Zeitstempel (ms) |

Es gibt **kein** eigenes Feld fuer "Rueckfahrt vs. Hinfahrt" mit eindeutigem Typ und
**kein** Feld "geschaetzt vs. fest". Richtung ergibt sich aus `fromId`/`toId` (Start `festival`
= Rueckfahrt). Das ist der Punkt aus Spec-Abschnitt 4: eine eindeutige Kennzeichnung
"geplant/fest vs. geschaetzt" existiert im Datenmodell nicht.

Anonymisiertes Beispielobjekt (aus der Struktur zusammengesetzt, keine echten Gastdaten):

```
{
  id: "r_ab12cd",
  status: "planned",
  time: "15:00",
  date: "2026-07-24",
  dayKey: "2026-07-24",
  fromId: "airport",
  toId: "sheraton",
  toCustom: "",
  zone: "",
  passengerCount: 3,
  passengers: "Max Mustermann (+49...)",
  estDurationMin: 35,
  flightNo: "LH123",
  assignedDriverId: null,
  meetingPoint: "GAT",
  notes: "",
  log: [{ event: "created", at: 1690000000000, by: "dispo:...", detail: "" }],
  updatedAt: 1690000000000
}
```

### B.2 Fahrer (`setup.drivers[]`), tatsaechlich genutzte Felder

| Feld | Bedeutung |
|---|---|
| `id` | eindeutige Fahrer-ID |
| `firstName` / `lastName` | Name |
| `vehicleType` | "Van" oder "Car" (mit grossem Anfangsbuchstaben) |
| `seats` | Sitzplaetze, existiert bereits und wird schon fuer den Sitzcheck genutzt |
| `vehicleId` | Fahrzeug-Kennung |
| `plate` | Kennzeichen |
| `phone` | Telefon |
| `pin` | Login-PIN |
| `driverState` | abgeleiteter Zustand |
| `artistPresence` | Merkmal |
| `messages` | Nachrichten |

**Nicht vorhanden** (Suche ergab je 0 Treffer im relevanten Sinn):
`role` als Fahrer-Rolle, `springer`, `available_from`, `timmy_team`. Der Begriff `role`
kommt vor, aber ausschliesslich als Session-Rolle (driver/dispo/stage), nicht am Fahrer.

### B.3 Statuswerte

Kanonisch definiert in `STATUS_LABEL` (Z. 1888):

| technisch | sichtbar |
|---|---|
| `planned` | Geplant |
| `accepted` | Angenommen |
| `enroute_pickup` | Auf Anfahrt |
| `onboard` | Gast an Bord |
| `done` | Abgeschlossen |
| `cancelled` | Storniert |

Uebergaenge laufen ueber `setRideStatus` (schreibt `logRide(..., "status", ...)`).
`wouldResetLiveStatus` (Z. 1908) erzwingt eine Rueckfrage, wenn ein Fahrerwechsel einen
laufenden Status auf "Geplant" zuruecksetzen wuerde.

Die Begriffe `faellig` und `Vorschlag` existieren **nicht** als gespeicherter Status
(je 0 bzw. 1 Treffer, letzterer nur als Text). Damit ist der von der Spec gewuenschte
Weg (sechsstufige Anzeige rein abgeleitet, kein neues Feld) mit dem Datenmodell vereinbar.

### B.4 Zeitfelder und Zeitmodell

- Fahrten speichern `time` als "HH:MM" und `date` als "YYYY-MM-DD", plus `dayKey`.
- `dateForNightTime(dayKey, time)` (Z. 6048) rollt Fahrten nach Mitternacht auf den echten Kalendertag.
- `parseTime`/`parseDate` (Z. 7666 folgende) setzen bewusst **keine** stillen Standardwerte (Kommentar: "nicht still auf 12:00 setzen").
- **Kein** ISO-Zeitstempel mit Zeitzone, **kein** Vorkommen von `Europe/Berlin`. Die App rechnet ueber lokale Uhrzeit-Strings und die Browser-Zeit.

### B.5 Orte und Zonen

`matchLoc(txt)` (Z. 7649) ist auf genau vier Orte fest verdrahtet: sheraton, moevenpick,
airport, festival. Alles andere faellt auf `__custom`. Karl August, Leonardo, City-Center,
InterCity, HBF und Muenchen werden **nicht** als eigene Zonen erkannt. Positionierung im
vorhandenen Motor laeuft ueber `toId` der letzten Fahrt plus die Fahrzeit-Matrix, nicht ueber
ein Zonen-Alias-Mapping.

### B.6 Vorhandene Vorschlags- und Hilfsfunktionen

`computeDriverStats`, `evaluateInsertion`, `suggestDrivers`, `reasonText`, `travelMin`,
`effDur`, `logRide`, `setRideStatus`, `wouldResetLiveStatus`, `dateForNightTime`,
`matchLoc`. Siehe Kopfteil dieses Berichts.

## C. Widersprueche zur Spezifikation

**Widerspruch 1: Vorschlag-Motor existiert bereits.**
Spezifikation: baue einen lesenden Vorschlag-Knopf (Phase 1/2).
Tatsaechlicher Code: `suggestDrivers`/`evaluateInsertion`/`reasonText` existieren, sind rein
lesend und laufen live im AssignModal und in der Rueckfahr-Ansicht.
Risiko: hoch (Duplizierung, zwei konkurrierende Vorschlagslogiken).
Empfohlene Korrektur: nicht neu bauen, den vorhandenen Motor erweitern.

**Widerspruch 2: Fahrzeiten "nicht vorhanden".**
Spezifikation: keine Fahrzeiten vorhanden, nicht erfinden, sonst keine sichere Verfuegbarkeitspruefung.
Tatsaechlicher Code: `setup.matrix` plus `travelMin` liefern Fahrzeiten zwischen Orten,
werden bereits fuer Anfahrt und Folgefahrt genutzt.
Risiko: mittel (Doppelmodell, wenn die Spec parallel eigene Fahrzeiten einfuehrt).
Empfohlene Korrektur: die vorhandene Matrix nutzen. Nur pruefen, ob sie mit echten Werten gefuellt ist.

**Widerspruch 3: Sitzplaetze nie pauschal.**
Spezifikation: `seats` immer aus dem konkreten Feld, nie pauschal Van=7/Car=4.
Tatsaechlicher Code: Sitzcheck nutzt bereits `driver.seats` (gut), ABER beim Anlegen eines
Fahrers wird `seats: type === "Van" ? 7 : 4` als Default gesetzt (Z. 464). Die realen Werte
der Spec (5 Vans mit 6, 2 Vans mit 7) widersprechen dem Default "alle Vans 7".
Risiko: mittel (zu grosse Van-Kapazitaet angenommen, Ueberbuchung moeglich).
Empfohlene Korrektur: echte Sitzzahlen pro Fahrzeug pflegen, Default nicht als Wahrheit behandeln.

**Widerspruch 4: genau ein Assign-Pfad.**
Spezifikation: Bestaetigen nutzt ausschliesslich den einen bestehenden Assign-Pfad.
Tatsaechlicher Code: mindestens drei Schreibwege setzen `assignedDriverId`:
das AssignModal (`onAssign`, Z. 8447), die Timeline-Schnellzuteilung (`quickAssign`, Z. 6162)
und der Chat-Assistent (Z. 3567). `quickAssign` und der Chat-Weg laufen **nicht** durch `onAssign`.
Risiko: mittel (welcher Weg ist der kanonische, an den ein neuer Knopf andockt).
Empfohlene Korrektur: den AssignModal-Weg als kanonisch festlegen und darauf verweisen.

**Widerspruch 5: Zeitzone Europe/Berlin, ISO-Zeitstempel.**
Spezifikation: alle internen Zeiten als ISO mit Europe/Berlin.
Tatsaechlicher Code: lokale "HH:MM"/"YYYY-MM-DD"-Strings, `dateForNightTime` fuer Mitternacht,
keine Zeitzone hinterlegt.
Risiko: mittel (Nacht-Sets, Vergleich Timetable gegen Fahrtzeiten).
Empfohlene Korrektur: die Regel der Spec beugt sich hier dem Bestand. Bestehende Zeitlogik
weiter nutzen, nicht ISO/TZ blind darueberstuelpen. Beim Vergleich mit der Timetable den
Festival-Tag konsequent ueber `dateForNightTime` bilden.

**Widerspruch 6: keine stillen Default-Werte.**
Spezifikation: fehlende Personenzahl nie still durch Standard ersetzen, stattdessen Ausschlussgrund.
Tatsaechlicher Code: `ride.passengerCount || 1` an Z. 1519 und Z. 3897 setzt bei fehlender
Zahl still auf 1.
Risiko: niedrig bis mittel (Sitzcheck koennte zu grosszuegig sein).
Empfohlene Korrektur: bei fehlender Personenzahl sichtbaren Hinweis statt Annahme 1.

**Widerspruch 7: Springer, available_from, timmy_team.**
Spezifikation: zweistufige Springer-Logik, Verfuegbar-ab, Timmy-Team.
Tatsaechlicher Code: keines dieser Konzepte existiert im Datenmodell.
Risiko: mittel (echtes neues Datenmodell noetig, kein reines Ableiten).
Empfohlene Korrektur: additive Felder, aber erst nach Freigabe und Fahrerdatei.

**Widerspruch 8: Zonen-Alias-Positionierung.**
Spezifikation: Position ueber Zonen-Aliasse (Karl August, Leonardo, HBF, MUC eigenstaendig).
Tatsaechlicher Code: `matchLoc` kennt nur 4 Orte, Rest `__custom`. Position ueber `toId` plus Matrix.
Risiko: mittel (viele echte Orte landen als "unbekannt").
Empfohlene Korrektur: `zoneOf` additiv daneben stellen, `matchLoc` nicht anfassen (deckt sich mit Spec-Regel 4).

**Widerspruch 9: Fahrerdatei als Quelle der Wahrheit.**
Spezifikation: `drivers_openbeatz.json` liefert Rollen, Sitze, Springer, Verfuegbarkeit.
Tatsaechlicher Zustand: die Datei existiert nirgends auf dem Rechner. Nur `timetable_openbeatz.json` ist da.
Risiko: kritisch (ohne Datei kein Abgleich, kein Springer, keine echten Sitzzahlen).
Empfohlene Korrektur: Datei beschaffen, bevor irgendetwas an Fahrer-Rollen/Sitzen gebaut wird.

## D. Umsetzbarkeit ohne Datenmodellaenderung

1. **Sofort rein lesend umsetzbar (existiert bereits):** Fahrervorschlag mit Rangliste,
   Sitzcheck, Zeitkonflikt, Anfahrt, Folgefahrt, Begruendung. Bestaetigung ueber bestehenden Assign-Pfad.
2. **Mit kleiner additiver Aenderung umsetzbar:** Timetable-Rubrik (Phase 3, reine Anzeige des JSON);
   sechsstufige Rueckfahr-Anzeige als abgeleitete UI-Ebene; Zonen-Alias-Funktion `zoneOf` neben `matchLoc`;
   "Set beendet"-Badge und Warnungen als reine Anzeige (brauchen aber die Timetable-Verknuepfung).
3. **Benoetigt Datenmodellaenderung (Freigabe noetig):** Springer-Rolle, `available_from`,
   `timmy_team`, ein Wartefahrt-Flag pro Fahrt-Paar, echte fahrzeugspezifische Sitzzahlen.
4. **Derzeit nicht zuverlaessig umsetzbar:** alles, was die fehlende `drivers_openbeatz.json`
   braucht (Fahrer-Abgleich, Springer, reale Sitzzahlen); belastbare Warnungen ohne verifizierte Matrix-Werte.
5. **Benoetigt weitere fachliche Festlegung:** Unterscheidung "geplant/fest vs. geschaetzt"
   (kein Feld vorhanden); Kriterium fuer "absehbar faellige 5+-Fahrt" (Spec-Abschnitt 12.4 offen);
   Zeitzonen-Haltung; welcher der drei Schreibwege kanonisch ist.

## E. Risikomatrix

| Risiko | Bewertung | Begruendung |
|---|---|---|
| falsche Fahrer-ID | kritisch | Fahrerdatei fehlt, kein gesicherter Abgleich moeglich |
| doppelte Zuweisung / zweiter Schreibpfad | mittel | drei Schreibwege, Vorschlag muss an genau einen andocken |
| Race Condition | mittel | `updatedAt`-Vergleich existiert (RideForm), aber nicht ueberall |
| falsche Sitzplatzberechnung | mittel | Default Van=7 widerspricht realen 6er-Vans |
| falsche Zeitberechnung | mittel | keine Zeitzone, Vergleich Timetable gegen Fahrten heikel |
| Fahrten ueber Mitternacht | niedrig bis mittel | `dateForNightTime` existiert, muss konsequent genutzt werden |
| unbekannte Orte | mittel | `matchLoc` kennt nur 4 Orte, viele echte Orte werden `__custom` |
| Springer verdraengt regulaeren Fahrer | derzeit nicht zutreffend | Springer-Konzept existiert noch nicht |
| Schreibvorgang beim blossen Vorschlag | niedrig | vorhandene Vorschlagsfunktionen sind rein lesend |
| Timetable-Fehlmatch | mittel | Namen weichen ab (b2b, Kurznamen), Nacht-Sets ohne Tagesgrenze gefaehrlich |
| fehlerhafte Sammelfahrt | mittel | in v1 nur Analyse geplant, kein Zusammenfuehren, Risiko damit begrenzt |
| Realtime-Inkonsistenz | mittel | mehrere Schreibwege plus Realtime-Verteilung |
| Duplizierung bestehender Funktionen | hoch | Neubau wuerde den vorhandenen Motor doppeln |

## F. Empfohlene Phase-1-Architektur (kleinstmoeglich, noch kein Code)

Nicht neu bauen. Der vorhandene lesende Motor (`suggestDrivers`/`evaluateInsertion`/`reasonText`)
ist die Basis. Die kleinstmoegliche sinnvolle Erweiterung, additiv und weiter rein lesend:

1. Eine additive `zoneOf(ortsname)`-Funktion neben `matchLoc`, die zusaetzliche Orte (Karl August,
   Leonardo, HBF, MUC) einer Zone zuordnet, mit sichtbarem Ausschluss bei Unklarheit. `matchLoc`
   bleibt unangetastet.
2. Optional Springer und `available_from` als additive Fahrer-Felder, erst nach Freigabe und
   nachdem die Fahrerdatei da ist. In `evaluateInsertion` als zusaetzlicher Filter (zwei Runden),
   ohne den bestehenden Score zu ersetzen.
3. Keine neuen gespeicherten Statuswerte. Die Rueckfahr-Stufen bleiben abgeleitete Anzeige.

Timetable, Warnungen und Wartefahrten (Spec-Phasen 3 bis 5) sind die eigentlich neue Arbeit
und bauen auf dem `timetable_openbeatz.json` auf.

## G. Offene Entscheidungen (nur, was die Dateien nicht beantworten)

1. Wo ist `drivers_openbeatz.json`? Ohne sie kein Fahrer-Abgleich, keine Springer, keine echten Sitzzahlen.
2. Zeitzonen-Haltung: bleibt es bei lokaler Browser-Zeit plus `dateForNightTime`, oder soll wirklich auf Europe/Berlin/ISO umgestellt werden? (Empfehlung: beim Bestand bleiben.)
3. Welcher der drei Schreibwege ist der kanonische Assign-Pfad, an den ein Knopf andockt? (Empfehlung: AssignModal `onAssign`.)
4. Unterscheidung "geplant/fest vs. geschaetzt": neues additives Feld noetig, oder reicht die Richtung (Start festival = Rueckfahrt)?
5. Sollen die realen fahrzeugspezifischen Sitzzahlen in die Fahrer-Stammdaten gepflegt werden (statt Default 7/4)?
6. `timmy_team`: Bedeutung ist ohne die Fahrerdatei nicht bestimmbar. Keine Logik ableiten, bis geklaert.

## H. Go- / No-Go-Empfehlung

**NO-GO fuer einen Neubau. GO MIT BEDINGUNGEN fuer eine spaetere, kleine Erweiterung.**

Begruendung:

- Der Kern (lesender Vorschlag mit Rangliste und Begruendung, Bestaetigung ueber bestehenden
  Assign-Pfad) existiert bereits und laeuft. Ihn neu zu bauen waere Duplizierung und verstiesse
  gegen die Absoluten Regeln der Spec.
- Die zentrale Datenquelle `drivers_openbeatz.json` fehlt. Damit sind Fahrer-Abgleich, Springer
  und reale Sitzzahlen nicht umsetzbar, ohne zu raten. Das verbietet die Spec ausdruecklich.
- Zeitpunkt: Festival in vier Tagen, Fahrertest laeuft. Ein Umbau am Vorschlag zwei Tage vor
  dem Test wuerde den Test entwerten und Risiko ohne Funktionsgewinn schaffen.

Bedingungen fuer eine spaetere GO (nach dem Festival):

1. `drivers_openbeatz.json` liegt vor und ist gegen die echten Fahrer-Datensaetze abgeglichen.
2. Entscheidung zur Zeitzone getroffen.
3. Kanonischer Assign-Pfad festgelegt.
4. Erweiterung baut auf dem vorhandenen Motor auf, ersetzt ihn nicht.
5. Springer/available_from/Wartefahrt-Flag nur als additive, freigegebene Felder.

Halt hier. Kein weiterer Schritt ohne ausdrueckliche Freigabe.
```
```

---

## Blockiert, weil die Fahrerdatei fehlt

Diese Unterpunkte der Anweisung konnten nicht mit echten Daten gefuellt werden:

- **0.5 Fahrer-Identifikation / Mapping-Tabelle** (externe ID gegen App-ID): Datei fehlt.
- **0.6 Fahrzeug- und Sitzplatzdaten** aus der externen Datei: nur der App-seitige Teil ist belegt (siehe B.2, Widerspruch 3).
- **0.11 Springerlogik**: kein Springer-Feld in der App, externe Datei fehlt.
- **0.12 timmy_team**: Feld existiert weder in der App, noch ist die externe Datei da. Bedeutung offen.

Sobald `drivers_openbeatz.json` vorliegt, koennen diese vier Punkte nachgezogen werden.
