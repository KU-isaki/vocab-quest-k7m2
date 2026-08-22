/* 難度矩陣 + 出題不重複
   ① 三段難度：題型配方不同、分鐘倍率不同，但題數門檻完全不變
   ② 出題本身：同一輪不重複字、每次順序與題型都會變 */
const fs=require('fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  beforeParse(win){ win.speechSynthesis={speak(){},cancel(){},getVoices:()=>[{lang:'en-US',name:'S'}],addEventListener(){}};
    win.SpeechSynthesisUtterance=function(t){this.text=t;}; }});
const w=dom.window,d=w.document; w.alert=()=>{}; w.confirm=()=>true; w.scrollTo=()=>{};
w.HTMLElement.prototype.scrollIntoView=function(){};
const $=id=>d.getElementById(id), click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('  ✗ '+m))};

const LEVELS=w.eval('LEVELS'), TIERS=w.eval('TIERS'), REWARD=w.eval('REWARD');
const setLv=id=>w.eval(`LV=LEVELS.find(l=>l.id==="${id}")`);

/* ---------- ① 矩陣 UI ---------- */
const sizeBtns=()=>[...d.querySelectorAll('#sizeRow .chip')];
const lvBtns=()=>[...d.querySelectorAll('#lvRow .chip')];
ok(sizeBtns().length===3,'第一列：三個題數按鈕, 實得 '+sizeBtns().length);
ok(lvBtns().length===3,'第二列：三個難度按鈕, 實得 '+lvBtns().length);
ok(sizeBtns().map(b=>+b.dataset.size).join()==='10,30,50','題數應為 10 / 30 / 50, 實得 '+sizeBtns().map(b=>b.dataset.size).join());
ok(sizeBtns().filter(b=>b.getAttribute('aria-pressed')==='true').length===1,'題數同時只能選一個');
ok(lvBtns().filter(b=>b.getAttribute('aria-pressed')==='true').length===1,'難度同時只能選一個');

// 任選組合都要能開始，而且真的照選的題數出題
for(const n of [10,50,30]){
  for(const lv of ['hard','easy','std']){
    click(sizeBtns().find(b=>+b.dataset.size===n));
    click(lvBtns().find(b=>b.dataset.lv===lv));
    ok(sizeBtns().find(b=>+b.dataset.size===n).getAttribute('aria-pressed')==='true',`選了 ${n} 題要亮起來`);
    ok(lvBtns().find(b=>b.dataset.lv===lv).getAttribute('aria-pressed')==='true',`選了 ${lv} 要亮起來`);
    ok($('btnStart').textContent.includes(String(n)),`開始鈕要顯示 ${n} 題, 實得 `+$('btnStart').textContent);
    click($('btnStart'));
    ok($('qCount').textContent.includes(`/ ${n}`),`${lv} × ${n} 題應出 ${n} 題, 實得 `+$('qCount').textContent);
    click($('btnQuit')); click($('btnBackHome'));
  }
}
// 難度不得偷偷減少題數
const sizes=['easy','std','hard'].map(lv=>{ setLv(lv); return w.eval('drawRound(pool(),30).length'); });
ok(sizes.every(x=>x===30),'三種難度都要出滿 30 題（難度不准減題）, 實得 '+sizes.join('/'));

/* ---------- ② 難度配方：越難，打字題與聽力題越多 ---------- */
w.eval('WORDS.forEach(x=>{ S.stats[x.w]={r:5,x:0,streak:5,due:"2000-01-01"}; });');
function mix(lv){
  setLv(lv);
  const c={};                                   // 動態計數，新題型加進來也不會變 NaN
  for(let i=0;i<40;i++) w.eval('drawRound(pool(),30)').forEach(q=>c[q.kind]=(c[q.kind]||0)+1);
  const all=Object.values(c).reduce((a,b)=>a+b,0);
  const n=k=>(c[k]||0);
  return {hard:(n('type')+n('listen'))/all, type:n('type')/all, listen:n('listen')/all, en2zh:n('en2zh')/all, c};
}
const E=mix('easy'), S_=mix('std'), H=mix('hard');
console.log('  難題（打字+聽力）比例 →',
  ['easy '+(E.hard*100).toFixed(0)+'%','std '+(S_.hard*100).toFixed(0)+'%','hard '+(H.hard*100).toFixed(0)+'%'].join('　'));
ok(H.type>S_.type && S_.type>E.type,`打字題比例要隨難度遞增, 實得 ${E.type.toFixed(2)}/${S_.type.toFixed(2)}/${H.type.toFixed(2)}`);
ok(H.listen>S_.listen && S_.listen>E.listen,
   `聽力題比例要隨難度遞增, 實得 ${E.listen.toFixed(2)}/${S_.listen.toFixed(2)}/${H.listen.toFixed(2)}`);
ok(H.hard>S_.hard && S_.hard>E.hard,'整體難題比例要隨難度遞增');
ok(E.en2zh>H.en2zh,'輕鬆模式的選擇題要比挑戰模式多');
ok(E.type>0,'輕鬆模式仍要出得到打字題（只是少）');

/* ---------- ③ 分鐘倍率 ---------- */
ok(LEVELS.map(l=>l.mul).every((m,i,a)=>i===0||m>a[i-1]),'倍率必須遞增, 實得 '+LEVELS.map(l=>l.mul).join('/'));
LEVELS.forEach(l=>{
  const got=w.eval(`goalMinutes(30,${l.mul})`);
  ok(got===Math.min(REWARD,Math.round(w.eval('tierMinutes(30)')*l.mul)),`${l.id} 30 題 = ${got} 分`);
});
console.log('  30 題可換 →', LEVELS.map(l=>`${l.id} ${w.eval(`goalMinutes(30,${l.mul})`)} 分`).join('　'));
ok(w.eval('goalMinutes(30,LEVELS[2].mul)')>w.eval('goalMinutes(30,LEVELS[0].mul)'),'同樣題數，挑戰要換到比輕鬆多的分鐘');
ok(w.eval('goalMinutes(9999,LEVELS[2].mul)')===REWARD,`再難也不得超過每日上限 ${REWARD} 分`);
// 門檻不變：難度不會讓你少答幾題就達標
LEVELS.forEach(l=>ok(w.eval(`goalMinutes(${TIERS[0].n-1},${l.mul})`)===0,`${l.id}：沒到第一階就是 0 分`));

