/* 易混淆字題庫的守門：規則全部寫在這裡，加題目之前先看這一份。

   這份資料的來源很不可靠——原始 161 題裡有 10 題答案本身是錯的（正解根本不在選項裡），
   15 處題幹把成語寫錯。所以這裡擋得比造字法則兇：正解一定要在四個字裡、四個字不得重複、
   解析一定要提到正解那個字，題幹一定要有「」挖空標記。
   還有一條最容易被忽略的：來源把正解一律排在第一個，出題時**一定要打亂**。 */
const fs = require("fs"), path = require("path"), {JSDOM} = require("jsdom");
const html = fs.readFileSync(path.join(__dirname, "..", "idiom.html"), "utf8");
const dom = new JSDOM(html, {runScripts:"dangerously", url:"https://x.test/idiom.html"});
const w = dom.window;

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const ROWS = w.eval("YIHUN_ROWS");
const TARGET = 149;   // 來源 161 題，丟掉 12 題（答案錯、兩個選項都對，或整題建立在錯的讀音上）

// ---------- 整體 ----------
ok(ROWS.length === TARGET, `題數要剛好 ${TARGET} 題，實得 ${ROWS.length}`);

const dup = (arr, name) => {
  const seen = {}, d = [];
  arr.forEach(v => { if(seen[v]) d.push(v); seen[v] = 1; });
  ok(d.length === 0, `${name}不得重複：${d.slice(0, 5).join("、")}`);
};
dup(ROWS.map(r => r[0]), "題幹");
dup(ROWS.map(r => r[2]), "解析");   // 解析重複通常代表兩題其實是同一題

// ---------- 每一題 ----------
const CJK = /^[一-鿿]$/;
ROWS.forEach((r, k) => {
  const tag = `第 ${k + 1} 題`;
  ok(Array.isArray(r) && r.length === 3, `${tag}要是 ["題幹", "四個字", "解析"] 三欄，實得 ${r.length} 欄`);
  const [q, chars, why] = r;

  ok(typeof q === "string" && q.includes("「") && q.includes("」"),
     `${tag}題幹要用「」標出挖空的位置：${q}`);
  ok(typeof chars === "string" && [...chars].length === 4,
     `${tag}要剛好四個字，實得 ${chars && [...chars].length}：${chars}`);
  [...String(chars)].forEach(ch => ok(CJK.test(ch), `${tag}選項「${ch}」不是單一中文字`));
  ok(new Set([...String(chars)]).size === 4, `${tag}四個選項不得重複：${chars}`);

  const ans = String(chars)[0];
  ok(typeof why === "string" && why.length >= 8, `${tag}解析太短：${why}`);
  ok(String(why).includes(ans), `${tag}解析要提到正解「${ans}」，答錯的人才知道差在哪：${why}`);

  // 題幹裡不可以出現正解，不然直接洩答案
  ok(!q.includes(ans), `${tag}題幹裡不可以出現正解「${ans}」：${q}`);
  /* 括號裡只能是注音。來源有 13 題把漢字「一」當成注音「ㄧ」（長得幾乎一樣，看不出來），
     還有兩題括號裡黏了空白。這種字餵給小孩，念出來和查字典都對不起來。 */
  (String(q).match(/[「『][^」』]*[」』]/g) || []).forEach(br=>{
    const inner = br.slice(1, -1);
    ok(/^[\u3105-\u3129ˊˇˋ˙]+( [\u3105-\u3129ˊˇˋ˙]+)*$/.test(inner),
      `${tag}括號裡只能是注音符號（注意漢字「一」不是注音「ㄧ」）：${br}`);
  });
  ok(q === q.trim(), `${tag}題幹前後不得有空白：${JSON.stringify(q)}`);
});

// ---------- 出題一定要打亂 ----------
// 來源的正解永遠排第一個。如果 showYihun 沒打亂，A 就永遠是答案。
{
  const d = w.document, $ = id => d.getElementById(id);
  const posOf = () => {
    w.eval("localStorage.setItem('cq-idiom-yihun','-1'); showYihun();");
    const k = +w.eval("localStorage.getItem('cq-idiom-yihun')");
    const ans = w.eval("YIHUN_ROWS")[k][1][0];
    return [...d.querySelectorAll("#yihunChoices .choice")].findIndex(b => b.dataset.w === ans);
  };
  const seen = new Set();
  for(let i = 0; i < 60; i++) seen.add(posOf());
  /* 正解填回去要跟成語題庫一致：題庫寫「提心吊膽」，這裡就不能把「弔」當唯一正解 —— 
   小孩在成語表看到的字，跟這裡判對的字必須是同一個。 */
{
  const deck = new Set(html.match(/^\["[\u4e00-\u9fff]{4}",/gm).map(x=>x.slice(2, 6)));
  const clash = [];
  ROWS.forEach((r, k)=>{
    const [q, chars] = r, ans = chars[0];
    [...chars].forEach(ch=>{
      const word = q.replace(/[「『][^」』]*[」』]/g, ch);
      if(word.length === 4 && deck.has(word) && ch !== ans)
        clash.push(`第 ${k+1} 題：正解標「${ans}」，但題庫收的是「${word}」`);
    });
  });
  ok(clash.length === 0, `正解要跟成語題庫同一個寫法：${clash.slice(0, 3).join("；")}`);
}
/* 題幹給的注音要跟成語題庫的破音字一致。來源有兩題把「櫛」念成 ㄐㄧˊ、「券」念成 ㄐㄩㄢˋ，
   而且四個選項全照錯的音去配 —— 那種題整題都要丟，不能只改注音。 */
{
  const pz = {};
  (html.match(/pz:"[^"]+"/g) || []).forEach(x=>x.slice(4, -1).split(/[，,]/).forEach(p=>{
    const [ch, z] = p.split("："); if(ch && z) (pz[ch] = pz[ch] || new Set()).add(z);
  }));
  const wrong = [];
  ROWS.forEach((r, k)=>{
    const m = r[0].match(/[「『]([^」』]+)[」』]/); if(!m) return;
    const zy = m[1].split(" "); if(zy.length !== 1) return;
    const ans = r[1][0];
    if(pz[ans] && !pz[ans].has(zy[0]))
      wrong.push(`第 ${k+1} 題「${ans}」注音寫 ${zy[0]}，題庫破音字是 ${[...pz[ans]].join("／")}`);
  });
  ok(wrong.length === 0, `題幹注音要跟題庫的破音字一致：${wrong.join("；")}`);
}
ok(seen.size >= 3, `正解不得固定在同一個位置（來源一律排第一個），60 次只出現在 ${[...seen].sort().join("/")} 號位`);
  ok(!(seen.size === 1 && seen.has(0)), "正解永遠在 A，等於送分題");
}

console.log(`通過 ${pass} / 失敗 ${fail}`);
process.exit(fail > 0 ? 1 : 0);
