/* 家長贈送 / 沒收遊戲時間

   這個功能的全部風險都在「會不會跟練習賺的分鐘混在一起」：
   - checkGoal 每答一題就拿 dayMinutes(day) 跟 day.paid 對帳，混進去會被倒扣掉
   - goalStreak 只看 day.paid，混進去會偽造達標日、去領連續 7 天的紅利
   所以下面的測試重點不是「送得出去」，是「送出去之後練習機制完全不受影響」。 */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  beforeParse(win){ win.speechSynthesis={speak(){},cancel(){},getVoices:()=>[{lang:'en-US',name:'S'}],addEventListener(){}};
    win.SpeechSynthesisUtterance=function(t){this.text=t;}; }});
const w=dom.window,d=w.document; w.alert=m=>console.log('ALERT',m); w.confirm=()=>true; w.scrollTo=()=>{};
w.HTMLElement.prototype.scrollIntoView=function(){};
const $=id=>d.getElementById(id), click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('  ✗ '+m))};

const REWARD=w.eval('REWARD'), GIFT_MAX=w.eval('GIFT_MAX'), WHY_MAX=w.eval('WHY_MAX');
const ev=x=>w.eval(x);
const left=()=>ev('bankLeft()'), gifts=()=>ev('JSON.stringify(SHARED.gifts)')&&JSON.parse(ev('JSON.stringify(SHARED.gifts)'));
const today=ev('dayKey()');
// 依序回答 prompt：（有密碼時先密碼）→ 分鐘數 → 原因
function run(id,...answers){ let i=0; w.prompt=()=>answers[i++]; click($(id)); }
const give=(m,why)=>run('btnGift',String(m),why);
const take=(m,why)=>run('btnTake',String(m),why);

ev('SHARED={days:{},bank:{earned:0,used:0,bonus:0},gifts:[],coupons:[]}; saveShared();');

// ⓪ 三顆鈕要真的看得到、按得到（這專案踩過好幾次「CSS 蓋掉 hidden / 白底白字」）
click([...d.querySelectorAll('.nav button')].find(b=>b.dataset.view==='vSet'));
['btnGift','btnTake','btnCoupon'].forEach(id=>{
  const el=$(id), cs=w.getComputedStyle(el);
  ok(!!el&&$('vSet').contains(el),`${id} 要在設定頁`);
  ok(cs.display!=='none'&&cs.visibility!=='hidden',`${id} 不得被 CSS 藏起來, display=${cs.display}`);
  ok((el.textContent||'').trim().length>0,`${id} 要有文字`);
});

// ① 送得出去，而且完全不碰練習那本帳
give(30,'幫忙洗碗');
ok(left()===30,`送 30 分鐘後存摺應為 30, 實得 ${left()}`);
ok(gifts().length===1&&gifts()[0].m===30&&gifts()[0].why==='幫忙洗碗','帳本要記下分鐘與原因');
ok(gifts()[0].d===today,'帳本要記下日期');
ok(ev('SHARED.bank.earned')===0,'贈送不得混進 bank.earned（那是練習賺的）');
ok(ev('SHARED.bank.bonus')===0,'贈送不得混進紅利');
ok(!ev(`SHARED.days[${JSON.stringify(today)}]`),'贈送不得偽造出一筆練習紀錄');
ok(ev('goalStreak()')===0,'贈送不得算成達標日去領連續紅利');
ok(ev('streakDays()')===0,'贈送不得算成「今天有練」');

// ② 原因必填
const n1=gifts().length;
give(10,'');            ok(gifts().length===n1,'原因空白不得送出');
give(10,'   ');         ok(gifts().length===n1,'原因只有空白不得送出');
give(10,'|~;:,=');      ok(gifts().length===n1,'原因只有分隔符（會被清成空白）不得送出');
run('btnGift','10',null); ok(gifts().length===n1,'原因按取消不得送出');
run('btnGift',null);    ok(gifts().length===n1,'分鐘數按取消不得送出');

// ③ 分鐘數要擋住亂填
give(0,'零');           ok(gifts().length===n1,'0 分鐘不得送出');
give(-5,'負數');        ok(gifts().length===n1,'負數不得從贈送鈕送出');
give(GIFT_MAX+1,'超過');ok(gifts().length===n1,`一次超過 ${GIFT_MAX} 分鐘不得送出`);
give('abc','非數字');   ok(gifts().length===n1,'非數字不得送出');
ok(left()===30,`擋下來的都不該動到存摺, 實得 ${left()}`);

// ④ 原因會被清乾淨：分隔符會撞壞備份碼格式，過長會變成留言板
give(5,'a|b~c;d:e,f=g');
ok(!/[|~;:,=]/.test(gifts().slice(-1)[0].why),`原因不得殘留分隔符: ${gifts().slice(-1)[0].why}`);
give(5,'一二三四五六七八九十一二三四五六七八九十一二三四五');
ok(gifts().slice(-1)[0].why.length<=WHY_MAX,`原因要截到 ${WHY_MAX} 字, 實得 ${gifts().slice(-1)[0].why.length}`);

