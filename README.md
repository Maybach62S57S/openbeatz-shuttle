# Open Beatz Shuttle-Leitstelle

Lauffähiges Vite/React-Projekt der Shuttle-App. Läuft sofort lokal (mit
In-Memory-Speicher, kein Live-Sync zwischen Geräten) und ist bereit für den
Supabase-Umbau (siehe `BACKEND-README.md`).

## Lokal starten
```
npm install
npm run dev
```
Öffnet unter http://localhost:5173

## Für Vercel bauen (lokaler Test)
```
npm run build
npm run preview
```

## Ins eigene GitHub-Repo bringen
```
git init
git add .
git commit -m "Initial commit: Shuttle-Leitstelle"
git branch -M main
git remote add origin <URL deines Repos>
git push -u origin main
```

## Nächste Schritte
1. **Supabase-Backend anbinden** — `BACKEND-README.md` lesen, `supabase-schema.sql`
   im Supabase SQL-Editor ausführen, `supabaseStore.js` in die App verdrahten
   (ersetzt den aktuellen `window.storage`-Fallback durch echten Live-Sync).
2. **Bei Vercel deployen** — Repo verbinden, Framework wird automatisch als Vite
   erkannt, Umgebungsvariablen aus `.env.example` setzen.
3. **Flug-Tracking optional aktivieren** — `FLIGHT-README.md`, erst kurz vor dem
   Event nötig.

## Projekt-Kontext für Claude
`PROJEKT-ANWEISUNGEN.md` enthält alle Konventionen (Datenmodell, Sprache,
Pages-Kompatibilität für Nebenprojekte). Diese Datei vor größeren Änderungen
mitgeben, damit Konventionen erhalten bleiben.
