const CACHE_NAME = "flora-vs-luca-pwa-v1";
const GAME_ASSET_ORIGIN = "https://assets.anuluca.com";
const GAME_ASSET_PREFIX = "/otherWebsites/flora-vs-luca/";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/hua-bowl-favicon-v3.png",
];

const isLocalDevelopment = ["localhost", "127.0.0.1", "::1"].includes(self.location.hostname);

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    if (!isLocalDevelopment) {
      const cache = await caches.open(CACHE_NAME);
      // 单个资源短暂失败不应阻止 Service Worker 安装。
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter((name) => name.startsWith("flora-vs-luca-pwa-") && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match("/")) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok || response.type === "opaque") await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  if (isLocalDevelopment || event.request.method !== "GET" || event.request.headers.has("range")) return;

  const url = new URL(event.request.url);
  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request));
    return;
  }

  const isSameOriginStatic = url.origin === self.location.origin && (
    url.pathname.startsWith("/_next/static/")
    || /\.(?:avif|gif|ico|jpe?g|png|svg|webp|woff2?|ttf|mp3|webmanifest)$/i.test(url.pathname)
  );
  const isRemoteGameAsset = url.origin === GAME_ASSET_ORIGIN && url.pathname.startsWith(GAME_ASSET_PREFIX);
  if (isSameOriginStatic || isRemoteGameAsset) event.respondWith(cacheFirst(event.request));
});