// ⑤ 沒收就是記一筆負的，帳本只增不改
const before=left(), cnt=gifts().length;
take(10,'亂發脾氣');
ok(left()===before-10,`沒收 10 分鐘後應為 ${before-10}, 實得 ${left()}`);
ok(gifts().length===cnt+1,'沒收要另外記一筆，不得回頭改掉原本那筆');
ok(gifts().slice(-1)[0].m===-10,'沒收要記成負數');
ok(gifts().slice(-1)[0].why==='亂發脾氣','沒收一樣要填原因');
take(999,'超過餘額');
ok(left()===before-10,'沒收不得超過存摺餘額');

// ⑥ 答錯會倒扣練習賺的，但不得動到贈送的分鐘
ev(`SHARED.days[${JSON.stringify(today)}]={n:30,r:30}; checkGoal(SHARED.days[${JSON.stringify(today)}]);`);
const earnedRight=ev('SHARED.bank.earned'), giftRight=ev('giftTotal()');
ok(earnedRight>0,`全對 30 題應該賺到分鐘, 實得 ${earnedRight}`);
ev(`const dd=SHARED.days[${JSON.stringify(today)}]; dd.n=40; dd.r=30; checkGoal(dd);`);
ok(ev('SHARED.bank.earned')<earnedRight,'答錯要倒扣練習賺的分鐘');
ok(ev('giftTotal()')===giftRight,'答錯不得扣到爸媽送的分鐘');
ok(gifts().length===cnt+1,'答錯不得動到贈送帳本');

// ⑦ 贈送不受「一天最多 60 分鐘」上限管（那是練習的上限）
ev(`SHARED.days[${JSON.stringify(today)}]={n:200,r:200}; checkGoal(SHARED.days[${JSON.stringify(today)}]);`);
ok(ev('paidOf(SHARED.days["'+today+'"])')===REWARD,`練習當天上限應為 ${REWARD}`);
const cap0=left();
give(GIFT_MAX,'生日禮物');
ok(left()===cap0+GIFT_MAX,`已達每日上限仍應收得到贈送, ${cap0} → ${left()}`);

// ⑧ 日曆看得出來
ev('renderCal()');
const cell=d.querySelector(`#calMonthGrid [data-day="${today}"]`);
ok(cell&&cell.classList.contains('gift'),'有贈送的日子在月檢視要有記號');
ok(ev(`dayNote(${JSON.stringify(today)}, SHARED.days[${JSON.stringify(today)}])`).includes('生日禮物'),
  '點格子要看得到贈送原因');
ok((cell.getAttribute('aria-label')||'').includes('爸媽送'),'螢幕閱讀器也要念得到贈送');
ok(ev('$("calSum").textContent').includes('爸媽送'),'當月小結要分開寫贈送');

// ⑨ 存摺畫面把兩種來源分開
ev('renderBank()');
ok($('bankDetail').textContent.includes('練習賺到'),'存摺要標明哪些是練習賺的');
ok($('bankDetail').textContent.includes('爸媽送'),'存摺要標明哪些是爸媽送的');

// ⑩ 中文原因要能通過備份碼（btoa 只吃 Latin1，中文會直接 throw）
let code='';
try{ code=ev('exportCode()'); }catch(e){ code=''; }
ok(code.startsWith(ev('BK_PREFIX')),'含中文原因時匯出不得爆掉');
const snapshot=JSON.stringify(gifts());
ev('SHARED={days:{},bank:{earned:0,used:0,bonus:0},gifts:[]}; saveShared();');
ok(left()===0,'清空後存摺歸零');
ok(ev(`importCode(${JSON.stringify(code)})`)==='','還原不得報錯');
ok(JSON.stringify(gifts().map(g=>({d:g.d,m:g.m,why:g.why})))
   ===JSON.stringify(JSON.parse(snapshot).map(g=>({d:g.d,m:g.m,why:g.why}))),
  `贈送帳本要能原封不動還原: ${JSON.stringify(gifts())}`);

// ⑪ 加倍券：要練才拿得到，跟純贈送不一樣
const X2=w.eval('X2'), T=JSON.stringify(today);
const coupons=()=>JSON.parse(ev('JSON.stringify(SHARED.coupons)'));
const reset=()=>ev('SHARED={days:{},bank:{earned:0,used:0,bonus:0},gifts:[],coupons:[]}; saveShared();');
function coupon(why){ let i=0; const a=[why]; w.prompt=()=>a[i++]; click($('btnCoupon')); }
/* 真實流程是一題一題累加、每題都呼叫一次 checkGoal。測試不可能真的跑 200 題，
   但「當天第一題」必須照實模擬 —— 加倍券就是在那一刻才會被吃掉。 */
