/* 備份碼 CQ5：帶成語ㄚ喵的東西一起走

   搬家那天飼料、成語紀錄（之後還有貓）都得跟著備份碼過去，否則等於沒備份。
   同時 CQ2～CQ4 的舊碼還是要還原得回來，而且還原後不得爆掉。 */
const fs = require("fs"), path = require("path"), {JSDOM} = require("jsdom");
const ROOT = path.join(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const idiomHtml = fs.readFileSync(path.join(ROOT, "idiom.html"), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const key = d => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
const today = key(new Date()), y1 = key(new Date(Date.now() - 86400000));

function boot(html, file, seed){
  const dom = new JSDOM(html, {runScripts:"dangerously", pretendToBeVisual:true, url:"https://x.test/" + file,
    beforeParse(win){
      win.speechSynthesis = {speak(){}, cancel(){}, getVoices:()=>[{lang:"en-US", name:"S"}], addEventListener(){}};
      win.SpeechSynthesisUtterance = function(t){ this.text = t; };
      if(seed) seed(win.localStorage);
    }});
  const w = dom.window;
  w.alert = ()=>{}; w.confirm = ()=>true; w.scrollTo = ()=>{}; w.HTMLElement.prototype.scrollIntoView = function(){};
  return {w, d:w.document, $:id=>w.document.getElementById(id), ev:x=>w.eval(x), ls:w.localStorage};
}
const SHARED = {
  days:{[y1]:{n:30, r:28, paid:15, i:{n:30, r:29, paid:12}}, [today]:{n:0, r:0, i:{n:10, r:9, paid:2}}},
  bank:{earned:17, used:5, bonus:0}, feed:{earned:14, used:3, bonus:0, tickets:1},
  gifts:[{d:today, m:30, why:"幫忙洗碗", dev:"ab12", seq:1, ts:1700000000}], coupons:[]
};
const IDIOM_S = {done:40, right:35, stats:{"一心一意":{r:3, x:1, streak:2, due:"2099-01-01", k:"tile"}, "守株待兔":{r:0, x:2, streak:0, due:today}}};

// ---------- ① CQ5 往返 ----------
{
  const a = boot(indexHtml, "index.html", ls=>{ ls.setItem("cq-shared-v1", JSON.stringify(SHARED)); ls.setItem("cq-vocab-v1:idiom", JSON.stringify(IDIOM_S)); });
  const code = a.ev("exportCode()");
  ok(code.startsWith("CQ5:"), `備份碼要升到 CQ5, 實得 ${code.slice(0, 4)}`);
  ok(/idiom=/.test(a.ev(`b64d(${JSON.stringify(code.slice(4))})`)), "備份碼要有成語那一段");
  const b = boot(indexHtml, "index.html");
  ok(b.ev(`importCode(${JSON.stringify(code)})`) === "", "CQ5 要還原得回來");
  ok(b.ev("SHARED.feed && SHARED.feed.earned") === 14 && b.ev("SHARED.feed.tickets") === 1, `飼料帳要跟著走, 實得 ${JSON.stringify(b.ev("SHARED.feed"))}`);
  ok(b.ev(`SHARED.days[${JSON.stringify(y1)}].i.n`) === 30 && b.ev(`SHARED.days[${JSON.stringify(y1)}].i.paid`) === 12, "每天的成語題數與飼料要跟著走");
  ok(b.ev(`SHARED.days[${JSON.stringify(y1)}].paid`) === 15, "英文那份不得被成語欄位擠掉");
  ok(b.ev(`SHARED.days[${JSON.stringify(today)}].i.n`) === 10 && !b.ev(`SHARED.days[${JSON.stringify(today)}].paid`), "只練成語的日子也要還原");
  const S2 = JSON.parse(b.ls.getItem("cq-vocab-v1:idiom"));
  ok(S2 && S2.stats["一心一意"] && S2.stats["一心一意"].r === 3 && S2.stats["一心一意"].streak === 2, `成語答題紀錄要跟著走, 實得 ${JSON.stringify(S2 && S2.stats["一心一意"])}`);
  ok(S2.stats["一心一意"].due === "2099-01-01" && S2.stats["守株待兔"].due === today, "複習日要保留");
  ok(S2.done === 40 && S2.right === 35, "總題數要保留");
  ok(b.ev("bankLeft()") === 17 + 30 - 5, `英文存摺要一樣, 實得 ${b.ev("bankLeft()")}`);
  ok(b.ev("SHARED.gifts[0].dev") === "ab12", "贈送紀錄的身分不得掉");
  // 成語頁要讀得到還原的東西
  const c = boot(idiomHtml, "idiom.html", ls=>{ ls.setItem("cq-shared-v1", b.ls.getItem("cq-shared-v1")); ls.setItem("cq-vocab-v1:idiom", b.ls.getItem("cq-vocab-v1:idiom")); });
  ok(c.ev("feedLeft()") === 14 - 3, `成語頁要讀到還原後的飼料, 實得 ${c.ev("feedLeft()")}`);
  ok(c.ev("mastered('一心一意')") === true, "成語頁要看到熟練的成語");
  ok(c.ev("feedStreak()") === 2, `成語連續達標要還原, 實得 ${c.ev("feedStreak()")}`);
}

// ---------- ①-2 貓要跟著備份碼走 ----------
{
  const withPet = JSON.parse(JSON.stringify(SHARED));
  withPet.pet = {free:false, bell:{month:today.slice(0,7), n:1}, cats:[{name:"小橘", breed:"orange", xp:250, hunger:64.4, clean:30.2, bonus:12, adopted:y1, last:1700000000, away:null, box:false, stage:"少年貓"}],
                 diary:[{d:y1, ev:"adopt", text:"領養了少見的橘虎斑，取名「小橘」", ts:1}, {d:today, ev:"stage", text:"小橘長成少年貓了", ts:2}]};
  const a = boot(indexHtml, "index.html", ls=>ls.setItem("cq-shared-v1", JSON.stringify(withPet)));
  const code = a.ev("exportCode()");
  const b = boot(indexHtml, "index.html");
  ok(b.ev(`importCode(${JSON.stringify(code)})`) === "", "帶貓的備份碼要還原得回來");
  const c = b.ev("SHARED.pet && SHARED.pet.cats[0]");
  ok(!!c && c.name === "小橘" && c.breed === "orange", `貓的名字與花色要跟著走, 實得 ${JSON.stringify(c)}`);
  ok(c.xp === 250 && c.hunger === 64 && c.clean === 30, "成長值與狀態要跟著走（四捨五入到整數）");
  ok(c.adopted === y1 && c.away === null && c.box === false, "領養日、在不在家要跟著走");
  ok(b.ev("SHARED.pet.free") === false && b.ev("SHARED.pet.bell.n") === 1 && b.ev("SHARED.pet.bell.month") === today.slice(0,7), "免費額度與鈴鐺次數要跟著走");
  ok(b.ev("SHARED.pet.diary.length") === 2 && b.ev("SHARED.pet.diary[1].text").includes("少年貓"), "日記要跟著走");
  // 離家中的貓也要還原成離家
  withPet.pet.cats[0].away = {since:y1, idle:7};
  const a2 = boot(indexHtml, "index.html", ls=>ls.setItem("cq-shared-v1", JSON.stringify(withPet)));
  const b2 = boot(indexHtml, "index.html");
  b2.ev(`importCode(${JSON.stringify(a2.ev("exportCode()"))})`);
  ok(b2.ev("SHARED.pet.cats[0].away && SHARED.pet.cats[0].away.since") === y1, "離家中要還原成離家");
  // 成語頁讀得到那隻貓
  const d = boot(idiomHtml, "idiom.html", ls=>ls.setItem("cq-shared-v1", b.ls.getItem("cq-shared-v1")));
  ok(d.ev("cat() && cat().name") === "小橘", "成語頁要讀到還原的貓");
}

// ---------- ② 沒練過成語的裝置：備份碼不得多出怪東西，還原後也不得爆 ----------
{
  const a = boot(indexHtml, "index.html", ls=>ls.setItem("cq-shared-v1", JSON.stringify({days:{[today]:{n:10, r:9, paid:2}}, bank:{earned:2, used:0, bonus:0}, gifts:[], coupons:[]})));
  const code = a.ev("exportCode()");
  const b = boot(indexHtml, "index.html");
  ok(b.ev(`importCode(${JSON.stringify(code)})`) === "", "沒有成語紀錄的碼要還原得回來");
  ok(!b.ev(`SHARED.days[${JSON.stringify(today)}].i`), "沒練成語的日子不得多出 i");
  ok(!b.ev("SHARED.feed"), "沒有飼料帳就不該憑空長出來");
  ok(!b.ev("SHARED.pet"), "沒有貓就不該憑空長出來");
  ok(b.ls.getItem("cq-vocab-v1:idiom") === null, "沒有成語紀錄就不得寫一份空的");
}

// ---------- ③ 舊碼 CQ4 / CQ2 還是要能還原 ----------
{
  const a = boot(indexHtml, "index.html");
  const cq4 = "CQ4:" + a.ev(`b64e("~shared=0|0|17|5|0||" + sd(${JSON.stringify(y1)}) + ":30,28,15|" + sd(${JSON.stringify(today)}) + ":30:ab12:1:1700000000:幫忙洗碗|")`);
  const b = boot(indexHtml, "index.html");
  ok(b.ev(`importCode(${JSON.stringify(cq4)})`) === "", "CQ4 舊碼要還原得回來");
  ok(b.ev(`SHARED.days[${JSON.stringify(y1)}].paid`) === 15 && !b.ev(`SHARED.days[${JSON.stringify(y1)}].i`), "CQ4 的日子沒有成語欄位，不得多出來");
  ok(b.ev("SHARED.gifts.length") === 1 && b.ev("SHARED.gifts[0].why") === "幫忙洗碗", "CQ4 的贈送要還原");
  ok(!b.ev("SHARED.feed"), "CQ4 沒有飼料帳");
  const cq2 = "CQ2:" + b.w.btoa("~shared=0|0|18|0|0||260816:30,30,1");
  ok(b.ev(`importCode(${JSON.stringify(cq2)})`) === "", "CQ2 最舊的碼還是要還原得回來");
  ok(b.ev('importCode("CQ6:x")') !== "", "不認得的版本要擋下來");
}

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail ? 1 : 0);
