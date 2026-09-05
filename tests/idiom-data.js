/* 成語題庫的守門：內容的規則全部寫在這裡，加內容之前先看這一份。

   跟單字題庫一樣，這些不是「程式對不對」，是「資料對不對」——
   例句裡沒有那個成語，挖空題就挖不掉；易錯字跟原字差兩個字，抓錯字題就出不了；
   近義指到題庫裡沒有的成語，干擾項就會抓到 undefined。全部在這裡先擋。 */
const fs = require("fs"), path = require("path"), {JSDOM} = require("jsdom");
const html = fs.readFileSync(path.join(__dirname, "..", "idiom.html"), "utf8");
const dom = new JSDOM(html, {runScripts:"dangerously", url:"https://x.test/idiom.html"});
const w = dom.window;
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const L = w.eval("IDIOMS");
const byC = {}; L.forEach(i => { byC[i.c] = i; });
const TARGET = {1:80, 2:120, 3:120, 4:129, 5:456};   // 每級的條數；五級是歷屆會考（外部來源），沒有例句與完整注音
const CJK = /^[一-鿿]{4}$/;
// 一組注音：聲母/韻母 + 可有可無的聲調。輕聲「˙」教育部放在前面，也接受放後面。
const ZY = /^(˙?[ㄅ-ㄩ]+[ˊˇˋ]?|[ㄅ-ㄩ]+˙)$/;

// ---------- 整體 ----------
ok(L.length > 0, "題庫不得是空的");
const perLv = {};
L.forEach(i => { perLv[i.lv] = (perLv[i.lv] || 0) + 1; });
Object.keys(TARGET).forEach(lv => {
  const n = perLv[lv] || 0;
  ok(n === 0 || n === TARGET[lv], `${lv} 級要剛好 ${TARGET[lv]} 條（或還沒開始做 = 0），實得 ${n}`);
});
console.log("  各級條數：" + Object.keys(TARGET).map(lv => `${lv}級 ${perLv[lv] || 0}`).join("　"));

const dup = (arr, name) => {
  const seen = {}, d = [];
  arr.forEach(v => { if(seen[v]) d.push(v); seen[v] = 1; });
  ok(d.length === 0, `${name}不得重複：${d.join("、")}`);
};
dup(L.map(i => i.c), "成語");
dup(L.map(i => i.m), "解釋");
dup(L.filter(i => i.ex).map(i => i.ex), "例句");
dup(L.filter(i => i.zy).map(i => i.zy), "注音");

