# Teilpaket B - Ist-Analyse (Abschnitt 1 und 15), VOR der Implementierung

Ruecksetzpunkt: Tag `pre-teilpaket-B` = `030bc15` (Codestand identisch mit Teilpaket A
`72f1b5b`), `src/ShuttleLeitstelle.jsx` = 9261 Zeilen. Alle Zeilennummern hier frisch am
`030bc15`-Stand gemessen, verschieben sich mit jeder Aenderung.

Diese Datei dokumentiert nur den Ist-Zustand. Es wurde noch KEIN Code geaendert.

---

## 1. matchLoc (Z. 7833-7847)

```
function matchLoc(txt) {
  t = txt.toLowerCase()
  /sheraton/            -> { id: "sheraton" }
  /m(ö|oe|o)venpick/    -> { id: "moevenpick" }
  /(airport|flughafen).*(nürnberg|nuremberg) | ... | private jet gat/ -> { id: "airport" }
  /venue|caldera|zone|stonelands|forest|stage|woods|festival/ -> { id:"festival", zone }
  sonst                 -> { id: "__custom", custom: txt.trim() }
}
```

Real erkannte feste IDs: **nur 4** - `sheraton`, `moevenpick`, `airport`, `festival`.
Alles andere faellt auf `__custom`. Die Spec-Orte `karl_august`, `leonardo`, `airport_muc`,
`gat_nue`, `hbf_nue` existieren im Code NICHT und landen aktuell alle als `__custom` mit
`durMin = null` (unbekannte Fahrzeit).

Auffaellig: Der Airport-Regex enthaelt bereits `private jet gat` als Airport-Treffer. GAT
wird also heute als `airport` (Flughafen Nuernberg) verbucht, nicht getrennt. Das ist genau
der in der Spec (Abschnitt 6) beschriebene Konflikt "NUE-GAT darf nicht vorher schon durch
NUE als airport_nue erkannt werden" - hier in umgekehrter Auspraegung schon vorhanden.

Aufrufstellen von matchLoc: nur in `parseRow` (Z. 7913/7914), also ausschliesslich beim
**Excel-Import**. Danach lebt eine Fahrt nur noch ueber `fromId`/`toId`/`fromCustom`/
`toCustom`. matchLoc wird zur Laufzeit des Vorschlagsmotors NICHT mehr aufgerufen.

Auftragsgemaess: matchLoc zunaechst nicht ersetzen/umbauen.

---

## 2. travelMin / travel / Matrix (Z. 675-685)

```
travel(matrix, a, b):
  if !a || !b     -> null
  if a === b      -> { min: 0, km: 0 }
  return matrix["a|b"] || matrix["b|a"] || null     // SYMMETRISCH
travelMin(matrix, a, b) = travel(...) ? .min : null  // null bei unbekannt
```

Die Matrix wird **symmetrisch** behandelt (Hin- und Rueckrichtung teilen sich einen
Eintrag). Fehlende Verbindung -> `null`, wird NICHT als 0 behandelt. Deckt Spec-
Anforderung "fehlend != 0" bereits ab.

**Stiller Default an EINER Stelle:** `effDur(config, r)` (Z. 685) faellt bei
`estDurationMin == null` auf `config.minDurationMin ?? 20`. Das ist bewusst (Konfliktpruefung
soll nie mit 0 rechnen), aber es ist ein geschaetzter Wert. `effDur` betrifft nur die
DAUER der Fahrt selbst, nicht die Anfahrt. Anfahrt (`deadMin`) und Folgehop bleiben strikt
`null`-tolerant.

Matrix-Struktur: **feste-Orts-ID zu fester-Orts-ID**. Kein Zone-zu-Zone, kein Mischbetrieb.
Zonen (Caldera etc.) werden fuer die Matrix ueber `nodeMatrixLoc` auf `festival` gemappt
(nur Kartendarstellung, Z. 1824-1836).

