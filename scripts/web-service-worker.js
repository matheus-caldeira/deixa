const VERSION = "__VERSION__";
const FILES = "__FILES__";
const CACHE = `deixa-web-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "activate") self.skipWaiting();
});

function pageUrl(url) {
  const path = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  return FILES.includes(path) ? path : url.pathname;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const key = request.mode === "navigate" ? pageUrl(url) : url.pathname;
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(key, { ignoreSearch: true }))
      .then((cached) => {
        if (!cached) return fetch(request);
        return request.destination === "worker" ? new Response(cached.body, cached) : cached;
      }),
  );
});
