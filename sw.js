/* Service worker：離線可用 + 有新版時通知頁面

   策略（2026-09-28 改）：所有請求都「先給快取、背景更新」。
   - 以前網頁本身是「先抓網路、3 秒沒回應才用快取」，一個頁面裡切分頁沒感覺；
     變成三個模組（單字／成語／時間）之後每次切換都是整頁導覽，每切一次就等一次網路，
     訊號普通時 1～3 秒，使用者回報「切換變慢」。
   - 改成先給快取之後切換是本機速度。新版不會漏：版本靠 sw.js 的 CACHE 版本號，
     瀏覽器每次開啟都會問 sw.js（_headers 設 no-cache），有新版就裝新快取（install 時重抓全部頁面）、
     跳「立即更新」，按了才切過去。背景更新只是順手把快取換新，下一次開就是新的。

   CACHE 的版本號每次改版都要換，舊快取才會被清掉。 */

const CACHE = "vocab-quest-v59";
const ASSETS = [
  "./",
  "./index.html",
  "./idiom.html",
  "./time.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
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

  const isPage = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");

  // 先給快取，背景更新。用 req 當 key，不能寫死 index.html —— 有好幾個頁面，
  // 寫死的話後開的那頁會把前一頁的快取蓋掉，離線時就拿到錯的頁面
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req, isPage ? { cache: "no-store" } : undefined).then(res => {
      if(res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
      return res;
    }).catch(() => null);
    if(cached){ e.waitUntil(network); return cached; }
    return (await network)
      || (isPage && await cache.match("./index.html"))
      || new Response(isPage ? "離線中，而且還沒存過這個頁面" : "", {
           status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  })());
});

// 頁面按下「立即更新」時才接管
self.addEventListener("message", e => {
  if(e.data === "skip-waiting") self.skipWaiting();
});