Geseedete Kanten (`seedMatrix`, Z. 510-517), alle rund um die 4 bekannten Orte:

```
airport|moevenpick    3 min
airport|sheraton     18 min
airport|festival     30 min
moevenpick|sheraton  18 min
moevenpick|festival  30 min
sheraton|festival    33 min
```

Editierbar in Einstellungen (Z. 7615-7621, `setMatrix` schreibt `s.matrix["a|b"]`).

---

## 3. Matrix-Verbindungen aus Abschnitt 15, Ist-Stand

Vorhanden (v) / fehlt (X) im Seed. Live-DB kann abweichen (nur Jordan/Supabase kennt den
echten Stand), daher hier der Code-Seed als Referenz:

```
Sheraton     <-> Festival            v  (33 min)
Moevenpick   <-> Festival            v  (30 min)
Karl August  <-> Festival            X  (Ort existiert gar nicht)
Leonardo     <-> Festival            X  (Ort existiert gar nicht)
HBF Nuernberg<-> Festival            X  (Ort existiert gar nicht)
GAT Nuernberg<-> Festival            X  (wird heute als airport gefuehrt)
Flugh. NUE   <-> Festival            v  (30 min, als "airport")
Flugh. MUC   <-> Festival            X  (Ort existiert gar nicht)
Sheraton     <-> Flugh. NUE          v  (18 min)
Sheraton     <-> GAT NUE             X
Sheraton     <-> HBF Nuernberg       X
Sheraton     <-> Leonardo            X
```

Fazit: Von den in Abschnitt 15 geforderten Verbindungen fehlen im Seed ALLE, die neue Orte
betreffen. Fuer die verbindliche Sheraton-Sonderregel (Leonardo/HBF -> Festival ueber
Sheraton) sind die noetigen Kanten (`sheraton|festival`, und Anfahrt Fahrerposition->
Sheraton) aber genau die, die bereits existieren - das ist der Grund, warum die Regel
ueberhaupt sinnvoll operabel ist. Fuer die Rueckfahrten (`festival|leonardo`,
`festival|hbf_nue`) fehlt die Fahrzeit komplett -> ergibt korrekt "unbekannt", kein Rateswert.

**Keine Fahrzeiten erfunden.** Fehlende Kanten bleiben fehlend, bis Jordan sie in der Matrix
pflegt oder liefert.

---

## 4. Ride-Felder fromId/toId/fromCustom/toCustom (parseRow Z. 7923-7943)

```
fromId: from.id, fromCustom: from.custom || ""
toId:   to.id,   toCustom:   to.custom || ""
zone:   to.zone || ""
```

- Feste ID (`sheraton`/`moevenpick`/`airport`/`festival`) -> `fromId` gesetzt, `fromCustom` leer.
- Unbekannt -> `fromId = "__custom"`, `fromCustom = Freitext`.
- Anzeige ueberall ueber lokale Closure `loc(id, txt) = setup.locations.find(id)?.short || txt || "—"`
  (u.a. AssignModal Z. 3909, dayReport Z. 3616, Timeline Z. 3128/3182/3537). Bei `__custom`
  findet `find` nichts -> faellt auf den Freitext zurueck. Der urspruengliche Ort bleibt also
  in `fromCustom`/`toCustom` erhalten und sichtbar.

Vorrang heute faktisch: gueltige ID gewinnt, sonst Custom-Freitext, sonst "—". Das deckt sich
mit der in Abschnitt 10 geforderten Reihenfolge.

---

## 5. evaluateInsertion - wo die operative Fahrzeit gebraucht wird (Z. 1635-1702)

Kern-Codepfad, hier docket Teilpaket B an:

