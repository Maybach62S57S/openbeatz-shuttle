// ============================================================================
// /api/life360-sync — holt Live-Positionen aus einem Life360-„Circle" und
// schreibt sie in dieselben Fahrer-GPS-Felder wie die eigene Standort-
// freigabe der App (settings.dyn_data.driverState[driverId].gps).
//
// WICHTIG, bitte beim Warten/Debuggen im Kopf behalten:
// Life360 hat KEINE offizielle, öffentliche Entwickler-API. Das hier nutzt
// die intern von der Life360-App selbst verwendete, von der Community
// zurückentwickelte Schnittstelle (dokumentiert u. a. unter
// krconv.github.io/life360-api-docs). Das kann jederzeit ohne Ankündigung
// brechen (Life360 ändert Endpunkte/Auth) und ist vermutlich nicht durch
// Life360s Nutzungsbedingungen für automatisierten/kommerziellen Zugriff
// gedeckt — siehe Abwägung dazu in BACKEND-README.md.
//
// DESHALB bewusst so gebaut, dass ein Ausfall NICHTS in der App kaputt
// macht: jeder Fehler wird abgefangen, geloggt, mit {ok:false} beantwortet,
// und es wird NICHTS geschrieben. Die eigene Standortfreigabe der Fahrer
// läuft davon komplett unberührt weiter (siehe useDriverLocationSharing in
// ShuttleLeitstelle.jsx) — Life360 ist hier nur eine zusätzliche, optionale
// Quelle, kein Ersatz.
//
// Zuordnung Life360-Mitglied -> Fahrer: über drivers.life360_name (freier
// Text, exakter Vor-+Nachname wie im Circle, case-insensitiv verglichen).
// Fahrer ohne gesetzten life360_name werden übersprungen.
//
// Aufruf aus der App: POST /api/life360-sync (kein Body nötig), ausgelöst
// alle ~45s aus der Leitstellen-Ansicht, siehe App-Komponente. Serverseitig
// zusätzlich auf ca. 20s gedrosselt (mehrere offene Leitstellen-Tabs sollen
// Life360 nicht parallel anfragen).
// ============================================================================
import { createClient } from "@supabase/supabase-js";

const LIFE360_EMAIL = process.env.LIFE360_EMAIL;
const LIFE360_PASSWORD = process.env.LIFE360_PASSWORD;
// Öffentlich bekannter, fest verdrahteter "App"-Client-Token, den die
// offizielle Life360-App selbst für den Login verwendet. Wert stammt aus
// der Open-Source-Reimplementierung github.com/harperreed/life360-python
// (dort als "authorization_token" bezeichnet) — NICHT von mir erfunden,
// aber auch nicht von mir gegen einen echten Life360-Account verifiziert.
// Falls der Login fehlschlägt, ist das der erste Verdächtige: bei den
// verlinkten Community-Projekten (z. B. auch krconv/life360-api-docs)
// nach dem aktuellen Wert schauen und hier bzw. über die Env-Variable
// LIFE360_CLIENT_TOKEN eintragen, ohne Code-Änderung.
const DEFAULT_CLIENT_TOKEN = "Y2F0aGFwYWNyQVBoZUtVc3RlOGV2ZXZldnVjSGFmZVRydVl1ZnJhYzpkOEM5ZVlVdkE2dUZ1YnJ1SmVnZXRyZVZ1dFJlQ1JVWQ==";
const CLIENT_TOKEN = process.env.LIFE360_CLIENT_TOKEN || DEFAULT_CLIENT_TOKEN;
const BASE_URL = "https://www.life360.com/v3";

