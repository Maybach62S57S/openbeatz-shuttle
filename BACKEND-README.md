# Open Beatz Shuttle – Produktivbetrieb mit Supabase

Die App im Chat-Artifact nutzt `window.storage` (synchronisiert nur innerhalb der Claude‑Umgebung). Für **echten Einsatz auf Vercel mit Fahrer‑Handys** braucht es ein echtes Backend. Diese Dateien liefern den kompletten Baukasten dafür.

## Was hier drin ist
- **`supabase-schema.sql`** – Tabellen (drivers, settings, rides, driver_state, guest_tokens) + alle RPCs (Gast-Zugriff, atomares Schreiben, Fahrer-/Token-Verwaltung) und RLS-Policies. **Das ist die Quelle der Wahrheit für die Datenbank**, wird direkt im SQL Editor ausgeführt.
- **`src/ShuttleLeitstelle.jsx`** – die App. Enthält die komplette Datenschicht bereits eingebaut (`sget`/`sset`/`sbGetSetup`/`sbSetSetup`/`sbGetDyn`/`sbSetDyn`), erkennt automatisch, ob `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` gesetzt sind (siehe `main.jsx`) und schaltet dann von `window.storage` auf Supabase um. **`supabaseStore.js` ist historisch/unbenutzt** — die App importiert es nirgends, die eigentliche Umstellung ist längst direkt in `ShuttleLeitstelle.jsx` passiert. Bitte nicht mehr als Anleitung nehmen, steht nur noch aus Altlast-Gründen mit im Repo.
- **`api/flight.js`** – Flug-Live-Tracking (AeroDataBox), siehe FLIGHT-README.md.
- **`sw.js`** – Service Worker für echte Push-Benachrichtigungen (gehört ins `public/`-Verzeichnis des Frontend-Projekts).
- **`api/send-push.js`** – Serverless-Funktion, die den eigentlichen Push verschickt.

## Warum das die Review-Punkte löst
- **Live-Sync (0):** *Teilweise.* Realtime ist auf DB-Ebene aktiviert (`alter publication supabase_realtime add table ...`), das Frontend abonniert es aber (Stand jetzt) nicht — es pollt weiterhin alle 3s (`POLL_MS`), auch nach dem Deploy. Funktioniert zuverlässig, ist nur nicht "live" im engeren Sinn. Realtime tatsächlich anzubinden wäre ein eigener, überschaubarer nächster Schritt.
- **Keine verlorenen Updates (1):** *Gelöst, aber anders als ursprünglich hier beschrieben.* Nicht über die separate `rides`-Tabelle mit Row-Locks (die ist unbenutzt, echte Fahrtdaten liegen in `settings.dyn_data`), sondern über `write_dyn_if_unchanged`/`write_setup_if_unchanged`: ein einziges atomares `UPDATE ... WHERE dyn_rev = erwarteter_wert` in der DB statt eines Lese-Vergleich-Schreibe-Zyklus aus der App heraus. Kollidiert das (jemand anders hat zwischenzeitlich geschrieben), bekommt die App den aktuellen Serverstand zurück und wendet ihre Änderung darauf erneut an, statt zu überschreiben.
- **Stammdaten/PII in der DB (2):** Fahrer/Fahrzeuge in `drivers`, keine E-Mails im Frontend. **Wichtige Einschränkung:** `read_settings`/`read_drivers` sind weiterhin für jeden mit dem (zwangsläufig öffentlichen) anon-Key lesbar, weil Dashboard und Fahrer-App ohne echtes Login denselben Key nutzen und die DB serverseitig nicht unterscheiden kann, wer wirklich Dispo/Fahrer ist. `drivers.pin`/`drivers.phone` sind also technisch weiterhin per `select * from drivers` auslesbar. Schreiben ist dagegen seit dem Sicherheits-Nachtrag unten nur noch über geprüfte Funktionen möglich, nicht mehr über offene Tabellen-Policies. Für echte Geheimhaltung von PINs/Telefonnummern braucht es echtes Rollen-Login (Supabase Auth/JWT) — bewusst noch nicht Teil dieser App.

