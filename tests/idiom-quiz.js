/* 成語ㄚ喵 E2–E6 + W1：出題器、題型、飼料帳

   重點跟單字闖關一樣：不是「題目出得來」，是「刷分數沒有好處」——
   難度倍率算當天平均、答對率乘在上面、答錯即時倒扣、一天有上限，
   而且成語練習只碰飼料帳，英文那本分鐘存摺一分都不能動。 */
const fs = require("fs"), path = require("path"), {JSDOM} = require("jsdom");
const html = fs.readFileSync(path.join(__dirname, "..", "idiom.html"), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const today = (() => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); })();

function boot(seed){
  const dom = new JSDOM(html, {runScripts:"dangerously", pretendToBeVisual:true, url:"https://x.test/idiom.html",
    beforeParse(win){
      // 假裝這台開過單字闖關：有一份存摺，飼料才存得住
      win.localStorage.setItem("cq-shared-v1", JSON.stringify({days:{}, bank:{earned:40, used:5, bonus:0}, gifts:[], coupons:[]}));
      if(seed) seed(win.localStorage);
    }});
  const w = dom.window, d = w.document;
  w.alert = ()=>{}; w.confirm = ()=>true; w.scrollTo = ()=>{}; w.HTMLElement.prototype.scrollIntoView = function(){};
  const $ = id => d.getElementById(id), ev = x => w.eval(x);
  const click = e => e.dispatchEvent(new w.MouseEvent("click", {bubbles:true}));
  const kind = () => ev("queue[idx].kind"), cur = () => ev("queue[idx].i");
  const disp = el => w.getComputedStyle(el).display;
  // 依題型作答；correct=false 時故意答錯
  function answer(correct){
    const k = kind(), i = cur();
    if(k === "m2c" || k === "c2m" || k === "syn"){
      const ans = k === "syn" ? ev("queue[idx].ans") : i.c;
      const bs = [...d.querySelectorAll("#qBody .choice")];
      click(correct ? bs.find(b=>b.dataset.c === ans) : bs.find(b=>b.dataset.c !== ans));
      click($("btnCheck"));
    }else if(k === "tile" || k === "cloze"){
      const ts = [...d.querySelectorAll("#qBody .tile")];
      const seq = [...i.c];
      if(!correct) seq.reverse();                          // 倒著拼一定錯（成語沒有回文的）
      const used = new Set();
      seq.forEach(ch=>{ const t = ts.find(x=>x.dataset.ch === ch && !used.has(x)); if(t){ used.add(t); click(t); } });
      click($("btnCheck"));
    }else if(k === "wrong"){
      const posBad = [...i.x].findIndex((ch, p)=>ch !== i.c[p]);
      const posOk = [...i.x].findIndex((ch, p)=>ch === i.c[p]);
      click(d.querySelector(`#xrow [data-pos="${correct ? posBad : posOk}"]`));
      if(correct) click(d.querySelector(`#xfix [data-fix="${i.c[posBad]}"]`));
    }else if(k === "usage"){
      const right = ev("queue[idx].right");
      click($(correct ? (right ? "btnO" : "btnX") : (right ? "btnX" : "btnO")));
    }else throw new Error("不認得的題型 " + k);
  }
  const next = () => click($("btnNext"));
  const start = () => click($("btnStart"));
  return {w, d, $, ev, click, kind, cur, answer, next, start, disp};
}
const pickDiff = (t, id) => t.click([...t.d.querySelectorAll("#lvRow .chip")].find(b=>b.dataset.diff === id));
const pickN = (t, n) => t.click([...t.d.querySelectorAll("#sizeRow .chip")].find(b=>+b.dataset.n === n));
function playRound(t, n, correct = true){
  pickN(t, n); t.start();
  const kinds = [];
  for(let k = 0; k < n; k++){ kinds.push(t.kind()); t.answer(typeof correct === "function" ? correct(k) : correct); if(k < n - 1) t.next(); }
  return kinds;
}

