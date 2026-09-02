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

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail ? 1 : 0);
})();
