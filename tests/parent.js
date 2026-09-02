/* 家長儀表板：唯讀不是「按鈕沒放出來」

   Worker 那邊已經擋掉家長鑰匙的寫入路徑（見 tests/worker.js）。這裡再從
   另一個角度確認：這個檔案本身連一個寫入請求都發不出來，就算有人打開
   開發者工具亂改前端也一樣。 */
const fs = require("fs"), path = require("path"), {JSDOM} = require("jsdom");
const file = path.join(__dirname, "..", "parent.html");
const html = fs.readFileSync(file, "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

// ---------- ① 靜態檢查：整份檔案不得有任何寫入的痕跡 ----------
ok(!/method\s*:\s*["'](PUT|POST|DELETE|PATCH)/i.test(html), "不得出現寫入用的 HTTP 方法");
ok(!/\bXMLHttpRequest\b|\bsendBeacon\b|\bnavigator\.send/i.test(html), "不得有其他送資料的管道");
ok((html.match(/fetch\(/g) || []).length === 1, "整份只該有一個 fetch（讀清單）");
ok(!/\/s\//.test(html.replace(/https?:\/\//g, "")), "不得出現寫入端點 /s/");

// ---------- ② 行為 ----------
const D = "2026-09-02", D2 = "2026-09-01";
const LIST = {children:[
  {child:"大寶", dev:"aa11", at:Math.floor(Date.now()/1000) - 120, sum:{
    v:"2026.09.02-b", who:"大寶", streak:3,
    days:{[D2]:{n:30,r:28,m:15}, [D]:{n:50,r:45,m:30}},
    bank:{earned:120, bonus:30, used:60, gift:25, left:115},
    gifts:[{d:D2, m:30, why:"幫忙洗碗"}, {d:D2, m:-5, why:"亂發脾氣"}],
    coupons:[{d:D2, on:D, why:"考試進步"}],
    decks:{summer:{label:"暑假版", total:114, done:200, right:170, mastered:60,
                   weak:[{w:"honest", zh:"誠實的", x:4}, {w:"nurse", zh:"護士", x:2}]}}}},
  {child:"二寶", dev:"bb22", at:Math.floor(Date.now()/1000) - 7200, sum:{
    v:"2026.09.02-b", who:"二寶", streak:0, days:{}, bank:{left:0},
    gifts:[], coupons:[], decks:{}}}
]};

function boot(seed, handler){
  const calls = [];
  const dom = new JSDOM(html, {runScripts:"dangerously", pretendToBeVisual:true,
    url:"https://english.ku-ai.cc/parent.html",
    beforeParse(win){
      if(seed) seed(win.localStorage);
      win.fetch = (u, o) => {
        calls.push({url:String(u), opt:o || {}});
        return Promise.resolve(handler(String(u), o || {}));
      };
    }});
  return {w:dom.window, d:dom.window.document, calls};
}
const okRes = body => ({ok:true, status:200, json:()=>Promise.resolve(body)});
const errRes = s => ({ok:false, status:s, json:()=>Promise.resolve({})});
const wait = () => new Promise(r=>setTimeout(r, 60));
const conf = {api:"https://english-api.ku-ai.cc", code:"r-secret"};
const seedConf = ls => ls.setItem("cqp-conf", JSON.stringify(conf));

(async () => {
// 沒設定過 → 先問設定碼，而且不得先去打 API
let t = boot(null, () => okRes(LIST));
await wait();
ok(!!t.d.getElementById("cc"), "沒設定過要顯示設定畫面");
ok(t.calls.length === 0, "還沒設定就不得發出任何請求");

// 壞掉的設定碼要擋下來
t.d.getElementById("cc").value = "亂打一通";
t.d.getElementById("go").dispatchEvent(new t.w.MouseEvent("click", {bubbles:true}));
await wait();
ok(/不是家長設定碼/.test(t.d.body.textContent), "不是設定碼要講清楚");
ok(t.calls.length === 0, "設定碼不對就不得發請求");

// 設定好之後：只發一個 GET，帶著家長的鑰匙
t = boot(seedConf, () => okRes(LIST));
await wait();
ok(t.calls.length === 1, `只該發一個請求, 實得 ${t.calls.length}`);
const c0 = t.calls[0];
ok(/\/p\/list$/.test(c0.url), `要打讀取端點, 實得 ${c0.url}`);
ok(!c0.opt.method || c0.opt.method.toUpperCase() === "GET", `必須是 GET, 實得 ${c0.opt.method}`);
ok(!c0.opt.body, "不得夾帶內容");
ok((c0.opt.headers || {}).Authorization === "Bearer r-secret", "要帶家長的鑰匙");

// 三個問題都要答得出來
const txt = t.d.body.textContent;
ok(/大寶/.test(txt) && /二寶/.test(txt), "兩個小孩都要列出來");
ok(/這兩週有沒有在練/.test(txt), "要有『有沒有在練』");
ok(/哪幾個字一直錯/.test(txt), "要有『哪幾個字一直錯』");
ok(/送的獎勵有沒有效/.test(txt), "要有『獎勵有沒有效』");
ok(/honest/.test(txt) && /誠實的/.test(txt), "要列出一直錯的字");
ok(/錯 4/.test(txt), "要顯示錯幾次");
ok(/幫忙洗碗/.test(txt), "要看得到贈送原因");
ok(/亂發脾氣/.test(txt), "沒收也要看得到");
ok(/考試進步/.test(txt) && /加倍券/.test(txt), "加倍券也要看得到");
ok(/連續天數/.test(txt) && />3</.test(t.d.body.innerHTML), "要顯示連續天數");
ok(/115/.test(txt), "要顯示存摺剩餘");
ok(/唯讀/.test(txt), "畫面上要標明這是唯讀的");
ok(t.d.querySelectorAll(".d.gift").length > 0, "有送獎勵的日子要在圖上標出來");
ok(/2026\.09\.02-b/.test(txt), "要看得到小孩那台的版本");

// 沒資料時要講人話，不是空白
t = boot(seedConf, () => okRes({children:[]}));
await wait();
ok(/還沒有任何資料/.test(t.d.body.textContent), "雲端沒資料要說明原因");

// 鑰匙不對
t = boot(seedConf, () => errRes(401));
await wait();
ok(/設定碼不對/.test(t.d.body.textContent), "401 要講清楚是碼的問題");
ok(!!t.d.getElementById("rs"), "要給重新設定的路");

// 雲端掛掉
t = boot(seedConf, () => errRes(500));
await wait();
ok(/500/.test(t.d.body.textContent), "其他錯誤要把狀態碼講出來");

// 重新整理只是再讀一次
t = boot(seedConf, () => okRes(LIST));
await wait();
t.d.getElementById("rf").dispatchEvent(new t.w.MouseEvent("click", {bubbles:true}));
await wait();
ok(t.calls.length === 2, `重新整理要再讀一次, 實得 ${t.calls.length}`);
ok(t.calls.every(c=>!c.opt.method || c.opt.method.toUpperCase() === "GET"), "每一次都必須是 GET");

// ---------- ③ XSS：資料來自小孩那台裝置，Worker 不驗型別 ----------
// 「看起來一定是數字」的欄位如果直接插進 HTML，小孩改一下就能在家長瀏覽器執行程式碼。
// 而這頁跟 App 同源，等於能讀走家長的鑰匙和密碼。
const BOOM = '<img src=x onerror="window.__pwned=1">';
const EVIL = {children:[{child:"壞資料", dev:"x", at:1, sum:{
  v:BOOM, who:BOOM, streak:BOOM,
  days:{[D]:{n:BOOM, r:BOOM, m:BOOM}},
  bank:{earned:BOOM, bonus:BOOM, used:BOOM, gift:BOOM, left:BOOM},
  gifts:[{d:D, m:BOOM, why:BOOM}],
  coupons:[{d:D, on:D, why:BOOM}],
  decks:{summer:{label:BOOM, total:BOOM, done:BOOM, right:BOOM, mastered:BOOM,
                 weak:[{w:BOOM, zh:BOOM, x:BOOM}]}}}}]};
t = boot(seedConf, () => okRes(EVIL));
await wait();
ok(!t.w.__pwned, "小孩上傳的內容不得在家長瀏覽器裡執行");
ok(t.d.querySelectorAll("img").length === 0, `不得注入出任何元素, 實得 ${t.d.querySelectorAll("img").length} 個 img`);
// 字串欄位（原因、單字）本來就會原樣顯示，escape 過的文字出現在畫面上是對的；
// 真正不能發生的是它變成「屬性」
ok(t.d.querySelectorAll("[onerror],[onload],[onclick]").length === 0, "不得產生任何事件屬性");
ok(t.d.querySelectorAll("script").length === 1, "不得多出 script 標籤");
ok(/連續天數/.test(t.d.body.textContent), "擋掉之後畫面仍要正常渲染");
ok(/>0</.test(t.d.body.innerHTML), "壞掉的數字要退回 0，不是印出原文");

// 型別亂七八糟也不能整頁壞掉
const MESS = {children:[
  {child:"甲", dev:"x", at:1, sum:{days:"不是物件", gifts:"不是陣列", coupons:null,
                                   bank:"不是物件", decks:[1,2,3], streak:null}},
  {child:"乙", dev:"x", at:1, sum:null},
  {child:"丙", dev:"x", at:1}
]};
t = boot(seedConf, () => okRes(MESS));
await wait();
ok(/甲/.test(t.d.body.textContent), "型別亂掉也要撐得住，不能整頁空白");
ok(/乙/.test(t.d.body.textContent) && /丙/.test(t.d.body.textContent),
  "沒有摘要的小孩也要列出來並說明");
ok(!!t.d.getElementById("rf"), "壞資料之後重新整理鈕仍要在");

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail ? 1 : 0);
})();