## Einrichtung (ca. 15 Min)
1. Supabase-Projekt anlegen → **SQL Editor** → `supabase-schema.sql` komplett ausführen (auch bei einem bestehenden Projekt gefahrlos erneut ausführbar, alle Statements sind idempotent gebaut).
2. Fahrer einspielen: `insert into drivers (id, first_name, last_name, vehicle_type, vehicle_id, seats) values (...);`
   und die `settings`-Zeile mit euren `locations`, `matrix`, `zones`, `config` füllen (Struktur = wie in der App) — oder einfach einmal die App mit den Demo-Daten starten und in den Einstellungen alles über die Oberfläche eintragen.
3. `src/ShuttleLeitstelle.jsx` ist schon fertig für Supabase gebaut, kein manuelles Umstellen der Datenschicht nötig (die Schritte "loadSetup()/subscribeLive()/advanceStatus()" aus einer früheren Version dieser Datei sind überholt, siehe Hinweis oben zu `supabaseStore.js`).
4. Env-Variablen bei Vercel setzen: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (siehe `.env.example`).
5. Deployen. `main.jsx` erkennt die beiden Variablen automatisch und schaltet von `window.storage` auf Supabase um — kein Code-Unterschied für die Leitstelle.

## Live-GPS der Fahrer (neu)
Die App erfasst jetzt echte Fahrer-Standorte im Browser (`useDriverLocationSharing` in `shuttle-leitstelle.jsx`), solange die Fahrer-App offen ist – gedrosselt (Bewegung > 15 m oder alle 45 s), landet in `driverState[driverId].gps`. Die Live-Karte projiziert diese Koordinate auf die passende Strecke zwischen zwei bekannten realen Orten (Flughafen/Hotels/Festival, bereits mit lat/lng hinterlegt) und nutzt sie statt der Fahrplan-Schätzung – ohne eigene Kartenkacheln, bleibt also im Chat-Artifact UND nach dem Deploy ohne zusätzliche Kartenanbieter-Kosten lauffähig.
- **Veraltet nach 3 Minuten** (`GPS_MAX_AGE_MS`) → automatischer Rückfall auf Zeitplan-Schätzung.
- **Zu weit von der erwarteten Route** (>5 km, `GPS_MAX_OFFROUTE_M`) → wird verworfen statt einer falschen Position zu zeigen.
- Schema/Store bereits erweitert: `driver_state` hat jetzt `gps_lat/gps_lng/gps_accuracy/gps_at`, `supabaseStore.js` hat `setDriverGps()`/liest es in `loadDriverState()` mit ein.
- **Wichtiger Hinweis für den Live-Betrieb:** Reines Web-Tracking funktioniert nur im Vordergrund – sperrt ein Fahrer das Handy längere Zeit, pausiert die Übertragung (iOS ist hier besonders restriktiv). Das ist eine Plattform-Grenze, keine Baustelle in der App; sie fällt in dem Fall sauber auf „geschätzt" zurück.
- **Datenschutz:** Standort-Freigabe ist im Fahrer-Header sichtbar und einzeln abschaltbar; vor dem Event kurz die Einwilligung/DSGVO-Seite klären (nur während der Schicht tracken, keine Langzeit-Historie).

