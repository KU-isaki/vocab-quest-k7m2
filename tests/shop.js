/* 時間商城：補簽券與貓房家具

   補簽券：只接回連續天數、不偽造那天的題數；補了沒用的不賣；7 天內只能補一次；
   同月第二張漲價；先練再補也要拿得到第 7 天紅利；兩頁算出來的連續要一樣。
   家具：沒買不得換、有門檻的分鐘夠也買不到、買過換來換去不再扣錢、還原回來的假資料不得生效。
   備份碼：購買帳與房間擺設往返後一致。 */
const fs = require("fs"), path = require("path"), {JSDOM} = require("jsdom");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const HTML = {idiom:read("idiom.html"), index:read("index.html")};
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const key = d => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
const daysAgo = n => { const t = new Date(); t.setDate(t.getDate() - n); return key(t); };
const today = daysAgo(0);
const CAT = {name:"小橘", breed:"white", xp:10, hunger:90, clean:90, bonus:0, adopted:daysAgo(30), last:Math.floor(Date.now()/1000), away:null, box:false, id:"1"};

/* ago 裡列的那幾天有練、英文和成語都達標 */
function shared(ago, extra){
  const days = {};
  ago.forEach(n=>{ days[daysAgo(n)] = {n:30, r:30, paid:15, i:{n:30, r:30, paid:10}}; });
  return Object.assign({days, bank:{earned:200, used:0, bonus:0}, gifts:[], coupons:[],
    feed:{earned:20, used:0, bonus:0, tickets:0}, pet:{free:false, active:0, cats:[Object.assign({}, CAT)], diary:[]}}, extra || {});
}
function boot(page, sh, store){
  const dom = new JSDOM(HTML[page], {runScripts:"dangerously", pretendToBeVisual:true, url:`https://x.test/${page}.html`,
    beforeParse(win){
      win.speechSynthesis = {speak(){}, cancel(){}, getVoices:()=>[], addEventListener(){}};
      win.SpeechSynthesisUtterance = function(t){ this.text = t; };
      win.localStorage.setItem("cq-shared-v1", JSON.stringify(sh));
      Object.keys(store || {}).forEach(k=>win.localStorage.setItem(k, store[k]));
    }});
  const w = dom.window, d = w.document;
  w.alert = ()=>{}; w.confirm = ()=>true; w.scrollTo = ()=>{};
  const $ = id => d.getElementById(id), ev = x => w.eval(x);
  const click = e => e.dispatchEvent(new w.MouseEvent("click", {bubbles:true}));
  const goCat = () => click([...d.querySelectorAll(".nav button")].find(b=>b.dataset.view === "vCat"));
  return {w, d, $, ev, click, goCat};
}

