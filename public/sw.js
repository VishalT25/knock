/* Knock service worker: offline shell + web push. */
const VERSION = "knock-v1";
const SHELL = "knock-shell-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll([OFFLINE_URL, "/icons/192"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return; // never cache API/SSE
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match(OFFLINE_URL)) || Response.error()),
    );
    return;
  }
  // Hashed production chunks are safe to cache-first; in local dev their names are stable, so never cache them.
  const isDev = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (!isDev && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"))) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          }),
      ),
    );
  }
});

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "Knock", body: e.data ? e.data.text() : "" }; }
  const kind = d.kind || "info";
  const tag = d.tag || "knock";
  const isAndroid = /android/i.test(self.navigator.userAgent || "");
  const opts = {
    body: d.body || "",
    tag,
    icon: "/icons/192",
    badge: "/icons/192",
    data: { url: d.url || "/", callId: d.callId || null },
    timestamp: Date.now(),
  };
  if (kind === "ring" || kind === "test") {
    Object.assign(opts, { renotify: true, requireInteraction: kind === "ring", vibrate: [220, 90, 220, 90, 420], silent: false });
    if (isAndroid && kind === "ring") opts.actions = [{ action: "open", title: "Open door" }];
  } else {
    // quiet ping / door opened / info: no sound, no vibration, replaces the loud one with the same tag
    Object.assign(opts, { silent: true, renotify: false, requireInteraction: false, vibrate: [] });
  }
  e.waitUntil(
    (async () => {
      await self.registration.showNotification(d.title || "Knock", opts);
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      clients.forEach((c) => c.postMessage({ type: "knock-push", kind, callId: d.callId || null }));
      const isIOS = /iPhone|iPad|iPod/i.test(self.navigator.userAgent || "");
      if (!isIOS && (kind === "opened" || kind === "quiet")) { // iOS ends push handlers that linger; leave those notifications for the user to clear
        // Let the replacement linger briefly, then clear it so the shade doesn't fill up.
        await new Promise((r) => setTimeout(r, kind === "opened" ? 8000 : 20000));
        const open = await self.registration.getNotifications({ tag });
        open.forEach((n) => { if (n.data && n.data.callId === (d.callId || null)) n.close(); });
      }
    })(),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  // iOS shows no action buttons: every tap lands on the Open screen. Android's "Open door" action does the same.
  const target = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) {
        if ("focus" in w) {
          await w.focus();
          if ("navigate" in w) { try { await w.navigate(target); } catch {} }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
