/* 造字法則（六書）題庫的守門：規則全部寫在這裡，加題目之前先看這一份。

   跟成語題庫同一個道理，擋的是「資料對不對」不是「程式對不對」——
   答案索引超出四個選項，結算頁就會顯示 undefined；解析裡沒有那個字，
   答錯的人看不出來在講誰；題目重複，同一輪抽到兩次就穿幫。 */
const fs = require("fs"), path = require("path"), {JSDOM} = require("jsdom");
const html = fs.readFileSync(path.join(__dirname, "..", "idiom.html"), "utf8");
const dom = new JSDOM(html, {runScripts:"dangerously", url:"https://x.test/idiom.html"});
const w = dom.window;

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const OPTS = w.eval("LIUSHU_OPTS");
const ROWS = w.eval("LIUSHU_ROWS");
const TARGET = 74;   // 來源 77 題，去掉辨／入／奕三題（分析有誤或教科書兩派並存）

// ---------- 整體 ----------
ok(Array.isArray(OPTS) && OPTS.length === 4, `選項要剛好四個，實得 ${OPTS && OPTS.length}`);
ok(OPTS.join("") === "象形指事會意形聲", `選項要照課本順序「象形指事會意形聲」，實得 ${OPTS.join("")}`);
ok(ROWS.length === TARGET, `題數要剛好 ${TARGET} 題，實得 ${ROWS.length}`);

const dup = (arr, name) => {
  const seen = {}, d = [];
  arr.forEach(v => { if(seen[v]) d.push(v); seen[v] = 1; });
  ok(d.length === 0, `${name}不得重複：${d.join("、")}`);
};
dup(ROWS.map(r => r[0]), "題目");
dup(ROWS.map(r => r[2]), "解析");

// 四種造字法則都要出得到，不然某一類等於沒教
const perOpt = {};
ROWS.forEach(r => { perOpt[OPTS[r[1]]] = (perOpt[OPTS[r[1]]] || 0) + 1; });
OPTS.forEach(o => ok((perOpt[o] || 0) >= 8, `「${o}」至少要 8 題（抽到的機會才夠），實得 ${perOpt[o] || 0}`));
console.log("  四類題數：" + OPTS.map(o => `${o} ${perOpt[o] || 0}`).join("　"));

// ---------- 每一題 ----------
const CJK = /[一-鿿]/;
ROWS.forEach((r, k) => {
  const tag = `第 ${k + 1} 題`;
  ok(Array.isArray(r) && r.length === 3, `${tag}要是 ["題目", 答案索引, "解析"] 三欄，實得 ${r.length} 欄`);
  const [q, a, why] = r;

  ok(typeof q === "string" && q.trim().length >= 8, `${tag}題目太短或不是字串：${q}`);
  ok(Number.isInteger(a) && a >= 0 && a <= 3, `${tag}答案索引要是 0～3，實得 ${a}`);
  ok(typeof why === "string" && why.trim().length >= 6, `${tag}解析太短或不是字串：${why}`);

  // 解析要點出是哪個字，答錯的人才知道在講誰
  const m = String(why).match(/^「(.)」字/);
  ok(!!m, `${tag}解析要用「X」字開頭點出是哪個字，實得：${why}`);

  // 題目不可以直接把答案寫出來，不然是送分題
  OPTS.forEach(o => ok(!q.includes(o), `${tag}題目裡不可以出現「${o}」這四個字，會直接洩答案：${q}`));

  ok(CJK.test(q), `${tag}題目要有中文`);
});

console.log(`通過 ${pass} / 失敗 ${fail}`);
process.exit(fail > 0 ? 1 : 0);