// ================= 補簽券：昨天斷了 =================
{
  const t = boot("idiom", shared([0, 2, 3, 4, 5, 6])); t.goCat();
  ok(t.ev("streakDays()") === 1 && t.ev("feedStreak()") === 1, "補之前連續只有今天");
  const o = t.ev("patchOffer()");
  ok(o && o.k === daysAgo(1) && o.gains.length === 3, `要提議補昨天、三條一起, 實得 ${JSON.stringify(o)}`);
  ok(!t.$("btnPatch").disabled && /20 分鐘/.test(t.$("patchHint").textContent), "按鈕要寫價錢");
  t.click(t.$("btnPatch"));
  ok(t.ev("streakDays()") === 7 && t.ev("feedStreak()") === 7 && t.ev("runLen(HAS.goal)") === 7, "三條連續都要接回 7 天");
  ok(t.ev("SHARED.bank.used") === 20 && t.ev("bankLeft()") === 210, `扣 20 分鐘、補發第 7 天紅利 30 分鐘, 實得 used ${t.ev("SHARED.bank.used")} left ${t.ev("bankLeft()")}`);
  ok(t.ev("SHARED.bank.bonus") === 30 && t.ev("feedLedger().tickets") === 1, "先練再補：第 7 天的紅利與轉蛋券要補發");
  ok(!t.ev(`SHARED.days["${daysAgo(1)}"]`), "補簽不得偽造那天的練習紀錄");
  ok(t.ev("SHARED.buys.length") === 1 && t.ev("SHARED.buys[0].it") === "patch:" + daysAgo(1), "要記進購買帳");
  ok(/補簽/.test(t.$("diary").textContent), "要寫日記");
  ok(t.ev("patchOffer()") === null && t.$("btnPatch").disabled, "補完就沒有可以補的了");
  // 同一份資料拿去單字闖關算，連續要一樣
  const e = boot("index", JSON.parse(t.w.localStorage.getItem("cq-shared-v1")));
  ok(e.ev("streakDays()") === 7 && e.ev("goalStreak()") === 7, `單字闖關算出來也要是 7 天, 實得 ${e.ev("streakDays()")} / ${e.ev("goalStreak()")}`);
  ok(/補簽/.test(e.ev(`dayNote("${daysAgo(1)}", undefined)`)), "日曆點那天要講是補簽的");
  e.ev("renderCal()");
  ok(!!e.d.querySelector(`[data-day="${daysAgo(1)}"].patch`) || new Date().getDate() === 1, "日曆那格要有補簽記號");
  // 備份碼往返
  const code = e.ev("exportCode()");
  const r = boot("index", shared([]));
  ok(r.ev(`importCode(${JSON.stringify(code)})`) === "", "備份碼要還原得回來");
  ok(r.ev("SHARED.buys.length") === 1 && r.ev("SHARED.buys[0].it") === "patch:" + daysAgo(1) && r.ev("SHARED.buys[0].m") === 20, `購買帳往返後要一致, 實得 ${JSON.stringify(r.ev("SHARED.buys"))}`);
  ok(r.ev("streakDays()") === 7, "還原後連續天數不得斷");
}

// ================= 補簽券：沒用的不賣、不夠不扣、7 天內一次、漲價 =================
{
  let t = boot("idiom", shared([0])); t.goCat();
  ok(t.ev("patchOffer()") === null, "昨天之前什麼都沒有：補了也接不起來，不賣");
  t = boot("idiom", shared([0, 3, 4, 5])); t.goCat();
  ok(t.ev("patchOffer()") === null, "連斷兩天：補一天接不回去，不賣");
  t = boot("idiom", shared([0, 1, 3, 4])); t.goCat();
  ok((t.ev("patchOffer()") || {}).k === daysAgo(2), "斷的是前天也能補");
  t = boot("idiom", shared([0, 2, 3], {bank:{earned:10, used:0, bonus:0}})); t.goCat();
  ok(t.$("btnPatch").disabled, "分鐘不夠按鈕要鎖");
  t.ev("buyPatch()");
  ok(t.ev("SHARED.bank.used") === 0 && !t.ev("SHARED.buys"), "不夠不得扣、不得記帳");
  t = boot("idiom", shared([0, 2, 3], {buys:[{d:daysAgo(5), ts:1, it:"patch:" + daysAgo(5), m:20}]})); t.goCat();
  ok(t.ev("patchOffer()") === null, "7 天內補過就不能再補");
  t = boot("idiom", shared([0, 2, 3], {buys:[{d:today, ts:1, it:"patch:" + daysAgo(20), m:20}]})); t.goCat();
  ok(t.ev("patchCost()") === 30, `同一個月第二張要 30 分鐘, 實得 ${t.ev("patchCost()")}`);
  // 補簽的那天本身是第 7 天：不發紅利
  t = boot("idiom", shared([2, 3, 4, 5, 6, 7])); t.goCat();
  t.click(t.$("btnPatch"));
  ok(t.ev("streakDays()") === 7 && t.ev("SHARED.bank.bonus") === 0, "補簽的那天沒有練，不發紅利");
}

