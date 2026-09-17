/* 成語ㄚ喵：到複習日的成語要先出

   會考重點有 525 條，只靠權重抽的話，考過的成語幾乎抽不回來：連對 2 次湊不到，
   湊到了到期又掉出「已熟練」，進度頁就一直是 0（2026-09-17 使用者回報）。 */
const fs = require("fs"), path = require("path"), {JSDOM} = require("jsdom");
const html = fs.readFileSync(path.join(__dirname, "..", "idiom.html"), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const key = d => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
const daysAgo = n => { const t = new Date(); t.setDate(t.getDate() - n); return key(t); };

function boot(stats){
  const dom = new JSDOM(html, {runScripts:"dangerously", pretendToBeVisual:true, url:"https://x.test/idiom.html",
    beforeParse(win){
      win.speechSynthesis = {speak(){}, cancel(){}, getVoices:()=>[], addEventListener(){}};
      win.SpeechSynthesisUtterance = function(t){ this.text = t; };
      win.localStorage.setItem("cq-shared-v1", JSON.stringify({days:{}, bank:{earned:0, used:0, bonus:0}, gifts:[], coupons:[]}));
      if(stats) win.localStorage.setItem("cq-vocab-v1:idiom", JSON.stringify({done:99, right:90, stats:stats(win)}));
    }});
  const w = dom.window; w.scrollTo = ()=>{};
  return {w, d:w.document, ev:x=>w.eval(x)};
}
// 題庫的前 n 條（會考重點範圍內）
const firstN = (n) => { const t = boot(); return t.ev(`pool().slice(0, ${n}).map(i=>i.c)`); };
const names = firstN(60);

{ // 40 條考過、昨天就到期 → 一輪 10 題要有 7 題是複習
  const t = boot(()=>{ const o = {}; names.slice(0, 40).forEach((c, k)=>{ o[c] = {r:2, x:0, streak:2, due:daysAgo(1 + k % 5)}; }); return o; });
  const dueSet = new Set(names.slice(0, 40));
  let min = 99, oldestFirst = true;
  for(let k = 0; k < 20; k++){
    const q = t.ev("drawRound(pool(), 10).map(x=>x.i.c)");
    ok(q.length === 10 && new Set(q).size === 10, "一輪要出滿 10 題、不得重複");
    min = Math.min(min, q.filter(c=>dueSet.has(c)).length);
  }
  ok(min >= 7, `到期的要先排，一輪至少 7 題是複習, 實得最少 ${min}`);
  const d = t.ev("dueList(pool()).map(i=>stat(i.c).due)");
  for(let k = 1; k < d.length; k++) if(d[k] < d[k-1]) oldestFirst = false;
  ok(d.length === 40 && oldestFirst, "拖最久的排最前面");
  t.ev("renderStats()");
  ok(/待複習 40 條/.test(t.d.getElementById("stDue").textContent), `進度頁要講有幾條待複習, 實得 ${t.d.getElementById("stDue").textContent}`);
  ok(t.d.getElementById("stMastered").textContent === "0", "到期的不算已熟練（數字不虛胖）");
}
{ // 還沒到期的不得被硬排進來；複習也不得把整輪佔滿
  const t = boot(()=>{ const o = {}; names.slice(0, 40).forEach(c=>{ o[c] = {r:2, x:0, streak:2, due:daysAgo(-5)}; }); return o; });
  ok(t.ev("dueList(pool()).length") === 0, "還沒到複習日的不算待複習");
  t.ev("renderStats()");
  ok(t.d.getElementById("stMastered").textContent === "40" && !/待複習/.test(t.d.getElementById("stDue").textContent), "沒到期的算已熟練，不顯示待複習");
}
{ // 沒考過的不算待複習（不然新裝置一開就是「待複習 525 條」）
  const t = boot();
  ok(t.ev("dueList(pool()).length") === 0, "沒考過的成語不算待複習");
  const q = t.ev("drawRound(pool(), 10).map(x=>x.i.c)");
  ok(q.length === 10, "沒有紀錄也要出得了題");
}
{ // 到期的只有 3 條：全排進去，其餘照常抽新的
  const t = boot(()=>{ const o = {}; names.slice(0, 3).forEach(c=>{ o[c] = {r:1, x:0, streak:1, due:daysAgo(0)}; }); return o; });
  const q = t.ev("drawRound(pool(), 10).map(x=>x.i.c)");
  ok(names.slice(0, 3).every(c=>q.includes(c)) && q.length === 10, "到期的少就全部排進去，剩下的補新的");
}
console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail ? 1 : 0);