```
pickup = ride.fromId          // Abholort
drop   = ride.toId            // Fahrtziel
prevLoc = prev ? prev.toId : (stats.locNow || cfg.baseLocationId)   // Fahrerposition
deadMin = travelMin(matrix, prevLoc, pickup)    // Anfahrt Fahrer -> Abholort
hop     = travelMin(matrix, drop, next.fromId)  // Uebergang zur Folgefahrt
avail   = checkDriverAvailability(driver, ride, deadKnown ? deadMin : null)
```

Wichtig: `checkDriverAvailability` bekommt `deadMin` durchgereicht (Z. 1681). Der
`availableFrom`-Filter aus Teilpaket A nutzt damit HEUTE SCHON exakt dieselbe Anfahrtszeit
wie die Eignungspruefung (Spec Abschnitt 13 ist strukturell bereits erfuellt - es gibt nur
eine `deadMin`-Berechnung). Wenn Teilpaket B `pickup`/`prevLoc` auf operative Orte umstellt,
profitiert `availableFrom` automatisch mit, solange die Umstellung VOR `deadMin` passiert.

Fahrerposition nach einer Fahrt (Abschnitt 14): kommt aus `prev.toId` bzw. `locNow`
(computeDriverStats Z. 1511/1516 - immer `active.toId` / `last.toId`). Solange `toId` bei
Rueckfahrten das ECHTE Ziel bleibt (leonardo/hbf_nue, nicht sheraton), ist die Position
danach automatisch korrekt. Das ist der Grund, warum die Sheraton-Regel NUR den Abhol-
`from` umschreiben darf und NIE den `to`/`toId`.

---

## 6. Wo Teilpaket B sauber andockt (Vorschlag, noch nicht gebaut)

Additiv, dem Muster von Teilpaket A folgend (reine Funktionen + Konstanten-Config, nie
stille Defaults, Ride-Daten unveraendert):

1. **Konstanten-Config** (analog `DRIVER_PROFILES`): `LOC_ALIASES`, `LOC_ZONE`,
   `PICKUP_RULES`. Zentral, gut sichtbar.
2. **Reine Funktion `resolveLocation(text|id, custom)`** -> strukturierte Rueckgabe
   (`requestedLocation/normalizedLocation/zone/operationalLocation/matchedAlias/status`).
   Deterministisch, spezifische Aliase vor allgemeinen (NUE-GAT vor NUE), Mehrdeutigkeit ->
   `ambiguous`, kein Fuzzy.
3. **Reine Funktion `resolveOperationalRideLocations(ride, setup)`** -> einzige Quelle der
   Wahrheit fuer `operationalFrom`/`operationalTo` + `appliedRules`. Sheraton-Regel NUR bei
   `from in {leonardo,hbf_nue} && to === festival`.
4. **Reine Funktion `resolveTravelMinutes({fromLocation,toLocation,setup})`** -> nutzt
   zuerst `setup.matrix`, gibt `{minutes,source,status}` mit `status:"unknown"` bei fehlender
   Kante. Erfindet nichts.
5. **Integration in evaluateInsertion**: minimalinvasiv - `pickup`/`prevLoc`/`drop` bei der
   Anfahrts-/Hop-Berechnung durch die operativen Orte ersetzen. `toId` (Fahrerposition
   danach) und die Ride-Daten bleiben unangetastet.
6. **UI (Abschnitt 17)**: im AssignModal-Kopf (Z. 3940-3952) eine Zeile "Abholung:
   Sheraton" ergaenzen, wenn `operationalFrom != requestedFrom`; Warnung bei
   `status:"unknown"` / fehlender Fahrzeit. Rein presentational.

Keine Kollision: `operational`/`pickup_at`/`resolveLocation`/`zoneOf`/
`resolveOperational` kommen im Code bisher nicht vor (gepruefr per grep).

---

## 7. Offene Punkte / Grenzen dieser Analyse

