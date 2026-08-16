/* Service worker：離線可用 + 有新版時通知頁面
   策略：先給快取（開得快），同時在背景抓新版存起來。
   新版不會自己接管 —— 由頁面問過使用者、按了「立即更新」才切換。 */

const CACHE = "vocab-quest-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {})
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;
  if(new URL(req.url).origin !== self.location.origin) return;   // 本來就沒有外部資源

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then(res => {
      if(res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
      return res;
    }).catch(() => null);
    return cached || (await network) || new Response("離線中，且這個檔案還沒存起來", {
      status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  })());
});

// 頁面按下「立即更新」時才接管
self.addEventListener("message", e => {
  if(e.data === "skip-waiting") self.skipWaiting();
});