// ---------- 每一條 ----------
L.forEach(i => {
  const tag = `「${i.c}」`;
  ok(CJK.test(i.c), `${tag}必須剛好四個中文字（拼成語題靠 8 格機制，第一階只收四字）`);
  ok(Array.isArray(i.chars) && i.chars.length === 4 && i.chars.join("") === i.c, `${tag}拆字要對`);
  ok([1,2,3,4,5].includes(i.lv), `${tag}級要是 1～5，實得 ${i.lv}`);
  const exam = i.lv === 5;                 // 會考級：來源沒有完整注音與例句，但有的話一樣要對

  if(!exam || String(i.zy || "").trim()){
    const zy = String(i.zy || "").trim().split(/\s+/);
    ok(zy.length === 4, `${tag}注音要剛好四組（用空格分開），實得 ${zy.length} 組：${i.zy}`);
    zy.forEach((g, k) => ok(ZY.test(g), `${tag}第 ${k+1} 組注音有怪字：${g}`));
  }
  // 特殊注音（破音字）：「字：注音」用全形逗號分開，字要在成語裡
  if(i.pz !== undefined){
    const parts = String(i.pz).split("，");
    ok(parts.length >= 1 && parts.every(p=>/^[一-鿿]：.+$/.test(p)), `${tag}特殊注音格式要是「字：注音」：${i.pz}`);
    parts.forEach(p=>{ const [ch, z] = p.split("："); ok(i.c.includes(ch), `${tag}特殊注音的「${ch}」不在成語裡`); ok(ZY.test(z || ""), `${tag}特殊注音有怪字：${z}`); });
  }

  ok(typeof i.m === "string" && i.m.length >= 4, `${tag}解釋太短或沒有`);
  ok(!i.m.includes(i.c), `${tag}解釋裡不能直接寫出成語本身（那就不用猜了）`);
  ok(/[。！？]$/.test(i.m), `${tag}解釋要以句號結尾`);

  if(!exam || i.ex){
    ok(typeof i.ex === "string" && i.ex.includes(i.c), `${tag}例句裡一定要有這個成語（挖空題才挖得掉）：${i.ex}`);
    ok(i.ex.length >= 6 && i.ex.length <= 40, `${tag}例句長度要在 6～40 字，實得 ${i.ex.length}`);
    ok(/[。！？」]$/.test(i.ex), `${tag}例句要以標點結尾`);
  }

  // 易錯字：抓錯字題的原料
  if(i.x !== undefined){
    ok(CJK.test(i.x), `${tag}易錯寫法要四個字：${i.x}`);
    ok(i.x !== i.c, `${tag}易錯寫法不能跟原字一樣`);
    // 「剛好一個字錯」——但疊字成語（小心翼翼→小心奕奕）是同一個字在兩個位置一起錯，
    // 那算一種錯，抓錯字題點到任一個都算對。所以規則是「只有一種替換」。
    const subs = new Set([...i.x].map((ch, k) => ch !== i.c[k] ? i.c[k] + "→" + ch : "").filter(Boolean));
    ok(subs.size === 1, `${tag}易錯寫法只能有一種字的替換，實得 ${subs.size} 種：${i.x}`);
    ok(!byC[i.x], `${tag}的易錯寫法「${i.x}」本身也是題庫裡的成語，不能當錯字`);
    ok(typeof i.xw === "string" && i.xw.length >= 4, `${tag}有易錯字就要說明為什麼容易錯（xw）`);
    ok(!i.ex.includes(i.x), `${tag}例句裡不能出現錯的寫法`);
  }
  // 誤用例句：用法○✕題的原料
  if(i.bad !== undefined){
    ok(typeof i.bad === "string" && i.bad.includes(i.c), `${tag}誤用例句裡要有這個成語：${i.bad}`);
    ok(i.bad !== i.ex, `${tag}誤用例句不能跟正確例句一樣`);
    ok(typeof i.badw === "string" && i.badw.length >= 4, `${tag}有誤用例句就要說明為什麼用錯（badw）`);
  }
  // 近義／反義：干擾項與 4-7 題的原料，必須指到題庫裡有的
  ["near", "anti"].forEach(k => {
    ok(Array.isArray(i[k]), `${tag}${k} 要是陣列`);
    (i[k] || []).forEach(t => {
      ok(!!byC[t], `${tag}${k === "near" ? "近義" : "反義"}「${t}」題庫裡沒有這一條`);
      ok(t !== i.c, `${tag}${k} 不能指向自己`);
    });
  });
  const overlap = (i.near || []).filter(t => (i.anti || []).includes(t));
  ok(overlap.length === 0, `${tag}同一個成語不能既是近義又是反義：${overlap.join("、")}`);

  // 三級以上一定要有易錯字；四級一定要有誤用例句（那兩個題型的原料）
  if(i.lv === 3 || i.lv === 4) ok(i.x !== undefined, `${tag}三、四級每條都要有易錯字`);
  if(i.lv === 4) ok(i.bad !== undefined, `${tag}四級每條都要有誤用例句`);
});

// 近義／反義要對稱：A 說 B 是近義，B 也該知道 A（否則 4-7 題只有單向可出）
let asym = [];
L.forEach(i => {
  (i.near || []).forEach(t => { if(!(byC[t].near || []).includes(i.c)) asym.push(`${i.c}→${t}`); });
  (i.anti || []).forEach(t => { if(!(byC[t].anti || []).includes(i.c)) asym.push(`${i.c}↔${t}`); });
});
ok(asym.length === 0, `近義／反義要雙向都寫：${asym.slice(0, 8).join("、")}${asym.length > 8 ? "…" : ""}`);

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail ? 1 : 0);
