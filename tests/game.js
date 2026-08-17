const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  beforeParse(win){
    win.speechSynthesis={speak(){},cancel(){},getVoices:()=>[{lang:'en-US',name:'Samantha'}],addEventListener(){}};
    win.SpeechSynthesisUtterance=function(t){this.text=t;};
  }});
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
const DAILY=w.eval('DAILY'), ROUND=w.eval('ROUND'), REWARD=w.eval('REWARD');
const TIERS=w.eval('TIERS'), SPEND=w.eval('SPEND'), T1=TIERS[0].m;
const SW=w.eval('SUMMER_WORDS'); const byZh={}; SW.forEach(x=>(byZh[x.zh]=byZh[x.zh]||[]).push(x.w));
const stats=()=>click([...d.querySelectorAll('.nav button')].find(b=>b.dataset.view==='vStats'));
function answer(correct=true){
  const t=$('qKind').textContent;
  if(t.includes('說中文')||t.includes('只聽')){
    const bs=[...d.querySelectorAll('#qBody .choice')];
    const en=(d.querySelector('#qPrompt .en')||{}).textContent;
    if(t.includes('只聽')&&!en){ // 聽力題：用 reveal 取得答案
      const r=$('reveal'); if(r) click(r);
    }
    const target=(d.querySelector('#qPrompt .en')||{}).textContent;
    const b= correct ? bs.find(x=>x.dataset.w===(target||'').trim()) : bs.find(x=>x.dataset.w!==(target||'').trim());
    click(b||bs[0]); click($('btnCheck'));
  } else {
    const a=ansOf();
    if((t.includes('拼英文')||t.includes('填單字'))){ const ts=[...d.querySelectorAll('#qBody .tile')];
      const seq=a.toLowerCase().split('').map(c=>ts.find(x=>x.textContent===c&&!x.classList.contains('used')));
      if(seq.every(Boolean)) seq.forEach(click); click($('btnCheck')); }
    else { $('typed').value= correct?a:'zz'; click($('btnCheck')); } }
  click($('btnNext'));
}

// ① 今日目標入口
ok(!!$('btnDaily'),'應有今日 N 題按鈕');
ok($('btnDaily').textContent.includes(String(DAILY)),`今日按鈕應顯示 ${DAILY}`);
ok($('btnStart').textContent.includes(String(ROUND)),`完整練習按鈕應顯示 ${ROUND}`);
ok($('heroGoal').textContent.includes('答對 0'),'主畫面應顯示今日進度, 實得 '+$('heroGoal').textContent);

// ② 做滿每日目標 → 拿到遊戲時間
click($('btnDaily'));
ok($('qCount').textContent.includes(`/ ${DAILY}`),`今日模式一輪應為 ${DAILY} 題, 實得 `+$('qCount').textContent);
for(let i=0;i<DAILY;i++) answer(true);
const S1={bank:w.eval('SHARED.bank'),days:w.eval('SHARED.days')};
ok(S1.bank.earned===T1,`做滿 ${DAILY} 題應入帳 ${T1} 分鐘, 實得 `+S1.bank.earned);
ok(S1.days[w.eval('dayKey()')].paid===T1,'當天應記錄已發放的分鐘數');
click($('btnBackHome'));
ok($('heroGoal').textContent.includes(`已賺 ${T1} 分鐘`),'主畫面應顯示已賺分鐘, 實得 '+$('heroGoal').textContent);

// 同一天再練是「升級」不是重複發放：20 題該拿第二階，不是兩次第一階
click($('btnDaily')); for(let i=0;i<DAILY;i++) answer(true); click($('btnBackHome'));
const S2={bank:w.eval('SHARED.bank'),days:w.eval('SHARED.days')};
ok(S2.bank.earned===TIERS[1].m,`累積 ${TIERS[1].n} 題應為 ${TIERS[1].m} 分（非 ${T1*2}），實得 `+S2.bank.earned);

// ③ 存摺畫面與兌換
stats();
ok($('bankLeft').textContent===String(TIERS[1].m),`存摺應有 ${TIERS[1].m} 分鐘, 實得 `+$('bankLeft').textContent);
ok($('btnSpend').disabled,`只有 ${TIERS[1].m} 分鐘不足 ${SPEND} 分，應停用`);
ok($('btnSpend').textContent.includes('還差'),'應提示還差多少, 實得 '+$('btnSpend').textContent);
w.eval('SHARED.bank.earned=60; save(); renderBank();');
ok(!$('btnSpend').disabled,'足夠時應可兌換');

// ④ GitHub 風格日曆
ok(d.querySelectorAll('#calGrid .cell').length>=26*7-7,'應有約半年的格子, 實得 '+d.querySelectorAll('#calGrid .cell').length);
ok(d.querySelectorAll('#calMonths span').length===26,'月份標籤欄數應等於週數');
const todayCell=d.querySelector('#calGrid .cell.today');
ok(!!todayCell,'今天要標出來');
ok(/l[1-4]/.test(todayCell.className),'今天有練應上色');
ok(todayCell.classList.contains('goal'),'今天達標應有達標外框');
ok(!d.querySelector('#calPrev'),'GitHub 風格不應還有上/下月按鈕');

