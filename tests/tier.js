const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  beforeParse(win){ win.speechSynthesis={speak(){},cancel(){},getVoices:()=>[{lang:'en-US',name:'S'}],addEventListener(){}};
    win.SpeechSynthesisUtterance=function(t){this.text=t;}; }});
const w=dom.window,d=w.document; w.alert=m=>console.log('ALERT',m); w.confirm=()=>true; w.scrollTo=()=>{};
w.HTMLElement.prototype.scrollIntoView=function(){};
const $=id=>d.getElementById(id), click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const R=w.eval('ROUND');

// 依畫面推回這題的正解單字（適用所有題型，含挖空題）
function ansOf(){
  const en=d.querySelector('#qPrompt .en');
  if(en) return en.textContent.trim();
  const sz=d.querySelector('#qPrompt .sen-zh');
  if(sz){ const hit=w.eval('WORDS').find(x=>x.ex&&x.ex[1]===sz.textContent.trim()); return hit&&hit.w; }
  const zh=d.querySelector('#qPrompt .zh');
  if(zh){ const list=w.eval('WORDS').filter(x=>x.zh===zh.textContent.trim()); return list[0]&&list[0].w; }
  return null;
}
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('  ✗ '+m))};
const TIERS=w.eval('TIERS'), SPEND=w.eval('SPEND'), REWARD=w.eval('REWARD');
const SW=w.eval('SUMMER_WORDS'); const byZh={}; SW.forEach(x=>(byZh[x.zh]=byZh[x.zh]||[]).push(x.w));
const stats=()=>click([...d.querySelectorAll('.nav button')].find(b=>b.dataset.view==='vStats'));
const bank=()=>w.eval('SHARED.bank.earned');
function answer(){ const t=$('qKind').textContent;
  if(t.includes('說中文')||t.includes('只聽')){ const r=$('reveal'); if(r) click(r);
    const en=(d.querySelector('#qPrompt .en')||{textContent:''}).textContent.trim();
    const bs=[...d.querySelectorAll('#qBody .choice')];
    click(bs.find(x=>x.dataset.w===en)||bs[0]);
  } else { const a=ansOf();
    if((t.includes('拼英文')||t.includes('填單字'))){ const ts=[...d.querySelectorAll('#qBody .tile')];
      const seq=a.toLowerCase().split('').map(c=>ts.find(x=>x.textContent===c&&!x.classList.contains('used')));
      if(seq.every(Boolean)) seq.forEach(click); click($('btnCheck')); }
    else { $('typed').value=a; click($('btnCheck')); } }
  click($('btnNext')); }
function answerWrong(){
  const t=$('qKind').textContent;
  if(d.querySelector('#qBody .choice')){
    const en=(d.querySelector('#qPrompt .en')||{textContent:''}).textContent.trim();
    const bs=[...d.querySelectorAll('#qBody .choice')];
    click(bs.find(x=>x.dataset.w!==en)||bs[0]);
  } else if(d.querySelector('#qBody .tile')){
    const ts=[...d.querySelectorAll('#qBody .tile')];
    const n=d.querySelectorAll('#qBody .slot').length;
    ts.slice(0,n).reverse().forEach(click);      // 順序顛倒 → 幾乎必錯
    click($('btnCheck'));
  } else { $('typed').value='zzzz'; click($('btnCheck')); }
  click($('btnNext'));
}
function play(n){ click($('btnDaily')); for(let i=0;i<n;i++) answer(); click($('btnQuit')); click($('btnBackHome')); }

console.log('  級距:', TIERS.map(t=>`${t.n}題=${t.m}分`).join(' · '));
ok(w.eval('tierMinutes(0)')===0,'0 題 = 0 分');
ok(w.eval('tierMinutes('+(TIERS[0].n-1)+')')===0,`未達第一階 = 0 分`);
TIERS.forEach((t,i)=>{
  ok(w.eval('tierMinutes('+t.n+')')===t.m, `${t.n} 題 = ${t.m} 分, 實得 `+w.eval('tierMinutes('+t.n+')'));
  const next=TIERS[i+1];
  if(next) ok(w.eval('tierMinutes('+(next.n-1)+')')===t.m, `${next.n-1} 題仍停在 ${t.m} 分`);
});
ok(w.eval('tierMinutes(9999)')===REWARD,`超過最後一階不再增加（上限 ${REWARD}）`);
// 級距必須遞增，否則多練反而變少
ok(TIERS.every((t,i)=>i===0||(t.n>TIERS[i-1].n&&t.m>TIERS[i-1].m)),'題數與分鐘都必須遞增');