// ================= E2 出題器 =================
{
  const t = boot();
  // 三種難度都要出滿題數、同一輪不重複
  for(const diff of ["easy", "std", "hard"]){
    pickDiff(t, diff); pickN(t, 30); t.start();
    const q = t.ev("queue.map(x=>x.i.c)");
    ok(q.length === 30, `${diff} 要出滿 30 題, 實得 ${q.length}`);
    ok(new Set(q).size === q.length, `${diff} 同一輪不得重複出同一條`);
    t.click(t.$("btnQuit"));
  }
  // 50 題也要出滿（一級有 80 條）
  pickN(t, 50); t.start();
  ok(t.ev("queue.length") === 50, "50 題要出滿");
  t.click(t.$("btnQuit"));
  // 不同輪的順序不得完全相同
  pickN(t, 30); t.start(); const a = t.ev("queue.map(x=>x.i.c).join()"); t.click(t.$("btnQuit"));
  t.start(); const b = t.ev("queue.map(x=>x.i.c).join()"); t.click(t.$("btnQuit"));
  ok(a !== b, "不同輪的順序不得完全相同");
  // 難度只調配方不調題數：挑戰模式抓錯字／辨用法比例要比輕鬆高
  const share = (diff, group) => { pickDiff(t, diff); let hit = 0, tot = 0; for(let r = 0; r < 12; r++){ pickN(t, 30); t.start(); t.ev("queue").forEach(x=>{ tot++; if(group.includes(x.kind)) hit++; }); t.click(t.$("btnQuit")); } return hit / tot; };
  const catchEasy = share("easy", ["wrong", "usage"]), catchHard = share("hard", ["wrong", "usage"]);
  ok(catchHard > catchEasy, `挑戰模式抓錯字比例(${catchHard.toFixed(2)})要比輕鬆(${catchEasy.toFixed(2)})高`);
  const recogEasy = share("easy", ["m2c", "c2m", "syn"]), recogHard = share("hard", ["m2c", "c2m", "syn"]);
  ok(recogEasy > recogHard, `輕鬆模式辨認題比例(${recogEasy.toFixed(2)})要比挑戰(${recogHard.toFixed(2)})高`);
  // 同一個成語換輪要換題型
  pickDiff(t, "std");
  const i0 = t.ev("IDIOMS[0].c");
  let repeats = 0;
  for(const last of ["m2c", "tile", "c2m"]){
    t.ev(`S.stats[${JSON.stringify(i0)}] = {r:0, x:0, streak:0, k:${JSON.stringify(last)}}`);
    for(let r = 0; r < 20; r++) if(t.ev(`pickKind(IDIOMS[0])`) === last) repeats++;
  }
  ok(repeats === 0, `同一條上一次出過的題型這次不得再出, 實得重複 ${repeats} 次`);
  // 沒原料的題型不能出：沒易錯字的不出抓錯字、沒誤用例句的不出用法題
  pickDiff(t, "hard");
  let badKind = 0;
  for(let r = 0; r < 6; r++){ pickN(t, 50); t.start(); t.ev("queue").forEach(q=>{ if(q.kind === "wrong" && !q.i.x) badKind++; if(q.kind === "usage" && !q.i.bad) badKind++; if(q.kind === "syn" && !q.i.near.length && !q.i.anti.length) badKind++; }); t.click(t.$("btnQuit")); }
  ok(badKind === 0, `沒原料的題型不得出, 實得 ${badKind} 題`);
  // 間隔重複：答對排到明天以後，答錯排回今天
  pickDiff(t, "std"); pickN(t, 10); t.start();
  const c1 = t.cur().c; t.answer(true);
  ok(t.ev(`S.stats[${JSON.stringify(c1)}].due`) > today, `答對要排到之後再考, 實得 ${t.ev(`S.stats[${JSON.stringify(c1)}].due`)}`);
  t.next(); const c2 = t.cur().c; t.answer(false);
  ok(t.ev(`S.stats[${JSON.stringify(c2)}].due`) === today, "答錯要立刻排回來");
  t.click(t.$("btnQuit"));
  // 錯得多的要優先出現
  t.ev(`IDIOMS.slice(0, 10).forEach(i=>{ S.stats[i.c] = {r:0, x:5, streak:0}; }); save();`);
  // 80 條裡只有 10 條錯過，均勻抽 10 題平均只會抽到 1.25 條；加權後理論值約 5。
  // 門檻放 3.5：明顯高於均勻、又不會因為抽樣抖動而偶發失敗。
  let seen = 0; const R = 12;
  for(let r = 0; r < R; r++){ pickN(t, 10); t.start(); const q = t.ev("queue.map(x=>x.i.c)"); seen += q.filter(c=>t.ev("IDIOMS.slice(0,10).map(i=>i.c)").includes(c)).length; t.click(t.$("btnQuit")); }
  ok(seen / R >= 3.5, `錯得多的成語要優先出現（均勻抽只會 1.25 條）, 實得平均 ${(seen/R).toFixed(1)}`);
}

