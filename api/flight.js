// ============================================================================
// /api/flight  —  Serverless Flugstatus-Endpoint (Vercel / Netlify Functions)
// Läuft SERVERSEITIG, damit der API-Key nicht ins Frontend gelangt.
// Aufruf aus der App:  GET /api/flight?provider=aerodatabox&flight=KL1845&date=2026-07-23
// Antwort (normalisiert, providerunabhängig):
//   { flightStatus, scheduledArrival, estimatedArrival, actualArrival,
//     terminal, airline, delayMinutes, source }
//
// Primär-Provider: AeroDataBox (über RapidAPI). FlightAware ist als zweiter
// Provider / Fallback vorbereitet, aber noch nicht implementiert.
// ============================================================================

const ARRIVAL_AIRPORT_IATA = process.env.ARRIVAL_AIRPORT_IATA || "NUE"; // Nürnberg

export default async function handler(req, res) {
  const { provider = "aerodatabox", flight, date } = req.query || {};
  if (!flight) return res.status(400).json({ error: "flight fehlt" });

  try {
    let result;
    if (provider === "flightaware") result = await fromFlightAware(flight, date);
    else result = await fromAeroDataBox(flight, date);
    // Cache: 60 s, damit API-Limits geschont werden (Punkt 6)
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json(result);
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}

/* --------------------------------- Helpers -------------------------------- */
// "2026-07-23 16:05+02:00" | ISO -> "HH:MM"
function hhmm(t) {
  if (!t) return "";
  const s = typeof t === "object" ? (t.local || t.utc || "") : String(t);
  const m = s.match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}
function minutesOfDay(hm) { if (!hm) return null; const [h, m] = hm.split(":").map(Number); return h * 60 + m; }
function diffMin(sched, other) {
  const a = minutesOfDay(sched), b = minutesOfDay(other);
  if (a == null || b == null) return 0;
  let d = b - a; if (d < -720) d += 1440; if (d > 720) d -= 1440; // Tagesgrenze
  return Math.max(0, d);
}

// AeroDataBox-Status -> unser Set (geplant/verspätet/gelandet/annulliert/"")
function mapAdbStatus(s) {
  const t = (s || "").toLowerCase();
  if (t.includes("cancel")) return "annulliert";
  if (t.includes("arriv") || t.includes("landed")) return "gelandet";
  if (t.includes("delay")) return "verspätet";
  if (["expected", "enroute", "en route", "approaching", "boarding", "departed", "scheduled", "checkin", "gateopen", "gateclosed"].some((k) => t.replace(/\s/g, "").includes(k.replace(/\s/g, "")))) return "geplant";
  return "";
}

async function fromAeroDataBox(flight, date) {
  const key = process.env.AERODATABOX_API_KEY;
  if (!key) throw new Error("AERODATABOX_API_KEY nicht gesetzt");
  const host = process.env.AERODATABOX_API_HOST || "aerodatabox.p.rapidapi.com";
  const num = encodeURIComponent(flight.replace(/\s+/g, ""));
  const path = date ? `/flights/number/${num}/${encodeURIComponent(date)}` : `/flights/number/${num}`;
  const url = `https://${host}${path}?dateLocalRole=Arrival&withLocation=false`;

  const r = await fetch(url, { headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": host } });
  if (r.status === 204) return empty("aerodatabox");
  if (!r.ok) throw new Error(`AeroDataBox ${r.status}`);
  const data = await r.json();
  const list = Array.isArray(data) ? data : (data.flights || []);
  if (!list.length) return empty("aerodatabox");

  // Ankunft am Zielflughafen bevorzugen
  const f = list.find((x) => (x.arrival?.airport?.iata || "").toUpperCase() === ARRIVAL_AIRPORT_IATA) || list[0];
  const arr = f.arrival || {};
  const scheduledArrival = hhmm(arr.scheduledTime);
  const estimatedArrival = hhmm(arr.predictedTime) || hhmm(arr.revisedTime);
  const actualArrival = hhmm(arr.runwayTime) || hhmm(arr.actualTime);
  let flightStatus = mapAdbStatus(f.status);
  // Verspätung ableiten, falls Status es nicht schon sagt
  const ref = actualArrival || estimatedArrival;
  const delayMinutes = scheduledArrival && ref ? diffMin(scheduledArrival, ref) : 0;
  if (!flightStatus && delayMinutes > 5) flightStatus = "verspätet";

  return {
    source: "aerodatabox",
    airline: f.airline?.name || "",
    terminal: arr.terminal || "",
    scheduledArrival, estimatedArrival, actualArrival,
    flightStatus, delayMinutes,
  };
}

// Platzhalter: später AeroAPI (FlightAware) analog implementieren und normalisieren.
async function fromFlightAware(/* flight, date */) {
  throw new Error("FlightAware-Provider noch nicht implementiert");
}

function empty(source) {
  return { source, airline: "", terminal: "", scheduledArrival: "", estimatedArrival: "", actualArrival: "", flightStatus: "", delayMinutes: 0 };
}
