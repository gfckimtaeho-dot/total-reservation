// Minimal service worker — required for PWA installability.
// Intentionally no fetch caching: caching strategy comes later (Serwist).
// Push handler is here so iOS 16.4+ home-screen installs can receive notifications later.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || "예약가즈아", {
      body: data.body || "",
      icon: "/icon/192",
      badge: "/icon/192",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url || "/"));
});