// ================= 干擾項 =================
{
  const t = boot();
  const forKind = (diff, want, tries = 40) => { pickDiff(t, diff); for(let r = 0; r < tries; r++){ pickN(t, 30); t.start(); for(let k = 0; k < 30; k++){ if(t.kind() === want) return true; t.answer(true); t.next(); } t.click(t.$("btnQuit")); } return false; };
  // 四個選項不得重複、正解一定在裡面、按檢查前不得洩漏
  ok(forKind("std", "m2c"), "要找得到看解釋選成語的題");
  const cs = [...t.d.querySelectorAll("#qBody .choice")].map(b=>b.dataset.c);
  ok(cs.length === 4 && new Set(cs).size === 4, "四個選項不得重複");
  ok(cs.includes(t.cur().c), "正解一定要在選項裡");
  ok(!t.d.querySelector("#qBody .choice.right"), "按檢查前不得洩漏正解");
  ok(t.$("btnCheck").disabled, "還沒選不能按檢查");
  // 點選項只是選起來，可以改
  const bs = [...t.d.querySelectorAll("#qBody .choice")];
  t.click(bs[0]); ok(bs[0].classList.contains("sel") && !t.ev("answered"), "點選項只是選起來，不得送出");
  t.click(bs[1]); ok(!bs[0].classList.contains("sel") && bs[1].classList.contains("sel"), "可以改選");
  t.click(t.$("btnCheck")); ok(t.ev("answered"), "按檢查才送出");
  ok(!!t.d.querySelector("#qBody .choice.right"), "送出後要標出正解");
  t.click(t.$("btnQuit"));
  // 輕鬆模式不得拿近義當干擾；標準模式要混一個
  const tryDis = diff => { pickDiff(t, diff); const withNear = t.ev("IDIOMS.filter(i=>i.near.length>=2)"); let ease = 0, tot = 0; for(let r = 0; r < 30; r++){ pickN(t, 30); t.start(); for(let k = 0; k < 30; k++){ const i = t.cur(); if((t.kind() === "m2c" || t.kind() === "c2m") && i.near.length >= 1){ const cs = [...t.d.querySelectorAll("#qBody .choice")].map(b=>b.dataset.c); tot++; if(cs.some(c=>i.near.includes(c))) ease++; } t.answer(true); t.next(); } t.click(t.$("btnQuit")); } return {ease, tot}; };
  const e = tryDis("easy"), s2 = tryDis("std");
  ok(e.tot > 0 && e.ease === 0, `輕鬆模式不得拿近義當干擾項, ${e.ease}/${e.tot}`);
  ok(s2.tot > 0 && s2.ease / s2.tot > .7, `標準模式要混一個近義（${s2.ease}/${s2.tot}）`);
}

