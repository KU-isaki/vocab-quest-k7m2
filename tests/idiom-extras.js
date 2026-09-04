/* 成語ㄚ喵 E7 + W2 + W3：典故猜成語、接龍、共用日曆、主畫面入口

   典故與接龍的唯一鐵律：不計分 —— 不碰 S、不碰飼料、不碰日曆。
   日曆：只練成語的日子，單字闖關那邊要看得到、連續天數要算，但英文的達標連續不得動。 */
const fs = require("fs"), path = require("path"), {JSDOM} = require("jsdom");
const ROOT = path.join(__dirname, "..");
const idiomHtml = fs.readFileSync(path.join(ROOT, "idiom.html"), "utf8");
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const key = d => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
const today = key(new Date());

function boot(html, file, seed){
  const dom = new JSDOM(html, {runScripts:"dangerously", pretendToBeVisual:true, url:"https://x.test/" + file,
    beforeParse(win){
      win.speechSynthesis = {speak(){}, cancel(){}, getVoices:()=>[{lang:"en-US", name:"S"}], addEventListener(){}};
      win.SpeechSynthesisUtterance = function(t){ this.text = t; };
      win.localStorage.setItem("cq-shared-v1", JSON.stringify({days:{}, bank:{earned:0, used:0, bonus:0}, gifts:[], coupons:[]}));
      if(seed) seed(win.localStorage);
    }});
  const w = dom.window;
  w.alert = ()=>{}; w.confirm = ()=>true; w.scrollTo = ()=>{}; w.HTMLElement.prototype.scrollIntoView = function(){};
  return {w, d:w.document, $:id=>w.document.getElementById(id), ev:x=>w.eval(x),
          click:e=>e.dispatchEvent(new w.MouseEvent("click", {bubbles:true})), disp:el=>w.getComputedStyle(el).display};
}
const snap = t => JSON.stringify({S:t.ev("JSON.parse(JSON.stringify(S))"), feed:t.ev("SHARED.feed || null"), days:t.ev("SHARED.days")});

// ================= E7 典故猜成語 =================
{
  const t = boot(idiomHtml, "idiom.html");
  // 直接進結算頁
  t.ev("queue = []; idx = 0; roundRight = 0; missed = []; endRound();");
  ok(!t.$("storyBox").hidden, "結算頁要出現典故題");
  const txt = t.$("storyText").textContent;
  ok(txt.length > 20, "要有一段故事");
  const cs = [...t.d.querySelectorAll("#storyChoices .choice")];
  ok(cs.length === 4 && new Set(cs.map(b=>b.dataset.s)).size === 4, "四個選項不得重複");
  const ansC = t.ev("localStorage.getItem('cq-idiom-story')");
  ok(cs.some(b=>b.dataset.s === ansC), "正解要在選項裡");
  ok(!txt.includes(ansC), "故事裡不得直接寫出答案");
  const before = snap(t);
  t.click(cs.find(b=>b.dataset.s !== ansC));
  ok(/✗/.test(t.$("storyRes").textContent) && t.$("storyRes").textContent.includes(ansC), "答錯要講正解");
  ok(snap(t) === before, "典故題不得動到答題紀錄、飼料、日曆");
  ok(cs.every(b=>b.disabled), "答完就鎖住");
  const wasDone = t.ev("$('storyChoices').dataset.done");
  t.click(cs.find(b=>b.dataset.s === ansC));
  ok(wasDone === "1" && /✗/.test(t.$("storyRes").textContent), "答完不得再改答案");
  // 同一篇不會連續出兩次
  let same = 0;
  for(let r = 0; r < 12; r++){ const prev = t.ev("localStorage.getItem('cq-idiom-story')"); t.ev("endRound()"); if(t.ev("localStorage.getItem('cq-idiom-story')") === prev) same++; }
  ok(same === 0, `同一篇典故不得連續出現, 實得 ${same} 次`);
  ok(snap(t) === before, "出了 12 次典故題還是不得動到任何紀錄");
}