const practise=(n,r)=>ev(`(()=>{
  const dd=SHARED.days[${T}]||(SHARED.days[${T}]={n:0,r:0});
  if(!dd.n){ dd.n=1; dd.r=${r}>0?1:0; checkGoal(dd); }     // 第一題
  dd.n=${n}; dd.r=${r}; checkGoal(dd);})()`);
const oneMore=ok2=>ev(`(()=>{                              // 在既有紀錄上再答一題
  const dd=SHARED.days[${T}]||(SHARED.days[${T}]={n:0,r:0});
  dd.n++; if(${!!ok2}) dd.r++; checkGoal(dd);})()`);

// 先量沒有券的基準
reset(); practise(30,30);
const base=ev('SHARED.bank.earned');
ok(base>0,`全對 30 題應該賺到分鐘, 實得 ${base}`);

reset(); coupon('考試進步');
ok(coupons().length===1&&coupons()[0].why==='考試進步','發券要記下原因');
ok(ev('couponStock().length')===1,'剛發的券要在庫存裡');
ok(ev(`couponMul(${T})`)===1,'還沒練習就不該生效');
ok(ev('bankLeft()')===0,'加倍券不得直接變成存摺裡的分鐘（要練才拿得到）');

practise(30,30);
ok(ev(`couponMul(${T})`)===X2,'開始練習之後券要生效');
ok(ev('SHARED.bank.earned')===base*X2,`有券那天應為 ${base*X2} 分鐘, 實得 ${ev('SHARED.bank.earned')}`);
ok(ev('couponStock().length')===0,'用掉的券不得留在庫存');
ok(coupons()[0].on===today,'券要記下用在哪一天');

// 一天只吃一張
coupon('多發一張'); practise(30,30);
ok(ev('couponStock().length')===1,'同一天不得連吃第二張券');
ok(ev('SHARED.bank.earned')===base*X2,'同一天第二張不得再加倍');

// ⑫ 加倍券要突破每日上限，否則練得多的日子等於沒送
reset(); practise(200,200);
const capNo=ev('SHARED.bank.earned');
ok(capNo===REWARD,`沒有券時一天上限應為 ${REWARD}, 實得 ${capNo}`);
reset(); coupon('生日'); practise(200,200);
ok(ev('SHARED.bank.earned')===REWARD*X2,`有券時上限應放寬到 ${REWARD*X2}, 實得 ${ev('SHARED.bank.earned')}`);

// ⑬ 答錯的倒扣也要加倍（不然持券亂猜就划算了）
reset(); practise(30,30); practise(40,30);
const downNo=ev('SHARED.bank.earned');
reset(); coupon('週末衝刺'); practise(30,30); practise(40,30);
ok(ev('SHARED.bank.earned')===downNo*X2,
  `有券時答錯的結果也要是 ${downNo*X2}, 實得 ${ev('SHARED.bank.earned')}`);
ok(ev('SHARED.bank.earned')<base*X2,'答錯之後要比全對少');

// ⑭ 券不得動到贈送帳本，日曆也要看得出來
ok(ev('giftTotal()')===0,'加倍券不得混進贈送帳本');
ev('renderCal()');
const c2=d.querySelector(`#calMonthGrid [data-day="${today}"]`);
ok(c2&&c2.classList.contains('gift'),'用了券的日子在日曆要有記號');
ok(ev(`dayNote(${T}, SHARED.days[${T}])`).includes('加倍券'),'點格子要看得到用了加倍券');
ok(ev(`dayNote(${T}, SHARED.days[${T}])`).includes('週末衝刺'),'點格子要看得到發券原因');
ev('renderBank()');
ok($('bankStreak').textContent.includes('加倍券'),'存摺要提示加倍券生效中');

// ⑮ 券要能通過備份碼往返（含中文原因、含「用掉了沒」）
coupon('還沒用的券');
const snap2=JSON.stringify(coupons().map(c=>({d:c.d,on:c.on,why:c.why})));
const code2=ev('exportCode()');
reset();
ok(ev(`importCode(${JSON.stringify(code2)})`)==='','含加倍券的備份碼要還原得回來');
ok(JSON.stringify(coupons().map(c=>({d:c.d,on:c.on,why:c.why})))===snap2,
  `加倍券要原封不動還原: ${JSON.stringify(coupons())}`);
ok(ev('couponStock().length')===1,'還沒用掉的券還原後仍要是未使用');

