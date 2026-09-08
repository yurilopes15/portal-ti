/* Service Worker dedicado a Web Push (não faz cache do app). */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Portal TI Slotter", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Portal TI Slotter";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/favicon.ico",
    badge: payload.icon || "/favicon.ico",
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const absolute = new URL(targetUrl, self.location.origin).href;
      for (const client of allClients) {
        if (client.url === absolute && "focus" in client) return client.focus();
      }
      for (const client of allClients) {
        if ("navigate" in client && "focus" in client) {
          await client.navigate(absolute);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(absolute);
      return undefined;
    })(),
  );
});
