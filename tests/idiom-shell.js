/* 成語ㄚ喵 E1：骨架
   驗收：開得起來、深淺色與字級跟單字闖關同一組設定、無障礙過、導覽正確、
   hidden 的東西真的看不見（這專案的老坑）、而且——最重要的——
   跟單字闖關讀到的是「同一份」存摺與日曆，兩個方向都不能失真。 */
const fs = require("fs"), path = require("path"), {JSDOM} = require("jsdom");
const {check} = require("./lib/a11y-check");
const ROOT = path.join(__dirname, "..");
const idiomHtml = fs.readFileSync(path.join(ROOT, "idiom.html"), "utf8");
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

function boot(html, file, seed){
  const dom = new JSDOM(html, {runScripts:"dangerously", pretendToBeVisual:true, url:"https://x.test/" + file,
    beforeParse(win){
      win.speechSynthesis = {speak(){}, cancel(){}, getVoices:()=>[{lang:"en-US", name:"S"}], addEventListener(){}};
      win.SpeechSynthesisUtterance = function(t){ this.text = t; };
      if(seed) seed(win.localStorage);
    }});
  const w = dom.window;
  w.alert = ()=>{}; w.confirm = ()=>true; w.scrollTo = ()=>{}; w.HTMLElement.prototype.scrollIntoView = function(){};
  return {w, d:w.document, $:id=>w.document.getElementById(id), ev:x=>w.eval(x),
          click:e=>e.dispatchEvent(new w.MouseEvent("click", {bubbles:true}))};
}
const disp = (t, el) => t.w.getComputedStyle(el).display;

// ---------- ① 無障礙：同一把尺 ----------
const issues = check(path.join(ROOT, "idiom.html"));
ok(issues.length === 0, "無障礙問題：\n      " + issues.join("\n      "));

// ---------- ② 導覽 ----------
let t = boot(idiomHtml, "idiom.html");
const tabs = [...t.d.querySelectorAll(".nav button")];
ok(tabs.length === 4, `導覽列要四個分頁, 實得 ${tabs.length}`);
const cols = /\.nav-in\{[^}]*grid-template-columns:\s*repeat\((\d+)/.exec(idiomHtml.match(/<style>([\s\S]*?)<\/style>/)[1]);
ok(cols && +cols[1] === tabs.length, `導覽列欄數(${cols && cols[1]})要等於分頁數(${tabs.length})`);
const nav = v => tabs.find(b=>b.dataset.view === v);
ok(nav("vQuiz").getAttribute("aria-current") === "true", "一開始要在練習頁");
ok(disp(t, t.$("vQuiz")) !== "none" && disp(t, t.$("vList")) === "none", "一開始只有練習頁看得見");
t.click(nav("vList"));
ok(nav("vList").getAttribute("aria-current") === "true" && nav("vQuiz").getAttribute("aria-current") === "false", "切分頁要更新 aria-current");
ok(disp(t, t.$("vList")) !== "none" && disp(t, t.$("vQuiz")) === "none", "切過去之後只有成語表看得見");
ok([...t.d.querySelectorAll(".view")].filter(v=>disp(t, v) !== "none").length === 1, "任何時候只能有一個分頁看得見");
// 貓：第二階才有，鈕在但不能按，而且要進得了 tab 順序
const cat = nav("vCat");
ok(cat.getAttribute("aria-disabled") === "true" && !cat.disabled, "貓的分頁要用 aria-disabled（不是 disabled）");
t.click(cat);
ok(nav("vList").getAttribute("aria-current") === "true" && disp(t, t.$("vCat")) === "none", "按貓不得切過去");
ok(/第二階/.test(t.$("toast").textContent), "按貓要有提示說明為什麼");
ok(!!t.d.querySelector('a.back[href="./"]'), "要有回單字闖關的路");

// ---------- ③ hidden 的東西真的不能看見（display:grid/flex 蓋掉 hidden 是這專案的老坑）----------
{
  const probe = t.d.createElement("div"); probe.className = "lvrow matrix stats"; probe.hidden = true; t.d.body.appendChild(probe);
  ok(disp(t, probe) === "none", `hidden 元素即使掛著 grid 類別也必須 display:none, 實得 ${disp(t, probe)}`);
  probe.remove();
}

// ---------- ④ 顯示設定跟單字闖關讀同一組鑰匙 ----------
t = boot(idiomHtml, "idiom.html", ls=>{ ls.setItem("cq-theme", "dark"); ls.setItem("cq-scale", "1.3"); });
ok(t.d.documentElement.getAttribute("data-theme") === "dark", "小孩在單字闖關選的深色，這頁要照用");
ok(t.d.documentElement.style.getPropertyValue("--scale") === "1.3", "字級也要照用");
t = boot(idiomHtml, "idiom.html", ls=>ls.setItem("cq-theme", "light"));
ok(t.d.documentElement.getAttribute("data-theme") === "light", "淺色也要");
t = boot(idiomHtml, "idiom.html");
ok(!t.d.documentElement.hasAttribute("data-theme"), "沒設定就跟隨系統（不蓋 data-theme）");
// 三種狀態的顏色都要在 :root 定義過，不能只藏在 media/[data-theme] 裡
{
  const css = idiomHtml.match(/<style>([\s\S]*?)<\/style>/)[1];
  const root = css.match(/:root\{([^}]*)\}/)[1];
  ["--ground","--surface","--ink","--brand","--line","--no","--ok","--mark"].forEach(v=>
    ok(root.includes(v + ":"), `${v} 要在裸 :root 定義，否則跟隨系統時會漏色`));
  ok(/prefers-color-scheme:dark[\s\S]*:root:not\(\[data-theme="light"\]\)/.test(css), "系統深色要讓明選淺色蓋得過");
  ok(/:root\[data-theme="dark"\]/.test(css), "明選深色要蓋得過系統淺色");
}

