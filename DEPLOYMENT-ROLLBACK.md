# Deployment- und Rollback-Anleitung (Open Beatz Shuttle-Leitstelle)

Stand: Go-Live-Freigabesession Teil 4. Diese Datei ist die operative Schritt-fuer-Schritt-Anleitung
fuer das echte Deployment auf Vercel + Supabase und den Weg zurueck, wenn etwas schiefgeht.
Sie ergaenzt `BACKEND-README.md` (das WARUM/Architektur) um das WIE/Reihenfolge/Rollback.

Sprachlich bewusst knapp und pruefbar. Jeder Schritt hat eine Kontrolle ("erwartet:").

---

## 0. Zwei Betriebsmodi (wichtig zu verstehen)

Die App hat genau eine Datenschicht-Weiche: `hasSupabase()` (Z. 110 in `src/ShuttleLeitstelle.jsx`).

- **Artifact-/Vorschaumodus:** kein `VITE_SUPABASE_URL/ANON_KEY` gesetzt. Speicher ist `window.storage`
  bzw. lokaler Fallback. Das ist NUR fuer Demo/Planung auf einem einzelnen Geraet. **Kein** Sync
  zwischen mehreren Handys.
- **Produktivmodus (Deploy):** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` gesetzt. Echte
  Postgres-DB, Realtime, atomare RPCs. Das ist der Modus fuer den Festivalbetrieb mit 20 Fahrern.

Die App schaltet automatisch um, sobald die beiden Supabase-Variablen im Build vorhanden sind.
Kein Code-Schalter, keine zwei Builds.

---

## 1. Voraussetzungen (einmalig)

- Vercel-Account + das Repo `Maybach62S57S/openbeatz-shuttle` verbunden.
- Supabase-Projekt (Region Frankfurt/EU fuer DSGVO + Latenz naeher am Festival).
- RapidAPI-Abo AeroDataBox (Flug-Tracking), optional aber empfohlen.
- Eigener Anthropic-API-Key (Chat-Assistent), optional.
- VAPID-Schluesselpaar (`npx web-push generate-vapid-keys`) fuer echte Push, optional.
- Google-Maps-Key mit Referrer-Restriktion, optional (ohne bleibt die kostenlose Schema-Karte).

Optionale Bausteine sind wirklich optional: fehlt einer, faellt genau dieses Feature sauber zurueck
(Flug -> manuelle Pflege, Push -> nur Vordergrund-Toast, Chat -> "nicht verfuegbar", Maps -> Schemakarte).
Nichts anderes bricht.

---

## 2. Env-Variablen-Checkliste (vollstaendig)

Alle Werte im Vercel-Dashboard unter *Settings -> Environment Variables* setzen (Environment:
Production, bei Bedarf auch Preview). Quelle/Vorlage: `.env.example`.

Legende: **Geheim** = darf NIE ins Frontend-Bundle. `VITE_`-Prefix bedeutet bewusst clientseitig
(landet im Bundle, ist dann kein Geheimnis mehr).

| Variable | Geheim? | Wofuer | Ohne sie |
|---|---|---|---|
| `VITE_SUPABASE_URL` | nein (client) | Produktivmodus an | App bleibt im Artifact-Modus (kein Multi-Geraet-Sync) |
| `VITE_SUPABASE_ANON_KEY` | nein (client) | Produktivmodus an | wie oben |
| `SUPABASE_URL` | nein | `api/send-push.js` DB-Zugriff | keine echten Push |
| `SUPABASE_SERVICE_ROLE_KEY` | **JA** | `api/send-push.js` (umgeht RLS) | keine echten Push |
| `AERODATABOX_API_KEY` | **JA** | `api/flight.js` | Flugstatus faellt auf manuelle Pflege |
| `AERODATABOX_API_HOST` | nein | `aerodatabox.p.rapidapi.com` | wie oben |
| `ARRIVAL_AIRPORT_IATA` | nein | `NUE` (Zielflughafen) | Flugauswahl unscharf |
| `ANTHROPIC_API_KEY` | **JA** | `api/chat.js` | Chat-Assistent meldet "nicht verfuegbar" |
| `VAPID_PUBLIC_KEY` | nein | Web-Push (auch in App-Einstellungen eintragen) | keine echten Push |
| `VAPID_PRIVATE_KEY` | **JA** | `api/send-push.js` signiert Push | keine echten Push |
| `VAPID_SUBJECT` | nein | `mailto:...` fuer VAPID | keine echten Push |
| `ALLOWED_APP_ORIGIN` | nein | Origin-Huerde fuer `api/*` | Endpoints offener (nicht kritisch) |
| `INTERNAL_API_SECRET` | (halb) | Huerde fuer `api/chat.js`/`send-push.js` | wie oben |
| `VITE_INTERNAL_API_SECRET` | nein (client) | muss = `INTERNAL_API_SECRET` | Huerde greift nicht |
| `VITE_GOOGLE_MAPS_API_KEY` | nein (client) | echte Live-Karte | Schemakarte (kein Fehler) |

**Pflicht fuer den Festivalbetrieb:** die beiden `VITE_SUPABASE_*`. Alles andere macht die App besser,
ist aber nicht existenziell.

Kontrolle nach dem Setzen: In Vercel muss jede Variable im richtigen Environment stehen. `VITE_`-Werte
greifen erst nach einem **neuen Build** (nicht nur Redeploy des alten Artefakts).

---

## 3. Supabase-Deploy (Datenbank)

Reihenfolge ist wichtig. Alles im Supabase **SQL Editor** (Projekt -> SQL Editor -> New query -> Run).

1. **Basis-Schema:** kompletten Inhalt von `supabase-schema.sql` einspielen.
   *Erwartet:* laeuft fehlerfrei durch, ist idempotent (mehrfaches Ausfuehren erzeugt nur harmlose
   NOTICE "... skipping"). Danach existieren die Tabellen `drivers, settings, rides, driver_state,
   guest_tokens, driver_locations` und die RPCs (`write_dyn_if_unchanged`, `write_setup_if_unchanged`,
   `assign_ride`, `guest_confirm_pickup`, `guest_report_issue`, ...).
   *Verifikation:*
   ```sql
   select proname from pg_proc where proname like 'write_%_if_unchanged' order by 1;
   select tablename from pg_tables where schemaname='public' order by 1;
   ```

2. **Stammdaten seeden:**
   - Fahrer aus `drivers_openbeatz.json` als `insert into drivers (...) values (...)` (Struktur siehe
     BACKEND-README Schritt 2).
   - Eine `settings`-Zeile (id=1) mit `locations`, `matrix`, `zones`, `config` (Struktur = wie in der App).
   - Fahrten koennen leer starten und werden per Import (Leitstelle) oder RPC eingespielt.

3. **Inkrementelle Daten-Nachtraege** (nur noetig, wenn die geseedete `settings`-Zeile die alten Werte
   hatte; jeder ist im Kopf selbst dokumentiert und live-sicher, kein rev-Bezug):
   - `festival-koordinate-update.sql` (Festival-Koordinate auf 49.52728 / 10.83139).
   - `orte-nachtrag-update.sql` (fehlende Orte wie Leonardo City-Center ergaenzen).
   - `teilpaket-b-matrix-update.sql` (Fahrzeit-Matrix ergaenzen).
   Jede Datei hat ein "VORHER pruefen" und "NACHHER kontrollieren" SELECT. Immer erst pruefen, dann
   updaten, dann kontrollieren.

4. **Realtime:** Das Schema haengt `rides/driver_state/settings/guest_tokens` an die Publikation
   `supabase_realtime` an (falls vorhanden). In Supabase unter *Database -> Replication* kontrollieren,
   dass diese Tabellen "realtime" aktiv sind.

**Wichtige Betriebsregel (aus den Projektregeln):** Jede spaetere Aenderung, die Live-Daten betrifft,
kommt als eigener, im Kopf dokumentierter SQL-Nachtrag ("VORHER/NACHHER"-SELECT), nie als blindes
UPDATE. Redeploys ueberschreiben geseedete `settings`/`locations` NICHT (nur der allererste Start seedet).

---

## 4. Frontend-Deploy (Vercel)

1. Env-Variablen aus Abschnitt 2 setzen (mindestens die beiden `VITE_SUPABASE_*`).
2. Build-Kommando: `vite build` (steht in `package.json`, Vercel erkennt Vite automatisch). Output `dist/`.
3. `api/chat.js`, `api/flight.js`, `api/send-push.js` liegen unter `api/` und werden von Vercel
   automatisch als Serverless Functions erkannt. Kein Extra-Setup.
4. `public/` enthaelt bereits `sw.js`, `manifest.webmanifest`, Icons -> die PWA-/Push-Basis ist da.
   Nach Deploy muss `/sw.js` und `/manifest.webmanifest` unter der Domain erreichbar sein.
5. Deployen. *Erwartet:* Build gruen, Domain laedt, Login-Screen erscheint.

---

## 5. Nach-Deploy-Smoke (manuell, ca. 10 Min, VOR dem Festival)

Auf der echten Domain, am besten mit zwei Geraeten:

1. **Produktivmodus aktiv?** DevTools-Konsole: `window.__obfSupabase` ist gesetzt (nicht undefined).
2. **Leitstelle:** einloggen (Name aus Liste + PIN), eine Testfahrt anlegen, einem Fahrer zuteilen.
3. **Fahrer (zweites Geraet):** einloggen, die zugeteilte Fahrt erscheint **ohne Reload** (Realtime),
   Status "akzeptiert" setzen -> erscheint auf dem Leitstellen-Geraet ohne Reload.
4. **Kein verlorenes Update:** auf beiden Geraeten fast gleichzeitig etwas an derselben Fahrt aendern
   -> beide Aenderungen bleiben, kein Fehler (das ist die CAS-Garantie aus Block G/H).
5. **Stage:** mit PIN rein, Problem melden -> erscheint bei der Leitstelle, Stage kann keinen Status/Fahrer
   aendern (nur Melden).
6. **Gast-Link:** in Einstellungen Token erzeugen, Link im Inkognito-Fenster oeffnen -> zeigt nur die
   Fahrten dieses Kuenstlers, keine Dispo-Funktionen, keine privaten Fahrer-Nummern.
7. **Flug** (falls AeroDataBox gesetzt): "Flugstatus aktualisieren" -> zieht echte Daten statt Fallback.
8. **Schreibdiagnose:** `window.__obfWriteStats` in der Konsole zeigt Zaehler (Success/Conflicts/...).

Erst wenn 1-6 sauber sind, ist der Live-Betrieb freigegeben.

---

## 6. Rollback

### 6a. Frontend-Rollback (haeufigster Fall: schlechtes Code-Deploy)
Schnellster Weg: Vercel-Dashboard -> Deployments -> das letzte **funktionierende** Deployment ->
"Promote to Production" (Instant Rollback, kein Rebuild). Sekundensache, kein DB-Eingriff.
Alternativ ueber CLI: das vorige Production-Deployment promoten.
Git-Weg (wenn die Ursache im Code liegt): `git revert <commit>` auf `main`, pushen, neuer Build.
Die Verifikationskette (esbuild + Smokes + rendertest + kontrast) muss vor dem Push wieder gruen sein.

*Wichtig:* Ein reiner Frontend-Rollback laesst die DB unberuehrt. Das Schema ist additiv/idempotent,
ein aelterer Frontend-Build spricht dieselben Tabellen/RPCs an. Nur wenn ein Deploy zusammen mit einer
DB-Strukturaenderung kam, siehe 6b.

### 6b. Datenbank-Rollback
- **Schemaaenderung zurueck:** Es gibt keine automatische Down-Migration. Kleine, additive Schemaschritte
  (neue Spalte/Funktion) lassen sich per gezieltem `drop`/`alter` zuruecknehmen; das gehoert vorbereitet
  UND getestet, bevor man es live faehrt. Grosse Schritte: Supabase **Point-in-Time-Recovery** (Backups
  unter *Database -> Backups*) auf einen Zeitpunkt vor dem Fehler.
- **Falsche Live-Daten** (z. B. ein fehlerhafter settings-Nachtrag): mit dem "VORHER"-SELECT den alten
  Wert sichern, bevor man updatet. Rueckweg = derselbe Nachtrag mit dem alten Wert. Deshalb IMMER erst
  das VORHER-SELECT laufen lassen und die Ausgabe kopieren.
- Waehrend des Festivals (23.-27.07.) gilt: DB-Aenderungen nur als dokumentierte Nachtraege mit
  VORHER/NACHHER-SELECT, moeglichst nachts/in Randzeiten, nie blind.

### 6c. Ehrlicher Notfall-Hinweis (kein weicher Multi-Geraet-Fallback)
Faellt Supabase komplett aus, gibt es KEINEN automatischen geteilten Ersatz: ohne
`VITE_SUPABASE_*`-Verbindung liefe die App im `window.storage`-Modus, der pro Geraet isoliert ist und
Fahrten NICHT zwischen 20 Handys synchronisiert. Das ist keine Live-Absicherung. Der operative
Ausfallplan dafuer steht im Betriebshandbuch (`GO_LIVE_OPENBEATZ_2026.md`, Stoerungs-Playbook):
zentrale Koordinationsnummer + Telefon/Zettel-Rueckfallebene, bis Supabase wieder da ist. Supabase-EU
hat sehr hohe Verfuegbarkeit, aber der Plan muss existieren.

---

## 7. Schnell-Checkliste (Deploy-Tag)

- [ ] Supabase-Schema eingespielt, RPCs + Tabellen per SELECT bestaetigt
- [ ] Fahrer + settings-Zeile geseedet, Daten-Nachtraege (falls noetig) mit VORHER/NACHHER gefahren
- [ ] Realtime fuer rides/driver_state/settings/guest_tokens aktiv
- [ ] `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in Vercel (Production) gesetzt
- [ ] optionale Keys (Flug/Push/Chat/Maps) gesetzt, wo gewuenscht; `VITE_INTERNAL_API_SECRET` = `INTERNAL_API_SECRET`
- [ ] Build gruen, Domain laedt, `window.__obfSupabase` gesetzt
- [ ] Nach-Deploy-Smoke 1-6 auf zwei Geraeten bestanden
- [ ] letztes gutes Vercel-Deployment als Rollback-Ziel bekannt
- [ ] Betriebshandbuch (`GO_LIVE_OPENBEATZ_2026.md`) beim Team, Zugangsdaten verteilt