- **Echte Ride-Schreibweisen (Spec Abschnitt 5, "tatsaechlich vorkommende Schreibweisen")
  liegen im Repo NICHT vor.** `timetable_openbeatz.json` ist die Setlist (229 Sets, fuer den
  spaeteren Timetable-Tab), enthaelt keine Ortsdaten. `drivers_openbeatz.json` sind Fahrer,
  keine Fahrten. Die Alias-Liste kann daher nur aus der Spec + `seedExampleRides` abgeleitet
  werden. Reale zusaetzliche Schreibvarianten muesste Jordan liefern (Export der echten
  Pickup-Liste), sonst bleibt es bei den Spec-Aliasen.
- **Live-Matrix** aus Supabase ist von hier nicht abrufbar. Referenz ist der Code-Seed. Fuer
  die neuen Orte fehlen fast alle Kanten - das ist erwartbar und wird als "unknown"
  behandelt, nicht geraten.
- **effDur-Default (minDurationMin)** bleibt unangetastet (ausserhalb Scope, betrifft
  Fahrtdauer nicht Anfahrt).

---

## 8. Bestaetigte Datenentscheidungen (von Jordan, 19.07.2026)

Diese Werte sind von Jordan freigegeben und bilden die Grundlage der Implementierung.
Recherche ueber Websuche (OSRM-Routenserver war nicht erreichbar, 503/TLS ueber Proxy).

### Festival-Standort
- Koordinate: **49.52728 / 10.83139** (Jordans Vorgabe, bewusst NICHT die offizielle
  Besucher-Navi-Koordinate 49.53918/10.83571).
- Anfahrt: **ueber Puschendorf** (VIP-Shuttle-Zufahrt). Der Veranstalter leitet normale
  Gaeste ueber Hoefen; wir sind VIP-Shuttle, daher Puschendorf. Jordans Ortskenntnis,
  bewusste Abweichung von der offiziellen Besucher-Zufahrt.
- Adresse bleibt: Puschendorfer Strasse 2, 91074 Herzogenaurach (Zusatz "Hoefen" entfaellt).

### Fahrzeiten (feste Matrix-Werte, keine Live-Berechnung)
- Stadt-Innenstadt -> Festival: **38 min** (von 33 angehoben wegen weiter suedlicher
  Festival-Koordinate). Gilt fuer Sheraton, und per Nachbar-Regel auch Leonardo, HBF,
  Karl August.
- Flughafen NUE -> Festival: bleibt (per Nachbar-Regel auch GAT).
- **Muenchen (MUC) -> Festival = MUC -> Sheraton = 105 min** (Zwischenwert zwischen den
  recherchierten 1h32 und 1h53; beide Strecken laut Jordan praktisch gleich).
  Belege: MyTransfers ~1h53 / 185 km; Rome2Rio ~1h32 / 185 km; ADAC ab Stadt 2h10 / 195 km.

### Ortszuordnung fuer die Zeitberechnung (Nachbar-Wiederverwendung, keine neuen Punkte)
Fahrer sieht immer den ECHTEN Ort; gerechnet wird mit dem bekannten Nachbarn:
```
leonardo     -> Zeit wie sheraton   (Innenstadt, direkt am Hbf)
hbf_nue      -> Zeit wie sheraton   (neben Leonardo)
karl_august  -> Zeit wie sheraton   (Innenstadt)
gat_nue      -> Zeit wie airport    (direkt am Flughafen NUE)
airport_muc  -> eigener Wert 105 min (kein Nachbar, zu weit weg)
festival/sheraton/moevenpick/airport bleiben sie selbst
```
GAT-Sonderfall: die alte matchLoc-Formulierung "private jet gat" wird beim Import weiter als
airport gelesen; da matchLoc auftragsgemaess unangetastet bleibt, trennt erst die neue
resolveLocation GAT sauber ab. Fuer die Zeit egal (GAT rechnet ohnehin wie airport).

### Offen fuers Bauen
- Muenchen-Wert 105 min noch final zu bestaetigen (Alternative glatt 100).
- Echte Ride-Schreibweisen liegen weiterhin nicht vor -> Alias-Liste nach Spec.
