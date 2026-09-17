/* 單字闖關：到複習日的字要先出（跟成語ㄚ喵的 idiom-review 同一條規則） */
const fs = require("fs"), path = require("path"), {JSDOM} = require("jsdom");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const key = d => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
const daysAgo = n => { const t = new Date(); t.setDate(t.getDate() - n); return key(t); };

function boot(stats){
  const dom = new JSDOM(html, {runScripts:"dangerously", pretendToBeVisual:true, url:"https://x.test/index.html",
    beforeParse(win){
      win.speechSynthesis = {speak(){}, cancel(){}, getVoices:()=>[], addEventListener(){}};
      win.SpeechSynthesisUtterance = function(t){ this.text = t; };
      if(stats) win.localStorage.setItem("cq-vocab-v1:full", JSON.stringify({done:99, right:90, stats}));
    }});
  const w = dom.window; w.scrollTo = ()=>{};
  return {w, ev:x=>w.eval(x)};
}
const names = boot().ev("WORDS.slice(0, 60).map(w=>w.w)");

{ // 40 個考過、已到期 → 一輪 10 題至少 7 題是複習
  const st = {}; names.slice(0, 40).forEach((w, k)=>{ st[w] = {r:2, x:0, streak:2, due:daysAgo(1 + k % 5)}; });
  const t = boot(st), dueSet = new Set(names.slice(0, 40));
  let min = 99;
  for(let k = 0; k < 20; k++){
    const q = t.ev("drawRound(WORDS, 10).map(x=>x.word.w)");
    ok(q.length === 10 && new Set(q).size === 10, "一輪要出滿 10 題、不得重複");
    min = Math.min(min, q.filter(w=>dueSet.has(w)).length);
  }
  ok(min >= 7, `到期的要先排，一輪至少 7 題是複習, 實得最少 ${min}`);
  const d = t.ev("dueList(WORDS).map(w=>due(w.w))");
  ok(d.length === 40 && d.every((x, k)=>k === 0 || d[k-1] <= x), "拖最久的排最前面");
}
{ // 還沒到期、沒考過的都不算
  const st = {}; names.slice(0, 40).forEach(w=>{ st[w] = {r:2, x:0, streak:2, due:daysAgo(-5)}; });
  ok(boot(st).ev("dueList(WORDS).length") === 0, "還沒到複習日的不算");
  const t = boot();
  ok(t.ev("dueList(WORDS).length") === 0, "沒考過的字不算待複習");
  ok(t.ev("drawRound(WORDS, 10).length") === 10, "沒有紀錄也要出得了題");
}
{ // 範圍很小（只有 5 個字）時不得出錯、不得重複
  const st = {}; names.slice(0, 5).forEach(w=>{ st[w] = {r:1, x:0, streak:1, due:daysAgo(0)}; });
  const q = boot(st).ev("drawRound(WORDS.slice(0, 5), 10).map(x=>x.word.w)");
  ok(q.length === 5 && new Set(q).size === 5, `範圍比題數小時出滿範圍就好, 實得 ${q.length}`);
}
console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail ? 1 : 0);
