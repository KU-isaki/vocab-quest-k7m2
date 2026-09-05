const fs=require('fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/'});
const w=dom.window,d=w.document;
w.onerror=(m)=>errs.push('window.onerror: '+m);
w.addEventListener('error',e=>errs.push('error evt: '+e.message));
w.alert=()=>{}; w.confirm=()=>true;
w.HTMLElement.prototype.scrollIntoView=function(){};
w.scrollTo=()=>{};

const $=id=>d.getElementById(id);
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
const click=el=>{ if(!el) throw new Error('missing element'); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); };

let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++):(fail++,console.log('  ✗ '+m)); };

// 1. 初始渲染
ok(d.querySelectorAll('#catChips .chip').length===38, '分類 chip 應有 38 顆, 實得 '+d.querySelectorAll('#catChips .chip').length);
ok(d.querySelectorAll('#listBody .wrow').length>=1207, '單字表至少 1207 列, 實得 '+d.querySelectorAll('#listBody .wrow').length);

// 2. 開始練習
click($('btnStart'));
ok($('qCard').hidden===false, '題目卡應顯示');
ok($('startCard').hidden===true, '起始卡應隱藏');

// 3. 跑完 10 題（每題都答第一個可選項/檢查）
let kinds={en2zh:0,spell:0,type:0};
for(let i=0;i<R;i++){
  const kind=$('qKind').textContent;
  if(d.querySelector('#qBody .choice')){
    kinds.en2zh++;
    click(d.querySelector('#qBody .choice'));
    click($('btnCheck'));
  }else if((kind.includes('拼英文')||kind.includes('填單字'))){
    kinds.spell++;
    const tiles=[...d.querySelectorAll('#qBody .tile')];
    const slots=d.querySelectorAll('#qBody .slot').length;
    ok(tiles.length>=slots, '字母 tile 數應 >= 空格數');
    tiles.slice(0,slots).forEach(click);
    ok(d.querySelectorAll('#qBody .slot.filled').length===slots, '點滿後每格都該有字母');
    click(d.querySelector('#qBody #btnBack'));
    ok(d.querySelectorAll('#qBody .slot.filled').length===slots-1, '退格應少一格');
    click(tiles.find(t=>!t.classList.contains('used')));
    click($('btnCheck'));
  }else{
    kinds.type++;
    $('typed').value='zzz';
    click($('btnCheck'));
  }
  ok($('qFb').classList.contains('on'), '第'+(i+1)+'題作答後應顯示回饋');
  ok($('fbAnswer').textContent.length>0, '回饋應顯示正確答案');
  click($('btnNext'));
}
ok($('sumCard').hidden===false, '10 題後應顯示本輪成績');
ok($('qCard').hidden===true, '成績頁時題目卡應隱藏');
const done=w.eval('S.done');
ok(done===R, `這個題庫的累積答題應為 ${R}, 實得 `+done);
// 頂端那條講的是「今天還差幾題、換得到幾分鐘」
const hNet=w.eval('netOf(SHARED.days[dayKey()])');
const hTier=w.eval('TIERS').find(t=>hNet<t.n);
if(hTier){
  ok(parseInt($('hNeed').textContent,10)===hTier.n-hNet, `標頭應顯示還差 ${hTier.n-hNet} 題, 實得 `+$('hNeed').textContent);
  ok($('hBar').style.width===(hNet/hTier.n*100)+'%', `進度條應為 ${hNet}/${hTier.n}, 實得 `+$('hBar').style.width);
}else ok($('hScore').textContent.includes('✓'),'到頂要顯示完成標記');

// 4. localStorage 有寫入
const saved=JSON.parse(w.localStorage.getItem('cq-vocab-v1:full'));
ok(saved && saved.done===R, `localStorage 應存下 done=${R}`);
ok(Object.keys(saved.stats).length===R, `應只存 ${R} 個考過的字, 實得 `+Object.keys(saved.stats).length);

// 5. 下一輪
click($('btnAgain'));
ok($('qCard').hidden===false, '下一輪應重新出題');
click($('btnQuit'));
ok($('sumCard').hidden===false, '結束這輪應跳成績頁');
click($('btnBackHome'));
ok($('startCard').hidden===false, '回主畫面');

// 6. 錯題模式
const wrongN=parseInt($('wrongCount').textContent,10);
ok(wrongN>0, '應有錯題數 > 0, 實得 '+wrongN);
click($('btnWrongOnly'));
ok($('qCard').hidden===false, '錯題模式應能開始');
click($('btnQuit')); click($('btnBackHome'));

// 7. 進度頁
click([...d.querySelectorAll('.nav button')].find(b=>b.dataset.view==='vStats'));
ok($('vStats').classList.contains('on'), '進度分頁應切換');
ok(parseInt($('stDone').textContent,10)>0, '進度頁應有答題數');
ok(d.querySelectorAll('#weakList .wrow').length===parseInt($('stWeak').textContent,10), '弱點清單筆數應等於統計數');

// 8. 搜尋
click([...d.querySelectorAll('.nav button')].find(b=>b.dataset.view==='vList'));
$('search').value='happy';
$('search').dispatchEvent(new w.Event('input',{bubbles:true}));
const rows=[...d.querySelectorAll('#listBody .wrow .en')].map(e=>e.textContent);
ok(rows.includes('happy')&&rows.includes('unhappy')&&rows.length===2, '搜尋 happy 應得 2 筆, 實得 '+JSON.stringify(rows));
$('search').value='頭';
$('search').dispatchEvent(new w.Event('input',{bubbles:true}));
ok(d.querySelectorAll('#listBody .wrow').length>=3, '中文搜尋「頭」應有結果, 實得 '+d.querySelectorAll('#listBody .wrow').length);

// 9. 清除紀錄
$('search').value=''; $('search').dispatchEvent(new w.Event('input',{bubbles:true}));
click($('btnReset'));
ok(w.eval('S.done')===0, '清除後歸零');

// 10. 出題型態涵蓋
console.log('  題型分布(第一輪):', JSON.stringify(kinds));
ok(kinds.en2zh>0 && kinds.spell>0, '第一輪應同時出現兩種主要題型');

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
if(errs.length) console.log('JS 執行期錯誤:', errs);
process.exit(fail?1:0);