// ⑮-2 送飼料、送轉蛋券（給成語ㄚ喵的貓）
reset();
run('btnGiftFeed','20','幫忙倒垃圾');
ok(ev('SHARED.feed && SHARED.feed.bonus')===20,`送飼料要進飼料帳的 bonus, 實得 ${JSON.stringify(ev('SHARED.feed'))}`);
ok(gifts().length===1&&gifts()[0].kind==='feed'&&gifts()[0].m===20,'帳本要記 kind:feed');
ok(ev('bankLeft()')===0,'送飼料不得混進分鐘存摺');
ok(ev('giftTotal()')===0,'giftTotal 只算分鐘');
run('btnGiftTicket','2','考試進步');
ok(ev('SHARED.feed.tickets')===2&&gifts()[1].kind==='ticket','送轉蛋券要進 tickets');
run('btnGiftTicket','5','太多');
ok(ev('SHARED.feed.tickets')===2,'轉蛋券一次最多 3 張');
run('btnGiftFeed','31','太多');
ok(ev('SHARED.feed.bonus')===20,'飼料一次最多 30 顆');
run('btnGiftFeed','5','');
ok(gifts().length===2,'送飼料也要填原因');
ev('renderCal()');
ok(ev(`dayNote(${T}, SHARED.days[${T}])`).includes('顆飼料')&&ev(`dayNote(${T}, SHARED.days[${T}])`).includes('張轉蛋券'),'日曆要看得到送的是飼料還是券');
ev('renderBank()');
ok(!/爸媽送 20/.test($('bankDetail').textContent),'存摺明細不得把飼料當分鐘顯示');

// ⑯ 已經練到一半才發的券，不得靠「再答一題」把整天回頭加倍
reset(); practise(200,200);
const full=ev('SHARED.bank.earned');
ok(full===REWARD,`練滿應為 ${REWARD} 分鐘, 實得 ${full}`);
ev(`SHARED.coupons.push({d:${T}, on:null, why:"晚上才發", ts:0}); saveShared();`);
oneMore(false);
ok(ev('SHARED.bank.earned')===full,
  `已練滿才發的券不得靠一題引爆整天, 實得 ${ev('SHARED.bank.earned')}`);
ok(ev('couponStock().length')===1,'半路發的券要留到下一天，不得當天用掉');
ok(ev(`couponMul(${T})`)===1,'半路發的券當天不得生效');
oneMore(true);
ok(ev('SHARED.bank.earned')===full,'再多答幾題也不得引爆');

// ⑰ 先兌換又答錯會欠著，那筆負債不得默默吃掉家長送的分鐘
reset(); practise(30,30);
const e1=ev('SHARED.bank.earned');
ev(`SHARED.bank.used=${e1}; saveShared();`);
ok(ev('bankLeft()')===0,'全部兌換後餘額為 0');
practise(60,30);                                   // 答錯一半，倒扣
ok(ev('bankRaw()')<0,`先兌換後答錯應該欠著, 實得 ${ev('bankRaw()')}`);
ok(ev('bankLeft()')===0,'欠著的時候畫面仍顯示 0，不得是負數');
ev('renderBank()');
ok($('bankDetail').textContent.includes('欠'),'欠著這件事要在存摺上講出來，不能只是消失');
const owed=-ev('bankRaw()');
ev(`SHARED.gifts.push({d:${T}, m:30, why:"補償", ts:0}); saveShared();`);
ok(ev('bankLeft()')===30-owed,
  `送 30 分鐘時要先補掉欠的 ${owed}, 實得 ${ev('bankLeft()')}`);

// ⑱ 家長密碼要擋得住
reset();
w.prompt=()=>'1234'; click($('btnPin'));
ok(ev('getPin()')==='1234','密碼要設得起來');
run('btnGift','9999','30','偷送自己');
ok(gifts().length===0,'密碼錯誤不得送出');
run('btnGift','1234','30','考試進步');
ok(gifts().length===1&&left()===30,`密碼正確才送得出去, 實得 ${left()}`);
run('btnTake','9999','10','沒收');
ok(gifts().length===1,'密碼錯誤不得沒收');
run('btnCoupon','9999','偷發券');
ok(ev('SHARED.coupons.length')===0,'密碼錯誤不得發加倍券');
run('btnCoupon','1234','幫忙掃地');
ok(ev('SHARED.coupons.length')===1,'密碼正確才發得出加倍券');
// 還原備份碼是整包覆寫，破壞力跟清除紀錄同級，一樣要密碼
const code3=ev('exportCode()');
const beforeTake=ev('bankLeft()');
run('btnTake','1234','10','沒收');
ok(ev('bankLeft()')===beforeTake-10,`先沒收 10 分鐘, 實得 ${ev('bankLeft()')}`);
ok(ev('SHARED.gifts').length===2,'沒收要多記一筆');
run('btnImport','9999',code3);
ok(ev('SHARED.gifts').length===2,'密碼錯誤不得用備份碼把沒收的分鐘救回來');
run('btnImport','1234',code3);
ok(ev('SHARED.gifts').length===1,'密碼正確才還原得了');

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail?1:0);