// ================= 家具 =================
{
  const t = boot("idiom", shared([0])); t.goCat();
  ok(!t.$("furnBox").hidden && t.$("furnList").querySelectorAll("[data-furn]").length === t.ev("FURN.filter(f=>owned(f.id) || onSale(f)).length"), "有貓就要列出家具（限定款只在期間內）");
  const rug0 = t.d.querySelector("#room .rmrug").innerHTML;
  const btn = id => t.$("furnList").querySelector(`[data-furn="${id}"]`);
  t.click(btn("rug_stripe"));
  ok(t.ev("SHARED.bank.used") === 15 && t.ev('owned("rug_stripe")'), "買條紋地毯扣 15 分鐘");
  ok(t.d.querySelector("#room .rmrug").innerHTML !== rug0 && btn("rug_stripe").getAttribute("aria-pressed") === "true", "買了就換上");
  t.click(btn("rug_stripe"));
  ok(t.d.querySelector("#room .rmrug").innerHTML === rug0 && t.ev("SHARED.bank.used") === 15, "再按一次換回原本的，不再扣錢");
  t.click(btn("rug_stripe"));
  ok(t.ev("SHARED.bank.used") === 15 && t.ev("SHARED.buys.length") === 1, "買過的再換上不得再扣、不得重複記帳");
  // 門檻
  t.click(btn("win_moon"));
  ok(!t.ev('owned("win_moon")') && t.ev("SHARED.bank.used") === 15, "沒到學習門檻，分鐘夠也買不到");
  ok(/🔒/.test(btn("win_moon").textContent), "鎖住的要標出來");
  // 還原回來的假資料：房間指到沒買過的家具
  t.ev('SHARED.pet.room.win = "win_night"; SHARED.pet.room.plant = "rug_stripe"; renderPet();');
  ok(t.ev('roomPick("win")') === null && t.ev('roomPick("plant")') === null, "沒買過、或擺錯位置的家具不得生效");
  // 每一款的 SVG 都要畫得出來
  t.ev('FURN.forEach(f=>{ SHARED.buys.push({d:dayKey(), ts:1, it:f.id, m:0}); SHARED.pet.room[f.slot] = f.id; }); renderPet();');
  ok(["rmrug", "rmplant", "rmwindow"].every(c=>t.d.querySelector("#room ." + c).children.length > 0), "每個位置換上去都要有內容");
}
{ // 英文熟練 100 個：滿月窗解鎖
  const stats = {}; for(let i = 0; i < 100; i++) stats["w" + i] = {r:2, x:0, streak:2, due:daysAgo(-5)};
  const t = boot("idiom", shared([0]), {"cq-vocab-v1:full":JSON.stringify({done:200, right:200, stats})}); t.goCat();
  ok(t.ev("enMastered()") === 100, `英文熟練數要讀得到, 實得 ${t.ev("enMastered()")}`);
  t.click(t.$("furnList").querySelector('[data-furn="win_moon"]'));
  ok(t.ev('owned("win_moon")') && t.ev("SHARED.bank.used") === 45, "到門檻就買得到");
  // 房間擺設的備份碼往返
  const e = boot("index", JSON.parse(t.w.localStorage.getItem("cq-shared-v1")));
  const code = e.ev("exportCode()");
  const r = boot("index", shared([]));
  r.ev(`importCode(${JSON.stringify(code)})`);
  ok(r.ev("SHARED.pet.room.win") === "win_moon" && r.ev('SHARED.buys.some(b=>b.it === "win_moon")'), `房間擺設與家具往返後要一致, 實得 ${JSON.stringify(r.ev("SHARED.pet.room"))}`);
}
{ // 季節限定：只在期間內賣（含頭尾）；過期沒買過的不列、也買不到；買過的永遠留著
  const t = boot("idiom", shared([0])); t.goCat();
  const f = 'furnOf("win_midautumn")';
  ok(t.ev(`onSale(${f}, "2026-09-17")`) && t.ev(`onSale(${f}, "2026-10-01")`), "期間頭尾兩天都要買得到");
  ok(!t.ev(`onSale(${f}, "2026-09-16")`) && !t.ev(`onSale(${f}, "2026-10-02")`) && !t.ev(`onSale(${f}, "2027-09-20")`), "期間外不賣（明年要賣得另外加一段）");
  ok(t.ev('onSale(furnOf("rug_stripe"), "2030-01-01")'), "一般款隨時都賣");
  t.ev('furnOf("win_midautumn").sale = [["2020-01-01", "2020-01-02"]]; renderPet();');          // 假裝已經過期
  ok(!t.$("furnList").querySelector('[data-furn="win_midautumn"]'), "過期又沒買過的不列出來");
  t.ev('pickFurn("win_midautumn")');
  ok(!t.ev('owned("win_midautumn")') && t.ev("SHARED.bank.used") === 0, "過期的不得買（就算直接呼叫）");
  t.ev('SHARED.buys = [{d:dayKey(), ts:1, it:"win_midautumn", m:30}]; renderPet();');
  ok(!!t.$("furnList").querySelector('[data-furn="win_midautumn"]'), "買過的過期後還是列著");
  t.ev('pickFurn("win_midautumn")');
  ok(t.ev('roomPick("win")') && t.ev('roomPick("win").id') === "win_midautumn" && t.ev("SHARED.bank.used") === 0, "買過的過期後照樣換得上、不再扣錢");
}
{ // 家長頁要看得到買了什麼：買的當下寫進名稱；舊帳（沒有名稱）開頁面時補上；摘要帶出去
  const old = [{d:today, ts:1, it:"rug_stripe", m:15}, {d:today, ts:2, it:"patch:" + daysAgo(9), m:20}];
  const t = boot("idiom", shared([0], {buys:old})); t.goCat();
  ok(t.ev("SHARED.buys[0].nm") === "地毯：條紋地毯" && /^補簽券（補 \d+\/\d+）$/.test(t.ev("SHARED.buys[1].nm")), `舊帳要補上名稱, 實得 ${JSON.stringify(t.ev("SHARED.buys.map(b=>b.nm)"))}`);
  t.click(t.$("btnTradeFeed"));
  ok(t.ev("SHARED.buys.length") === 3 && t.ev("SHARED.buys[2].it") === "trade_feed" && t.ev("SHARED.buys[2].nm") === "10 顆飼料" && t.ev("SHARED.buys[2].m") === 10, "分鐘換飼料也要記進購買帳");
  const e = boot("index", JSON.parse(t.w.localStorage.getItem("cq-shared-v1")));
  const sum = e.ev("syncSummary().buys");
  ok(sum.length === 3 && sum[0].nm === "地毯：條紋地毯" && sum[0].m === 15 && !("ts" in sum[0]), `雲端摘要要帶購買紀錄（名稱、分鐘、日期）, 實得 ${JSON.stringify(sum[0])}`);
  // 換飼料的帳也要過得了備份碼往返
  const r = boot("index", shared([]));
  r.ev(`importCode(${JSON.stringify(e.ev("exportCode()"))})`);
  ok(r.ev('SHARED.buys.some(b=>b.it === "trade_feed" && b.m === 10)'), "換飼料的帳要過得了備份碼往返");
}
{ // 沒有貓：商城還在、家具不出現
  const sh = shared([0, 2, 3]); delete sh.pet;
  const t = boot("idiom", sh); t.goCat();
  ok(t.w.getComputedStyle(t.$("shopCard")).display !== "none" && t.w.getComputedStyle(t.$("furnBox")).display === "none", "沒有貓也能補簽，但不賣家具");
  ok(!t.$("btnPatch").disabled, "沒有貓也能買補簽券");
}
{ // 從單字闖關的連結直接到商城
  const dom = new JSDOM(HTML.idiom, {runScripts:"dangerously", pretendToBeVisual:true, url:"https://x.test/idiom.html#shop",
    beforeParse(win){ win.speechSynthesis = {speak(){}, cancel(){}, getVoices:()=>[], addEventListener(){}}; win.SpeechSynthesisUtterance = function(){}; win.scrollTo = ()=>{};
      win.localStorage.setItem("cq-shared-v1", JSON.stringify(shared([0]))); }});
  ok(dom.window.document.getElementById("vCat").classList.contains("on"), "#shop 要直接開在貓分頁");
  ok(/idiom\.html#shop/.test(HTML.index), "單字闖關要有到商城的連結");
}

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail ? 1 : 0);
