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
const bank=()=>w.eval('S.bank.earned');
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
function play(n){ click($('btnDaily')); for(let i=0;i<n;i++) answer(); click($('btnQuit')); click($('btnBackHome')); }

console.log('  級距:', JSON.stringify(TIERS));
ok(w.eval('tierMinutes(0)')===0,'0 題 = 0 分');
ok(w.eval('tierMinutes(9)')===0,'9 題 = 0 分');
ok(w.eval('tierMinutes(10)')===2,'10 題 = 2 分, 實得 '+w.eval('tierMinutes(10)'));
ok(w.eval('tierMinutes(19)')===2,'19 題仍是 2 分');
ok(w.eval('tierMinutes(20)')===4,'20 題 = 4 分, 實得 '+w.eval('tierMinutes(20)'));
ok(w.eval('tierMinutes(29)')===4,'29 題仍是 4 分');
ok(w.eval('tierMinutes(30)')===15,'30 題 = 15 分, 實得 '+w.eval('tierMinutes(30)'));
ok(w.eval('tierMinutes(100)')===15,'超過 30 題不再增加（上限 15）');

// 分次累積：10 → 20 → 30，總額必須等於一次做 30 題
play(10); ok(bank()===2,`做 10 題應入帳 2 分, 實得 ${bank()}`);
play(10); ok(bank()===4,`累積 20 題應共 4 分, 實得 ${bank()}`);
play(10); ok(bank()===15,`累積 30 題應共 15 分, 實得 ${bank()}`);
play(10); ok(bank()===15,`超過 30 題不再加, 實得 ${bank()}`);
console.log('  分三次做 10 題 → 總共', bank(), '分鐘（與一次做 30 題相同）');

// 一次做滿 30 題
w.eval('S=blank(); save();');
click($('btnStart')); for(let i=0;i<30;i++) answer(); click($('btnBackHome'));
ok(bank()===15,`一次做 30 題應得 15 分, 實得 ${bank()}`);

// 兌換：密碼、申請訊息、倒數
stats();
ok($('btnSpend').textContent.includes(String(SPEND)),'兌換鈕應顯示分鐘數');
ok(!$('btnSpend').disabled,'15 分鐘足夠應可兌換');
let copied='';
w.navigator.clipboard={writeText:async t=>{copied=t;}};
click($('btnSpend'));
(async()=>{
  await new Promise(r=>setTimeout(r,30));
  ok(w.eval('S.bank.used')===SPEND,'應扣款 15 分鐘');
  ok($('bankLeft').textContent==='0','餘額應歸零');
  console.log('  ── 申請訊息 ──\n'+copied.split('\n').map(s=>'    '+s).join('\n'));
  ok(copied.includes('遊戲時間申請'),'應複製申請訊息');
  ok(copied.includes('30 題'),'訊息要寫今天練幾題');
  ok(/\d+\/\d+ \d{2}:\d{2} 開始/.test(copied),'訊息要有開始時間, 實得 '+copied);
  ok(!/http/.test(copied),'申請訊息不得含網址');
  // 倒數
  ok(!$('timerBox').hidden,'兌換後應顯示倒數');
  ok(/剩 1[45]:\d{2}/.test($('timerBox').textContent),'倒數應從約 15 分開始, 實得 '+$('timerBox').textContent);
  ok(w.eval('S.bank.until')>Date.now(),'應存下結束時間（關掉網頁再回來也算得準）');
  w.eval('S.bank.until = Date.now()-1000; renderTimer();');
  ok($('timerBox').hidden,'時間到應收起倒數');

  // 家長密碼
  ok(w.eval('getPin()')==='','預設沒有密碼');
  w.prompt=()=>'1234';
  click($('btnPin'));
  ok(w.eval('getPin()')==='1234','應能設定密碼');
  ok($('tierHint').textContent.includes('已設家長密碼'),'畫面要提示已設密碼');
  w.eval('S.bank.earned=100; save(); renderBank();');
  w.prompt=()=>'9999';           // 輸錯
  const used0=w.eval('S.bank.used');
  click($('btnSpend'));
  await new Promise(r=>setTimeout(r,20));
  ok(w.eval('S.bank.used')===used0,'密碼錯誤不得扣款');
  w.prompt=()=>'1234';           // 輸對
  click($('btnSpend'));
  await new Promise(r=>setTimeout(r,20));
  ok(w.eval('S.bank.used')===used0+SPEND,'密碼正確才扣款');
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
  w.eval(`S.days["2026-01-01"]={n:30,r:30,paid:true};`);
  ok(w.eval('paidOf(S.days["2026-01-01"])')===REWARD,'舊版 paid:true 應換算成滿額分鐘');

  console.log(`\n通過 ${pass} / 失敗 ${fail}`);
  process.exit(fail?1:0);
})();