// ================= E7 接龍 =================
{
  const t = boot(idiomHtml, "idiom.html");
  ok(/熟練 8 條以上/.test(t.$("chainBody").textContent), "沒熟練夠多時要說明條件");
  // 讓 10 條熟練
  t.ev(`IDIOMS.slice(0, 10).forEach(i=>{ S.stats[i.c] = {r:3, x:0, streak:3, due:"2099-01-01"}; }); save(); chainNext(null);`);
  const cs = [...t.d.querySelectorAll("#chainBody .choice")];
  ok(cs.length === 4, `要有四個選項, 實得 ${cs.length}`);
  const cur = t.ev("chainCur.c");
  ok(t.ev("mastered(chainCur.c)"), "題目只能是熟練的成語");
  const ch = cur[3];
  const hits = cs.filter(b=>b.dataset.n[0] === ch);
  ok(hits.length === 1, `剛好一個選項用「${ch}」開頭, 實得 ${hits.length}`);
  ok(t.$("chainBody").textContent.includes(ch), "要提示要用哪個字開頭");
  const before = snap(t);
  t.click(hits[0]);
  ok(t.ev("chainN") === 1 && t.$("chainScore").textContent.includes("1"), `接上要算一條, chainN=${t.ev("chainN")}`);
  const picked = hits[0].dataset.n;
  const continuable = t.ev(`IDIOMS.some(x=>x.c[0] === ${JSON.stringify(picked[3])} && x.c !== ${JSON.stringify(picked)})`);
  ok(!continuable || t.ev("chainCur.c") === picked, "接上之後題目要換成剛才接的那條（除非它是死路）");
  ok(t.ev("chainN") === 1, "就算接到死路換題，連鎖也不得歸零");
  ok(snap(t) === before, "接龍不得動到答題紀錄、飼料、日曆");
  // 接錯歸零
  const cs2 = [...t.d.querySelectorAll("#chainBody .choice")];
  const ch2 = t.ev("chainCur.c")[3];
  t.click(cs2.find(b=>b.dataset.n[0] !== ch2));
  ok(t.ev("chainN") === 0, "接錯要歸零");
  ok(!!t.d.querySelector("#chainBody .choice.right"), "接錯要標出正解");
  ok(snap(t) === before, "接錯也不得動到任何紀錄");
  // 練習中接龍卡要收起來
  t.click(t.$("btnStart"));
  ok(t.$("chainCard").hidden && t.disp(t.$("chainCard")) === "none", "練習中接龍卡要收起來");
  t.click(t.$("btnQuit"));
  t.click(t.$("btnBackHome"));
  ok(!t.$("chainCard").hidden, "回主畫面接龍卡要回來");
}

// ================= W2 共用日曆（單字闖關那邊）=================
{
  const y1 = key(new Date(Date.now() - 86400000));
  const t = boot(indexHtml, "index.html", ls=>ls.setItem("cq-shared-v1", JSON.stringify({
    days:{[y1]:{n:0, r:0, i:{n:30, r:28, paid:10}}, [today]:{n:20, r:18, paid:5, i:{n:10, r:9, paid:2}}},
    bank:{earned:5, used:0, bonus:0}, gifts:[], coupons:[]})));
  ok(t.ev("streakDays()") === 2, `只練成語的日子也要算「有練」, 連續 ${t.ev("streakDays()")}`);
  ok(t.ev("goalStreak()") === 1, `英文的達標連續只能算英文（今天 paid 5，昨天沒有英文）, 實得 ${t.ev("goalStreak()")}`);
  t.ev("renderStats()");
  const cell = t.d.querySelector(`#calMonthGrid [data-day="${y1}"]`);
  ok(!!cell && /l[2-4]/.test(cell.className), `只練成語的日子日曆要有深淺, 實得 ${cell && cell.className}`);
  ok(!cell.classList.contains("met"), "只練成語不得標成英文達標日");
  const note = t.ev(`dayNote(${JSON.stringify(y1)}, SHARED.days[${JSON.stringify(y1)}])`);
  ok(/成語 30 題/.test(note) && /10 顆/.test(note), `點格子要看得到成語題數與飼料, 實得「${note}」`);
  const note2 = t.ev(`dayNote(${JSON.stringify(today)}, SHARED.days[${JSON.stringify(today)}])`);
  ok(/英文 20 題/.test(note2) && /成語 10 題/.test(note2), `兩種都有的日子要分開講, 實得「${note2}」`);
  ok(/成語 40 題/.test(t.$("calSum").textContent), `當月小結要算成語題數, 實得「${t.$("calSum").textContent}」`);
  ok(t.ev("bankLeft()") === 5, "英文存摺不得被成語紀錄影響");
}

// ================= W3 主畫面入口 =================
{
  const t = boot(indexHtml, "index.html");
  const a = t.$("idiomLink");
  ok(!!a && a.getAttribute("href") === "idiom.html", "主畫面要有成語ㄚ喵的入口");
  ok(/成語ㄚ喵/.test(a.textContent), "入口要有名字");
  ok(t.disp(a) !== "none", "入口要看得見");
  const headers = fs.readFileSync(path.join(ROOT, "_headers"), "utf8");
  ok(/\/idiom\n\s+Cache-Control: no-cache/.test(headers), "_headers 要讓 /idiom 不被快取");
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  ok(/"\.\/idiom\.html"/.test(sw), "sw.js 要預先快取 idiom.html");
}

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail ? 1 : 0);
