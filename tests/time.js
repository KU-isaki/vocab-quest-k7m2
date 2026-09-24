/* 時間紀錄（time.html）：小孩回家後打卡「現在在做什麼」，家長頁畫成色帶一起看。

   紀錄不換分鐘、不算連續（無法驗證真偽，一掛獎勵就是鼓勵假打卡）。
   驗收：開得起來、無障礙過、顯示設定跟單字闖關同一組；讀不到存摺就不寫；
   打卡／停止／改／補記／刪的規則；忘了按停止的處理；事項清單（設定頁、要密碼）；
   備份碼往返；雲端摘要與回到單字闖關時補傳；家長頁的分頁。 */
const fs = require("fs"), path = require("path"), {JSDOM} = require("jsdom");
const {check} = require("./lib/a11y-check");
const ROOT = path.join(__dirname, "..");
const timeHtml = fs.readFileSync(path.join(ROOT, "time.html"), "utf8");
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const parentHtml = fs.readFileSync(path.join(ROOT, "parent.html"), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const key = d => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
const today = key(new Date()), y1 = key(new Date(Date.now() - 86400000)), y2 = key(new Date(Date.now() - 2 * 86400000));
const BASE = {days:{[y1]:{n:10, r:9}}, bank:{earned:20, used:0, bonus:0}, gifts:[], coupons:[]};

function boot(html, file, seed, opts){
  const calls = [];
  const dom = new JSDOM(html, {runScripts:"dangerously", pretendToBeVisual:true, url:"https://x.test/" + file,
    beforeParse(win){
      win.speechSynthesis = {speak(){}, cancel(){}, getVoices:()=>[{lang:"en-US", name:"S"}], addEventListener(){}};
      win.SpeechSynthesisUtterance = function(t){ this.text = t; };
      win.fetch = (u, o) => { calls.push({url:String(u), opt:o || {}}); return Promise.resolve({ok:true, status:200}); };
      if(seed) seed(win.localStorage);
    }});
  const w = dom.window;
  w.alert = ()=>{}; w.confirm = ()=>true; w.scrollTo = ()=>{}; w.HTMLElement.prototype.scrollIntoView = function(){};
  const t = {w, d:w.document, $:id=>w.document.getElementById(id), ev:x=>w.eval(x), ls:w.localStorage, calls,
          click:e=>e.dispatchEvent(new w.MouseEvent("click", {bubbles:true})),
          say:(...a)=>{ const q = a.slice(); w.prompt = () => q.length ? q.shift() : null; }};
  if(opts && opts.min !== undefined) t.ev(`nowMin = () => ${opts.min}; render();`);
  return t;
}
const bootTime = (seed, min) => boot(timeHtml, "time.html", seed, {min});
const shared = () => ls => ls.setItem("cq-shared-v1", JSON.stringify(BASE));
const chips = t => [...t.d.querySelectorAll("#actGrid [data-act]")];
const chip = (t, id) => chips(t).find(b=>b.dataset.act === id);
const tl = (t, k) => JSON.parse(t.ls.getItem("cq-shared-v1")).tl[k || today];
const disp = (t, el) => t.w.getComputedStyle(el).display;
const wait = () => new Promise(r=>setTimeout(r, 60));

(async () => {
// ---------- ① 骨架：無障礙、顯示設定、hidden ----------
{
  const issues = check(path.join(ROOT, "time.html"));
  ok(issues.length === 0, "無障礙問題：\n      " + issues.join("\n      "));
  let t = bootTime(ls=>{ ls.setItem("cq-theme", "dark"); ls.setItem("cq-scale", "1.3"); });
  ok(t.d.documentElement.getAttribute("data-theme") === "dark" && t.d.documentElement.style.getPropertyValue("--scale") === "1.3", "深淺色與字級跟單字闖關同一組設定");
  t = bootTime();
  ok(!t.d.documentElement.hasAttribute("data-theme"), "沒設定就跟隨系統");
  const css = timeHtml.match(/<style>([\s\S]*?)<\/style>/)[1];
  ok(/prefers-color-scheme:dark[\s\S]*:root:not\(\[data-theme="light"\]\)/.test(css) && /:root\[data-theme="dark"\]/.test(css), "深色的兩種來源都要蓋得對");
  const probe = t.d.createElement("form"); probe.className = "addbox"; probe.hidden = true; t.d.body.appendChild(probe);
  ok(disp(t, probe) === "none", `hidden 元素掛著 grid 類別也必須 display:none, 實得 ${disp(t, probe)}`);
  ok(!!t.d.querySelector('.mods a[href="./"]') && t.d.querySelector('.mods a[href="time.html"]').getAttribute("aria-current") === "page", "模組切換列要有、而且亮在時間");
  ok(!/https?:\/\//.test(timeHtml.replace(/<!--[\s\S]*?-->/g, "")) , "這頁不得有任何外部連結或資源（預設一個外部請求都不發）");
}

// ---------- ② 讀不到存摺就不寫 ----------
{
  const t = bootTime(null, 1000);
  ok(disp(t, t.$("noShared")) !== "none", "沒開過單字闖關的裝置要講清楚記不起來");
  ok(chips(t).length === 14, `內建十四項事項, 實得 ${chips(t).length}`);
  ok(chips(t).filter(b=>b.classList.contains("pt")).map(b=>b.dataset.act).join() === "home,wake,sleep", "到家、起床、睡覺是時間點，要畫成虛線框");
  t.click(chip(t, "wc"));
  ok(t.ls.getItem("cq-shared-v1") === null, "讀不到存摺就不得憑空造一份");
  ok(t.ls.getItem("cq-tl-dirty") === null, "沒寫就不得立旗");
}

// ---------- ③ 打卡：點下一件上一件就結束；停止；同一分鐘的零長度段拿掉 ----------
{
  const t = bootTime(shared(), 17 * 60 + 2);
  ok(disp(t, t.$("noShared")) === "none", "有存摺就不顯示那句話");
  ok(t.$("btnStop").disabled, "沒在記錄時停止鈕要鎖住");
  t.click(chip(t, "wc"));
  ok(tl(t).length === 1 && tl(t)[0].a === "wc" && tl(t)[0].s === 1022 && tl(t)[0].e === undefined, `點一下就開始, 實得 ${JSON.stringify(tl(t))}`);
  ok(chip(t, "wc").getAttribute("aria-pressed") === "true" && chip(t, "eat").getAttribute("aria-pressed") === "false", "正在做的那格要亮");
  ok(/上廁所/.test(t.$("nowBox").textContent) && /17:02/.test(t.$("nowBox").textContent), "「現在」要寫在做什麼、幾點開始");
  ok(t.ls.getItem("cq-tl-dirty") === "1", "存檔要立旗，回單字闖關時補傳");
  ok(JSON.parse(t.ls.getItem("cq-shared-v1")).bank.earned === 20 && JSON.parse(t.ls.getItem("cq-shared-v1")).days[y1].n === 10, "存摺與日曆不得被動到");
  t.click(chip(t, "wc"));
  ok(tl(t).length === 1, "再點同一件不得多一段");
  t.ev("nowMin = () => 1030");
  t.click(chip(t, "eat"));
  ok(tl(t).length === 2 && tl(t)[0].e === 1030 && tl(t)[1].a === "eat" && tl(t)[1].s === 1030, `點下一件，上一件要結束在同一個時間, 實得 ${JSON.stringify(tl(t))}`);
  t.say("數學習作 p.12|國語;"); t.click(chip(t, "hw"));   // 同一分鐘：吃飯是 0 分鐘，拿掉；寫功課要問備註
  ok(tl(t).length === 2 && tl(t)[1].a === "hw" && tl(t)[1].s === 1030, `同一分鐘內換事項，0 分鐘那段要拿掉, 實得 ${JSON.stringify(tl(t))}`);
  ok(tl(t)[1].n === "數學習作 p.12 國語", `寫功課開始時問備註、去分隔符, 實得「${tl(t)[1].n}」`);
  ok(/數學習作 p\.12/.test(t.$("segList").textContent), "備註要顯示在今天的清單");
  t.ev("nowMin = () => 1100");
  t.click(t.$("btnStop"));
  ok(tl(t).length === 2 && tl(t)[1].e === 1100 && !t.ev("openSeg()"), "停止要把進行中那段收掉");
  ok(t.$("btnStop").disabled, "停了之後停止鈕要鎖住");
  ok(/2 段/.test(t.$("todaySum").textContent) && /1 小時 18 分/.test(t.$("todaySum").textContent) && !/空檔/.test(t.$("todaySum").textContent), `今天的小結：2 段、共 78 分、沒有空檔, 實得「${t.$("todaySum").textContent}」`);
  const rows = [...t.d.querySelectorAll("#segList details.seg")];
  ok(rows.length === 2 && /17:02–17:10/.test(rows[0].textContent) && /寫功課/.test(rows[1].textContent) && /1 小時 10 分/.test(rows[1].textContent), "今天的每一段要列出來、附長度");
  // 改：時間要合理、不能重疊
  const f = rows[1].querySelector("form");
  f.querySelector("[name=s]").value = "17:05"; f.querySelector("[name=e]").value = "18:40"; f.dispatchEvent(new t.w.Event("submit", {bubbles:true, cancelable:true}));
  ok(tl(t)[1].s === 1030 && tl(t)[1].e === 1100, "改成跟上一段重疊要擋下來");
  f.querySelector("[name=s]").value = "18:00"; f.querySelector("[name=e]").value = "17:50"; f.dispatchEvent(new t.w.Event("submit", {bubbles:true, cancelable:true}));
  ok(tl(t)[1].s === 1030, "結束在開始之前要擋下來");
  f.querySelector("[name=s]").value = "17:15"; f.querySelector("[name=e]").value = "18:40"; f.querySelector("[name=n]").value = "改成英文"; f.dispatchEvent(new t.w.Event("submit", {bubbles:true, cancelable:true}));
  ok(tl(t)[1].s === 1035 && tl(t)[1].e === 1120 && tl(t)[1].n === "改成英文", `改得了（含備註）, 實得 ${JSON.stringify(tl(t)[1])}`);
  ok(/空檔 5 分/.test(t.$("todaySum").textContent) && /空檔 5 分/.test(t.$("segList").textContent), `改出來的 5 分鐘空檔要標出來, 實得「${t.$("todaySum").textContent}」`);
  // 補記一段
  t.click(t.$("btnAdd"));
  ok(disp(t, t.$("addBox")) !== "none", "按補記要出現表單");
  t.$("addAct").value = "piano"; t.$("addS").value = "19:00"; t.$("addE").value = "19:30";
  t.$("addBox").dispatchEvent(new t.w.Event("submit", {bubbles:true, cancelable:true}));
  ok(tl(t).length === 3 && tl(t)[2].a === "piano" && tl(t)[2].s === 1140 && tl(t)[2].e === 1170, `補記要進去、照時間排, 實得 ${JSON.stringify(tl(t))}`);
  ok(disp(t, t.$("addBox")) === "none", "補完表單要收起來");
  t.click(t.$("btnAdd"));
  t.$("addAct").value = "play"; t.$("addS").value = "19:10"; t.$("addE").value = "19:20";
  t.$("addBox").dispatchEvent(new t.w.Event("submit", {bubbles:true, cancelable:true}));
  ok(tl(t).length === 3, "補記跟別段重疊要擋下來");
  // 刪
  t.click([...t.d.querySelectorAll("#segList details.seg")][0].querySelector("[data-del]"));
  ok(tl(t).length === 2 && tl(t)[0].a === "hw", `刪得掉, 實得 ${JSON.stringify(tl(t))}`);
  // 這週
  ok(t.d.querySelectorAll("#week .band .row").length === 7, "這週要七列");
  ok(t.d.querySelectorAll("#week .band .row i").length === 2, `色帶上要有今天的兩段, 實得 ${t.d.querySelectorAll("#week .band .row i").length}`);
  const lg = t.$("legend").textContent;
  ok(/寫功課/.test(lg) && /1 小時 25 分/.test(lg) && /鋼琴/.test(lg), `圖例要有本週合計, 實得「${lg}」`);
  ok(/最長 1 小時 25 分/.test(lg), "每一項要標最長的一次");
  { const u = bootTime(ls=>ls.setItem("cq-shared-v1", JSON.stringify(Object.assign({}, BASE, {tl:{[y1]:[{a:"play", s:1000, e:1440, x:1}, {a:"hw", s:900, e:960}]}}))), 1000);
    ok(!/玩/.test(u.$("legend").textContent) && /寫功課/.test(u.$("legend").textContent), "忘了按停止的那段不算進合計與最長"); }
  ok(/空檔.*20 分/.test(lg), `空檔要合計（18:40 到 19:00）, 實得「${lg}」`);
  ok(!/吃飯/.test(lg), "沒用到的事項不進圖例");
  ok(t.$("bandRange").textContent === "15:00 ～ 24:00" && !/>12</.test(t.$("week").innerHTML), "平日只有下午的紀錄，色帶從 15:00 起");
  { const u = bootTime(ls=>ls.setItem("cq-shared-v1", JSON.stringify(Object.assign({}, BASE, {tl:{[y1]:[{a:"wake", s:8 * 60 + 20, p:1}, {a:"hw", s:9 * 60, e:10 * 60}], [today]:[{a:"hw", s:1000, e:1060}]}}))), 1000);
    ok(u.$("bandRange").textContent === "08:00 ～ 24:00" && />9</.test(u.$("week").innerHTML) && />12</.test(u.$("week").innerHTML), `假日有早上的紀錄，色帶從那個整點起、刻度跟著補, 實得「${u.$("bandRange").textContent}」`);
    ok(u.d.querySelectorAll("#week .band .row i").length === 3, "早上的紀錄要畫得出來"); }
  // 時間點：只記幾點幾分；正在做的那段在那一刻結束
  t.ev("nowMin = () => 1180");
  t.click(chip(t, "play"));
  t.ev("nowMin = () => 1230");
  t.click(chip(t, "sleep"));
  const last = tl(t).slice(-2);
  ok(last[0].a === "play" && last[0].e === 1230 && last[1].a === "sleep" && last[1].s === 1230 && last[1].p === 1 && last[1].e === undefined, `睡覺是時間點：玩在那一刻結束、睡覺只有一個時間, 實得 ${JSON.stringify(last)}`);
  ok(!t.ev("openSeg()") && t.$("btnStop").disabled, "時間點之後沒有東西在進行中");
  t.click(chip(t, "sleep"));
  ok(tl(t).length === 4, "同一分鐘再點同一個時間點不得重複記");
  ok(!!t.d.querySelector("#week .band .row i.pt"), "色帶上時間點是一條細線");
  ok(!/睡覺/.test(t.$("legend").textContent), "時間點沒有長度，不進合計");
  const ptRow = [...t.d.querySelectorAll("#segList details.seg")].pop();
  ok(ptRow.classList.contains("pt") && /20:30/.test(ptRow.textContent) && ptRow.querySelectorAll("input").length === 1, "時間點那列只有一個時間可以改");
  // 補記一個時間點
  t.click(t.$("btnAdd")); t.$("addAct").value = "home"; t.$("addAct").dispatchEvent(new t.w.Event("change"));
  ok(t.$("addELab").hidden && !t.$("addE").required, "補記時間點只問一個時間");
  t.$("addS").value = "16:55";
  t.$("addBox").dispatchEvent(new t.w.Event("submit", {bubbles:true, cancelable:true}));
  ok(tl(t)[0].a === "home" && tl(t)[0].s === 1015 && tl(t)[0].p === 1, `補記的到家要排在最前面, 實得 ${JSON.stringify(tl(t)[0])}`);
  ok(/空檔 20 分/.test(t.$("segList").textContent), "到家跟第一件事之間的空檔也要標");
  // 睡眠：昨晚睡覺到今天起床
  { const u = bootTime(ls=>ls.setItem("cq-shared-v1", JSON.stringify(Object.assign({}, BASE, {tl:{[y2]:[{a:"sleep", s:1290, p:1}], [y1]:[{a:"wake", s:390, p:1}, {a:"sleep", s:1350, p:1}], [today]:[{a:"wake", s:420, p:1}]}}))), 1000);
    ok(/睡了 8 小時 30 分/.test(u.$("segList").textContent) && /22:30 → 07:00/.test(u.$("segList").textContent), `今天要寫昨晚睡了多久, 實得「${u.$("segList").textContent.trim().slice(0, 60)}」`);
    const lg2 = u.$("legend").textContent;
    ok(/睡眠/.test(lg2) && /平均 8 小時 45 分/.test(lg2) && /最短 8 小時 30 分/.test(lg2), `這週要有睡眠平均與最短, 實得「${lg2}」`);
    const v = bootTime(ls=>ls.setItem("cq-shared-v1", JSON.stringify(Object.assign({}, BASE, {tl:{[today]:[{a:"wake", s:420, p:1}]}}))), 1000);
    ok(!/睡了/.test(v.$("segList").textContent), "昨晚沒記睡覺就不算"); }
}

// ---------- ④ 忘了按停止：隔天開，收在午夜並標記 ----------
{
  const seed = ls => ls.setItem("cq-shared-v1", JSON.stringify(Object.assign({}, BASE, {tl:{[y1]:[{a:"play", s:1200}], [today]:[{a:"hw", s:1000}]}})));
  const t = bootTime(seed, 1030);
  ok(tl(t, y1)[0].e === 1440 && tl(t, y1)[0].x === 1, `昨天沒停的那段要收在 24:00 並標記, 實得 ${JSON.stringify(tl(t, y1))}`);
  ok(tl(t)[0].e === undefined, "今天還開著的那段不得動");
  ok(!!t.d.querySelector("#week .band .row i.trunc"), "色帶上那段要畫成斜線");
  ok(/寫功課/.test(t.$("nowBox").textContent), "今天那段要接著算");
}

// ---------- ⑤ 事項清單：家長改的、壞資料、只留 90 天 ----------
{
  const acts = [{id:"wc", em:"🚽", name:"上廁所"}, {id:"hw", em:"📝", name:"寫功課", off:true}, {id:"cswim", em:"🏊", name:"游泳"}, {id:"bad id!", name:"x"}, null, {id:"noname", name:" "}];
  const t = bootTime(ls=>ls.setItem("cq-shared-v1", JSON.stringify(Object.assign({}, BASE, {tlActs:acts, tl:{[y1]:[{a:"hw", s:1000, e:1060}, {a:"gone", s:1100, e:1130}]}}))), 1000);
  ok(chips(t).map(b=>b.dataset.act).join() === "wc,cswim", `關掉的不顯示、壞的不算, 實得 ${chips(t).map(b=>b.dataset.act).join()}`);
  ok(/游泳/.test(chip(t, "cswim").textContent), "家長加的要用它的名字");
  ok(/寫功課/.test(t.$("legend").textContent), "關掉的事項舊紀錄照樣看得到");
  ok(/已刪掉的事項/.test(t.$("legend").textContent), "紀錄指到不存在的事項不得讓整頁壞掉");
  const t2 = bootTime(ls=>ls.setItem("cq-shared-v1", JSON.stringify(Object.assign({}, BASE, {tlActs:[{id:"bad id!", name:"x"}]}))), 1000);
  ok(chips(t2).length === 14, "清單全壞就退回內建十四項");
  // 90 天
  const old = {}; for(let i = 1; i <= 100; i++){ old[key(new Date(Date.now() - i * 86400000))] = [{a:"hw", s:1000, e:1060}]; }
  const t3 = bootTime(ls=>ls.setItem("cq-shared-v1", JSON.stringify(Object.assign({}, BASE, {tl:old}))), 1000);
  t3.click(chip(t3, "wc"));
  const ks = Object.keys(JSON.parse(t3.ls.getItem("cq-shared-v1")).tl);
  ok(ks.length === 90 && ks.includes(today) && ks.includes(y1), `存檔只留 90 天, 實得 ${ks.length} 天`);
}

// ---------- ⑥ 單字闖關：入口、設定頁的事項編輯（要密碼）、內建清單同一份 ----------
{
  const a = boot(indexHtml, "index.html", shared());
  ok(!!a.d.querySelector('a#timeLink[href="time.html"]'), "主畫面要有一張卡連到時間紀錄");
  ok(/"\.\/time\.html"/.test(fs.readFileSync(path.join(ROOT, "sw.js"), "utf8")), "sw.js 要預先快取 time.html");
  const defIdx = a.ev("JSON.stringify(TL_DEF_ACTS)"), defTime = bootTime().ev("JSON.stringify(DEF_ACTS)");
  ok(defIdx === defTime, "內建事項清單兩頁要同一份");
  ok(!!a.$("btnTlActs") && a.$("btnTlActs").closest("#vSet"), "事項編輯要在設定頁");
  a.ev(`localStorage.setItem(PIN_KEY, "1234")`);
  a.say("0000", "游泳", "🏊"); a.click(a.$("btnTlActs"));
  ok(!a.ev("SHARED.tlActs"), "密碼錯不得動");
  a.say("1234", "游泳", "🏊"); a.click(a.$("btnTlActs"));
  ok(a.ev("tlActs().length") === 15 && a.ev("tlActs()[14].name") === "游泳" && a.ev("tlActs()[14].em") === "🏊" && !a.ev("tlActs()[14].p") && /^c/.test(a.ev("tlActs()[14].id")), `加得了（confirm 說是一段時間）, 實得 ${JSON.stringify(a.ev("tlActs()"))}`);
  ok(a.ev("tlActs()[0].id") === "home" && a.ev("tlActs()[1].id") === "wc", "內建十四項要一起寫進去、順序不變（顏色照位置配）");
  a.w.confirm = () => false;                                  // 「取消」= 時間點
  a.say("1234", "出門", "🚌"); a.click(a.$("btnTlActs"));
  ok(a.ev("tlActs().length") === 16 && a.ev("tlActs()[15].p") === 1, "新增時可以選成時間點");
  a.w.confirm = () => true;
  a.say("1234", "游泳", ""); a.click(a.$("btnTlActs"));
  ok(a.ev("tlActs().length") === 16, "同名不得重複加");
  a.say("1234", "a|b;c 很長很長很長很長的名字", ""); a.click(a.$("btnTlActs"));
  ok(a.ev("tlActs()[16].name") === "a b c 很長", `名稱要去分隔符、限 8 字, 實得「${a.ev("tlActs()[16].name")}」`);
  a.say("1234", "17"); a.click(a.$("btnTlActs"));            // 沒用過 → 刪
  ok(a.ev("tlActs().length") === 16, "沒用過的事項輸入編號可以刪掉");
  a.ev(`SHARED.tl = {[dayKey()]:[{a:"hw", s:1000, e:1060}]}; saveShared();`);
  a.say("1234", "4"); a.click(a.$("btnTlActs"));             // 用過 → 關
  ok(a.ev("tlActs().length") === 16 && a.ev("tlActs()[3].off") === true, "用過的事項只能關掉，不得刪");
  a.say("1234", "4"); a.click(a.$("btnTlActs"));
  ok(!a.ev("tlActs()[3].off"), "再輸入一次就打開");
  for(let i = 0; i < 5; i++){ a.say("1234", "新" + i, ""); a.click(a.$("btnTlActs")); }
  ok(a.ev("tlActs().length") === 20, `最多 20 項, 實得 ${a.ev("tlActs().length")}`);
  // time.html 要吃到
  const t = boot(timeHtml, "time.html", ls=>ls.setItem("cq-shared-v1", a.ls.getItem("cq-shared-v1")), {min:1000});
  ok(chips(t).length === 20 && /游泳/.test(t.$("actGrid").textContent) && chip(t, a.ev("tlActs()[12].id")).classList.contains("pt"), "時間紀錄那頁要看到家長改的清單，含時間點");
}

// ---------- ⑦ 備份碼往返、雲端摘要、回到單字闖關時補傳 ----------
{
  const tlData = {[y2]:[{a:"hw", s:1000, e:1060, x:1, n:"數學 p.3-4"}], [y1]:[{a:"home", s:1015, p:1}, {a:"wc", s:1022, e:1030}, {a:"eat", s:1030, e:1100}, {a:"sleep", s:1300, p:1}], [today]:[{a:"hw", s:1000, e:1050}, {a:"play", s:1060}]};
  const acts = [{id:"home", em:"🏠", name:"到家", p:1}, {id:"wc", em:"🚽", name:"上廁所"}, {id:"hw", em:"📝", name:"寫功課", off:true}, {id:"cswim", em:"", name:"游泳"}, {id:"sleep", em:"🛏️", name:"睡覺", p:1, off:true}];
  const a = boot(indexHtml, "index.html", ls=>ls.setItem("cq-shared-v1", JSON.stringify(Object.assign({}, BASE, {tl:tlData, tlActs:acts}))));
  const code = a.ev("exportCode()");
  const b = boot(indexHtml, "index.html", shared());
  ok(b.ev(`importCode(${JSON.stringify(code)})`) === "", "備份碼要還原得回來");
  const norm = xs => JSON.stringify(xs.map(x=>Object.keys(x).sort().map(k=>[k, x[k]])));
  ok(norm(b.ev("SHARED.tlActs")) === norm(acts), `事項清單往返要一致, 實得 ${JSON.stringify(b.ev("SHARED.tlActs"))}`);
  ok(JSON.stringify(b.ev(`SHARED.tl[${JSON.stringify(y1)}]`)) === JSON.stringify(tlData[y1]) && b.ev(`SHARED.tl[${JSON.stringify(y2)}][0].x`) === 1, `打卡往返要一致, 實得 ${JSON.stringify(b.ev("SHARED.tl"))}`);
  ok(b.ev(`SHARED.tl[${JSON.stringify(today)}].length`) === 1, "進行中的那段不進備份碼");
  ok(b.ev(`SHARED.tl[${JSON.stringify(y2)}][0].n`) === "數學 p.3-4", `備註（含句點）往返要一致, 實得「${b.ev(`SHARED.tl[${JSON.stringify(y2)}][0].n`)}」`);
  ok(b.ev("bankLeft()") === 20 && b.ev("SHARED.days[" + JSON.stringify(y1) + "].n") === 10, "原本的欄位不受影響");
  // 舊碼（沒有這兩欄）也要還原得回來
  const old = code.slice(0, 4) + a.ev(`b64e(b64d(${JSON.stringify(code.slice(4))}).split("~").map(c=>c.startsWith("shared=") ? c.split("|").slice(0, 13).join("|") : c).join("~"))`);
  const c = boot(indexHtml, "index.html", shared());
  ok(c.ev(`importCode(${JSON.stringify(old)})`) === "" && !c.ev("SHARED.tl") && !c.ev("SHARED.tlActs"), "沒有這兩欄的舊碼照樣還原");
  // 雲端摘要
  const sum = a.ev("syncSummary()");
  ok(sum.tl && sum.tl.acts.length === 5 && sum.tl.acts[3].name === "游泳" && sum.tl.acts[0].p === 1 && Object.keys(sum.tl.days).length === 3, `摘要要帶事項名稱與最近幾天, 實得 ${JSON.stringify(sum.tl)}`);
  ok(sum.tl.days[today][1].e === undefined && sum.tl.days[y2][0].x === 1 && sum.tl.days[y1][0].p === 1 && sum.tl.days[y2][0].n === "數學 p.3-4", "摘要要保留進行中、忘了停、時間點的標記與備註");
  ok(boot(indexHtml, "index.html", shared()).ev("syncSummary().tl") === null, "沒打卡過就是 null");
  // 補傳：time.html 立了旗 → 回到單字闖關開啟時傳一次
  const on = ls => { ls.setItem("cq-profile", "大寶"); ls.setItem("cq-sync", JSON.stringify({api:"https://english-api.ku-ai.cc", code:"w"})); ls.setItem("cq-shared-v1", JSON.stringify(Object.assign({}, BASE, {tl:tlData}))); };
  let s = boot(indexHtml, "index.html", ls=>{ on(ls); ls.setItem("cq-tl-dirty", "1"); });
  await wait();
  ok(s.calls.length === 1 && s.calls[0].opt.method === "PUT" && /"tl":\{/.test(s.calls[0].opt.body), `有旗就補傳一次, 實得 ${s.calls.length} 次`);
  ok(s.ls.getItem("cq-tl-dirty") === null, "傳過旗要拿掉");
  s = boot(indexHtml, "index.html", on);
  await wait();
  ok(s.calls.length === 0, "沒旗就不多傳");
  s = boot(indexHtml, "index.html", ls=>{ ls.setItem("cq-profile", "大寶"); ls.setItem("cq-shared-v1", JSON.stringify(BASE)); ls.setItem("cq-tl-dirty", "1"); });
  await wait();
  ok(s.calls.length === 0, "沒開雲端就算有旗也一個請求都不准發");
}

// ---------- ⑧ 家長頁：有打卡才有「時間」分頁；色帶、圖例；壞資料 ----------
{
  const D = today;
  const mk = sum => ({children:[{child:"大寶", dev:"x", at:1, sum:Object.assign({v:"t", who:"大寶", streak:0, days:{}, bank:{left:0}, gifts:[], coupons:[], decks:{}}, sum)}]});
  const bootP = list => {
    const dom = new JSDOM(parentHtml, {runScripts:"dangerously", pretendToBeVisual:true, url:"https://english.ku-ai.cc/parent.html",
      beforeParse(win){
        win.localStorage.setItem("cqp-conf", JSON.stringify({api:"https://english-api.ku-ai.cc", code:"r"}));
        win.fetch = () => Promise.resolve({ok:true, status:200, json:()=>Promise.resolve(list)});
      }});
    return {w:dom.window, d:dom.window.document};
  };
  const tabs = t => [...t.d.querySelectorAll('[role="tab"][data-sec]')].map(b=>b.dataset.sec);
  let p = bootP(mk({})); await wait();
  ok(!tabs(p).includes("time"), "沒打卡的小孩不給時間分頁");
  p = bootP(mk({tl:{acts:[{id:"home", em:"🏠", name:"到家", p:1}, {id:"hw", em:"📝", name:"寫功課"}, {id:"play", em:"🎮", name:"玩"}], days:{[y2]:[{a:"hw", s:1000, e:1030, n:"數學 p.3"}, {a:"sleep", s:1350, p:1}], [y1]:[{a:"wake", s:420, p:1}, {a:"home", s:1000, p:1}, {a:"hw", s:1020, e:1080, x:1}, {a:"play", s:1090, e:1140}], [D]:[{a:"hw", s:1000}]}}})); await wait();
  ok(tabs(p).includes("time"), "有打卡就有時間分頁");
  const sec = p.d.querySelector('[id$="-time"].sec');
  ok(!!sec && sec.querySelectorAll(".band .row").length === 7, "色帶要七列");
  ok(sec.querySelectorAll(".band .row i").length === 7 && sec.querySelectorAll(".band .row i.trunc").length === 2 && sec.querySelectorAll(".band .row i.pt").length === 3, `七筆：忘了停與進行中的兩段是斜線、到家睡覺起床是細線, 實得 ${sec.querySelectorAll(".band .row i").length}/${sec.querySelectorAll(".band .row i.trunc").length}/${sec.querySelectorAll(".band .row i.pt").length}`);
  const lg = sec.querySelector(".legend").textContent;
  ok(/寫功課/.test(lg) && /30 分/.test(lg) && /玩/.test(lg), `圖例要有合計, 實得「${lg}」`);
  ok(new RegExp("最長 30 分（" + (+y2.slice(5, 7)) + "/" + (+y2.slice(8)) + "）").test(lg), `每一項要標最長的一次和哪天（忘了停的那段不算）, 實得「${lg}」`);
  ok(/空檔.*30 分/.test(lg), `空檔要合計（到家→寫功課 20 分、寫功課→玩 10 分）, 實得「${lg}」`);
  ok(/07:00 到 24:00/.test(sec.textContent) && />12</.test(sec.innerHTML), "有早上起床的紀錄，色帶從 07:00 起");
  { const q = bootP(mk({tl:{acts:[{id:"hw", em:"📝", name:"寫功課"}], days:{[y1]:[{a:"hw", s:9 * 60 + 30, e:10 * 60}]}}})); await wait();
    const s2 = q.d.querySelector('[id$="-time"].sec');
    ok(/09:00 到 24:00/.test(s2.textContent) && />12</.test(s2.innerHTML) && s2.querySelectorAll(".band .row i").length === 1, "家長頁：假日早上的紀錄，色帶從那個整點起"); }
  ok(!/2 小時/.test(lg) && !/到家.*分/.test(lg), "進行中的那段與時間點不算進合計");
  ok(/睡眠/.test(lg) && /平均 8 小時 30 分/.test(lg), `家長頁要有睡眠, 實得「${lg}」`);
  ok(/備註/.test(sec.textContent) && /數學 p\.3/.test(sec.textContent), "家長頁要列備註");
  // 進行中的那段畫到上傳那一刻為止
  const at = new Date(); at.setHours(17, 30, 0, 0);
  p = bootP(mk({at:Math.floor(at / 1000), tl:{acts:[{id:"hw", em:"📝", name:"寫功課"}], days:{[D]:[{a:"hw", s:1000}]}}})); await wait();
  const bar = p.d.querySelector('[id$="-time"].sec .band .row i');
  ok(bar && /width:\s*9\.2/.test(bar.getAttribute("style")) && /還在做/.test(bar.parentNode.getAttribute("aria-label")), `進行中的那段只畫到上傳那一刻（16:40→17:30 = 50 分 = 9.26%）, 實得 ${bar && bar.getAttribute("style")}`);
  // 壞資料
  const BOOM = '<img src=x onerror="window.__pwned=1">';
  p = bootP(mk({tl:{acts:[{id:BOOM, em:BOOM, name:BOOM, p:BOOM}, BOOM, null], days:{[D]:[{a:BOOM, s:BOOM, e:BOOM, x:BOOM, p:BOOM, n:BOOM}, BOOM, {a:"hw", s:-5, e:99999, n:BOOM}, {a:"hw", s:BOOM, p:1}], [BOOM]:"x"}}})); await wait();
  ok(!p.w.__pwned && p.d.querySelectorAll("img").length === 0 && p.d.querySelectorAll("[onerror]").length === 0, "小孩上傳的內容不得在家長瀏覽器裡執行");
  ok(tabs(p).includes("time") && /回家後的時間/.test(p.d.body.textContent), "擋掉之後畫面仍要正常");
  p = bootP(mk({tl:"不是物件"})); await wait();
  ok(!tabs(p).includes("time") && /連續天數/.test(p.d.body.textContent), "型別亂七八糟也不能整頁壞掉");
}

console.log(`通過 ${pass} / 失敗 ${fail}`);
process.exit(fail ? 1 : 0);
})();
