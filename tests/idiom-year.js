/* 歷屆會考年度的守門：規則全部寫在這裡，改年度資料之前先看這一份。

   這份只是標籤，不影響出題範圍，所以擋的重點只有兩個：
   一、鍵一定要是題庫裡真的有的成語——指到不存在的成語，標籤就永遠不會出現，
       改錯了也沒人發現（來源有 13 條八字諺語不在題庫裡，就是這樣濾掉的）。
   二、年度一定要是合理的三位數民國年，而且不能重複。 */
const fs = require("fs"), path = require("path"), {JSDOM} = require("jsdom");
const html = fs.readFileSync(path.join(__dirname, "..", "idiom.html"), "utf8");
const dom = new JSDOM(html, {runScripts:"dangerously", url:"https://x.test/idiom.html"});
const w = dom.window;

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const YEARS = w.eval("EXAM_YEARS");
const IDIOMS = w.eval("IDIOMS");
const byC = {}; IDIOMS.forEach(i => { byC[i.c] = i; });
const TARGET = 390;
const LO = 102, HI = 113;   // 來源涵蓋的年度範圍

const keys = Object.keys(YEARS);
ok(keys.length === TARGET, `要剛好 ${TARGET} 條，實得 ${keys.length}`);

keys.forEach(c => {
  ok(!!byC[c], `「${c}」不在題庫裡，標籤永遠不會出現`);
  const ys = String(YEARS[c]).split(" ").filter(Boolean);
  ok(ys.length > 0, `「${c}」沒有年度`);
  ok(new Set(ys).size === ys.length, `「${c}」年度重複：${YEARS[c]}`);
  ys.forEach(y => ok(/^\d{3}$/.test(y) && +y >= LO && +y <= HI,
                     `「${c}」的年度要是 ${LO}～${HI}，實得 ${y}`));
  ok(ys.join(" ") === ys.slice().sort().join(" "), `「${c}」年度要由小到大排：${YEARS[c]}`);
});

// 有年度的一定屬於「會考重點」範圍，不然標了會考卻練不到，自相矛盾
keys.forEach(c => ok(w.eval(`inScope(byC[${JSON.stringify(c)}], "exam")`),
                     `「${c}」標了會考年度，卻不在「會考重點」範圍裡`));

// 標籤只是資訊，不得拿去當出題條件。
// 這裡不寫死條數——條數會隨題庫校對變動，寫死只會在別人修資料時誤紅；
// 真正要擋的是「範圍的判斷式碰到了 EXAM_YEARS」。
const SCOPES = w.eval("SCOPES");
ok(SCOPES.length === 2, `範圍還是只能有兩種，實得 ${SCOPES.length}`);
SCOPES.forEach(z => ok(!String(z.pick).includes("EXAM_YEARS"),
                       `範圍「${z.name}」的判斷式不得用到 EXAM_YEARS，年度只是標籤`));
// 也不得漏進出題流程
["pickKind", "weight", "pool"].forEach(fn => {
  const src = w.eval(`typeof ${fn} === "function" ? String(${fn}) : ""`);
  ok(!src.includes("EXAM_YEARS"), `${fn}() 不得用到 EXAM_YEARS，年度不影響出題`);
});

// 每個年度都要有題，不然是資料漏了
const per = {};
keys.forEach(c => String(YEARS[c]).split(" ").forEach(y => { per[y] = (per[y] || 0) + 1; }));
for(let y = LO; y <= HI; y++) ok((per[y] || 0) > 0, `${y} 年一條都沒有，資料可能漏了`);
console.log("  各年度條數：" + Object.keys(per).sort().map(y => `${y} ${per[y]}`).join("　"));

console.log(`通過 ${pass} / 失敗 ${fail}`);
process.exit(fail > 0 ? 1 : 0);