// ================= E4 拼成語 =================
{
  const t = boot();
  const forKind = want => { for(let r = 0; r < 40; r++){ pickN(t, 30); t.start(); for(let k = 0; k < 30; k++){ if(t.kind() === want) return true; t.answer(true); t.next(); } t.click(t.$("btnQuit")); } return false; };
  pickDiff(t, "std");
  ok(forKind("tile"), "要找得到拼成語的題");
  let i = t.cur();
  const tiles = [...t.d.querySelectorAll("#qBody .tile")].map(b=>b.dataset.ch);
  ok(tiles.length === 8, `要有 8 個字塊, 實得 ${tiles.length}`);
  const need = [...i.c]; const bag = tiles.slice();
  ok(need.every(ch=>{ const p = bag.indexOf(ch); if(p < 0) return false; bag.splice(p, 1); return true; }), `字塊裡一定湊得出「${i.c}」: ${tiles.join("")}`);
  if(i.x){ const bad = [...i.x].find((ch, p)=>ch !== i.c[p]); ok(tiles.includes(bad), `有易錯字的成語，易錯字「${bad}」一定要混在字塊裡`); }
  ok(t.$("btnCheck").disabled, "沒拼滿不能按檢查");
  const ts = [...t.d.querySelectorAll("#qBody .tile")];
  t.click(ts.find(x=>x.dataset.ch === need[0]));
  ok(t.$("btnCheck").disabled && t.d.querySelectorAll("#slots .slot.filled").length === 1, "拼一格還不能檢查");
  t.click(t.$("btnBack"));
  ok(t.d.querySelectorAll("#slots .slot.filled").length === 0, "退一格要退得掉");
  // 字塊跟檢查鈕要有距離（誤按的老坑）
  const sb = t.d.querySelector("#qBody .spellbar");
  ok(parseInt(t.w.getComputedStyle(sb).marginTop) >= 24, `檢查鈕要離字塊夠遠, 實得 ${t.w.getComputedStyle(sb).marginTop}`);
  t.answer(true);
  ok(t.ev("answered") && /答對/.test(t.$("fbTitle").textContent), "拼對要算對");
  // 拼到易錯字要判錯，而且回饋要講為什麼
  t.next();
  let found = false;
  for(let k = 0; k < 200 && !found; k++){
    if(t.ev("answered")) t.next();
    if(t.ev("idx >= queue.length")){ pickN(t, 50); t.start(); }
    i = t.cur();
    if((t.kind() === "tile" || t.kind() === "cloze") && i.x){
      found = true;
      const ts2 = [...t.d.querySelectorAll("#qBody .tile")]; const used = new Set();
      [...i.x].forEach(ch=>{ const x = ts2.find(y=>y.dataset.ch === ch && !used.has(y)); used.add(x); t.click(x); });
      t.click(t.$("btnCheck"));
      ok(/再記一次/.test(t.$("fbTitle").textContent), `拼成易錯字「${i.x}」要判錯`);
      ok(!t.$("fbUse").hidden && t.$("fbUse").textContent.includes(i.xw.slice(0, 4)), "判錯要說明為什麼容易錯");
    }else{ t.answer(true); }
  }
  ok(found, "要找得到有易錯字的拼字題");
  // 例句填空：句子裡不得洩漏答案
  t.click(t.$("btnQuit"));
  let cl = false;
  for(let r = 0; r < 40 && !cl; r++){ pickN(t, 30); t.start(); for(let k = 0; k < 30; k++){ if(t.kind() === "cloze"){ cl = true; break; } t.answer(true); t.next(); } if(!cl) t.click(t.$("btnQuit")); }
  ok(cl, "要找得到例句填空");
  i = t.cur();
  ok(!t.$("qPrompt").textContent.includes(i.c), "填空的句子裡不得出現答案");
  ok(!!t.$("blank"), "要有空格");
}

