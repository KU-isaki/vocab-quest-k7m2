const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/'});
const w=dom.window,d=w.document; w.alert=()=>{}; w.confirm=()=>true; w.scrollTo=()=>{};
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
const stats=()=>click([...d.querySelectorAll('.nav button')].find(b=>b.dataset.view==='vStats'));
const SW=w.eval('WORDS'); const byZh={}; SW.forEach(x=>(byZh[x.zh]=byZh[x.zh]||[]).push(x.w));
function answer(){ const t=$('qKind').textContent;
  if(d.querySelector('#qBody .choice')){ const aw=w.eval('queue[idx].word.w');
    click([...d.querySelectorAll('#qBody .choice')].find(b=>b.dataset.w===aw)); click($('btnCheck')); }
  else { const a=w.eval('queue[idx].word.w');
    if((t.includes('拼英文')||t.includes('填單字'))){ const ts=[...d.querySelectorAll('#qBody .tile')];
      const seq=a.toLowerCase().split('').map(c=>ts.find(x=>x.textContent===c&&!x.classList.contains('used')));
      if(seq.every(Boolean)) seq.forEach(click); click($('btnCheck')); }
    else { $('typed').value=a; click($('btnCheck')); } }
  click($('btnNext')); }

// 答 10 題後今天應有紀錄
click($('btnStart')); for(let i=0;i<R;i++) answer();
click($('btnBackHome'));
const todayK=w.eval('dayKey()');
const S=JSON.parse(w.localStorage.getItem('cq-vocab-v1:full'));
const shared=w.eval('SHARED');
ok(shared.days && shared.days[todayK],'今天應留下日曆紀錄');
ok(shared.days[todayK].n===R,`今天題數應為 ${R}, 實得 `+(shared.days[todayK]||{}).n);
ok(shared.days[todayK].r===R,`今天答對數應為 ${R}`);

stats();
// 預設應該是「這個月」——半年那張在手機上一定要左右捲
const modeBtn=v=>[...d.querySelectorAll('#calMode .chip')].find(b=>b.dataset.cal===v);
ok(!!modeBtn('month')&&!!modeBtn('half'),'應有兩種檢視可切換');
ok(modeBtn('month').getAttribute('aria-pressed')==='true','預設應為月檢視');
ok($('calMonthView').hidden===false,'月檢視應顯示');
ok($('ghwrap').hidden===true,'半年熱力圖預設應收起來');
ok(d.querySelectorAll('#calMonthGrid .wd').length===7,'月檢視要有星期標頭');
const mcells=()=>[...d.querySelectorAll('#calMonthGrid .mcell:not(.pad)')];
const now=new Date(), lenM=new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
ok(mcells().length===lenM,`這個月應有 ${lenM} 格, 實得 `+mcells().length);
ok(mcells().every(c=>/^\d+$/.test(c.textContent)),'月檢視每格要寫日期數字');
ok($('calTitle').textContent.includes(String(now.getMonth()+1)+' 月'),'標題要寫哪一個月, 實得 '+$('calTitle').textContent);
ok($('calNext').disabled,'不能往未來翻月');
ok(!$('calPrev').disabled,'可以往回翻月');
const mToday=d.querySelector('#calMonthGrid .mcell.today');
ok(!!mToday,'月檢視要標出今天');
ok(/l[1-4]/.test(mToday.className),'今天有練習應該上色, class='+mToday.className);
ok($('calSum').textContent.includes('題'),'月檢視要有當月小結, 實得 '+$('calSum').textContent);
// aspect-ratio 的自動最小尺寸會回頭把欄寬撐大，7 欄就會跑出畫面（實測 568px 塞進 358px）
const css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
const mg=/\.mgrid\{([^}]*)\}/.exec(css);
ok(mg && /minmax\(\s*0\s*,\s*1fr\s*\)/.test(mg[1]),
   '月格子的欄寬必須用 minmax(0,1fr)，否則會被 aspect-ratio 撐爆, 實得 '+(mg?mg[1]:'(沒有 .mgrid)'));
const mc=/\.mcell\{([^}]*)\}/.exec(css);
ok(mc && /aspect-ratio/.test(mc[1]),'格子要維持正方形');
ok(mc && /min-width:\s*0/.test(mc[1]) && /min-height:\s*0/.test(mc[1]),
   '有 aspect-ratio 的格子要把 min-width / min-height 歸零, 實得 '+(mc?mc[1]:''));