// ⑤ 間隔重複
const st=w.eval('S.stats');
const someDue=Object.values(st).filter(s=>s.due).length;
ok(someDue>0,'答對的字應排定下次複習日, 實得 '+someDue);
const oneWord=Object.keys(st).find(k=>st[k].streak>=1);
ok(/^\d{4}-\d{2}-\d{2}$/.test(st[oneWord].due),'複習日格式應為 YYYY-MM-DD, 實得 '+st[oneWord].due);
ok(w.eval(`mastered("${oneWord}")`)===(st[oneWord].streak>=2),'熟練判定要看連對次數與到期日');
// 未到期的熟練字權重要低
w.eval(`S.stats["happy"]={r:5,x:0,streak:3,due:"2099-01-01"}`);
ok(w.eval('weight(WORDS.find(x=>x.w==="happy"))')<0.5,'未到期的熟練字權重要很低');
w.eval(`S.stats["happy"].due="2000-01-01"`);
ok(w.eval('weight(WORDS.find(x=>x.w==="happy"))')>=3,'到期的熟練字要優先回鍋');
ok(w.eval('reviewCount()')>0,'應統計出今天該複習的字數');

// ⑥ 聽力題
ok(!!$('chipListen'),'應有聽力題開關');
let sawListen=false;
for(let r=0;r<6&&!sawListen;r++){ click($('btnStart'));
  for(let i=0;i<ROUND;i++){ if($('qKind').textContent.includes('只聽')){ sawListen=true;
      ok(!d.querySelector('#qPrompt .en'),'聽力題一開始不該顯示英文');
      ok(!!$('spk'),'聽力題要有大喇叭鈕');
      ok(!!$('reveal'),'聽力題要有「聽不到」的逃生按鈕');
      click($('reveal'));
      ok(!!d.querySelector('#qPrompt .en'),'點了逃生鈕要顯示單字');
      ok(d.querySelectorAll('#qBody .choice').length===4,'聽力題要有 4 個選項');
    } answer(true); } click($('btnBackHome')); }
ok(sawListen,'應該要出得到聽力題');
// 關掉聽力題後不該再出現
click($('chipListen'));
ok($('chipListen').getAttribute('aria-pressed')==='false','開關要能關掉');
let listenAfterOff=0;
for(let r=0;r<4;r++){ click($('btnStart'));
  for(let i=0;i<ROUND;i++){ if($('qKind').textContent.includes('只聽')) listenAfterOff++; answer(true); }
  click($('btnBackHome')); }
ok(listenAfterOff===0,'關掉後不該再出聽力題, 實得 '+listenAfterOff);

// ⑦ 備份與還原
const code=w.eval('exportCode()');
ok(code.startsWith(w.eval('BK_PREFIX')),'備份碼要有前綴');
ok(code.length>50,'備份碼應包含實際資料, 長度 '+code.length);
console.log('  備份碼長度:', code.length, '字元');
const before=$('hDone').textContent;
w.eval('S=blank(); save(); refreshHeader();');
ok($('hDone').textContent==='0','清空後歸零');
ok(w.eval(`importCode(${JSON.stringify(code)})`)==='','還原不該報錯');
w.eval('refreshHeader()');
ok($('hDone').textContent===before,`還原後應回到 ${before}, 實得 `+$('hDone').textContent);
ok(w.eval('importCode("亂打一通")')!=='','不是備份碼要擋下來');
ok(w.eval('importCode("CQ2:@@@壞掉")')!=='','壞掉的備份碼要擋下來');
ok(w.eval('bankLeft()')>=0,'還原後存摺不得為負');
// 往返一致性：pack → unpack 後資料必須完全相同
const orig=JSON.parse(w.localStorage.getItem('cq-vocab-v1:summer'));
const round=w.eval(`unpackDeck(packDeck(${JSON.stringify(orig)}))`);
ok(round.done===orig.done&&round.right===orig.right,'往返後總題數要一致');
ok(JSON.stringify(round.bank)===JSON.stringify(orig.bank),'往返後存摺要一致');
ok(Object.keys(round.stats).length===Object.keys(orig.stats).length,`往返後單字數要一致 ${Object.keys(round.stats).length} vs ${Object.keys(orig.stats).length}`);
ok(Object.keys(round.days).length===Object.keys(orig.days).length,'往返後日曆天數要一致');
const k0=Object.keys(orig.stats)[0];
ok(JSON.stringify(round.stats[k0])===JSON.stringify(orig.stats[k0]),`往返後單字統計要一致: ${JSON.stringify(round.stats[k0])} vs ${JSON.stringify(orig.stats[k0])}`);
const dk=Object.keys(orig.days)[0];
ok(JSON.stringify(round.days[dk])===JSON.stringify(orig.days[dk]),`往返後日紀錄要一致: ${JSON.stringify(round.days[dk])} vs ${JSON.stringify(orig.days[dk])}`);
// 含點與連字號的單字
const tricky={done:1,right:1,stats:{"mr.":{r:1,x:0,streak:1,due:"2026-09-01"},"hard-working":{r:2,x:1,streak:0}},days:{"2026-08-16":{n:5,r:4,paid:true}},bank:{earned:15,used:0,bonus:30}};
const t2=w.eval(`unpackDeck(packDeck(${JSON.stringify(tricky)}))`);
ok(JSON.stringify(t2)===JSON.stringify(tricky),`含點/連字號的單字要能往返: ${JSON.stringify(t2)}`);
ok(code.length<4000,'備份碼應壓到 4000 字元以內, 實得 '+code.length);

// ⑧ 成績訊息含遊戲時間
const rep=w.eval('reportText(false)');
console.log('  ── 訊息 ──\n'+rep.split('\n').map(s=>'    '+s).join('\n'));
ok(/存摺 \d+ 分鐘/.test(rep),'訊息應包含遊戲時間, 實得 '+rep.split('\n').pop());
ok(!/http/.test(rep),'訊息仍不得含網址');

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail?1:0);
