/* 爸媽自訂的實體獎勵（看電影、吃冰…）

   定義要家長密碼才改得了；小孩換的時候也要家長密碼（現實世界的東西，要家長在場）；
   扣同一本分鐘存摺、記進購買帳（帶名稱，獎勵被刪掉紀錄也看得懂）；備份碼往返；名稱不得注入。 */
const fs = require("fs"), path = require("path"), {JSDOM} = require("jsdom");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

function boot(sh, pin){
  const dom = new JSDOM(html, {runScripts:"dangerously", pretendToBeVisual:true, url:"https://x.test/index.html",
    beforeParse(win){
      win.speechSynthesis = {speak(){}, cancel(){}, getVoices:()=>[], addEventListener(){}};
      win.SpeechSynthesisUtterance = function(t){ this.text = t; };
      win.localStorage.setItem("cq-shared-v1", JSON.stringify(Object.assign({days:{}, bank:{earned:200, used:0, bonus:0}, gifts:[], coupons:[]}, sh || {})));
    }});
  const w = dom.window, d = w.document;
  w.alert = ()=>{}; w.confirm = ()=>true; w.scrollTo = ()=>{};
  const $ = id => d.getElementById(id), ev = x => w.eval(x);
  const click = e => e.dispatchEvent(new w.MouseEvent("click", {bubbles:true}));
  const say = (...a) => { const q = a.slice(); w.prompt = () => q.length ? q.shift() : null; };
  if(pin) ev(`localStorage.setItem(PIN_KEY, "${pin}")`);
  return {w, d, $, ev, click, say};
}

{ // 新增、顯示、兌換
  const t = boot(null, "1234");
  ok(t.w.getComputedStyle(t.$("rewardBox")).display === "none", "沒有自訂獎勵時存摺卡不得多出一塊");
  t.say("9999", "看電影", "120"); t.click(t.$("btnRewards"));
  ok(t.ev("rewards().length") === 0, "密碼錯不得新增");
  t.say("1234", "看電影", "120"); t.click(t.$("btnRewards"));
  t.say("1234", "吃冰", "30"); t.click(t.$("btnRewards"));
  ok(t.ev("rewards().length") === 2 && t.ev("rewards()[0].name") === "看電影" && t.ev("rewards()[0].m") === 120, `要新增得了, 實得 ${JSON.stringify(t.ev("rewards()"))}`);
  t.say("1234", "太貴", "9999"); t.click(t.$("btnRewards"));
  t.say("1234", "免費", "0"); t.click(t.$("btnRewards"));
  ok(t.ev("rewards().length") === 2, "分鐘要在 1～600 之間");
  const btns = () => [...t.$("rewardList").querySelectorAll("[data-reward]")];
  ok(btns().length === 2 && /看電影/.test(btns()[0].textContent) && /120 分鐘/.test(btns()[0].textContent), "存摺卡要列出來、寫價錢");
  t.say("0000"); t.click(btns()[1]);
  ok(t.ev("SHARED.bank.used") === 0 && !t.ev("SHARED.buys"), "小孩換的時候密碼錯：不得扣、不得記帳");
  t.say("1234"); t.click(btns()[1]);
  ok(t.ev("SHARED.bank.used") === 30 && t.ev("bankLeft()") === 170, "密碼對：扣 30 分鐘");
  ok(t.ev("SHARED.buys.length") === 1 && t.ev("SHARED.buys[0].nm") === "獎勵：吃冰" && /^reward_/.test(t.ev("SHARED.buys[0].it")), "要記進購買帳、帶名稱");
  ok(t.ev("syncSummary().buys[0].nm") === "獎勵：吃冰", "家長頁的摘要要看得到");
  // 分鐘不夠
  t.ev("SHARED.bank.used = 150; renderBank();");
  ok(btns()[0].disabled && /還差 70/.test(btns()[0].textContent), "分鐘不夠要鎖住、講還差多少");
  t.ev(`buyReward(rewards()[0].id)`);
  ok(t.ev("SHARED.bank.used") === 150, "不夠不得扣（就算直接呼叫）");
  // 備份碼往返
  const code = t.ev("exportCode()");
  const r = boot();
  ok(r.ev(`importCode(${JSON.stringify(code)})`) === "", "備份碼要還原得回來");
  ok(r.ev("rewards().length") === 2 && r.ev("rewards()[1].name") === "吃冰" && r.ev("rewards()[1].m") === 30, `獎勵定義往返後要一致, 實得 ${JSON.stringify(r.ev("rewards()"))}`);
  ok(r.ev('SHARED.buys.some(b=>/^reward_/.test(b.it) && b.m === 30)'), "兌換紀錄往返後要在");
  // 刪除：已經換過的紀錄不受影響
  t.say("1234", "1"); t.click(t.$("btnRewards"));
  ok(t.ev("rewards().length") === 1 && t.ev("rewards()[0].name") === "吃冰" && t.ev("SHARED.buys.length") === 1, "輸入編號刪掉那一個，紀錄留著");
}
{ // 最多 8 個；名稱不得注入；壞資料不得讓整頁壞掉
  const t = boot({rewards:[{id:"x1", name:'<img src=x onerror="window.__pwned=1">', m:10}, {id:"x2", name:"正常", m:"abc"}]});
  t.ev("renderBank()");
  ok(!t.w.__pwned && t.$("rewardList").querySelectorAll("img").length === 0, "獎勵名稱不得變成 HTML");
  ok(t.$("rewardList").querySelectorAll("[data-reward]").length === 1, "分鐘不是數字的那一個不得列出來");
  const t2 = boot({rewards:Array.from({length:8}, (_, i)=>({id:"r" + i, name:"獎" + i, m:10}))});
  t2.say("第九個", "10"); t2.click(t2.$("btnRewards"));
  ok(t2.ev("rewards().length") === 8, "最多 8 個");
  const t3 = boot({rewards:"壞掉"}); t3.ev("renderBank()");
  ok(t3.ev("rewards().length") === 0, "rewards 不是陣列也不得壞掉");
}
console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail ? 1 : 0);