/* ---------- ④ 不能用輕鬆刷題、最後切挑戰回頭領獎 ---------- */
w.eval('SHARED={days:{},bank:{earned:0,used:0,bonus:0}}; saveShared(); S=blank(); save();');
w.eval('WORDS.forEach(x=>{ S.stats[x.w]={r:5,x:0,streak:5,due:"2000-01-01"}; });');
const answer=()=>{
  const t=$('qKind').textContent;
  if(d.querySelector('#qBody .choice')){
    const aw=w.eval('queue[idx].word.w');
    const bs=[...d.querySelectorAll('#qBody .choice')];
    click(bs.find(x=>x.dataset.w===aw)||bs[0]); click($('btnCheck'));
  }else if(d.querySelector('#qBody .tile')){
    const a=w.eval('queue[idx].word.w').toLowerCase();
    const ts=[...d.querySelectorAll('#qBody .tile')];
    const seq=a.split('').map(c=>ts.find(x=>x.textContent===c&&!x.classList.contains('used')));
    if(seq.every(Boolean)) seq.forEach(click); else ts.slice(0,a.length).forEach(click);
    click($('btnCheck'));
  }else{ $('typed').value=w.eval('queue[idx].word.w'); $('typed').dispatchEvent(new w.Event('input',{bubbles:true})); click($('btnCheck')); }
  click($('btnNext'));
};
const play=(n,lv)=>{
  click(lvBtns().find(b=>b.dataset.lv===lv));
  click(sizeBtns().find(b=>+b.dataset.size===n));
  click($('btnStart'));
  for(let i=0;i<n;i++) answer();
  if($('btnQuit') && !$('qCard').hidden) click($('btnQuit'));
  click($('btnBackHome'));
};
play(10,'easy'); play(10,'easy'); play(10,'easy');   // 輕鬆刷到 30 題
const easyPaid=w.eval('SHARED.days[dayKey()].paid');
const easyExp=w.eval('goalMinutes(30, LEVELS[0].mul * ACC[0].m)');   // 全對 → 答對率也給 ×1.2
ok(easyPaid===easyExp,`輕鬆全對做滿 30 題應得 ${easyExp} 分, 實得 ${easyPaid}`);
// 現在切到挑戰但不再作答 → 已賺的分鐘不得跳上去
click(lvBtns().find(b=>b.dataset.lv==='hard'));
w.eval('checkGoal(SHARED.days[dayKey()])');
ok(w.eval('SHARED.days[dayKey()].paid')===easyPaid,'切難度不得回頭追加已賺的分鐘, 實得 '+w.eval('SHARED.days[dayKey()].paid'));
ok(Math.abs(w.eval('dayMul(SHARED.days[dayKey()])')-LEVELS[0].mul)<0.01,'當天平均倍率應是實際作答時的難度');
// 再用挑戰做 10 題 → 平均倍率往上抬，但不是整天都算挑戰
play(10,'hard');
const mul=w.eval('dayMul(SHARED.days[dayKey()])');
ok(mul>LEVELS[0].mul && mul<LEVELS[2].mul,`混合難度應落在中間, 實得 ${mul.toFixed(2)}`);

/* ---------- ⑤ 出題不重複 ---------- */
w.eval('S=blank(); save();');
const rounds=[];
for(let i=0;i<8;i++) rounds.push(w.eval('drawRound(pool(),30)').map(q=>({w:q.word.w,k:q.kind})));
rounds.forEach((r,i)=>{
  const ws=r.map(x=>x.w);
  ok(new Set(ws).size===ws.length,`第 ${i+1} 輪同一個字不得重複出現`);
});
// 順序：兩兩比較，不該出現一模一樣的排列
let sameOrder=0;
for(let i=0;i<rounds.length;i++) for(let j=i+1;j<rounds.length;j++)
  if(rounds[i].map(x=>x.w).join()===rounds[j].map(x=>x.w).join()) sameOrder++;
ok(sameOrder===0,`不同輪的出題順序不得完全相同, 重複 ${sameOrder} 組`);
// 題型：同一個字在不同輪應該會考到不同題型
const byWord={};
rounds.flat().forEach(x=>(byWord[x.w]=byWord[x.w]||new Set()).add(x.k));
const multi=Object.values(byWord).filter(s=>s.size>1).length;
const repeated=Object.values(byWord).filter(s=>s.size>=1).length;
console.log(`  ${rounds.length} 輪裡有 ${multi} 個字被考到不只一種題型（共出現 ${repeated} 個字）`);
ok(multi>0,'同一個字在不同輪應該要換題型考');
// 錯過的字要優先回鍋，但也不能整輪都同一批
w.eval('S=blank(); save(); WORDS.slice(0,20).forEach(x=>{ S.stats[x.w]={r:0,x:3,streak:0}; });');
const a=w.eval('drawRound(pool(),30)').map(q=>q.word.w);
const b=w.eval('drawRound(pool(),30)').map(q=>q.word.w);
ok(a.join()!==b.join(),'即使有錯題加權，兩輪也不該一模一樣');
ok(a.filter(x=>b.includes(x)).length<a.length,'兩輪不該是同一批字');

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail?1:0);
