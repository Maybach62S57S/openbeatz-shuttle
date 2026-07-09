// ============================================================================
// supabaseStore.js — Produktiv-Datenschicht für die Shuttle-Leitstelle
// Ersetzt die window.storage-Ebene (sget/sset/updateDyn) der Artifact-Version.
// Echte gemeinsame Live-Sync über Supabase Realtime + atomare RPCs.
//
// Setup:
//   npm i @supabase/supabase-js
//   .env(.local):  VITE_SUPABASE_URL=...   VITE_SUPABASE_ANON_KEY=...
//   Schema vorher einspielen: supabase-schema.sql
// ============================================================================
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ---- Mapping DB <-> App (snake_case <-> camelCase) -------------------------
const fromDbRide = (r) => ({
  id: r.id, srcId: r.src_id, dayKey: r.day_key, date: r.ride_date, time: r.ride_time,
  fromId: r.from_id, fromCustom: r.from_custom, toId: r.to_id, toCustom: r.to_custom,
  zone: r.zone, djName: r.dj_name, passengerCount: r.passenger_count, passengers: r.passengers,
  flightNo: r.flight_no, meetingPoint: r.meeting_point, notes: r.notes, onDemand: r.on_demand,
  estDurationMin: r.est_duration_min, type: r.ride_type, assignedDriverId: r.assigned_driver_id,
  status: r.status, statusHistory: r.status_history, issues: r.issues,
  acceptedAt: r.accepted_at, enrouteAt: r.enroute_at, onboardAt: r.onboard_at, doneAt: r.done_at,
  updatedAt: r.updated_at,
});
const toDbRide = (r) => ({
  src_id: r.srcId ?? null, day_key: r.dayKey, ride_date: r.date, ride_time: r.time,
  from_id: r.fromId, from_custom: r.fromCustom || "", to_id: r.toId, to_custom: r.toCustom || "",
  zone: r.zone || "", dj_name: r.djName || "", passenger_count: r.passengerCount || 1,
  passengers: r.passengers || "", flight_no: r.flightNo || "", meeting_point: r.meetingPoint || "",
  notes: r.notes || "", on_demand: !!r.onDemand, est_duration_min: r.estDurationMin ?? null,
  ride_type: r.type || "transfer", assigned_driver_id: r.assignedDriverId ?? null,
  status: r.status || "planned",
});

// ---- Laden -----------------------------------------------------------------
export async function loadSetup() {
  const [{ data: drivers }, { data: settings }] = await Promise.all([
    supabase.from("drivers").select("*").eq("active", true),
    supabase.from("settings").select("*").eq("id", 1).single(),
  ]);
  return {
    drivers: (drivers || []).map((d) => ({
      id: d.id, firstName: d.first_name, lastName: d.last_name,
      vehicleType: d.vehicle_type, vehicleId: d.vehicle_id, seats: d.seats,
    })),
    locations: settings.locations, matrix: settings.matrix, zones: settings.zones, config: settings.config,
  };
}

export async function loadRides() {
  const { data } = await supabase.from("rides").select("*").neq("status", "cancelled");
  return (data || []).map(fromDbRide);
}

export async function loadDriverState() {
  const { data } = await supabase.from("driver_state").select("*");
  const map = {};
  (data || []).forEach((s) => {
    map[s.driver_id] = {
      locationId: s.location_id,
      gps: s.gps_lat != null ? { lat: s.gps_lat, lng: s.gps_lng, accuracy: s.gps_accuracy, at: s.gps_at ? new Date(s.gps_at).getTime() : null } : null,
      pushSubscription: s.push_subscription || null,
    };
  });
  return map;
}

// ---- Realtime: bei jeder Änderung Callback (Punkt 0/1) ---------------------
export function subscribeLive(onChange) {
  const ch = supabase
    .channel("shuttle")
    .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "driver_state" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, onChange)
    .subscribe();
  return () => supabase.removeChannel(ch);
}

// ---- Atomare Mutationen (Row-Locks/RPC statt Ganz-Objekt-Überschreiben) -----
export async function advanceStatus(rideId, status, by) {
  const { data } = await supabase.rpc("advance_ride_status", { p_ride: rideId, p_status: status, p_by: by });
  return data ? fromDbRide(data) : null;
}
export async function assignRide(rideId, driverId, by) {
  const { data } = await supabase.rpc("assign_ride", { p_ride: rideId, p_driver: driverId, p_by: by });
  return data ? fromDbRide(data) : null;
}
export async function reportIssue(rideId, issue) {
  const { data } = await supabase.rpc("report_ride_issue", { p_ride: rideId, p_issue: issue });
  return data ? fromDbRide(data) : null;
}
export async function resolveIssues(rideId, currentIssues) {
  const issues = (currentIssues || []).map((i) => ({ ...i, resolved: true }));
  await supabase.from("rides").update({ issues, updated_at: new Date().toISOString() }).eq("id", rideId);
}
export async function upsertRide(ride) {
  if (ride.id && !ride._new) {
    await supabase.from("rides").update(toDbRide(ride)).eq("id", ride.id);
  } else {
    await supabase.from("rides").insert(toDbRide(ride));
  }
}
export async function insertRides(rides) {           // Bulk-Import
  await supabase.from("rides").insert(rides.map(toDbRide));
}
export async function setDriverLocation(driverId, locationId) {
  await supabase.from("driver_state").upsert({ driver_id: driverId, location_id: locationId, updated_at: new Date().toISOString() });
}
// Live-GPS vom Fahrer-Handy (bereits clientseitig gedrosselt, siehe useDriverLocationSharing in der App).
export async function setDriverGps(driverId, { lat, lng, accuracy, at }) {
  await supabase.from("driver_state").upsert({
    driver_id: driverId, gps_lat: lat, gps_lng: lng, gps_accuracy: accuracy,
    gps_at: new Date(at).toISOString(), updated_at: new Date().toISOString(),
  });
}
// Push-Abo speichern, nachdem der Fahrer die Browser-Berechtigung erteilt hat
// (siehe usePushNotifications in der App). api/send-push.js liest es beim Versand.
export async function setDriverPushSubscription(driverId, subscription) {
  await supabase.from("driver_state").upsert({ driver_id: driverId, push_subscription: subscription, updated_at: new Date().toISOString() });
}
export async function saveSettings(patch) {          // locations/matrix/zones/config
  await supabase.from("settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1);
}

// Dedup gegen bestehende Fahrten (Punkt 14) – vor insertRides nutzen
export async function existingSignatures() {
  const { data } = await supabase.from("rides").select("src_id,day_key,ride_time,from_id,to_id,dj_name,passenger_count,flight_no").neq("status", "cancelled");
  return new Set((data || []).map((r) => r.src_id
    ? `src:${r.src_id}`
    : `${r.day_key}|${r.ride_time}|${r.from_id}|${r.to_id}|${(r.dj_name||"").toLowerCase()}|${r.passenger_count}|${(r.flight_no||"").toLowerCase()}`));
}
