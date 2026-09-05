/* 雲端備份（小孩端）

   最重要的一條是「沒開就完全不發請求」—— README 的隱私聲明靠它站著。
   其次是傳出去的東西要剛好夠家長回答三個問題，不多不少。 */
const fs = require("fs"), path = require("path"), {JSDOM} = require("jsdom");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

function boot(seed, res){
  const calls = [];
  const dom = new JSDOM(html, {runScripts:"dangerously", pretendToBeVisual:true, url:"https://x.test/",
    beforeParse(win){
      win.speechSynthesis = {speak(){}, cancel(){}, getVoices:()=>[{lang:"en-US",name:"S"}], addEventListener(){}};
      win.SpeechSynthesisUtterance = function(t){ this.text = t; };
      if(seed) seed(win.localStorage);
      win.fetch = (u, o) => { calls.push({url:String(u), opt:o || {}});
                              return Promise.resolve(res ? res() : {ok:true, status:200}); };
    }});
  const w = dom.window;
  w.alert = ()=>{}; w.confirm = ()=>true; w.scrollTo = ()=>{};
  w.HTMLElement.prototype.scrollIntoView = function(){};
  return {w, d:w.document, calls, $:id=>w.document.getElementById(id),
          ev:x=>w.eval(x),
          click:e=>e.dispatchEvent(new w.MouseEvent("click", {bubbles:true}))};
}
const wait = () => new Promise(r=>setTimeout(r, 60));
const API = "https://english-api.ku-ai.cc";
// 設定碼 = CQS1: + base64({api, code})
function setupCode(api, code){
  const s = JSON.stringify({api, code});
  return "CQS1:" + Buffer.from(s, "utf8").toString("base64");
}
const seedOn = ls => {
  ls.setItem("cq-profile", "大寶");
  ls.setItem("cq-sync", JSON.stringify({api:API, code:"w-secret"}));
};

