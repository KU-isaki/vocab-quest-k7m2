/* 首頁「今天」總覽：這個工具已經不只是單字闖關，首頁要先讓人看到三個模組。
   驗收：總覽卡在起始卡前面、三個入口帶今天的狀態、練習中收起來、導覽列「存摺」、
   成語頁與時間頁的返回鍵寫「首頁」、家長頁總覽多一行時間紀錄。 */
const fs = require("fs"), path = require("path"), {JSDOM} = require("jsdom");
const ROOT = path.join(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const parentHtml = fs.readFileSync(path.join(ROOT, "parent.html"), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const key = d => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
const today = key(new Date()), y1 = key(new Date(Date.now() - 86400000));
function boot(seed){
  const dom = new JSDOM(indexHtml, {runScripts:"dangerously", pretendToBeVisual:true, url:"https://x.test/index.html",
    beforeParse(win){
      win.speechSynthesis = {speak(){}, cancel(){}, getVoices:()=>[{lang:"en-US", name:"S"}], addEventListener(){}};
      win.SpeechSynthesisUtterance = function(t){ this.text = t; };
      if(seed) win.localStorage.setItem("cq-shared-v1", JSON.stringify(Object.assign({days:{}, bank:{earned:0, used:0, bonus:0}, gifts:[], coupons:[]}, seed)));
    }});
  const w = dom.window;
  w.alert = ()=>{}; w.confirm = ()=>true; w.scrollTo = ()=>{}; w.HTMLElement.prototype.scrollIntoView = function(){};
  return {w, d:w.document, $:id=>w.document.getElementById(id), ev:x=>w.eval(x), click:e=>e.dispatchEvent(new w.MouseEvent("click", {bubbles:true})),
          disp:el=>w.getComputedStyle(el).display};
}
const wait = () => new Promise(r=>setTimeout(r, 60));

(async () => {
{ // 位置與入口
  const t = boot();
  const card = t.$("todayCard");
  ok(!!card && card.compareDocumentPosition(t.$("startCard")) & 4, "「今天」總覽要在英文起始卡前面");
  ok(t.$("vQuiz").contains(card) && t.disp(card) !== "none", "總覽要在練習頁、一開始看得見");
  ok(t.$("englishLink").getAttribute("href") === "#startCard" && t.$("idiomLink").getAttribute("href") === "idiom.html" && t.$("timeLink").getAttribute("href") === "time.html", "三個入口各連到自己的地方");
  ok(/存摺/.test(t.$("todayBank").textContent) && />0</.test(t.$("todayBank").innerHTML), "最上面寫存摺餘額");
  ok(/今天還沒練/.test(t.$("todayEn").textContent) && /再答對 10 題 → 2 分鐘/.test(t.$("todayEn").textContent), `英文那行：還沒練＋還差幾題, 實得「${t.$("todayEn").textContent}」`);
  ok(/今天還沒練 · 還沒養貓/.test(t.$("todayZh").textContent), `成語那行, 實得「${t.$("todayZh").textContent}」`);
  ok(t.$("todayTl").textContent === "今天還沒打卡", `時間那行, 實得「${t.$("todayTl").textContent}」`);
  ok(t.d.querySelector('.nav button[data-view="vStats"]').textContent.includes("存摺"), "導覽列「進度」改叫「存摺」");
  ok(t.d.querySelectorAll(".idiomlink").length === 0, "舊的兩張入口卡要拿掉，不能重複");
  // 練習中收起來、回首頁再出現
  t.click(t.$("btnStart"));
  ok(t.$("todayCard").hidden && t.disp(t.$("todayCard")) === "none", "練習中總覽要收起來");
  t.ev('$("qCard").hidden = true; $("sumCard").hidden = false;');
  t.click(t.$("btnBackHome"));
  ok(!t.$("todayCard").hidden, "回首頁總覽要再出現");
}
{ // 狀態：有練、有貓、有打卡
  const t = boot({days:{[today]:{n:12, r:10, paid:2, i:{n:5, r:4}}}, bank:{earned:30, used:10, bonus:0},
                  pet:{cats:[{name:"小花", hunger:20, clean:80}]},
                  tl:{[y1]:[{a:"sleep", s:1350, p:1}], [today]:[{a:"wake", s:420, p:1}, {a:"home", s:1000, p:1}, {a:"hw", s:1010, e:1060}]}});
  ok(/今天 12 題、答對 10/.test(t.$("todayEn").textContent), `英文今天的題數, 實得「${t.$("todayEn").textContent}」`);
  ok(/今天 5 題、答對 4 · 貓餓了/.test(t.$("todayZh").textContent), `成語題數與貓的狀態, 實得「${t.$("todayZh").textContent}」`);
  ok(/昨晚睡 8 小時 30 分 · 16:40 到家 · 今天記了 1 段/.test(t.$("todayTl").textContent), `時間那行, 實得「${t.$("todayTl").textContent}」`);
  ok(/>20</.test(t.$("todayBank").innerHTML), "存摺餘額要對");
  const u = boot({tl:{[today]:[{a:"hw", s:0}]}});
  ok(/現在：📝 寫功課，00:00 開始/.test(u.$("todayTl").textContent), `正在做的事要寫出來, 實得「${u.$("todayTl").textContent}」`);
}
{ // 返回鍵
  ["idiom.html", "time.html"].forEach(f=>{
    const h = fs.readFileSync(path.join(ROOT, f), "utf8");
    ok(/class="back" href="\.\/">← 首頁</.test(h), `${f} 的返回鍵要寫「首頁」`);
  });
}
{ // 家長頁總覽多一行
  const mk = sum => ({children:[{child:"大寶", dev:"x", at:1, sum:Object.assign({v:"t", who:"大寶", streak:0, days:{}, bank:{left:0}, gifts:[], coupons:[], decks:{}}, sum)}]});
  const bootP = list => {
    const dom = new JSDOM(parentHtml, {runScripts:"dangerously", pretendToBeVisual:true, url:"https://english.ku-ai.cc/parent.html",
      beforeParse(win){ win.localStorage.setItem("cqp-conf", JSON.stringify({api:"https://english-api.ku-ai.cc", code:"r"}));
                        win.fetch = () => Promise.resolve({ok:true, status:200, json:()=>Promise.resolve(list)}); }});
    return {d:dom.window.document, w:dom.window};
  };
  let p = bootP(mk({tl:{acts:[{id:"hw", em:"📝", name:"寫功課"}], days:{[y1]:[{a:"sleep", s:1350, p:1}], [today]:[{a:"wake", s:420, p:1}, {a:"home", s:1000, p:1}, {a:"hw", s:1010}]}}})); await wait();
  const sec = p.d.querySelector('[id$="-sum"].sec');
  ok(/昨晚睡 8 小時 30 分 · 16:40 到家 · 上傳時在：📝 寫功課/.test(sec.textContent), `總覽要有一行時間紀錄, 實得「${sec.textContent.slice(-80)}」`);
  p = bootP(mk({})); await wait();
  ok(!/⏱️/.test(p.d.querySelector('[id$="-sum"].sec').textContent), "沒打卡就不顯示那行");
  const BOOM = '<img src=x onerror="window.__pwned=1">';
  p = bootP(mk({tl:{acts:[{id:"home", em:BOOM, name:BOOM, p:1}], days:{[today]:[{a:"home", s:BOOM, p:1}, {a:BOOM, s:1}]}}})); await wait();
  ok(!p.w.__pwned && p.d.querySelectorAll("img").length === 0, "那一行也不得注入");
}
console.log(`通過 ${pass} / 失敗 ${fail}`);
process.exit(fail ? 1 : 0);
})();