ok(/repeat\(7/.test(mg[1]),'一列要正好七天');
// 往回翻一個月：格數要跟著那個月變、也不該還標著今天
const prevLen=new Date(now.getFullYear(), now.getMonth(), 0).getDate();
click($('calPrev'));
ok(mcells().length===prevLen,`上個月應有 ${prevLen} 格, 實得 `+mcells().length);
ok(!d.querySelector('#calMonthGrid .mcell.today'),'翻到別的月份就不該再標今天');
ok(!$('calNext').disabled,'翻到過去後應該可以再翻回來');
click($('calNext'));
ok($('calTitle').textContent.includes(String(now.getMonth()+1)+' 月'),'翻回本月');

// 切到半年熱力圖
click(modeBtn('half'));
ok($('ghwrap').hidden===false,'切換後半年圖要出現');
ok($('calMonthView').hidden===true,'月檢視要收起來');
ok(w.localStorage.getItem('cq-cal')==='half','選擇要記住');
const cells=[...d.querySelectorAll('#calGrid .cell:not(.pad)')];
ok(cells.length>0,'應畫出日曆格子');
const today=d.querySelector('#calGrid .cell.today');
ok(!!today,'今天要標記出來');
ok(/l[1-4]/.test(today.className),'今天有練習應該上色, class='+today.className);
ok($('calStreak').textContent.includes('今天有練')||$('calStreak').textContent.includes('連續'),'應顯示連續天數, 實得 '+$('calStreak').textContent);
ok(d.querySelectorAll('#calGrid .cell').length%7===0,'格子數應為 7 的倍數（每欄一週）');
ok(!d.querySelector('#calGrid .cell[data-day]:not(.pad)')||true,'');

// 未來的日子不該可點
const future=[...d.querySelectorAll('#calGrid .cell.pad')];
ok(future.every(c=>c.tagName!=='BUTTON'),'未來日期不該做成可點按鈕');

// 手動塞歷史紀錄測試連續天數與深淺
const mk=off=>{const t=new Date(); t.setDate(t.getDate()-off); return w.eval(`dayKey(new Date(${t.getFullYear()},${t.getMonth()},${t.getDate()}))`);};
w.eval(`SHARED.days["${mk(1)}"]={n:45,r:40}; SHARED.days["${mk(2)}"]={n:25,r:20}; SHARED.days["${mk(3)}"]={n:12,r:10}; SHARED.days["${mk(5)}"]={n:3,r:3};`);
w.eval('renderCal()');
ok($('calStreak').textContent.includes('連續 4 天'),'連續天數應為 4（今天+前3天）, 實得 '+$('calStreak').textContent);
const cls=k=>{const el=d.querySelector(`#calGrid [data-day="${k}"]`); return el?el.className:'(不在範圍)';};
console.log('   45題→',cls(mk(1)).trim(),'\n   25題→',cls(mk(2)).trim(),'\n   12題→',cls(mk(3)).trim(),'\n    3題→',cls(mk(5)).trim());
ok(/l4/.test(cls(mk(1))),'45 題應為最深');
ok(/l3/.test(cls(mk(2))),'25 題應為 l3');
ok(/l2/.test(cls(mk(3))),'12 題應為 l2');
ok(/l1/.test(cls(mk(5))),'3 題應為 l1');

// 點格子
click(d.querySelector(`#calGrid [data-day="${todayK}"]`));
ok($('toast').textContent.includes(R+' 題'),'點今天要顯示當天紀錄, 實得 '+$('toast').textContent);

// 清除「題庫紀錄」不該動到共用的日曆與存摺
click($('btnReset'));
ok(!!d.querySelector('#calGrid .cell.l1, #calGrid .cell.l2, #calGrid .cell.l3, #calGrid .cell.l4'),
   '清除題庫紀錄後，共用的日曆應該保留');
ok($('stDone').textContent==='0','但該題庫的答題統計要歸零');

// 要有獨立的方式清除共用紀錄
ok(!!$('btnResetShared'),'應有「清除日曆與遊戲時間」的按鈕');
click($('btnResetShared'));
ok(!d.querySelector('#calGrid .cell.l1, #calGrid .cell.l2, #calGrid .cell.l3, #calGrid .cell.l4'),'清除後日曆應全空');
ok($('calStreak').textContent==='','清除後不該還顯示連續天數');
ok($('bankLeft').textContent==='0','清除後存摺應歸零');

// 月檢視也要跟著清空
click(modeBtn('month'));
ok(!d.querySelector('#calMonthGrid .mcell.l1, #calMonthGrid .mcell.l2, #calMonthGrid .mcell.l3, #calMonthGrid .mcell.l4'),
   '清除後月檢視也要全空');
ok($('calSum').textContent.includes('還沒有'),'當月小結要顯示沒有紀錄, 實得 '+$('calSum').textContent);
click(modeBtn('half'));

// 舊版存檔（沒有 days / bank）不能壞
w.localStorage.setItem('cq-vocab-v1:full', JSON.stringify({done:5,right:4,stats:{happy:{r:1,x:0,streak:1}}}));
w.eval('useDeck(); renderStats();');
ok($('stDone').textContent==='1','舊存檔要能載入');
ok(d.querySelectorAll('#calGrid .cell').length>0,'舊存檔也要能畫出日曆');
ok($('bankLeft').textContent==='0','舊存檔的存摺應預設為 0');

// 加在格子上的修飾 class 必須是「有前綴限定」的規則，不能有裸的 .x{...}
// （曾經把達標格子取名 .met 之前叫 .goal，撞到每日目標區塊的 .goal{margin:16px 0 14px}，格子被推低 16px）
w.eval(`SHARED.days["${todayK}"]={n:30,r:30,mw:30,paid:15}; saveShared(); renderCal();`);
click(modeBtn('month'));
const mods=new Set();
[...d.querySelectorAll('#calMonthGrid .mcell, #calGrid .cell')].forEach(c=>
  c.classList.forEach(x=>{ if(x!=='mcell' && x!=='cell') mods.add(x); }));
console.log('  格子上的修飾 class:', [...mods].join(' '));
ok(mods.size>0,'應該抓得到修飾 class');
const bare=[...mods].filter(c=>new RegExp(`(^|[,}])\\s*\\.${c}\\s*\\{`,'m').test(css));
ok(bare.length===0,'這些 class 有裸規則，會被頁面其他地方誤套用: '+bare.join(', '));

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail?1:0);