## Gast-/Artist-Manager-Links (neu)
Persönliche Info-Seite für Artist/Manager über einen Link mit Token (`?guest=TOKEN`), ohne Login. Zeigt nur die Fahrten desselben Künstlernamens, keine Dispo-Funktionen, standardmäßig Englisch. Token-Verwaltung: Einstellungen → „Gast-/Artist-Links" (erzeugen, Link kopieren, Vorschau direkt im Artifact testen, löschen).
- **Im Chat-Artifact** (`window.storage`) ist der Token weiterhin **keine echte Zugriffssperre** – er blendet nur die Oberfläche für andere Daten aus, technisch liegen alle Daten im selben, ungeschützten Objekt. Unverändert, weil window.storage dafür keine Grundlage bietet.
- **Nach dem Supabase-Deploy ist das jetzt echt abgesichert** (Sicherheits-Nachtrag in `supabase-schema.sql`): Die Gast-Seite läuft ausschließlich über token-beschränkte RPCs (`guest_session`, `guest_confirm_pickup`, `guest_at_pickup`, `guest_report_issue`). Ein Gast-Client bekommt serverseitig nur noch die eigenen Fahrten zurück, nie die volle Fahrten- oder Token-Liste, und kann über frei erfundene ride-ids keine fremden Fahrten anfassen (getestet, siehe unten). Die `guest_tokens`-Tabelle selbst ist über die normale REST-API nicht mehr auflistbar.
- **Bleibt offen:** `settings.dyn_data` (worin alle Fahrten liegen) ist über `read_settings` weiterhin für jeden mit dem anon-Key lesbar (siehe Hinweis oben zu PII). Ein technisch versierter Angreifer, der direkt gegen die Supabase-REST-API statt gegen die App spricht, könnte diesen Weg also umgehen. Der normale Nutzungsweg über den Link ist damit sauber, eine gegen gezielte Angriffe gehärtete Trennung braucht echtes Rollen-Login.
- Aktionen des Gastes (Confirm pickup, I am at pickup, Problem melden) schreiben ausschließlich Flags/Log-Einträge (`guestConfirmedAt`, `guestAtPickupAt`, `issues[]`) – nie Status oder Fahrer-Zuteilung. Dieselbe Absicherung wie beim Stage-Manager-Modus, jetzt zusätzlich in der DB-Funktion selbst erzwungen (nicht nur im Frontend-Code).
- Zentrale „Shuttle-Coordination"-Nummer statt privater Fahrer-Nummer (Einstellungen → Gast-/Artist-Links), damit keine persönlichen Telefonnummern über den Gast-Link kursieren.

## Fahrer- & Leitstellen-Benachrichtigungen

**Stufe 1 – Vordergrund (funktioniert sofort, auch im Artifact):** Die Fahrer-App erkennt bei jedem Datenabgleich Änderungen an den eigenen Fahrten und zeigt eine Toast-Meldung + Vibration + Ton: neue Zuteilung, geänderte Zeit/Route/Treffpunkt, Flug jetzt verspätet/gelandet/annulliert, neues Problem gemeldet, Gast hat bestätigt / ist am Treffpunkt, Fahrt umverteilt. Kein Spam beim ersten Laden — nur echte Änderungen gegenüber dem zuletzt gesehenen Stand. Läuft nur, solange die App-Seite offen ist.

**Stufe 2 – echte Push-Benachrichtigung:** Kommt auch bei gesperrtem Handy/geschlossener App an. Seit Nachtrag 4 nicht mehr nur für Fahrer, sondern auch für die Leitstelle:
- **`sw.js`** (Service Worker) — zeigt die System-Benachrichtigung, öffnet die App beim Antippen.
- **`usePushNotifications`** in `ShuttleLeitstelle.jsx` — jetzt für beide Rollen nutzbar (`stateKey` = `"driverState"` oder `"dispatcherState"`). Fahrer aktiviert per Klick im Kopfbereich seiner App, Leitstellen-Nutzer im Dashboard-Header. Speichert das Abo in `dyn_data.driverState[id].pushSubscription` bzw. `dyn_data.dispatcherState[id].pushSubscription`.
- **`api/send-push.js`** — verschickt den eigentlichen Push über die `web-push`-Bibliothek (VAPID-Standard). Zwei Modi: `{driverId, ...}` für einen einzelnen Fahrer, `{broadcastToDispatchers: true, ...}` für alle Leitstellen-Nutzer mit aktivem Abo auf einmal (Server liest die Abo-Liste selbst, der Client muss sie nicht kennen).
  - **An Fahrer ausgelöst** (`triggerPush`): neue Zuteilung, Zeit/Route/Treffpunkt geändert, Flugstatus jetzt verspätet/gelandet/annulliert, sowie die drei Gast-Aktionen.
  - **An die Leitstelle ausgelöst** (`triggerDispatcherPush`, neu): Problem gemeldet (egal ob von Fahrer, Stage Manager oder Gast) und Flugstatus wird kritisch (`flightAlert(...).level === "critical"`, also annulliert oder gelandet-ohne-Fahrer-unterwegs) — bewusst enger gefasst als bei Fahrern, sonst piepst bei mehreren Dispo-Handys ständig irgendeins.
