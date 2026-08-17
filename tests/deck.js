const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/'});
const w=dom.window,d=w.document; w.alert=m=>console.log('ALERT:',m); w.confirm=()=>true; w.scrollTo=()=>{};
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
const deckBtn=k=>[...d.querySelectorAll('.deck')].find(b=>b.dataset.deck===k);

ok(d.querySelectorAll('.deck').length===2,'應有 2 個題庫卡片');
ok($('hDeck').textContent==='暑假版','預設暑假版, 實得 '+$('hDeck').textContent);
ok(d.querySelectorAll('#catChips .chip').length===6,'暑假版 6 顆 chip');
ok(d.querySelectorAll('#listBody .wrow').length===114,'暑假版 114 字, 實得 '+d.querySelectorAll('#listBody .wrow').length);

// 暑假版答 10 題
const play=(n)=>{ click($('btnStart'));
  for(let i=0;i<n;i++){ const t=$('qKind').textContent;
    if(t.includes('說中文')){ click(d.querySelector('#qBody .choice')); click($('btnCheck')); }
    else if((t.includes('拼英文')||t.includes('填單字'))){ [...d.querySelectorAll('#qBody .tile')].slice(0,d.querySelectorAll('#qBody .slot').length).forEach(click); click($('btnCheck')); }
    else { $('typed').value='q'; click($('btnCheck')); }
    click($('btnNext')); } };
play(R);
ok(w.eval('S.done')===R,`暑假版答 ${R} 題`);

// 切到總整理版
click($('btnBackHome'));
click(deckBtn('full'));
ok($('hDeck').textContent==='總整理版','切換到總整理版');
ok(d.querySelectorAll('#catChips .chip').length===38,'總整理版 38 顆 chip(含全部), 實得 '+d.querySelectorAll('#catChips .chip').length);
ok(w.eval('S.done')===0,'切換後進度獨立歸零, 實得 '+w.eval('S.done'));
click([...d.querySelectorAll('.nav button')].find(b=>b.dataset.view==='vList'));
const rows=d.querySelectorAll('#listBody .wrow').length;
ok(rows>1200,'總整理版單字表 >1200 列(含跨類重複顯示), 實得 '+rows);
ok(d.querySelectorAll('#listBody .tip').length===37,'應有 37 則記憶提示, 實得 '+d.querySelectorAll('#listBody .tip').length);
click([...d.querySelectorAll('.nav button')].find(b=>b.dataset.view==='vQuiz'));
play(R);
ok(w.eval('S.done')===R,`總整理版答 ${R} 題`);

// 切回暑假版，進度應保留
click($('btnBackHome'));
click(deckBtn('summer'));
ok(w.eval('S.done')===R,`切回暑假版進度仍為 ${R}, 實得 `+w.eval('S.done'));
const ls=Object.keys(w.localStorage).filter(k=>k.startsWith('cq-'));
ok(ls.includes('cq-vocab-v1:summer')&&ls.includes('cq-vocab-v1:full'),'兩個題庫各自存檔, 實得 '+JSON.stringify(ls));

// 選擇題不得出現重複中文
click(deckBtn('full'));
let dupOpt=0, checked=0;
for(let r=0;r<9;r++){ click($('btnStart'));
  for(let i=0;i<R;i++){ const t=$('qKind').textContent;
    if(t.includes('說中文')){ const zs=[...d.querySelectorAll('#qBody .choice')].map(b=>b.textContent.slice(1));
      checked++; if(new Set(zs).size!==zs.length) {dupOpt++; if(dupOpt<3) console.log('   重複選項:',zs);}
      click(d.querySelector('#qBody .choice')); click($('btnCheck')); }
    else if((t.includes('拼英文')||t.includes('填單字'))){ [...d.querySelectorAll('#qBody .tile')].slice(0,d.querySelectorAll('#qBody .slot').length).forEach(click); click($('btnCheck')); }
    else { $('typed').value='q'; click($('btnCheck')); }
    click($('btnNext')); } }
ok(dupOpt===0, `選擇題出現重複中文 ${dupOpt} 次 / 共 ${checked} 題`);
console.log(`  (檢查了 ${checked} 題選擇題)`);
console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail?1:0);
