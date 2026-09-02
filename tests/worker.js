/* 雲端備份 API：權限分離是這支程式唯一的重點

   家長端「唯讀」不能靠畫面上不放按鈕 —— 那只要有人打開開發者工具就破功。
   真正的保證在 Worker 的路由層：家長那把鑰匙碰不到任何寫入路徑。
   下面把「拿錯鑰匙」「用錯方法」的每一種組合都試一遍。 */
const path = require("path");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

// 假的 KV：夠用就好，不模擬 expiration
function fakeKV(){
  const m = new Map();
  return {
    m,
    async put(k, v){ m.set(k, v); },
    async get(k){ return m.has(k) ? m.get(k) : null; },
    async list({prefix, cursor}){
      const all = [...m.keys()].filter(k=>k.startsWith(prefix)).sort();
      const from = cursor ? +cursor : 0, page = all.slice(from, from + 1000);
      return {keys:page.map(name=>({name})),
              list_complete: from + page.length >= all.length,
              cursor: String(from + page.length)};
    }
  };
}
const APP = "https://english.ku-ai.cc";
const pad12 = n => String(n).padStart(12, "0");
const ENV = kv => ({KV:kv, WRITE_CODE:"w-secret", READ_CODE:"r-secret", ALLOW_ORIGIN:APP});