// ---------- ⑤ 成語表 ----------
t = boot(idiomHtml, "idiom.html");
t.click(nav("vList"));
const rows = t.d.querySelectorAll("#listBody details.irow");
ok(rows.length === t.ev("IDIOMS.length"), `成語表要列出全部, ${rows.length} vs ${t.ev("IDIOMS.length")}`);
ok(/ㄧ ㄒㄧㄣ ㄧ ㄧˋ/.test(rows[0].textContent), "每一條要有注音");
ok(disp(t, rows[0].querySelector(".in")) === "none" || !rows[0].open, "解釋預設要收起來");
t.$("search").value = "刺骨"; t.$("search").dispatchEvent(new t.w.Event("input"));
ok(t.d.querySelectorAll("#listBody details.irow").length === 1, "搜尋要縮到符合的那幾條");
ok(/寒風刺骨/.test(t.$("listBody").textContent), "搜尋結果要對");
t.$("search").value = "ㄏㄢˊ ㄈㄥ"; t.$("search").dispatchEvent(new t.w.Event("input"));
ok(/寒風刺骨/.test(t.$("listBody").textContent), "用注音也搜得到");
t.$("search").value = "沒有這個"; t.$("search").dispatchEvent(new t.w.Event("input"));
ok(/找不到/.test(t.$("listBody").textContent), "搜不到要講");

// ---------- ⑥ 跟單字闖關讀同一份存摺（兩個方向）----------
// 先讓單字闖關產生一份真的紀錄，再拿它存到 localStorage 的原文餵給成語頁
const today = (() => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); })();
const yday = (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); })();
const a = boot(indexHtml, "index.html", ls=>ls.setItem("cq-shared-v1", JSON.stringify({
  days:{[yday]:{n:30, r:28, paid:15}, [today]:{n:10, r:9, paid:2}},
  bank:{earned:17, used:0, bonus:0}, gifts:[{d:today, m:30, why:"幫忙洗碗", ts:1700000000}], coupons:[]})));
