import React from "react";
import ReactDOM from "react-dom/client";
import App from "./ShuttleLeitstelle.jsx";
import "./index.css";

// Live-Sync über Supabase, falls konfiguriert (siehe .env.example). Ohne diese
// zwei Variablen läuft die App weiterhin lokal, nur ohne Sync zwischen Geräten.
if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
  const { createClient } = await import("@supabase/supabase-js");
  window.__obfSupabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