// ================= E5 抓錯字 / E6 用法○✕ =================
{
  const t = boot();
  // 塞一條有誤用例句的進去，用法題才有原料
  t.ev(`IDIOMS.push({c:"再接再厲", zy:"ㄗㄞˋ ㄐㄧㄝ ㄗㄞˋ ㄌㄧˋ", m:"一次又一次繼續努力。", ex:"比賽輸了沒關係，我們再接再厲！", lv:1, chars:[..."再接再厲"], near:[], anti:[], x:"再接再勵", xw:"「厲」是磨刀，不是鼓勵的「勵」。", bad:"他今天再接再厲地睡了一整天。", badw:"用在偷懶上是錯的，這個成語是講努力。"}); byC["再接再厲"] = IDIOMS[IDIOMS.length-1];`);
  pickDiff(t, "hard");
  const forKindC = (want, c) => { for(let r = 0; r < 60; r++){ pickN(t, 50); t.start(); for(let k = 0; k < 50; k++){ if(t.kind() === want && (!c || t.cur().c === c)) return true; t.answer(true); t.next(); } t.click(t.$("btnQuit")); } return false; };
  ok(forKindC("wrong"), "要找得到抓錯字的題");
  let i = t.cur();
  ok(t.d.querySelectorAll("#xrow [data-pos]").length === 4, "要顯示四個字");
  ok(t.d.querySelector("#xrow").textContent.replace(/\s/g, "") === i.x, "顯示的要是寫錯的版本");
  // 點到對的字 → 這題就錯了
  const posOk = [...i.x].findIndex((ch, p)=>ch === i.c[p]);
  t.click(t.d.querySelector(`#xrow [data-pos="${posOk}"]`));
  ok(t.ev("answered") && /再記一次/.test(t.$("fbTitle").textContent), "點到寫對的字要算錯");
  ok(!t.$("fbUse").hidden && t.$("fbUse").textContent.includes(i.xw.slice(0, 4)), "要說明哪個字錯、為什麼");
  t.click(t.$("btnQuit"));
  // 兩步都對才算對；第一步對第二步錯要算錯
  ok(forKindC("wrong"), "再找一題抓錯字");
  i = t.cur();
  const posBad = [...i.x].findIndex((ch, p)=>ch !== i.c[p]);
  t.click(t.d.querySelector(`#xrow [data-pos="${posBad}"]`));
  ok(!t.ev("answered") && t.d.querySelectorAll("#xfix [data-fix]").length === 3, "點對錯字後要出三個候選字");
  const wrongFix = [...t.d.querySelectorAll("#xfix [data-fix]")].find(b=>b.dataset.fix !== i.c[posBad]);
  t.click(wrongFix);
  ok(t.ev("answered") && /再記一次/.test(t.$("fbTitle").textContent), "第二步選錯要算錯");
  t.click(t.$("btnQuit"));
  ok(forKindC("wrong"), "再找一題");
  t.answer(true);
  ok(/答對/.test(t.$("fbTitle").textContent), "兩步都對才算對");
  t.click(t.$("btnQuit"));
  // 用法○✕
  ok(forKindC("usage", "再接再厲"), "要找得到用法題");
  const right = t.ev("queue[idx].right");
  ok(t.$("qPrompt").textContent.includes(right ? "比賽輸了" : "睡了一整天"), "句子要對得上○或✕");
  t.answer(false);
  ok(/再記一次/.test(t.$("fbTitle").textContent), "判斷錯要算錯");
  if(!right) ok(t.$("fbUse").textContent.includes("偷懶"), "誤用的句子答錯要解釋為什麼用錯");
  t.click(t.$("btnQuit"));
  // ○✕ 要各半左右：直接把同一題出 60 次，數硬幣
  let o = 0;
  for(let r = 0; r < 60; r++){ t.ev(`queue = [{i: byC["再接再厲"], kind:"usage"}]; idx = 0; showQ();`); if(t.ev("queue[0].right")) o++; }
  ok(o > 18 && o < 42, `○✕ 要各半左右, ○ ${o}/60`);
  ok(t.$("qPrompt").textContent.includes("再接再厲"), "用法題的句子裡要有那個成語");
}

