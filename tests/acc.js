/* 答對率影響遊戲時間
   淨題數只扣一次；不加這層的話「猜錯再多做幾題補回來」還是划算。
   這裡驗的是：同樣的淨題數，錯得多就是拿得少。 */
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

const ACC=w.eval('ACC'), TIERS=w.eval('TIERS'), REWARD=w.eval('REWARD');
const day=(n,r)=>({n,r});
const accOf=o=>w.eval('accOf('+JSON.stringify(o)+')');
const accMul=o=>w.eval('accMul('+JSON.stringify(o)+')');
const mins=o=>w.eval('dayMinutes('+JSON.stringify(o)+')');

/* ---------- ① 級距本身 ---------- */
console.log('  答對率級距:', ACC.map(t=>`${Math.round(t.p*100)}%↑ ×${t.m}`).join(' · '));
ok(ACC.every((t,i)=>i===0||t.m<ACC[i-1].m),'倍率必須隨答對率遞減, 實得 '+ACC.map(t=>t.m).join('/'));
ok(ACC.every((t,i)=>i===0||t.p<ACC[i-1].p),'門檻必須遞減，否則永遠命中第一條');
ok(ACC[ACC.length-1].p===0,'最後一條要接住所有情況（門檻 0）');
ok(ACC[0].m>1,'全對要有獎勵（>1）');
ok(ACC[ACC.length-1].m<1,'錯太多要有懲罰（<1）');

ok(accOf(day(0,0))===1,'還沒作答當 100%，不先扣人分數');
ok(accOf(day(10,10))===1,'全對 = 100%');
ok(Math.abs(accOf(day(10,7))-0.7)<1e-9,'對 7 錯 3 = 70%');
ACC.forEach(t=>{
  const n=1000, r=Math.round(t.p*n);          // 剛好踩在門檻上
  ok(accMul(day(n,r))===t.m,`答對率 ${Math.round(t.p*100)}% 應為 ×${t.m}, 實得 `+accMul(day(n,r)));
});
ok(accMul(day(100,94))===ACC[1].m,`94% 應掉到 ×${ACC[1].m}（差一點點也要掉）, 實得 `+accMul(day(100,94)));

/* ---------- ② 同樣淨題數，錯越多拿越少 ---------- */
// 淨 30 題的三種走法：全對 30、對 40 錯 10、對 60 錯 30
const cases=[day(30,30), day(50,40), day(90,60)];
cases.forEach(c=>ok(w.eval('netOf('+JSON.stringify(c)+')')===30,`${c.r}/${c.n} 的淨題數應為 30`));
const got=cases.map(mins);
console.log('  淨 30 題 →',
  cases.map((c,i)=>`對${c.r}錯${c.n-c.r}（${Math.round(c.r/c.n*100)}%）${got[i]} 分`).join('　'));
ok(got[0]>got[1] && got[1]>got[2],`同樣淨 30 題，錯越多要拿越少, 實得 ${got.join('/')}`);

// 硬刷題數也不能繞過：淨題數升一階、但答對率掉一級，未必划算
const before=mins(day(20,20));                 // 淨 20、100%
const after=mins(day(34,27));                  // 淨 20、約 79%
ok(after<before,`亂猜補題數不得比穩穩答還多, ${before} → ${after}`);

/* ---------- ③ 上限與下限 ---------- */
ok(mins(day(9999,9999))===REWARD,`再高的答對率也不得超過每日上限 ${REWARD} 分`);
ok(mins(day(TIERS[0].n-1,TIERS[0].n-1))===0,'沒到第一階，答對率再高也是 0 分');
ok(mins(day(20,2))===0,'錯比對多 → 淨 0 → 0 分');
ok(mins(day(60,40))>=0,'再差也不得算出負分');

/* ---------- ④ 實際作答：答錯會即時把分鐘扣回來 ---------- */
const bank=()=>w.eval('SHARED.bank.earned');
const paid=()=>w.eval('paidOf(SHARED.days[dayKey()])');
function answer(right){
  if(d.querySelector('#qBody .choice')){
    const aw=w.eval('queue[idx].word.w');
    const bs=[...d.querySelectorAll('#qBody .choice')];
    click((right? bs.find(x=>x.dataset.w===aw) : bs.find(x=>x.dataset.w!==aw))||bs[0]);
    click($('btnCheck'));
  }else if(d.querySelector('#qBody .tile')){
    const a=w.eval('queue[idx].word.w').toLowerCase();
    const ts=[...d.querySelectorAll('#qBody .tile')];
    const n=d.querySelectorAll('#qBody .slot').length;
    if(right){
      const seq=a.split('').map(c=>ts.find(x=>x.textContent===c&&!x.classList.contains('used')));
      if(seq.every(Boolean)) seq.forEach(click); else ts.slice(0,n).forEach(click);
    }else ts.slice(0,n).reverse().forEach(click);
    click($('btnCheck'));
  }else{
    $('typed').value = right ? w.eval('queue[idx].word.w') : 'zzzz';
    $('typed').dispatchEvent(new w.Event('input',{bubbles:true}));
    click($('btnCheck'));
  }
  click($('btnNext'));
}
const pickN=n=>click([...d.querySelectorAll('#sizeRow .chip')].find(b=>+b.dataset.size===n));
w.eval('SHARED={days:{},bank:{earned:0,used:0,bonus:0}}; saveShared(); S=blank(); save();');