(async () => {
const {default:worker} = await import(path.join("file://", __dirname, "..", "worker", "worker.js"));
const kv = fakeKV(), env = ENV(kv);
const call = (method, p, {code, body, origin} = {}) => worker.fetch(new Request("https://api.test" + p, {
  method,
  headers:Object.assign({}, code ? {Authorization:"Bearer " + code} : {},
                            origin ? {Origin:origin} : {},
                            body ? {"Content-Type":"application/json"} : {}),
  body
}), env);

const payload = JSON.stringify({code:"CQ4:abc", sum:{dev:"a1b2c3", who:"大寶", at:1, days:{}}});

// ① 正常寫入
let r = await call("PUT", "/s/%E5%A4%A7%E5%AF%B6", {code:"w-secret", body:payload, origin:APP});
ok(r.status === 200, `小孩的碼要寫得進去, 實得 ${r.status}`);
ok(r.headers.get("Access-Control-Allow-Origin") === APP, 'CORS 要放行 App 的網域');
ok([...kv.m.keys()].some(k=>k.startsWith("head:")), '要寫一把 head: 當最新指標');
ok([...kv.m.keys()].some(k=>k.startsWith("snap:")), '要寫一把 snap: 當歷史');

// ② 家長的碼「絕對不能」寫入 —— 這是整支程式的重點
r = await call("PUT", "/s/大寶", {code:"r-secret", body:payload});
ok(r.status === 401, `家長的碼不得用來寫入, 實得 ${r.status}`);
r = await call("PUT", "/p/list", {code:"r-secret", body:payload});
ok(r.status === 405 || r.status === 404, `家長路徑不得接受 PUT, 實得 ${r.status}`);
for(const m of ["POST", "DELETE", "PATCH"]){
  r = await call(m, "/p/list", {code:"r-secret"});
  ok(r.status !== 200, `家長路徑不得接受 ${m}, 實得 ${r.status}`);
  r = await call(m, "/s/大寶", {code:"w-secret", body:payload});
  ok(r.status !== 200, `寫入路徑不得接受 ${m}（只准 PUT）, 實得 ${r.status}`);
}

// ③ 小孩的碼不能讀 —— 反過來也要擋
r = await call("GET", "/p/list", {code:"w-secret"});
ok(r.status === 401, `小孩的碼不得用來讀取, 實得 ${r.status}`);

// ④ 沒有碼、錯的碼、空的碼
for(const c of [undefined, "", "wrong-code", "w-secre", "w-secretx"]){
  r = await call("PUT", "/s/大寶", {code:c, body:payload});
  ok(r.status === 401, `錯的碼「${c}」不得寫入, 實得 ${r.status}`);
  r = await call("GET", "/p/list", {code:c});
  ok(r.status === 401, `錯的碼「${c}」不得讀取, 實得 ${r.status}`);
}

// ⑤ 家長讀得到，但「讀不到完整備份碼」——清單只給摘要
r = await call("GET", "/p/list", {code:"r-secret", origin:APP});
ok(r.status === 200, `家長的碼要讀得到, 實得 ${r.status}`);
let j = await r.json();
ok(j.children.length === 1 && j.children[0].child === "大寶", `要列出小孩, 實得 ${JSON.stringify(j.children)}`);
ok(j.children[0].sum && j.children[0].sum.who === "大寶", '清單要帶摘要');
ok(!("code" in j.children[0]), '清單不得夾帶完整備份碼（那是給還原用的，不是給看的）');

// ⑥ 要完整備份碼要另外一條路
r = await call("GET", "/p/snap/大寶", {code:"r-secret"});
j = await r.json();
ok(r.status === 200 && j.code === "CQ4:abc", `snap 才給完整備份碼, 實得 ${r.status}`);
r = await call("GET", "/p/snap/沒這個人", {code:"r-secret"});
ok(r.status === 404, `查不到的人要回 404, 實得 ${r.status}`);

// ⑦ 歷史只增不改：同一個小孩寫兩次，snap 要留兩把
const before = [...kv.m.keys()].filter(k=>k.startsWith("snap:")).length;
await new Promise(res=>setTimeout(res, 1100));            // 鑰匙用「秒」當後綴
await call("PUT", "/s/大寶", {code:"w-secret",
  body:JSON.stringify({code:"CQ4:xyz", sum:{dev:"a1b2c3"}})});
const after = [...kv.m.keys()].filter(k=>k.startsWith("snap:")).length;
ok(after === before + 1, `歷史要只增不改, ${before} → ${after}`);
r = await call("GET", "/p/snap/大寶", {code:"r-secret"});
ok((await r.json()).code === "CQ4:xyz", 'head 要指到最新那份');
r = await call("GET", "/p/history/大寶", {code:"r-secret"});
ok((await r.json()).keys.length === after, '倒退查得到每一份歷史');

// ⑧ 亂七八糟的輸入
r = await call("PUT", "/s/大寶", {code:"w-secret", body:"這不是 json"});
ok(r.status === 400, `壞掉的 JSON 要擋下來, 實得 ${r.status}`);
r = await call("PUT", "/s/大寶", {code:"w-secret", body:JSON.stringify({sum:{}})});
ok(r.status === 400, `沒有備份碼要擋下來, 實得 ${r.status}`);
r = await call("PUT", "/s/" + "長".repeat(50), {code:"w-secret", body:payload});
ok(r.status === 400, `名字太長要擋下來, 實得 ${r.status}`);
r = await call("PUT", "/s/大寶", {code:"w-secret",
  body:JSON.stringify({code:"x".repeat(1024*1024+10)})});
ok(r.status === 413, `太大的內容要擋下來, 實得 ${r.status}`);
r = await call("GET", "/亂逛", {code:"r-secret"});
ok(r.status === 404, `不存在的路徑要回 404, 實得 ${r.status}`);

// ⑨ CORS：只放行自己的網域
r = await call("GET", "/p/list", {code:"r-secret", origin:"https://evil.example.com"});
ok(!r.headers.get("Access-Control-Allow-Origin"), '別的網域不得拿到 CORS 放行');
r = await call("OPTIONS", "/s/大寶", {origin:APP});
ok(r.status === 204 && r.headers.get("Access-Control-Allow-Origin") === APP, '預檢要過');
ok(!(await call("OPTIONS", "/s/大寶", {origin:APP})).headers.get("Access-Control-Allow-Methods").includes("DELETE"),
  '不得放行 DELETE');

// ---------- ⑩ 密鑰沒綁 = 全開？（timingSafe("","") 會回 true）----------
{
  const kv2 = fakeKV();
  const bare = {KV:kv2, ALLOW_ORIGIN:APP};              // 兩個密鑰都沒綁
  const c = (m, p, o = {}) => worker.fetch(new Request("https://api.test" + p, {
    method:m, headers:o.code ? {Authorization:"Bearer " + o.code} : {}, body:o.body}), bare);
  let r = await c("PUT", "/s/大寶", {body:payload});
  ok(r.status !== 200, `密鑰沒綁時，不帶鑰匙不得寫得進去, 實得 ${r.status}`);
  ok(r.status === 500, `密鑰沒綁應該整支停用回 500, 實得 ${r.status}`);
  r = await c("GET", "/p/list");
  ok(r.status === 500, `密鑰沒綁時讀取也要擋, 實得 ${r.status}`);
  ok(kv2.m.size === 0, "密鑰沒綁時不得有任何東西被寫進 KV");
  // 只綁一半也不行
  const half = {KV:fakeKV(), WRITE_CODE:"w", ALLOW_ORIGIN:APP};
  r = await worker.fetch(new Request("https://api.test/s/大寶", {method:"PUT", body:payload,
    headers:{Authorization:"Bearer w"}}), half);
  ok(r.status === 500, `只綁一半也要停用, 實得 ${r.status}`);
}

// ---------- ⑪ 名字不得汙染 KV 的鑰匙結構 ----------
for(const bad of ["大寶:x", "a/b", "", "  ", "x".repeat(41), "a:b:c"]){
  const r = await call("PUT", "/s/" + encodeURIComponent(bad), {code:"w-secret", body:payload});
  ok(r.status !== 200, `名字「${bad}」要擋下來, 實得 ${r.status}`);
  ok(![...kv.m.keys()].some(k=>k.includes(bad) && bad), `名字「${bad}」不得被寫進 KV`);
}
ok((await call("PUT", "/s/" + encodeURIComponent("小明-2"), {code:"w-secret", body:payload})).status === 200,
  "正常的中文與連字號名字要收得下");
// dev 也一樣：它會變成鑰匙的一段
await call("PUT", "/s/髒dev", {code:"w-secret",
  body:JSON.stringify({code:"CQ4:x", sum:{dev:"a:b:../../x"}})});
ok(![...kv.m.keys()].some(k=>k.includes("../")), "dev 裡的怪字元不得進到鑰匙裡");

// ---------- ⑫ 壞掉的網址編碼不得炸成 500 ----------
{
  const r = await worker.fetch(new Request("https://api.test/s/%zz", {method:"PUT",
    headers:{Authorization:"Bearer w-secret"}, body:payload}), env);
  ok(r.status === 400, `壞掉的編碼要回 400 而不是炸掉, 實得 ${r.status}`);
}

// ---------- ⑬ 歷史超過一頁時，要看得到「最新的」而不是最舊的 ----------
{
  const kv3 = fakeKV(), env3 = ENV(kv3);
  for(let i = 0; i < 1500; i++) kv3.m.set(`snap:多寶:d1:${pad12(i)}`, "{}");
  kv3.m.set("head:多寶", JSON.stringify({child:"多寶", at:1, code:"CQ4:new", sum:{}}));
  const r = await worker.fetch(new Request("https://api.test/p/history/多寶",
    {headers:{Authorization:"Bearer r-secret"}}), env3);
  const j = await r.json();
  ok(j.keys.length === 50, `要回最近 50 筆, 實得 ${j.keys.length}`);
  ok(j.keys[0].endsWith(pad12(1499)), `第一筆要是最新的, 實得 ${j.keys[0]}`);
  ok(!j.keys.some(k=>k.endsWith(pad12(0))), "不得回傳最舊的那些");
}

// ---------- ⑭ 光有鑰匙名稱救不回東西，要能真的取回那一份 ----------
{
  const hist = (await (await call("GET", "/p/history/大寶", {code:"r-secret"})).json()).keys;
  ok(hist.length > 0, "要查得到歷史");
  let r = await call("GET", "/p/at/" + encodeURIComponent(hist[hist.length - 1]), {code:"r-secret"});
  ok(r.status === 200 && (await r.json()).code === "CQ4:abc",
    `要能取回舊的那一份（救得回來才算數）, 實得 ${r.status}`);
  r = await call("GET", "/p/at/" + encodeURIComponent("head:大寶"), {code:"r-secret"});
  ok(r.status === 400, `只准讀 snap: 開頭的鑰匙, 實得 ${r.status}`);
  r = await call("GET", "/p/at/" + encodeURIComponent("snap:不存在"), {code:"r-secret"});
  ok(r.status === 404, `取不到要回 404, 實得 ${r.status}`);
  r = await call("PUT", "/p/at/x", {code:"w-secret", body:payload});
  ok(r.status !== 200, "小孩的鑰匙不得碰 /p/at");
}

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail ? 1 : 0);
})();