// ================= W1 飼料帳 =================
{
  const t = boot();
  const T = JSON.stringify(today);
  const practise = (n, r) => t.ev(`(()=>{ const d = SHARED.days[${T}] || (SHARED.days[${T}] = {n:0, r:0}); const di = d.i || (d.i = {n:0, r:0}); if(!di.n){ di.n = 1; di.r = ${r} > 0 ? 1 : 0; checkFeed(di); } di.n = ${n}; di.r = ${r}; checkFeed(di); })()`);
  const feed = () => t.ev("feedLedger().earned");
  pickDiff(t, "std");
  // 級距（全對 → ×1.2）
  const exp = (n) => t.ev(`feedFor(${n}, 1 * 1.2)`);
  practise(10, 10); ok(feed() === exp(10), `10 題 → ${exp(10)} 顆, 實得 ${feed()}`);
  practise(30, 30); ok(feed() === exp(30), `30 題 → ${exp(30)} 顆, 實得 ${feed()}`);
  practise(80, 80); ok(feed() === 30, `80 題全對要碰到上限 30, 實得 ${feed()}`);
  practise(200, 200); ok(feed() === 30, "再多也不得超過一天 30 顆");
  // 答錯即時倒扣
  t.ev(`SHARED.days = {}; SHARED.feed = {earned:0, used:0, bonus:0, tickets:0};`);
  practise(30, 30); const full = feed();
  practise(40, 30); ok(feed() < full, `答錯要倒扣, ${full} → ${feed()}`);
  ok(feed() === t.ev("feedFor(20, 1 * 1)"), "倒扣後要等於重算的值（淨 20、答對率 75% ×1）");
  // 難度倍率是當天平均：用輕鬆刷完再切挑戰不得回頭追加
  t.ev(`SHARED.days = {}; SHARED.feed = {earned:0, used:0, bonus:0, tickets:0};`);
  pickDiff(t, "easy"); practise(30, 30); const easyFeed = feed();
  pickDiff(t, "hard"); t.ev(`checkFeed(SHARED.days[${T}].i)`);
  ok(feed() === easyFeed, "切到挑戰不得回頭追加飼料");
  // 成語練習不得動到英文的分鐘存摺與英文達標
  ok(t.ev("SHARED.bank.earned") === 40 && t.ev("SHARED.bank.used") === 5, "英文的分鐘存摺一分都不能動");
  ok(t.ev(`SHARED.days[${T}].paid`) === undefined, "成語達標不得寫進英文的 day.paid（會偽造英文達標日）");
  // 但日曆要有「今天有練」
  ok(t.ev("streakDays()") === 1, "只練成語，日曆也要算今天有練");
  // 連續 7 天達標送轉蛋券
  t.ev(`SHARED.days = {}; SHARED.feed = {earned:0, used:0, bonus:0, tickets:0};
    for(let k = 1; k <= 6; k++){ const d = new Date(); d.setDate(d.getDate() - k); SHARED.days[dayKey(d)] = {n:0, r:0, i:{n:30, r:30, paid:12}}; }`);
  practise(30, 30);
  ok(t.ev("feedLedger().tickets") === 1, `連續 7 天達標要送一張轉蛋券, 實得 ${t.ev("feedLedger().tickets")}`);
  ok(t.ev("feedStreak()") === 7, `成語連續達標要算 7 天, 實得 ${t.ev("feedStreak()")}`);
  // 真的用畫面練一輪，飼料要進帳、頂端要更新
  t.ev(`SHARED.days = {}; SHARED.feed = {earned:0, used:0, bonus:0, tickets:0}; refreshHeader();`);
  ok(t.$("hStreak").textContent.includes("再答對 10 題"), `頂端要講還差幾題, 實得「${t.$("hStreak").textContent}」`);
  playRound(t, 10, true);
  ok(feed() >= 2, `練一輪 10 題全對要有飼料, 實得 ${feed()}`);
  ok(t.$("hFeed").textContent === String(feed()), "頂端飼料要更新");
  t.next();
  ok(!t.$("sumCard").hidden && /顆飼料/.test(t.$("sumText").textContent), "結算頁要講今天幾顆");
  // 存得進 localStorage，重開讀得回來
  const raw = t.w.localStorage.getItem("cq-shared-v1");
  ok(JSON.parse(raw).feed.earned === feed(), "飼料帳要存進共用存摺");
  ok(!!JSON.parse(t.w.localStorage.getItem("cq-vocab-v1:idiom")).stats, "成語答題紀錄要存起來");
}

// ================= 只考錯過的 =================
{
  const t = boot();
  t.click(t.$("btnWrongOnly"));
  ok(t.$("qCard").hidden, "沒有錯過的成語時不得開始");
  t.ev(`IDIOMS.slice(0, 5).forEach(i=>{ S.stats[i.c] = {r:0, x:2, streak:0}; }); save(); renderPickers();`);
  ok(t.$("wrongCount").textContent === "5", "錯題數要顯示");
  t.click(t.$("btnWrongOnly"));
  ok(!t.$("qCard").hidden && t.ev("queue.length") === 5, `只考錯過的要剛好那幾條, 實得 ${t.ev("queue.length")}`);
  ok(t.ev("queue.every(q=>IDIOMS.slice(0,5).some(i=>i.c===q.i.c))"), "只能出錯過的");
}

// ================= 中途結束 =================
{
  const t = boot();
  pickN(t, 10); t.start();
  t.answer(true); t.next(); t.answer(false);
  t.click(t.$("btnQuit"));
  ok(!t.$("sumCard").hidden && t.$("sumTotal").textContent === "/2", `中途結束分母要等於實際答題數, 實得 ${t.$("sumTotal").textContent}`);
  ok(t.$("sumScore").textContent === "1", "分子要對");
  ok(/提早結束/.test(t.$("sumText").textContent), "要標示提早結束");
}

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail ? 1 : 0);
