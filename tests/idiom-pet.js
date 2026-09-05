/* 成語ㄚ喵 第二階：貓

   規則（設計稿第 6 節）：飽足／清潔每天掉、吃飽再餵才長、清貓砂一天兩次、
   飽足歸零躲紙箱但永遠不會死、7 天沒練成語離家（3 天先張望）、連續練 3 天自己回來、
   鈴鐺 2 張券起跳同月遞增、成長值離家時原封不動、日記只增不改。 */
const fs = require("fs"), path = require("path"), {JSDOM} = require("jsdom");
const html = fs.readFileSync(path.join(__dirname, "..", "idiom.html"), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const key = d => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
const daysAgo = n => key(new Date(Date.now() - n * 86400000));
const today = daysAgo(0);

function boot(seed){
  const dom = new JSDOM(html, {runScripts:"dangerously", pretendToBeVisual:true, url:"https://x.test/idiom.html",
    beforeParse(win){
      win.speechSynthesis = {speak(){}, cancel(){}, getVoices:()=>[], addEventListener(){}};
      win.SpeechSynthesisUtterance = function(t){ this.text = t; };
      const sh = {days:{[today]:{n:0, r:0, i:{n:30, r:28, paid:10}}}, bank:{earned:0, used:0, bonus:0}, gifts:[], coupons:[], feed:{earned:20, used:0, bonus:0, tickets:3}};
      win.localStorage.setItem("cq-shared-v1", JSON.stringify(sh));
      if(seed) seed(win.localStorage, sh);
    }});
  const w = dom.window, d = w.document;
  w.alert = ()=>{}; w.confirm = ()=>true; w.scrollTo = ()=>{}; w.HTMLElement.prototype.scrollIntoView = function(){};
  w.prompt = ()=>"小橘";
  const $ = id => d.getElementById(id), ev = x => w.eval(x);
  const click = e => e.dispatchEvent(new w.MouseEvent("click", {bubbles:true}));
  const goCat = () => click([...d.querySelectorAll(".nav button")].find(b=>b.dataset.view === "vCat"));
  const disp = el => w.getComputedStyle(el).display;
  const cat = () => ev("cat()");
  const state = () => (($("room").className.match(/st-(\S+)/) || [])[1]);
  return {w, d, $, ev, click, goCat, disp, cat, state};
}
const wait = ms => new Promise(r=>setTimeout(r, ms));

(async () => {
// ================= 轉蛋 =================
{
  const t = boot(); t.goCat();
  ok(t.disp(t.$("gachaCard")) !== "none" && /第一隻免費/.test(t.$("gachaSub").textContent), "第一隻要免費");
  t.click(t.$("btnGacha"));
  await wait(1800);
  const c = t.cat();
  ok(!!c, "轉蛋之後要有一隻貓");
  ok(c.name === "小橘", `名字要用小孩取的, 實得 ${c && c.name}`);
  ok(!!t.ev("BREED[cat().breed]"), "花色要是清單裡的");
  ok(t.ev("feedLedger().tickets") === 3, "第一隻不得扣轉蛋券");
  ok(c.xp === 0 && c.stage === "幼貓", "一開始是幼貓");
  ok(t.disp(t.$("petCard")) !== "none" && t.disp(t.$("gachaCard")) === "none", "有貓之後要顯示貓卡");
  ok(/領養/.test(t.$("diary").textContent), "日記要記領養");
  ok(!!t.d.querySelector("#room svg .cat"), "要有會動的貓（SVG）");
  ok(t.$("petName").textContent === "小橘", "貓卡要顯示名字");
  // 現在一次只能養一隻
  t.click(t.$("btnGacha"));
  ok(t.ev("SHARED.pet.cats.length") === 1, "第一階段只養一隻");
  // 稀有度機率要對得上（抽 3000 次）
  const N = 3000, cnt = {1:0, 2:0, 3:0, 4:0};
  for(let k = 0; k < N; k++) cnt[t.ev("BREED[rollBreed().id].rar")]++;
  ok(cnt[1] / N > .5 && cnt[1] / N < .7, `普通約六成, 實得 ${(cnt[1]/N).toFixed(2)}`);
  ok(cnt[2] / N > .22 && cnt[2] / N < .38, `少見約三成, 實得 ${(cnt[2]/N).toFixed(2)}`);
  ok(cnt[4] / N < .04, `傳說要很稀有, 實得 ${(cnt[4]/N).toFixed(3)}`);
}

// ================= 餵、清、長 =================
{
  const t = boot(); t.goCat(); t.click(t.$("btnGacha")); await wait(1800);
  const c0 = t.cat();
  ok(Math.round(c0.hunger) === 70, `剛領養飽足 70, 實得 ${c0.hunger}`);
  t.click(t.$("btnFeed"));
  const H = () => Math.round(t.cat().hunger);
  ok(H() === 80 && t.ev("feedLedger().used") === 1 && t.ev("feedLeft()") === 19, `餵一顆：飽足 +10、飼料 −1, 實得 飽足 ${H()} 剩 ${t.ev("feedLeft()")}`);
  ok(t.cat().xp === 0, "還沒吃飽（<80）餵不長成長值");
  ok(t.state() === "eat", `餵的時候要播吃飯動畫, 實得 ${t.state()}`);
  t.click(t.$("btnFeed"));                                   // 現在 80，吃飽了再餵
  ok(t.cat().xp === 10, `吃飽再餵才長成長值, 實得 xp ${t.cat().xp}`);
  ok(H() === 90, "飽足繼續加但不超過 100");
  for(let k = 0; k < 5; k++) t.click(t.$("btnFeed"));
  ok(H() === 100, "飽足上限 100");
  ok(t.cat().xp === 60, `多出來的全變成長值, 實得 ${t.cat().xp}`);
  ok(/再 40 成長值就長成少年貓/.test(t.$("petNext").textContent), `要講下一個里程碑, 實得「${t.$("petNext").textContent}」`);
  for(let k = 0; k < 4; k++) t.click(t.$("btnFeed"));
  ok(t.cat().xp === 100 && t.cat().stage === "少年貓", `100 要長成少年貓, 實得 ${t.cat().xp} ${t.cat().stage}`);
  ok(/少年貓/.test(t.$("diary").textContent), "升階段要寫日記");
  ok(/s2/.test(t.$("room").className), "少年貓要換外觀（圍巾）");
  // 飼料用完不能餵
  t.ev("feedLedger().used = feedLedger().earned;"); t.ev("renderPet()");
  ok(t.$("btnFeed").disabled, "沒飼料不能餵");
  // 清貓砂一天兩次（先等吃飯動畫播完）
  await wait(2400);
  t.ev("cat().clean = 20; renderPet();");
  ok(t.state() === "dirty", `清潔低要播髒的動畫, 實得 ${t.state()}`);
  t.click(t.$("btnClean")); ok(Math.round(t.cat().clean) === 70, `清一次 +50, 實得 ${t.cat().clean}`);
  t.click(t.$("btnClean")); ok(Math.round(t.cat().clean) === 100, "第二次到 100");
  t.click(t.$("btnClean")); ok(t.cat().cleanN === 2 && t.$("btnClean").disabled, "一天最多兩次");
  // 點牠一天最多 5 次加心情
  const b0 = t.cat().bonus;
  for(let k = 0; k < 8; k++) t.click(t.$("catsvg"));
  ok(t.cat().bonus - b0 === 5 || t.cat().bonus === 40, `點貓加心情一天最多 5 次, 實得 +${t.cat().bonus - b0}`);
}

// ================= 時間會過：掉數值、躲紙箱、不會死 =================
{
  const t = boot(); t.goCat(); t.click(t.$("btnGacha")); await wait(1800);
  t.ev("cat().hunger = 70; cat().clean = 80; cat().last = nowSec() - 24*3600; renderPet();");
  ok(Math.round(t.cat().hunger) === 40 && Math.round(t.cat().clean) === 55, `一天飽足 −30、清潔 −25, 實得 ${t.cat().hunger} ${t.cat().clean}`);
  t.ev("cat().last = nowSec() - 10*24*3600; renderPet();");
  ok(t.cat().hunger === 0 && t.cat().box === true, "飽足歸零要躲進紙箱");
  ok(t.state() === "sleep", `躲紙箱要播睡覺, 實得 ${t.state()}`);
  ok(/紙箱/.test(t.$("diary").textContent), "躲紙箱要寫日記");
  ok(!!t.cat() && t.cat().name === "小橘", "十天沒餵也不會死");
  const xp = t.cat().xp;
  t.click(t.$("btnFeed"));
  ok(t.cat().box === false && Math.round(t.cat().hunger) === 10, "餵了就從紙箱出來");
  ok(t.cat().xp === xp, "餓的時候餵不長成長值");
}

// ================= 離家與回家 =================
{
  // 最後一次練成語是 3 天前 → 門口張望
  const t = boot((ls, sh)=>{ sh.days = {[daysAgo(3)]:{n:0, r:0, i:{n:30, r:28, paid:10}}}; ls.setItem("cq-shared-v1", JSON.stringify(sh)); });
  t.goCat(); t.click(t.$("btnGacha")); await wait(1800);
  t.ev(`cat().adopted = ${JSON.stringify(daysAgo(30))}; renderPet();`);
  ok(t.state() === "peek", `3 天沒練要在門口張望, 實得 ${t.state()}`);
  ok(!t.cat().away && /張望/.test(t.$("awayBox").textContent), "張望是預警，還沒離家");
  // 7 天 → 離家
  const t2 = boot((ls, sh)=>{ sh.days = {[daysAgo(7)]:{n:0, r:0, i:{n:30, r:28, paid:10}}}; ls.setItem("cq-shared-v1", JSON.stringify(sh)); });
  t2.goCat(); t2.click(t2.$("btnGacha")); await wait(1800);
  t2.ev(`cat().adopted = ${JSON.stringify(daysAgo(30))}; cat().xp = 250; cat().stage = '少年貓'; renderPet();`);
  ok(!!t2.cat().away, "7 天沒練要離家");
  ok(t2.state() === "away", `離家要播空房間, 實得 ${t2.state()}`);
  ok(/離家/.test(t2.$("diary").textContent), "離家要寫日記");
  ok(t2.cat().xp === 250 && t2.cat().name === "小橘", "離家時成長值與名字要保留");
  ok(t2.$("btnFeed").disabled && !t2.$("btnBell").hidden, "離家時不能餵、要出現鈴鐺");
  ok(/連續練 3 天/.test(t2.$("awayBox").textContent) && /2 張/.test(t2.$("awayBox").textContent), "要並排兩條回家的路");
  // 連續練 3 天 → 自己回來（離家是 3 天前的事，之後每天都有練）
  t2.ev(`cat().away.since = ${JSON.stringify(daysAgo(3))}; [1,2].forEach(k=>{ const d = new Date(); d.setDate(d.getDate() - k); SHARED.days[dayKey(d)] = {n:0, r:0, i:{n:10, r:9, paid:2}}; }); SHARED.days[dayKey()] = {n:0, r:0, i:{n:10, r:9, paid:2}}; renderPet();`);
  ok(!t2.cat().away, "連續練 3 天要自己回來");
  ok(/自己回來/.test(t2.$("diary").textContent), "自己回來要寫日記");
  ok(t2.cat().xp === 250, "回來的是同一隻（成長值沒變）");
  // 鈴鐺
  const t3 = boot((ls, sh)=>{ sh.days = {[daysAgo(8)]:{n:0, r:0, i:{n:30, r:28, paid:10}}}; sh.feed.tickets = 5; ls.setItem("cq-shared-v1", JSON.stringify(sh)); });
  t3.goCat(); t3.click(t3.$("btnGacha")); await wait(1800);
  t3.ev(`cat().adopted = ${JSON.stringify(daysAgo(30))}; renderPet();`);
  ok(!!t3.cat().away, "離家（鈴鐺測試）");
  ok(t3.ev("bellCost()") === 2, `鈴鐺 2 張起跳, 實得 ${t3.ev("bellCost()")}`);
  t3.click(t3.$("btnBell"));
  ok(!t3.cat().away && t3.ev("feedLedger().tickets") === 3, `搖鈴鐺要回來並扣 2 張, 剩 ${t3.ev("feedLedger().tickets")}`);
  ok(/搖鈴鐺/.test(t3.$("diary").textContent), "搖鈴鐺回來的日記要跟自己回來分開記");
  ok(t3.ev("bellCost()") === 3, `同一個月第二次要 3 張, 實得 ${t3.ev("bellCost()")}`);
  // 券不夠不能搖
  t3.ev("cat().away = {since:dayKey(), idle:7}; cat().homeAt = ''; feedLedger().tickets = 1; renderPet();");
  t3.click(t3.$("btnBell"));
  ok(!!t3.cat().away && t3.ev("feedLedger().tickets") === 1, "券不夠不得搖、不得扣");
  // 搖完鈴鐺之後（還沒練）不得馬上又離家
  t3.ev("feedLedger().tickets = 9; renderPet();"); t3.click(t3.$("btnBell"));
  ok(!t3.cat().away, "搖鈴鐺回來後不得立刻又離家");
  t3.ev("renderPet(); renderPet();");
  ok(!t3.cat().away && t3.state() !== "away", "重畫幾次也不得又離家（倒數從回家那天重算）");
  // 練習之後（今天有 i）就不會離家
  const t4 = boot(); t4.goCat(); t4.click(t4.$("btnGacha")); await wait(1800);
  t4.ev(`cat().adopted = ${JSON.stringify(daysAgo(30))}; renderPet();`);
  ok(!t4.cat().away && t4.state() !== "peek", "今天有練就不會張望或離家");
  // 剛領養的貓當天不會離家，就算之前很久沒練
  const t5 = boot((ls, sh)=>{ sh.days = {[daysAgo(20)]:{n:0, r:0, i:{n:30, r:28, paid:10}}}; ls.setItem("cq-shared-v1", JSON.stringify(sh)); });
  t5.goCat(); t5.click(t5.$("btnGacha")); await wait(1800);
  ok(!t5.cat().away && t5.state() === "idle", `剛領養的貓不會馬上離家（倒數從領養日起算）, 實得 ${t5.state()}`);
}

// ================= 多貓與門檻 =================
{
  const t = boot((ls, sh)=>{ sh.feed.tickets = 9; sh.bank = {earned:60, used:0, bonus:0}; ls.setItem("cq-shared-v1", JSON.stringify(sh)); });
  t.goCat(); t.click(t.$("btnGacha")); await wait(1800);
  ok(t.ev("SHARED.pet.cats.length") === 1, "先有一隻");
  ok(!!t.$("btnMore") && t.$("btnMore").disabled, "第 2 隻的槽要出現但鎖住");
  t.click(t.$("btnMore"));
  ok(t.ev("SHARED.pet.cats.length") === 1 && /三級/.test(t.$("toast").textContent), "沒達門檻不得抽，要講門檻");
  // 三級熟練 50 條 → 開第 2 隻
  t.ev(`IDIOMS.filter(i=>i.lv === 3).slice(0, 50).forEach(i=>{ S.stats[i.c] = {r:3, x:0, streak:3, due:"2099-01-01"}; }); save(); renderPet();`);
  ok(!t.$("btnMore").disabled, "三級熟練 50 條要開第 2 隻");
  // 用固定花色抽，避免重複
  t.ev(`rollBreed = () => BREED[SHARED.pet.cats[0].breed === "black" ? "white" : "black"];`);
  t.w.prompt = ()=>"小黑";
  t.click(t.$("btnMore")); await wait(1800);
  ok(t.ev("SHARED.pet.cats.length") === 2 && t.ev("feedLedger().tickets") === 8, `第 2 隻要扣 1 張券, 隻數 ${t.ev("SHARED.pet.cats.length")} 券 ${t.ev("feedLedger().tickets")}`);
  ok(t.cat().name === "小黑" && t.ev("SHARED.pet.active") === 1, "新抽的要變成目前的貓");
  ok(t.d.querySelectorAll("#catTabs [data-cat]").length === 2, "選貓列要兩顆");
  t.click(t.d.querySelector('#catTabs [data-cat="0"]'));
  ok(t.cat().name === "小橘", "切回第一隻");
  // 各自獨立：餵第一隻不影響第二隻
  const h2 = t.ev("SHARED.pet.cats[1].hunger");
  t.click(t.$("btnFeed"));
  ok(Math.round(t.ev("SHARED.pet.cats[1].hunger")) === Math.round(h2), "餵一隻不得影響另一隻");
  // 第 3 隻：四級 50 條 + 挑戰模式近 7 天 85%
  ok(t.$("btnMore").disabled, "第 3 隻要鎖住");
  t.ev(`IDIOMS.filter(i=>i.lv === 4).slice(0, 50).forEach(i=>{ S.stats[i.c] = {r:3, x:0, streak:3, due:"2099-01-01"}; }); save(); renderPet();`);
  ok(t.$("btnMore").disabled, "只有四級 50 條還不夠，挑戰模式答對率也要");
  t.ev(`SHARED.days[dayKey()].i.hn = 40; SHARED.days[dayKey()].i.hr = 36; renderPet();`);
  ok(!t.$("btnMore").disabled, "四級 50 條 + 挑戰 90% 要開第 3 隻");
  t.ev(`SHARED.days[dayKey()].i.hn = 20; SHARED.days[dayKey()].i.hr = 20; renderPet();`);
  ok(t.$("btnMore").disabled, "挑戰模式不到 30 題不算");
  t.ev(`SHARED.days[dayKey()].i.hn = 40; SHARED.days[dayKey()].i.hr = 36; renderPet();`);
  // 重複花色 → 20 顆飼料，不新增貓
  t.ev(`rollBreed = () => BREED["black"];`);
  const fb = t.ev("feedLedger().bonus || 0");
  t.click(t.$("btnMore")); await wait(200);
  ok(t.ev("SHARED.pet.cats.length") === 2 && t.ev("feedLedger().bonus") === fb + 20, "抽到重複花色要換成 20 顆飼料");
  ok(t.ev("feedLedger().tickets") === 7, "重複也要扣券");
  ok(/換成 20 顆/.test(t.$("diary").textContent), "重複要寫日記");
  // 第 3 隻成功，然後最多 3 隻
  t.ev(`rollBreed = () => BREED["orange"];`); t.w.prompt = ()=>"三花";
  t.click(t.$("btnMore")); await wait(1800);
  ok(t.ev("SHARED.pet.cats.length") === 3, "第 3 隻要抽得到");
  ok(!t.$("btnMore"), "三隻之後不得再有空槽");
  // 練習後 tick 要算到每一隻
  t.ev(`SHARED.pet.cats.forEach(c=>{ c.hunger = 50; c.last = nowSec() - 24*3600; }); renderPet();`);
  ok(t.ev("SHARED.pet.cats.every(c=>Math.round(c.hunger) === 20)"), "時間過去每一隻都要掉");
}

// ================= 用遊戲時間換 =================
{
  const t = boot((ls, sh)=>{ sh.bank = {earned:40, used:5, bonus:0}; sh.gifts = [{d:today, m:10, why:"送", dev:"x", seq:1, ts:1}]; ls.setItem("cq-shared-v1", JSON.stringify(sh)); });
  t.goCat(); t.click(t.$("btnGacha")); await wait(1800);
  ok(t.ev("bankLeft()") === 45, `成語頁算的存摺要跟單字闖關一樣（40+10−5）, 實得 ${t.ev("bankLeft()")}`);
  const f0 = t.ev("feedLeft()");
  t.click(t.$("btnTradeFeed"));
  ok(t.ev("feedLeft()") === f0 + 10 && t.ev("SHARED.bank.used") === 15, `10 分鐘換 10 顆：飼料 +10、分鐘 −10, 實得 飼料 ${t.ev("feedLeft()")} used ${t.ev("SHARED.bank.used")}`);
  ok(t.ev("feedLedger().earned") === 20, "換來的飼料不得算成「練習賺到的」");
  t.click(t.$("btnTradeTicket"));
  ok(t.ev("feedLedger().tickets") === 4 && t.ev("SHARED.bank.used") === 30, "15 分鐘換 1 張券");
  ok(/換了/.test(t.$("diary").textContent), "換要寫日記");
  t.ev("SHARED.bank.used = 100; renderPet();");
  ok(t.$("btnTradeFeed").disabled && t.$("btnTradeTicket").disabled, "分鐘不夠不能換");
  t.click(t.$("btnTradeFeed"));
  ok(t.ev("SHARED.bank.used") === 100, "不夠不得扣");
  // 贈送的飼料（kind:feed）不得算進分鐘存摺
  t.ev(`SHARED.gifts.push({d:dayKey(), m:30, why:"送飼料", kind:"feed", dev:"x", seq:2, ts:1}); SHARED.bank.used = 5;`);
  ok(t.ev("bankLeft()") === 45, "家長送的飼料不得混進分鐘存摺");
}

// ================= 隱藏的東西真的看不見、hidden 沒被 grid 蓋掉 =================
{
  const t = boot(); t.goCat();
  [...t.d.querySelectorAll("#vCat [hidden]")].forEach(el=>ok(t.disp(el) === "none", `#${el.id} hidden 卻仍顯示`));
  t.click(t.$("btnGacha")); await wait(1800);
  [...t.d.querySelectorAll("#vCat [hidden]")].forEach(el=>ok(t.disp(el) === "none", `#${el.id} hidden 卻仍顯示（有貓之後）`));
  ok(t.disp(t.$("btnBell")) === "none", "沒離家時鈴鐺要藏起來");
}

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail ? 1 : 0);
})();
