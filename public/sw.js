// Minimal Web Push service worker — no offline caching, that's not the goal here.
// This is what lets a notification show up even when the site isn't open in a tab,
// which is the entire point (checking a dashboard is exactly what this replaces).

self.addEventListener("push", (event) => {
  let data = { title: "Theonexus", body: "New alert" };
  try {
    if (event.data) data = event.data.json();
  } catch {
    // ignore malformed payloads
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: data.url || "/" },
    })
  );
});

// Tapping the notification focuses an existing tab on this site if one's open,
// otherwise opens a new one at the relevant page (risk-watchdog or analyst).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
