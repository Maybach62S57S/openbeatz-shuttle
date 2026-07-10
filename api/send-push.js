// ============================================================================
// /api/send-push — verschickt eine Web-Push-Benachrichtigung an einen Fahrer.
// Läuft SERVERSEITIG (VAPID-Private-Key darf niemals ins Frontend).
//
// Aufruf aus der App:
//   POST /api/send-push  { driverId, title, body, tag? }
// Die Funktion lädt das gespeicherte Push-Abo des Fahrers aus der DB
// (driver_state.push_subscription, siehe supabase-schema.sql) und schickt den
// Push über den Anbieter des Browsers (Google/Mozilla/Apple) zu — web-push
// übernimmt die Verschlüsselung nach dem VAPID-Standard.
//
// Setup: `npm install web-push` im Projekt, VAPID-Schlüsselpaar einmalig
// erzeugen (siehe FLIGHT-README/BACKEND-README), als Env-Variablen setzen.
//
// Sicherheitshinweis (Nachtrag 3, Security-Review): diese Funktion nutzt den
// Supabase-Service-Role-Key (umgeht RLS komplett) und akzeptiert driverId +
// beliebigen Titel/Text vom Aufrufer. War vorher völlig offen — jeder mit
// der URL konnte einem (erratbaren) Fahrer eine frei erfundene Push-
// Nachricht schicken, ein Social-Engineering-Risiko auf echten Fahrer-
// Handys. Dieselben drei Checks wie bei /api/chat (Origin, optionales
// Shared-Secret, Rate-Limit) — kein vollwertiges Auth, aber verhindert
// automatisiertes/wildes Fremdnutzen. Details: BACKEND-README.md.
// ============================================================================
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:info@merg-and-more.ch";

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
// Best-Effort, siehe ausführlicher Hinweis in api/chat.js.
const rateMap = new Map();
function allowRate(req, limit = 30, windowMs = 60000) {
  const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").toString().split(",")[0].trim();
  const now = Date.now();
  const hits = (rateMap.get(ip) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  rateMap.set(ip, hits);
  return hits.length <= limit;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST erwartet" });
  if (!checkOrigin(req)) return res.status(403).json({ error: "Ungültiger Origin" });
  if (!checkSecret(req)) return res.status(401).json({ error: "Nicht autorisiert" });
  if (!allowRate(req)) return res.status(429).json({ error: "Zu viele Anfragen, bitte kurz warten" });
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return res.status(500).json({ error: "VAPID-Keys nicht gesetzt" });

  const { driverId, title, body, tag, url } = req.body || {};
  if (!driverId || !title) return res.status(400).json({ error: "driverId und title erforderlich" });

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: state } = await supabase.from("driver_state").select("push_subscription").eq("driver_id", driverId).single();
    const sub = state?.push_subscription;
    if (!sub) return res.status(200).json({ ok: false, reason: "kein Push-Abo für diesen Fahrer" });

    const payload = JSON.stringify({ title, body: body || "", tag: tag || "shuttle-update", url: url || "/" });
    await webpush.sendNotification(sub, payload);
    return res.status(200).json({ ok: true });
  } catch (e) {
    // Abo abgelaufen/widerrufen (410 Gone) -> in der DB aufräumen, damit nicht ständig fehlschlägt
    if (e.statusCode === 410 || e.statusCode === 404) {
      try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        await supabase.from("driver_state").update({ push_subscription: null }).eq("driver_id", driverId);
      } catch {}
      return res.status(200).json({ ok: false, reason: "Abo abgelaufen, entfernt" });
    }
    return res.status(502).json({ error: String(e.message || e) });
  }
}