- **Bugfix (Nachtrag 4):** `api/send-push.js` suchte Push-Abos vorher in der separaten `driver_state`-TABELLE. Die App schreibt sie aber (wie die Fahrten selbst) in `settings.dyn_data`, die separate Tabelle wird nirgends beschrieben. Echte Push-Benachrichtigungen an Fahrer hätten dadurch **nie funktioniert**, unabhängig von allen anderen Einstellungen — jetzt korrigiert und gegen eine echte Postgres-Instanz mit Testdaten verifiziert.

**Einrichtung:**
1. `web-push` ist als Abhängigkeit in `package.json` eingetragen, kein manueller `npm install` nötig (Vercel installiert das beim Build automatisch mit).
2. Einmalig Schlüsselpaar erzeugen: `npx web-push generate-vapid-keys`.
3. `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` als Env-Variablen bei Vercel setzen (siehe `.env.example`) — der private Key darf **nie** ins Frontend.
4. `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` als Env-Variablen setzen (für `api/send-push.js` — braucht direkten DB-Zugriff, nicht den anon-Key).
5. `sw.js` liegt bereits in `public/sw.js`, kein weiterer Schritt nötig.
6. Den **öffentlichen** VAPID-Key zusätzlich in der App eintragen: Einstellungen → „Echte Push-Benachrichtigungen".
7. Jeder Fahrer tippt einmal auf „Push-Benachrichtigungen aktivieren" im Kopfbereich seiner App; jeder Leitstellen-Nutzer auf den Push-Button im Dashboard-Header. Ein Abo pro angemeldetem Namen, nicht automatisch pro Gerät — meldet sich dieselbe Person auf einem zweiten Gerät neu an und aktiviert dort erneut, ersetzt das dortige Abo das vorherige.

Ohne diese Einrichtung bleibt automatisch alles bei Stufe 1 (Vordergrund) — nichts bricht, es kommt nur keine echte Push-Benachrichtigung an. Das ist auch der Zustand im Chat-Artifact hier.

## Chat-Assistent (neu)
Im Chat-Artifact ruft der Chat-Assistent `api.anthropic.com` direkt aus dem Browser auf — Claude stellt den Schlüssel dort automatisch bereit. Nach dem Deploy funktioniert dieser direkte Aufruf **nicht** mehr (kein Schlüssel, Browser dürfen die Anthropic-API ohnehin nicht direkt aufrufen). Dafür gibt es jetzt `api/chat.js`, das denselben Zweck serverseitig übernimmt.

1. Einen eigenen API-Key auf console.anthropic.com anlegen
2. `ANTHROPIC_API_KEY` als Env-Variable bei Vercel setzen (siehe `.env.example`) — **nie** ins Frontend
3. Fertig — die App erkennt automatisch (an der vorhandenen Supabase-Verbindung), dass sie im echten Deployment läuft, und nutzt dann `api/chat.js` statt des direkten Aufrufs. Kein Unterschied in der Bedienung für die Leitstelle.

Ohne gesetzten Key liefert der Chat-Assistent einen Fehler ("nicht verfügbar") statt einer Antwort — bricht sonst aber nichts an der App.

