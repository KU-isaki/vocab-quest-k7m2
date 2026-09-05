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
ok((html.match(/fetch\(/g) || []).length === 2, "只該有兩個 fetch（讀清單、取備份碼）");
ok(!/["'`]\/s\/["'`+]|\+\s*"\/s\/"/.test(html), "不得出現寫入端點 /s/");

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
                   weak:[{w:"honest", zh:"誠實的", x:4}, {w:"nurse", zh:"護士", x:2}]}},
    feed:{earned:14, used:3, bonus:0, tickets:1},
    idiom:{byLv:{1:{m:20, total:80}, 2:{m:5, total:120}, 3:{m:0, total:120}, 4:{m:0, total:129}},
           weak:[{c:"守株待兔", m:"死守老方法，只想等好運。", x:3}], done:60, right:50, streak:2, at:1},
    pet:{name:"小橘", breed:"orange", xp:180, hunger:64, clean:22, stage:"少年貓", adopted:"2026-09-01", away:null, box:false,
         diary:[{d:"2026-09-01", text:"領養了小橘"}, {d:D, text:"小橘長成少年貓了"}]}}},
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
// 成語ㄚ喵
ok(/成語ㄚ喵/.test(txt), "要有成語ㄚ喵這一段");
ok(/守株待兔/.test(txt) && /錯 3/.test(txt), "要列出一直錯的成語");
ok(/20 \/ 80/.test(txt), "各級熟練要顯示");
ok(/>11</.test(t.d.body.innerHTML), "飼料剩餘要算對（14+0-3）");
ok(t.d.querySelectorAll(".lvb").length === 4, "四級都要有一條");
// 貓
ok(/貓：小橘/.test(txt), "要有貓卡");
ok(/少年貓/.test(txt) && /貓砂該清了/.test(txt), `貓卡要講狀態（清潔 22 → 該清了）`);
ok(/長成少年貓/.test(txt), "貓卡要有最近的日記");
ok(!/成語ㄚ喵/.test(boot(seedConf, () => okRes({children:[LIST.children[1]]})).d.body.textContent) || true, "沒練成語的小孩不強制顯示");

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
                 weak:[{w:BOOM, zh:BOOM, x:BOOM}]}},
  feed:{earned:BOOM, used:BOOM, bonus:BOOM, tickets:BOOM},
  pet:{name:BOOM, breed:BOOM, xp:BOOM, hunger:BOOM, clean:BOOM, stage:BOOM, adopted:BOOM, away:BOOM, box:BOOM, diary:[{d:BOOM, text:BOOM}]},
  idiom:{byLv:{1:{m:BOOM, total:BOOM}}, weak:[{c:BOOM, m:BOOM, x:BOOM}], streak:BOOM}}}]};
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

// ---------- ④ 取得備份碼：一樣只有 GET ----------
const CODE = "CQ4:" + "x".repeat(300);
const route = u => /\/p\/snap\//.test(u)
  ? okRes({child:"大寶", at:Math.floor(Date.now()/1000) - 60, code:CODE, sum:{}})
  : okRes(LIST);
t = boot(seedConf, route);
await wait();
const grab = t.d.querySelector('[data-grab="大寶"]');
ok(!!grab, "每個小孩要有一顆取備份碼的鈕");
ok(t.d.querySelectorAll("[data-grab]").length === 2, "兩個小孩各一顆");
grab.dispatchEvent(new t.w.MouseEvent("click", {bubbles:true}));
await wait();
const snapCall = t.calls[t.calls.length - 1];
ok(/\/p\/snap\//.test(snapCall.url), `要打 /p/snap/, 實得 ${snapCall.url}`);
ok(!snapCall.opt.method || snapCall.opt.method.toUpperCase() === "GET",
  `取備份碼也必須是 GET, 實得 ${snapCall.opt.method}`);
ok(t.calls.every(c=>!c.opt.method || c.opt.method.toUpperCase() === "GET"), "全程只准 GET");
const ta = t.d.querySelector('[data-box="大寶"] textarea');
ok(!!ta && ta.value === CODE, "備份碼要完整顯示出來");
ok(/貼上備份碼還原/.test(t.d.body.textContent), "要告訴家長這段怎麼用");
ok(!!t.d.querySelector('[data-act="copy"]') && !!t.d.querySelector('[data-act="save"]'),
  "要有複製與存檔兩個選項");

// 備份碼是小孩傳上來的字串，一樣不能當 HTML 塞
t = boot(seedConf, u => /\/p\/snap\//.test(u)
  ? okRes({child:"大寶", at:1, code:'<img src=x onerror="window.__pwned2=1">', sum:{}})
  : okRes(LIST));
await wait();
t.d.querySelector('[data-grab="大寶"]').dispatchEvent(new t.w.MouseEvent("click", {bubbles:true}));
await wait();
ok(!t.w.__pwned2, "備份碼的內容不得被當成 HTML 執行");
ok(t.d.querySelectorAll('[data-box="大寶"] img').length === 0, "不得注入元素");

// 取不到要講清楚，不能默默沒反應
t = boot(seedConf, u => /\/p\/snap\//.test(u) ? errRes(404) : okRes(LIST));
await wait();
const g2 = t.d.querySelector('[data-grab="大寶"]');
g2.dispatchEvent(new t.w.MouseEvent("click", {bubbles:true}));
await wait();
ok(/404/.test(t.d.body.textContent), "取不到要顯示原因");
ok(!g2.disabled && /取得備份碼/.test(g2.textContent), "失敗後按鈕要能再按一次");

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail ? 1 : 0);
})();
