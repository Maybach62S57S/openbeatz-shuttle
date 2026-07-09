// public/sw.js — läuft im Browser des Fahrer-Handys, auch wenn die App-Seite
// geschlossen/im Hintergrund ist. Empfängt den Push vom Server und zeigt eine
// echte System-Benachrichtigung. Muss im Deployment unter /sw.js erreichbar
// sein (bei Vite: Datei einfach in public/sw.js legen).

self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener("push", (event) => {
  let data = { title: "Open Beatz Shuttle", body: "Es gibt eine Änderung." };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch { if (event.data) data.body = event.data.text(); }

  const options = {
    body: data.body,
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    tag: data.tag || "shuttle-update", // gleiche tag ersetzt vorherige Meldung statt zu stapeln
    renotify: true,
    vibrate: [200, 80, 200],
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Tippt der Fahrer auf die Benachrichtigung -> App-Tab fokussieren oder neu öffnen.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ("focus" in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