## API-Absicherung für api/chat.js & api/send-push.js (neu, Nachtrag 3)
Beide Endpoints waren vorher völlig offen — jeder, der die URL kennt, konnte den Anthropic-Key als kostenlosen Proxy nutzen bzw. (bei send-push, das den Service-Role-Key nutzt) einem beliebigen, erratbaren Fahrer eine frei erfundene Push-Nachricht schicken. Beide haben jetzt drei Schutzschichten:
1. **Origin-Check** (`ALLOWED_APP_ORIGIN`): nur Anfragen von eurer eigenen Domain.
2. **Shared-Secret** (`INTERNAL_API_SECRET` serverseitig + `VITE_INTERNAL_API_SECRET` clientseitig, müssen identisch sein): kein echtes Geheimnis, landet zwangsläufig im JS-Bundle, aber eine zusätzliche Hürde gegen automatisiertes Abgrasen.
3. **Rate-Limit** (Best-Effort, pro Serverless-Instanz, kein verteilter Zähler): fängt Endlosschleifen/einfache Scripts ab.

**Das ist kein vollwertiges Auth** — dafür bräuchte es echte Nutzer-Logins, die es hier bewusst noch nicht gibt. Für ein internes Dispo-Tool für ein Wochenend-Event (kein öffentliches Produkt) ist das aber eine sinnvolle Abwägung: schützt gegen automatisiertes/versehentliches Fremdnutzen, nicht gegen einen gezielten, technisch versierten Angreifer. Beide Variablenpaare sind optional — ohne sie gesetzt läuft alles wie vorher (Checks werden übersprungen), siehe `.env.example`.

## PWA / Home‑Screen (Punkt 17)
Braucht echtes Hosting (nicht im Artifact möglich): `manifest.webmanifest` + „Zum Homescreen hinzufügen"-Unterstützung (z. B. `vite-plugin-pwa`). Der Service Worker für Push (`sw.js`) ist oben schon beschrieben; für eine vollwertige installierbare PWA (Icon auf dem Homescreen, Standalone-Fenster) zusätzlich ein `manifest.webmanifest` mit Icons/Namen ergänzen.

## Ehrliche Einordnung
Die Artifact-Version ist voll funktionsfähig zum Planen und Demonstrieren. Für den Festival-Livebetrieb mit 20 Handys ist der Supabase-Weg oben der richtige.

Stand nach dem Sicherheits-Review vom 10.07.2026 (siehe Nachtrag 3 in `supabase-schema.sql`, ausführlich mit echten Postgres-Tests verifiziert, nicht nur "sieht plausibel aus"):
- **Gelöst:** Gast-Link ist nach dem Deploy echt auf die eigenen Fahrten beschränkt. guest_tokens nicht mehr auflistbar. Schreibzugriffe auf settings/drivers nur noch über geprüfte Funktionen. Race Condition bei gleichzeitigen Änderungen (Lost Updates) durch echtes Compare-and-Swap in der DB behoben. Die beiden offenen API-Endpoints (chat, push) haben jetzt Origin-/Secret-/Rate-Limit-Schutz.
- **Bewusst offen gelassen (Jordans Entscheidung, nicht vergessen):** Fahrer-PINs und -Telefonnummern sind über den anon-Key weiterhin technisch auslesbar, weil Login/PIN-Prüfung komplett clientseitig läuft und es keine serverseitige Rollen-Unterscheidung gibt. Der saubere nächste Schritt dafür wäre eine `verify_driver_pin(driver_id, pin)`-RPC, die nur ja/nein zurückgibt, statt die PINs selbst auszuliefern — sollte vor dem Event noch angegangen werden, ist aber ein eigenständiges, überschaubares Stück Arbeit.
- Realtime ist in der DB vorbereitet, aber nicht angebunden (Frontend pollt weiterhin alle 3s). Kein Sicherheits-, nur ein Aktualitäts-Thema.

Der Umbau ist dank der gekapselten Datenschicht überschaubar geblieben, sollte aber vor dem Event einmal echt gegen ein echtes Supabase-Projekt getestet werden (die SQL-Funktionen selbst wurden gegen eine lokale Postgres-Instanz mit echten Testdaten verifiziert, das App-Frontend dagegen nicht — dafür fehlt hier ein echtes Supabase-Projekt zum Testen).