const ALLOWED_ORIGINS = (process.env.ALLOWED_APP_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
function checkOrigin(req) {
  if (!ALLOWED_ORIGINS.length) return true; // nicht konfiguriert -> Check übersprungen, siehe .env.example
  const origin = req.headers.origin || req.headers.referer || "";
  return ALLOWED_ORIGINS.some((o) => origin.startsWith(o));
}
function checkSecret(req) {
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected) return true; // nicht konfiguriert -> Check übersprungen, siehe .env.example
  return req.headers["x-app-secret"] === expected;
}
// Best-Effort, siehe ausführlicher Hinweis in api/chat.js. Hier zusätzlich
// niedriges Limit, weil jeder Aufruf einen echten Life360-Login auslösen kann.
const rateMap = new Map();
function allowRate(req, limit = 10, windowMs = 60000) {
  const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").toString().split(",")[0].trim();
  const now = Date.now();
  const hits = (rateMap.get(ip) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  rateMap.set(ip, hits);
  return hits.length <= limit;
}

// Serverseitiger Cooldown: mehrere offene Leitstellen-Tabs lösen sonst
// parallel echte Life360-Logins/Requests aus. Läuft nur innerhalb derselben
// warmen Serverless-Instanz (kein globaler Lock über mehrere Instanzen
// hinweg) — ausreichend, um im Normalfall die Anfragen deutlich zu senken,
// kein hartes Limit.
const COOLDOWN_MS = 20000;
let lastRun = { at: 0, result: null };

// Life360-Zugriffstoken zwischen Aufrufen wiederverwenden (spart Logins),
// nur innerhalb derselben warmen Instanz gültig.
let cachedToken = null;

async function life360Login() {
  const r = await fetch(`${BASE_URL}/oauth2/token.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${CLIENT_TOKEN}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "password", username: LIFE360_EMAIL, password: LIFE360_PASSWORD }),
  });
  if (!r.ok) throw new Error(`Life360-Login fehlgeschlagen (${r.status})`);
  const data = await r.json();
  if (!data.access_token) throw new Error("Life360-Login: kein access_token in Antwort");
  return `${data.token_type || "Bearer"} ${data.access_token}`;
}

async function life360Fetch(path) {
  if (!cachedToken) cachedToken = await life360Login();
  let r = await fetch(`${BASE_URL}${path}`, { headers: { Authorization: cachedToken, Accept: "application/json" } });
  if (r.status === 401) {
    // Token abgelaufen/ungültig -> einmal neu einloggen und erneut versuchen
    cachedToken = await life360Login();
    r = await fetch(`${BASE_URL}${path}`, { headers: { Authorization: cachedToken, Accept: "application/json" } });
  }
  if (!r.ok) throw new Error(`Life360 ${path} -> ${r.status}`);
  return r.json();
}

// Alle Mitglieder aus allen Circles holen (falls es mehrere gibt, z. B.
// privater Familien-Circle + eigens angelegter Fahrer-Circle).
async function fetchLife360Members() {
  const circles = (await life360Fetch("/circles")).circles || [];
  const members = [];
  for (const c of circles) {
    const detail = await life360Fetch(`/circles/${c.id}`);
    for (const m of detail.members || []) {
      const loc = m.location;
      if (!loc || loc.latitude == null || loc.longitude == null) continue;
      members.push({
        name: `${m.firstName || ""} ${m.lastName || ""}`.trim(),
        firstName: (m.firstName || "").trim(),
        lat: Number(loc.latitude), lng: Number(loc.longitude),
        // Life360 liefert den Zeitstempel als Unix-Sekunden (String)
        at: loc.timestamp ? Number(loc.timestamp) * 1000 : Date.now(),
        accuracy: loc.accuracy != null ? Number(loc.accuracy) : null,
      });
    }
  }
  return members;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST erwartet" });
  if (!checkOrigin(req)) return res.status(403).json({ error: "Ungültiger Origin" });
  if (!checkSecret(req)) return res.status(401).json({ error: "Nicht autorisiert" });
  if (!allowRate(req)) return res.status(429).json({ error: "Zu viele Anfragen, bitte kurz warten" });

  if (Date.now() - lastRun.at < COOLDOWN_MS && lastRun.result) {
    return res.status(200).json({ ...lastRun.result, cached: true });
  }

  if (!LIFE360_EMAIL || !LIFE360_PASSWORD) {
    return res.status(200).json({ ok: false, reason: "LIFE360_EMAIL/LIFE360_PASSWORD nicht gesetzt" });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(200).json({ ok: false, reason: "Supabase-Service-Role nicht konfiguriert" });
  }

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: driverRows, error: driverErr } = await supabase.from("drivers").select("id, life360_name").not("life360_name", "eq", "");
    if (driverErr) throw new Error("Fahrerliste konnte nicht geladen werden: " + driverErr.message);
    const mapped = (driverRows || []).filter((d) => (d.life360_name || "").trim());
    if (mapped.length === 0) {
      const result = { ok: true, updated: [], reason: "kein Fahrer mit gesetztem life360_name" };
      lastRun = { at: Date.now(), result };
      return res.status(200).json(result);
    }

    const members = await fetchLife360Members();
    const byFullName = new Map(members.map((m) => [m.name.toLowerCase(), m]));
    // Fallback: nur Vorname, aber nur wenn der Vorname unter den aktuellen
    // Life360-Mitgliedern eindeutig ist (sonst bleibt's beim vollen Namen,
    // um niemanden versehentlich zu verwechseln). Grund: Life360 zeigt in
    // der App oft nur den Vornamen an, ob ein Nachname im Profil hinterlegt
    // ist, sieht man von außen nicht - Fahrer sollen einfach den Namen
    // eintragen können, den sie in der Life360-App sehen.
    const firstNameCounts = new Map();
    for (const m of members) {
      if (!m.firstName) continue;
      const key = m.firstName.toLowerCase();
      firstNameCounts.set(key, (firstNameCounts.get(key) || 0) + 1);
    }
    const byUniqueFirstName = new Map(
      members.filter((m) => m.firstName && firstNameCounts.get(m.firstName.toLowerCase()) === 1)
        .map((m) => [m.firstName.toLowerCase(), m])
    );

    // CAS-Schreiben wie updateDyn im Frontend: lesen, mergen, mit
    // erwarteter rev zurückschreiben, bei Konflikt (Rides wurden zeitgleich
    // geändert) mit dem neuen Serverstand erneut versuchen.
    const updated = [];
    const skipped = [];
    let lastError = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: row, error: readErr } = await supabase.from("settings").select("dyn_data, dyn_rev").eq("id", 1).single();
      if (readErr) throw new Error("dyn_data konnte nicht gelesen werden: " + readErr.message);
      const dyn = row.dyn_data || {};
      const driverState = { ...(dyn.driverState || {}) };
      updated.length = 0; skipped.length = 0;

      for (const d of mapped) {
        const key = d.life360_name.trim().toLowerCase();
        const m = byFullName.get(key) || byUniqueFirstName.get(key);
        if (!m) { skipped.push({ driverId: d.id, reason: "kein Life360-Mitglied mit diesem Namen gefunden (auch nicht als eindeutiger Vorname)" }); continue; }
        const current = driverState[d.id]?.gps;
        // Nur überschreiben, wenn die Life360-Position tatsächlich neuer ist
        // als die zuletzt bekannte (egal ob die vorher von der App selbst
        // oder von Life360 kam) — die eigene Standortfreigabe soll nicht
        // durch eine ältere Life360-Position zurückgesetzt werden.
        if (current?.at && current.at >= m.at) { skipped.push({ driverId: d.id, reason: "vorhandene Position ist bereits aktuell" }); continue; }
        driverState[d.id] = { ...(driverState[d.id] || {}), gps: { lat: m.lat, lng: m.lng, accuracy: m.accuracy, at: m.at, source: "life360" } };
        updated.push(d.id);
      }

      if (updated.length === 0) break; // nichts zu schreiben, kein Write nötig

      const { data: writeData, error: writeErr } = await supabase.rpc("write_dyn_if_unchanged", {
        p_expected_rev: row.dyn_rev || 0,
        p_rides: dyn.rides || [],
        p_driver_state: driverState,
        p_dispatcher_state: dyn.dispatcherState || {},
        p_artist_presence: dyn.artistPresence || {},
        p_messages: dyn.messages || [],
      });
      if (writeErr) { lastError = writeErr.message; continue; }
      const writeRow = Array.isArray(writeData) ? writeData[0] : writeData;
      if (writeRow?.ok) { lastError = null; break; } // Erfolg
      // Konflikt (rev stimmte nicht mehr) -> nächste Runde mit frischem Stand
    }
    if (updated.length > 0 && lastError) throw new Error("Schreiben nach mehreren Versuchen fehlgeschlagen: " + lastError);

    const result = { ok: true, updated, skipped };
    lastRun = { at: Date.now(), result };
    return res.status(200).json(result);
  } catch (e) {
    // Absichtlich Status 200 (nicht 500): der Aufrufer im Frontend ist
    // fire-and-forget und wertet den Body ohnehin nicht kritisch aus, ein
    // Fehler hier soll niemals als App-Fehler beim Nutzer aufschlagen.
    console.error("life360-sync fehlgeschlagen:", e);
    const result = { ok: false, error: String(e.message || e) };
    lastRun = { at: Date.now(), result };
    return res.status(200).json(result);
  }
}