pickN(30); click($('btnStart'));
for(let i=0;i<30;i++) answer(true);            // 全對 30 題
click($('btnBackHome'));
const perfect30=bank();
ok(perfect30===w.eval('goalMinutes(30, LV.mul * ACC[0].m)'),`全對 30 題應含答對率加成, 實得 ${perfect30}`);
ok($('heroGoal').textContent.includes('答對率 100%'),'主畫面要顯示今日答對率, 實得 '+$('heroGoal').textContent);
ok($('heroGoal').textContent.includes(`×${ACC[0].m}`),'主畫面要顯示答對率倍率');

// 再答錯一批：淨題數掉、答對率也掉 → 分鐘要跟著掉
pickN(30); click($('btnStart'));
for(let i=0;i<12;i++) answer(false);
click($('btnQuit')); click($('btnBackHome'));
const afterWrong=bank();
const rec=w.eval('SHARED.days[dayKey()]');
console.log(`  對 ${rec.r} 錯 ${rec.n-rec.r}（${Math.round(rec.r/rec.n*100)}%）→ ${afterWrong} 分鐘（原本 ${perfect30}）`);
ok(afterWrong<perfect30,`答錯後分鐘要被扣回來（${perfect30} → ${afterWrong}）`);
ok(afterWrong>=0,'扣回來不得變負數');
ok(paid()===afterWrong,'當日已發放的分鐘要跟存摺一致');
ok(w.eval('dayMinutes(SHARED.days[dayKey()])')===afterWrong,'存摺金額要等於當下重算的結果');
ok(w.eval('accMul(SHARED.days[dayKey()])')<ACC[0].m,'答對率倍率應該已經掉下來');

// 進度頁要把答對率跟倍率寫清楚
click([...d.querySelectorAll('.nav button')].find(b=>b.dataset.view==='vStats'));
ok(/答對率 \d+%/.test($('goalNum').textContent),'進度頁要顯示今日答對率, 實得 '+$('goalNum').textContent);
ok(ACC.some(t=>$('goalNum').textContent.includes(t.name)),'要標出目前落在哪一級, 實得 '+$('goalNum').textContent);
ok($('tierHint').textContent.includes('答對率'),'說明區要解釋答對率倍率');
// 加了答對率之後這行變長，不能再整行 nowrap，否則右邊會被切掉
const css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
ok(!/\.goal-head span\{[^}]*white-space:\s*nowrap/.test(css),
   '.goal-head 的整段不得 nowrap（文字變長會被切掉）');
ok(/\.goal-head \.seg\{[^}]*white-space:\s*nowrap/.test(css),'小段要 nowrap，數字才不會被折斷');
ok(d.querySelectorAll('#goalNum .seg').length>=4,'進度頁那行應該分成多段, 實得 '+d.querySelectorAll('#goalNum .seg').length);
ok(d.querySelectorAll('#heroGoal .seg').length>=3,'主畫面那行也要分段');
ACC.forEach(t=>ok($('tierHint').textContent.includes('×'+t.m),`說明要列出 ×${t.m} 這一級`));

/* ---------- ⑤ 頂端那條要看得懂 ---------- */
// 舊版是「已答 0/100」（第一版殘留，做超過就變成 347/100），
// 再上一版是「今天 0/10 題」——沒說 10 是什麼，門檻一跳還像進度歸零。
ok(!/\/100</.test(html.split('</header>')[0]),'標頭不得再寫死 /100 這種永遠追不完的分母');
const hTxt=()=>$('hScore').textContent;
const TIERS2=w.eval('TIERS');
[0,5,12,25].forEach(r=>{
  w.eval(`SHARED.days[dayKey()]={n:${r},r:${r},mw:${r}}; refreshHeader();`);
  const tier=TIERS2.find(t=>r<t.n);
  const need=tier.n-r;
  ok(parseInt($('hNeed').textContent,10)===need,`淨 ${r} 題時應顯示還差 ${need} 題, 實得 `+$('hNeed').textContent);
  ok(+$('hGain').textContent>0,'要講清楚換得到幾分鐘, 實得 '+$('hGain').textContent);
  ok(hTxt().includes('題')&&hTxt().includes('分'),'單位要寫出來, 實得 '+hTxt());
  ok(!/\d+\s*\/\s*\d+/.test(hTxt()),'不要再用看不懂的 X/Y 寫法, 實得 '+hTxt());
  ok($('hBar').style.width===(r/tier.n*100)+'%',`進度條應為 ${r}/${tier.n}, 實得 `+$('hBar').style.width);
  ok(/淨 \d+ 題/.test($('hScore').title),'長按/滑過要看得到今天實際做了幾題, 實得 '+$('hScore').title);
});
// 顯示的分鐘數要跟真的會拿到的一致
w.eval('SHARED.days[dayKey()]={n:12,r:12,mw:12}; refreshHeader();');
const tier2=TIERS2.find(t=>12<t.n);
ok(+$('hGain').textContent===w.eval(`goalMinutes(${tier2.n}, projMul(SHARED.days[dayKey()], ${tier2.n-12}) * accStep(projAcc(SHARED.days[dayKey()], ${tier2.n-12})).m)`),
   '標頭寫的分鐘要等於真的算出來的, 實得 '+$('hGain').textContent);
// 到頂之後不能還叫人再答題
const top=TIERS2[TIERS2.length-1].n+15;
w.eval(`SHARED.days[dayKey()]={n:${top},r:${top},mw:${top}}; refreshHeader();`);
ok(!hTxt().includes('再答對'),'到頂就不該再叫人答題, 實得 '+hTxt());
ok(hTxt().includes('✓'),'到頂要有完成標記, 實得 '+hTxt());
ok($('hBar').style.width==='100%','到頂進度條要滿格');

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail?1:0);
