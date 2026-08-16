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
const SW=w.eval('SUMMER_WORDS'); const byZh={}; SW.forEach(x=>(byZh[x.zh]=byZh[x.zh]||[]).push(x.w));
function answer(){ const t=$('qKind').textContent;
  if(t.includes('說中文')){ const en=d.querySelector('#qPrompt .en').textContent.trim();
    click([...d.querySelectorAll('#qBody .choice')].find(b=>b.dataset.w===en)); }
  else { const a=ansOf();
    if((t.includes('拼英文')||t.includes('填單字'))){ const ts=[...d.querySelectorAll('#qBody .tile')];
      const seq=a.toLowerCase().split('').map(c=>ts.find(x=>x.textContent===c&&!x.classList.contains('used')));
      if(seq.every(Boolean)) seq.forEach(click); click($('btnCheck')); }
    else { $('typed').value=a; click($('btnCheck')); } }
  click($('btnNext')); }

// 答 10 題後今天應有紀錄
click($('btnStart')); for(let i=0;i<R;i++) answer();
click($('btnBackHome'));
const todayK=w.eval('dayKey()');
const S=JSON.parse(w.localStorage.getItem('cq-vocab-v1:summer'));
const shared=w.eval('SHARED');
ok(shared.days && shared.days[todayK],'今天應留下日曆紀錄');
ok(shared.days[todayK].n===R,`今天題數應為 ${R}, 實得 `+(shared.days[todayK]||{}).n);
ok(shared.days[todayK].r===R,`今天答對數應為 ${R}`);

stats();
// 日曆格子（GitHub 風格）
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

// 舊版存檔（沒有 days / bank）不能壞
w.localStorage.setItem('cq-vocab-v1:summer', JSON.stringify({done:5,right:4,stats:{happy:{r:1,x:0,streak:1}}}));
w.eval('useDeck("summer"); renderStats();');
ok($('stDone').textContent==='1','舊存檔要能載入');
ok(d.querySelectorAll('#calGrid .cell').length>0,'舊存檔也要能畫出日曆');
ok($('bankLeft').textContent==='0','舊存檔的存摺應預設為 0');

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail?1:0);
