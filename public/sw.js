const CACHE = "deixa-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isCacheable(request, response) {
  if (!response || response.status !== 200 || response.type === "opaque") return false;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/audio/")) return true;
  if (url.pathname.startsWith("/_next/static/")) return true;
  return request.mode === "navigate" || request.destination === "image" || request.destination === "font";
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (isCacheable(request, response)) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") return (await caches.match(OFFLINE_URL)) ?? Response.error();
        return Response.error();
      }),
  );
});