(async () => {
// ---------- ① 沒開啟就一個請求都不准發 ----------
let t = boot(ls=>ls.setItem("cq-profile", "大寶"));
t.ev("syncPush()");
t.ev("SHARED.gifts.push(stamp({d:dayKey(), m:10, why:'測試'})); saveShared();");
await wait();
ok(t.calls.length === 0, `沒設定雲端就不得發任何請求, 實得 ${t.calls.length} 次`);
ok(t.$("syncState").textContent === "未開啟", `狀態要標示未開啟, 實得 ${t.$("syncState").textContent}`);

// ---------- ② 設定碼的驗證 ----------
t = boot(ls=>ls.setItem("cq-profile", "大寶"));
const trySetup = v => { t.w.prompt = ()=>v; t.click(t.$("btnSync")); };
trySetup("亂打一通");         ok(!t.ev("syncConf()"), "不是設定碼要擋下來");
trySetup("CQS1:@@壞掉@@");    ok(!t.ev("syncConf()"), "壞掉的設定碼要擋下來");
trySetup(setupCode("http://english-api.ku-ai.cc", "w"));
ok(!t.ev("syncConf()"), "非 https 的網址要擋下來");
trySetup(setupCode(API, "同步碼有中文"));
ok(!t.ev("syncConf()"), "含中文的同步碼要擋下來（HTTP 標頭只吃 ASCII，會無聲失敗）");
await wait();
ok(t.calls.length === 0, "驗證沒過就不得發請求");

// ---------- ③ 要先知道這台是誰在用 ----------
t = boot();
t.w.prompt = ()=>setupCode(API, "w-secret");
t.click(t.$("btnSync"));
ok(!t.ev("syncConf()"), "沒填「這台是誰在用」不得開啟雲端備份");

// ---------- ④ 設定成功：立刻傳第一份 ----------
t = boot(ls=>ls.setItem("cq-profile", "大寶"));
// 先造一點答題紀錄，摘要才有東西可以放（沒練過的題庫本來就不該出現在摘要裡）
t.ev(`(()=>{
  const a = DECKS.summer.words[0].w, b = DECKS.summer.words[1].w, o = {done:10, right:8, stats:{}};
  o.stats[a] = {r:1, x:4, streak:0};      // 一直錯的
  o.stats[b] = {r:5, x:0, streak:3};      // 已熟練的
  localStorage.setItem("cq-vocab-v1:summer", JSON.stringify(o));
})()`);
t.w.prompt = ()=>setupCode(API, "w-secret");
t.click(t.$("btnSync"));
await wait();
ok(t.calls.length === 1, `設定完要馬上傳一份, 實得 ${t.calls.length}`);
const c0 = t.calls[0];
ok(c0.opt.method === "PUT", `要用 PUT, 實得 ${c0.opt.method}`);
ok(c0.url === API + "/s/" + encodeURIComponent("大寶"), `網址要帶小孩的名字, 實得 ${c0.url}`);
ok(c0.opt.headers.Authorization === "Bearer w-secret", "要帶同步碼");
ok(/已開啟/.test(t.$("syncState").textContent), `狀態要標示已開啟, 實得 ${t.$("syncState").textContent}`);
ok(/關閉/.test(t.$("btnSync").textContent), "按鈕要變成關閉");

// ---------- ⑤ 傳出去的內容 ----------
const body = JSON.parse(c0.opt.body);
ok(typeof body.code === "string" && body.code.startsWith(t.ev("BK_PREFIX")), "要帶完整備份碼");
const s = body.sum;
ok(s.who === "大寶" && !!s.dev && s.at > 1e9, "摘要要帶身分與時間");
ok(!!s.days && typeof s.streak === "number", "① 這週有沒有在練：要有日曆與連續天數");
ok(!!s.decks.summer && Array.isArray(s.decks.summer.weak),
  `② 哪幾個字一直錯：要有待加強字, 實得 ${JSON.stringify(s.decks)}`);
ok(s.decks.summer.weak.length === 1 && s.decks.summer.weak[0].x === 4,
  `只列真的還沒學會的字, 實得 ${JSON.stringify(s.decks.summer.weak)}`);
ok(!!s.decks.summer.weak[0].zh, "待加強字要附中文，家長才看得懂");
ok(s.decks.summer.mastered === 1 && s.decks.summer.total > 0,
  `要有已熟練/總字數, 實得 ${s.decks.summer.mastered}/${s.decks.summer.total}`);
ok(!s.decks.full, "沒練過的題庫不該出現在摘要裡");
ok(!!s.bank && Array.isArray(s.gifts) && Array.isArray(s.coupons), "③ 獎勵有沒有效：要有存摺與贈送紀錄");
ok(!/"pin"|cq-pin/.test(c0.opt.body), "不得把家長密碼傳出去");
// 成語ㄚ喵：飼料帳與成語摘要要一起上去（摘要由成語頁算好放在 localStorage）
{
  const t2 = boot(ls=>{ ls.setItem("cq-profile", "大寶");
    ls.setItem("cq-sync", JSON.stringify({api:API, code:"w-secret"}));
    ls.setItem("cq-shared-v1", JSON.stringify({days:{}, bank:{earned:0, used:0, bonus:0}, gifts:[], coupons:[], feed:{earned:12, used:3, bonus:0, tickets:1}}));
    ls.setItem("cq-idiom-sum", JSON.stringify({byLv:{exam:{m:5, total:810}, all:{m:7, total:909}}, weak:[{c:"守株待兔", m:"死守老方法。", x:3}], done:40, right:33, streak:2, at:1}));
  });
  t2.ev("syncPush()");
  await wait();
  const s2 = JSON.parse(t2.calls[0].opt.body).sum;
  ok(s2.feed && s2.feed.earned === 12 && s2.feed.tickets === 1, "摘要要帶飼料帳");
  ok(s2.idiom && s2.idiom.byLv && s2.idiom.byLv.exam.m === 5, "摘要要帶會考重點熟練");
  ok(s2.idiom.weak[0].c === "守株待兔", "摘要要帶一直錯的成語");
  const t3 = boot(seedOn);
  t3.ev("syncPush()");
  await wait();
  const s3 = JSON.parse(t3.calls[0].opt.body).sum;
  ok(s3.idiom === null && s3.feed === null && s3.pet === null, "沒練過成語、沒有貓的裝置，摘要裡是 null 不是爆掉");
  const t4 = boot(ls=>{ ls.setItem("cq-profile", "大寶"); ls.setItem("cq-sync", JSON.stringify({api:API, code:"w-secret"}));
    ls.setItem("cq-shared-v1", JSON.stringify({days:{}, bank:{earned:0, used:0, bonus:0}, gifts:[], coupons:[],
      pet:{free:false, cats:[{name:"小橘", breed:"orange", xp:120, hunger:55.5, clean:80, bonus:0, stage:"少年貓", adopted:"2026-09-01", away:null, box:false, last:1}],
           diary:[{d:"2026-09-01", ev:"adopt", text:"領養了小橘"}]}})); });
  t4.ev("syncPush()");
  await wait();
  const s4 = JSON.parse(t4.calls[0].opt.body).sum;
  ok(s4.pet && s4.pet.name === "小橘" && s4.pet.hunger === 56 && s4.pet.stage === "少年貓", `摘要要帶貓的狀態, 實得 ${JSON.stringify(s4.pet)}`);
  ok(Array.isArray(s4.pet.diary) && s4.pet.diary[0].text === "領養了小橘", "摘要要帶最近的日記");
}

// ---------- ⑥ 家長操作、練完一輪都要傳 ----------
t = boot(seedOn);
t.w.prompt = ()=>null;
t.ev("SHARED.gifts.push(stamp({d:dayKey(), m:10, why:'測試'})); saveShared(); syncPush();");
await wait();
ok(t.calls.length === 1, `贈送之後要傳, 實得 ${t.calls.length}`);
t.ev("endRound()");
await wait();
ok(t.calls.length === 2, `練完一輪要傳, 實得 ${t.calls.length}`);

// 一輪只傳一次，不是每題 —— KV 免費額度每天 1000 次寫入
t = boot(seedOn);
const n0 = t.calls.length;
t.ev("(()=>{ for(let i=0;i<30;i++){ const dd=SHARED.days[dayKey()]||(SHARED.days[dayKey()]={n:0,r:0}); dd.n++; dd.r++; checkGoal(dd); } })()");
await wait();
ok(t.calls.length === n0, `答題本身不得觸發上傳, 實得 ${t.calls.length - n0} 次`);

// ---------- ⑦ 碼不對要說出來，不得默默失敗 ----------
t = boot(seedOn, ()=>({ok:false, status:401}));
t.ev("syncPush()");
await wait();
ok(/同步碼不對/.test(t.$("syncState").textContent), `401 要講清楚, 實得 ${t.$("syncState").textContent}`);
t = boot(seedOn, ()=>{ throw new Error("boom"); });
try{ t.ev("syncPush()"); }catch(e){}
await wait();
ok(/⚠️/.test(t.$("syncState").textContent) || /未開啟|已開啟/.test(t.$("syncState").textContent),
  "傳不出去也不能讓畫面壞掉");

// ---------- ⑧ 關得掉，關掉就真的不傳了 ----------
t = boot(seedOn);
t.click(t.$("btnSync"));
ok(!t.ev("syncConf()"), "要關得掉");
const n1 = t.calls.length;
t.ev("syncPush()"); t.ev("endRound()");
await wait();
ok(t.calls.length === n1, "關掉之後不得再傳");
ok(t.$("syncState").textContent === "未開啟", "關掉後狀態要更新");

// ---------- ⑨ 這是家長設定，要密碼 ----------
t = boot(ls=>{ ls.setItem("cq-profile", "大寶"); ls.setItem("cq-pin", "1234"); });
t.w.prompt = ()=>"9999";
t.click(t.$("btnSync"));
ok(!t.ev("syncConf()"), "密碼錯誤不得開啟雲端備份");
let seq = ["1234", setupCode(API, "w-secret")], i = 0;
t.w.prompt = ()=>seq[i++];
t.click(t.$("btnSync"));
ok(!!t.ev("syncConf()"), "密碼正確才開得了");

// ---------- ⑩ 備份碼變大時不得再用 keepalive ----------
// 瀏覽器對 keepalive 請求的 body 上限是 64KB，超過會直接被拒絕，
// 症狀是「永遠傳不出去」而且不會自己好。
t = boot(seedOn);
t.ev("syncPush()");
await wait();
ok(t.calls[0].opt.keepalive === true, "小份的照樣用 keepalive（關掉分頁也傳得完）");
t = boot(seedOn);
t.ev(`(()=>{                            // 灌成滿載的樣子
  const o = {done:9, right:9, stats:{}};
  DECKS.full.words.forEach(w=>{ o.stats[w.w] = {r:9, x:3, streak:1, due:"2026-12-31"}; });
  localStorage.setItem("cq-vocab-v1:full", JSON.stringify(o));
  for(let i=0;i<400;i++){ const d=new Date(2026,0,1); d.setDate(d.getDate()+i);
    SHARED.days[dayKey(d)] = {n:50, r:45, paid:30}; }
  saveShared();
})()`);
t.ev("syncPush()");
await wait();
const big = t.calls[t.calls.length - 1];
ok(big.opt.body.length > 16 * 1024, `這份要夠大才測得到, 實得 ${big.opt.body.length} bytes`);
ok(big.opt.keepalive === false, `大份的必須關掉 keepalive, 實得 ${big.opt.keepalive}`);

// ---------- ⑪ 組不出資料時不得把自己鎖死 ----------
t = boot(seedOn);
t.ev("exportCode = () => { throw new Error('壞了'); };");
t.ev("syncPush()");
await wait();
ok(t.calls.length === 0, "組不出來就不該送出");
t.ev("exportCode = () => 'CQ4:ok';");
t.ev("syncPush()");
await wait();
ok(t.calls.length === 1, "修好之後要能繼續傳（syncBusy 不得卡在 true）");

// ---------- ⑫ 傳失敗要補傳，不能等到隔天 ----------
let failing = true;
t = boot(seedOn, () => failing ? {ok:false, status:503} : {ok:true, status:200});
t.ev("syncPush()");
await wait();
ok(t.calls.length === 1 && /⚠️/.test(t.$("syncState").textContent), "失敗要標示出來");
failing = false;
t.w.dispatchEvent(new t.w.Event("online"));
await wait();
ok(t.calls.length === 2, `回到線上要補傳, 實得 ${t.calls.length}`);
ok(/已開啟/.test(t.$("syncState").textContent), "補傳成功後狀態要恢復");
t.w.dispatchEvent(new t.w.Event("online"));
await wait();
ok(t.calls.length === 2, "沒有待傳的東西時不得重複打");

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail ? 1 : 0);
})();