// 分次累積：10 → 20 → 30，總額必須等於一次做 30 題
const step=TIERS[0].n;
for(const t of TIERS){
  for(let guard=0; guard<40; guard++){
    const day=w.eval('SHARED.days[dayKey()]')||{n:0};
    if(day.n>=t.n) break;
    play(step);
  }
  ok(bank()===t.m, `分次累積到 ${t.n} 題應共 ${t.m} 分, 實得 ${bank()}`);
}
console.log('  分次累積到', TIERS[TIERS.length-1].n, '題 → 總共', bank(), '分鐘');

// 一次做滿 30 題
w.eval('S=blank(); save();');
const R3=w.eval('ROUND');
w.eval('SHARED={days:{},bank:{earned:0,used:0,bonus:0}}; saveShared(); S=blank(); save();');
click($('btnStart')); for(let i=0;i<R3;i++) answer(); click($('btnBackHome'));
ok(bank()===w.eval('tierMinutes('+R3+')'),`一次做 ${R3} 題應得 ${w.eval('tierMinutes('+R3+')')} 分, 實得 ${bank()}`);

// 兌換：密碼、申請訊息、倒數
stats();
ok($('btnSpend').textContent.includes(String(SPEND)),'兌換鈕應顯示分鐘數');
ok(!$('btnSpend').disabled,'15 分鐘足夠應可兌換');
let copied='';
w.navigator.clipboard={writeText:async t=>{copied=t;}};
click($('btnSpend'));
(async()=>{
  await new Promise(r=>setTimeout(r,30));
  ok(w.eval('SHARED.bank.used')===SPEND,`應扣款 ${SPEND} 分鐘, 實得 `+w.eval('SHARED.bank.used'));
  ok($('bankLeft').textContent===String(w.eval('bankLeft()')),'畫面餘額要跟資料一致');
  console.log('  ── 申請訊息 ──\n'+copied.split('\n').map(s=>'    '+s).join('\n'));
  ok(copied.includes('遊戲時間申請'),'應複製申請訊息');
  ok(copied.includes(w.eval('SHARED.days[dayKey()]').n+' 題'),'訊息要寫今天練幾題, 實得 '+copied.split('\n')[1]);
  ok(/\d+\/\d+ \d{2}:\d{2} 開始/.test(copied),'訊息要有開始時間, 實得 '+copied);
  ok(!/http/.test(copied),'申請訊息不得含網址');
  // 倒數
  ok(!$('timerBox').hidden,'兌換後應顯示倒數');
  ok(/剩 1[45]:\d{2}/.test($('timerBox').textContent),'倒數應從約 15 分開始, 實得 '+$('timerBox').textContent);
  ok(w.eval('SHARED.bank.until')>Date.now(),'應存下結束時間（關掉網頁再回來也算得準）');
  w.eval('SHARED.bank.until = Date.now()-1000; renderTimer();');
  ok($('timerBox').hidden,'時間到應收起倒數');

  // 家長密碼
  ok(w.eval('getPin()')==='','預設沒有密碼');
  w.prompt=()=>'1234';
  click($('btnPin'));
  ok(w.eval('getPin()')==='1234','應能設定密碼');
  ok($('tierHint').textContent.includes('已設家長密碼'),'畫面要提示已設密碼');
  w.eval('SHARED.bank.earned=100; save(); renderBank();');
  w.prompt=()=>'9999';           // 輸錯
  const used0=w.eval('SHARED.bank.used');
  click($('btnSpend'));
  await new Promise(r=>setTimeout(r,20));
  ok(w.eval('SHARED.bank.used')===used0,'密碼錯誤不得扣款');
  w.prompt=()=>'1234';           // 輸對
  click($('btnSpend'));
  await new Promise(r=>setTimeout(r,20));
  ok(w.eval('SHARED.bank.used')===used0+SPEND,'密碼正確才扣款');
  // 取消密碼：先驗證舊密碼，再輸入空字串
  let seq=['1234',''], si=0;
  w.prompt=()=>seq[si++];
  click($('btnPin'));
  ok(w.eval('getPin()')==='','應能取消密碼, 實得 '+w.eval('getPin()'));
  // 改密碼：驗證舊的 → 設新的
  w.prompt=()=>'5678'; click($('btnPin'));
  ok(w.eval('getPin()')==='5678','應能設新密碼');
  seq=['5678','12']; si=0; w.prompt=()=>seq[si++];
  click($('btnPin'));
  ok(w.eval('getPin()')==='5678','非 4 位數應被擋下、保留原密碼, 實得 '+w.eval('getPin()'));
  seq=['5678','']; si=0; w.prompt=()=>seq[si++]; click($('btnPin'));

  // 舊版存檔 paid:true 要能換算
  w.eval(`SHARED.days["2026-01-01"]={n:30,r:30,paid:true};`);
  ok(w.eval('paidOf(SHARED.days["2026-01-01"])')===REWARD,'舊版 paid:true 應換算成滿額分鐘');

  // ===== 答錯倒扣 =====
  console.log('\n  ── 答錯倒扣 ──');
  const netOf = o => w.eval('netOf(' + JSON.stringify(o) + ')');
  ok(netOf({n:10,r:10})===10,'全對 10 題 → 淨 10');
  ok(netOf({n:10,r:8})===6,'對 8 錯 2 → 淨 6, 實得 '+netOf({n:10,r:8}));
  ok(netOf({n:10,r:5})===0,'對 5 錯 5 → 淨 0, 實得 '+netOf({n:10,r:5}));
  ok(netOf({n:10,r:2})===0,'錯比對多 → 淨 0（不會變負數）, 實得 '+netOf({n:10,r:2}));
  ok(netOf({n:30,r:25})===20,'對 25 錯 5 → 淨 20');

  // 全新一天：先全對做到第二階，再故意答錯把它扣回第一階
  w.eval('S = blank(); SHARED={days:{},bank:{earned:0,used:0,bonus:0}}; save();');
  const tierN = TIERS[1].n, tierM = TIERS[1].m, firstM = TIERS[0].m;
  click($('btnStart'));
  for(let i=0;i<tierN;i++) answer();          // 全對 tierN 題
  click($('btnQuit')); click($('btnBackHome'));
  ok(bank()===tierM, `全對 ${tierN} 題應得 ${tierM} 分, 實得 ${bank()}`);

  // 答錯數題，讓淨題數掉回第一階
  const wrongNeeded = Math.ceil((tierN - TIERS[0].n) / 2) + 1;
  click($('btnStart'));
  for(let i=0;i<wrongNeeded;i++) answerWrong();
  click($('btnQuit')); click($('btnBackHome'));
  const after = bank();
  ok(after < tierM, `答錯 ${wrongNeeded} 題後應該被倒扣（${tierM} → ${after}）`);
  ok(after >= 0, '倒扣後不得變成負數, 實得 '+after);
  const day = w.eval('SHARED.days[dayKey()]');
  ok(day.paid === after, `當日已發放分鐘要跟著調整, day.paid=${day.paid} bank=${after}`);
  ok(w.eval('tierMinutes(netOf(' + JSON.stringify({n:day.n,r:day.r}) + '))') === after,
     `倒扣後的分鐘要等於淨題數該得的（淨 ${day.r-(day.n-day.r)} 題）`);
  console.log(`  對 ${day.r} 錯 ${day.n-day.r} → 淨 ${Math.max(0,day.r-(day.n-day.r))} 題 → ${after} 分鐘`);

  // 再全對補回來
  click($('btnStart'));
  for(let i=0;i<tierN;i++) answer();
  click($('btnQuit')); click($('btnBackHome'));
  ok(bank() > after, `再答對應該把分鐘賺回來（${after} → ${bank()}）`);

  console.log(`\n通過 ${pass} / 失敗 ${fail}`);
  process.exit(fail?1:0);
})();
