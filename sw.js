/* Service worker：離線可用 + 有新版時通知頁面

   策略分兩種：
   - 網頁本身（導覽請求）：先抓網路，抓到就用最新的，順便更新快取；
     沒網路才拿快取出來用。這樣有網路時永遠是最新版，不會卡在舊版。
   - 圖示等靜態檔：先給快取，背景更新即可。

   CACHE 的版本號每次改版都要換，舊快取才會被清掉。 */

const CACHE = "vocab-quest-v3";
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

  if(isPage){
    // 網頁：先抓網路（3 秒逾時），失敗才用快取
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try{
        const res = await Promise.race([
          fetch(req, { cache: "no-store" }),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000))
        ]);
        if(res && res.status === 200) cache.put("./index.html", res.clone()).catch(() => {});
        return res;
      }catch(err){
        return (await cache.match(req, { ignoreSearch: true }))
          || (await cache.match("./index.html"))
          || new Response("離線中，而且還沒存過這個頁面", {
               status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    })());
    return;
  }

  // 其他靜態檔：先給快取，背景更新
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then(res => {
      if(res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
      return res;
    }).catch(() => null);
    return cached || (await network) || new Response("", { status: 503 });
  })());
});

// 頁面按下「立即更新」時才接管
self.addEventListener("message", e => {
  if(e.data === "skip-waiting") self.skipWaiting();
});
