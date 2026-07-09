# Flug-Tracking (AeroDataBox)

Die App fragt Flugdaten über einen **serverseitigen** Endpoint ab (`/api/flight`), damit der API-Key nie im Browser landet. Im Chat-Artifact existiert dieser Endpoint nicht – der Button „Flugstatus aktualisieren" fällt dort sauber auf **manuelle Pflege** zurück. Nach dem Deploy funktioniert er live.

## Dateien
- **`api/flight.js`** – Serverless-Funktion (Vercel/Netlify). Ruft AeroDataBox über RapidAPI ab und liefert normalisierte Felder zurück. FlightAware ist als zweiter Provider vorbereitet (`provider=flightaware`), aber noch nicht implementiert.
- **`.env.example`** – benötigte Umgebungsvariablen.

## Einrichtung (ca. 15 Min)
1. AeroDataBox auf RapidAPI abonnieren (Free/Basic reicht für den Start): https://rapidapi.com/aedbx-aedbx/api/aerodatabox
2. In Vercel unter *Settings → Environment Variables* setzen:
   - `AERODATABOX_API_KEY` = dein RapidAPI-Key
   - `AERODATABOX_API_HOST` = `aerodatabox.p.rapidapi.com`
   - `ARRIVAL_AIRPORT_IATA` = `NUE`
3. `api/flight.js` liegt im Projekt-Root unter `api/` (Vercel erkennt das automatisch als Function).
4. Deployen. Die App ruft dann `/api/flight?provider=aerodatabox&flight=…&date=…` auf.

## Was zurückkommt (normalisiert)
`flightStatus` (geplant/verspätet/gelandet/annulliert/""), `scheduledArrival`, `estimatedArrival`, `actualArrival`, `terminal`, `airline`, `delayMinutes`, `source`.

## Verhalten in der App
- **Manuelle Werte gewinnen:** Sobald die Leitstelle einen Flug manuell ändert, wird die Fahrt als `manuell` markiert und vom Auto-Update übersprungen (per Klick auf „auto" wieder freigeben).
- **Auto-Markierung:** verspätet → gelb; gelandet ohne Fahrer unterwegs → rot/kritisch; annulliert → prüfen/halten; unbekannt → Hinweis.
- **API-Limits:** Der Endpoint cached 60 s. Eine automatische Aktualisierung alle X Minuten lässt sich später ergänzen (z. B. Vercel Cron), sollte aber die Kontingente im Blick behalten.

## FlightAware später
In `api/flight.js` die Funktion `fromFlightAware()` implementieren (AeroAPI) und dasselbe normalisierte Objekt zurückgeben. Der Provider-Switch (`?provider=flightaware`) ist bereits vorhanden.
