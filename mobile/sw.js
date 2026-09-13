const CACHE = "neoai-mobile-v24";
const ASSETS = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "media.html",
  "media.css",
  "media-v2.css",
  "media.js",
  "manifest.webmanifest",
  "icon.svg",
];
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith("neoai-mobile-") && key !== CACHE).map((key) => caches.delete(key)),
        ),
      ).then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Never cache API responses, private downloads or unrelated same-origin content.
  const assets = new Set(ASSETS.map((asset) => new URL(asset, self.registration.scope).href));
  if (!assets.has(event.request.url)) return;
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy))); }
          return response;
        }),
    ),
  );
});