const rawFromIndex = a.w.localStorage.getItem("cq-shared-v1") || "";
ok(rawFromIndex.length > 0, "單字闖關要有寫回去");
const b = boot(idiomHtml, "idiom.html", ls=>ls.setItem("cq-shared-v1", rawFromIndex));
ok(b.ev("SHARED.bank.earned") === a.ev("SHARED.bank.earned"), "存摺數字要一樣");
ok(b.ev("streakDays()") === a.ev("streakDays()") && b.ev("streakDays()") === 2, `連續天數要一樣（都是 2）, 成語頁 ${b.ev("streakDays()")} / 單字 ${a.ev("streakDays()")}`);
ok(b.ev("Object.keys(SHARED.days).length") === 2, "日曆要讀到同樣的天");
ok(b.ev("SHARED.gifts.length") === 1 && b.ev("SHARED.gifts[0].why") === "幫忙洗碗", "贈送紀錄也要在（雖然這頁不顯示）");
ok(b.$("stStreak").textContent === "2", `進度頁要顯示連續天數 2, 實得「${b.$("stStreak").textContent}」`);
ok(/再答對 \d+ 題 → \d+ 顆/.test(b.$("hStreak").textContent), `頂端要講還差幾題換幾顆（跟單字闖關同一個語氣）, 實得「${b.$("hStreak").textContent}」`);
// 反方向：成語頁存回去的，單字闖關要讀得回來且一個欄位都不掉
b.ev("SHARED.feed = {earned:5, used:0, bonus:0}; saveShared();");
const rawFromIdiom = b.w.localStorage.getItem("cq-shared-v1");
const c = boot(indexHtml, "index.html", ls=>ls.setItem("cq-shared-v1", rawFromIdiom));
ok(c.ev("SHARED.bank.earned") === 17 && c.ev("Object.keys(SHARED.days).length") === 2, "成語頁存回去的，單字闖關要讀得回來");
ok(c.ev("SHARED.gifts.length") === 1 && c.ev("SHARED.gifts[0].dev") !== undefined, "贈送紀錄不得因為繞過成語頁而掉欄位");
ok(c.ev("bankLeft()") === a.ev("bankLeft()") && a.ev("bankLeft()") === 47, `單字闖關的存摺餘額不得被成語頁動到（17 賺 + 30 送 = 47）, 實得 ${c.ev("bankLeft()")}`);
ok(JSON.parse(rawFromIdiom).feed && JSON.parse(rawFromIdiom).feed.earned === 5, "成語頁自己的飼料帳要存得進同一份");
ok(c.ev("SHARED.feed && SHARED.feed.earned") === 5, "單字闖關讀進來要把成語頁的 feed 欄位留著");
c.ev("saveShared()");                                    // 單字闖關存一次檔
const afterIndexSave = JSON.parse(c.w.localStorage.getItem("cq-shared-v1"));
ok(afterIndexSave.feed && afterIndexSave.feed.earned === 5, "單字闖關存檔之後，成語頁的飼料帳不得被靜默洗掉（loadShared 只挑欄位重建就會發生）");

// 從沒開過單字闖關的裝置：成語頁不得憑空造一份存摺出來
const e = boot(idiomHtml, "idiom.html");
e.ev("SHARED.feed = {earned:1}; saveShared();");
ok(e.w.localStorage.getItem("cq-shared-v1") === null, "沒有存摺時成語頁不得自己寫一份（會擋掉單字闖關的舊資料搬家）");
ok(e.$("hFeed").textContent === "0" && e.$("stStreak").textContent === "0" && /再答對/.test(e.$("hStreak").textContent), "沒有紀錄時畫面要是空的而不是壞的");

// ---------- ⑦ 版本標示 ----------
ok(/版本 \d{4}\.\d{2}\.\d{2}-[a-z]/.test(t.$("heroVer").textContent), "要有版本標示");
ok(/題庫 \d+ 條/.test(t.$("verline").textContent), "頁尾要有題庫條數");

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail ? 1 : 0);
