const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/'});
const w=dom.window,d=w.document; w.alert=()=>{}; w.scrollTo=()=>{};
w.HTMLElement.prototype.scrollIntoView=function(){};
const $=id=>d.getElementById(id), click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('  ✗ '+m))};
const disp=el=>w.getComputedStyle(el).display;

// 所有 hidden 元素的實際 display 必須是 none —— 這次的 bug 就出在這
console.log('=== 載入時所有 [hidden] 元素的實際顯示狀態 ===');
[...d.querySelectorAll('[hidden]')].forEach(el=>{
  const id=el.id||el.className||el.tagName;
  const dd=disp(el);
  console.log(`   ${id.padEnd(14)} display=${dd}`);
  ok(dd==='none', `${id} 有 hidden 卻仍然顯示 (display=${dd})`);
});
ok(d.querySelectorAll('[hidden]').length>=3,'應該有數個預設隱藏的元素');

// 反向：切換 hidden 後要真的顯示得出來
$('sheet').hidden=false;
ok(disp($('sheet'))!=='none','取消 hidden 後面板要顯示得出來');
$('sheet').hidden=true;
ok(disp($('sheet'))==='none','再設回 hidden 要藏起來');

// 開始練習後題目卡要顯示、起始卡要藏
click($('btnStart'));
ok(disp($('qCard'))!=='none','題目卡要顯示');
ok(disp($('startCard'))==='none','起始卡要隱藏');
ok(disp($('qFb'))==='none','作答前回饋區要隱藏');
// 依題型正確作答（拼字題要先拼滿，不然新的防誤按機制會擋下來）
if(d.querySelector('#qBody .choice')){ click(d.querySelector('#qBody .choice')); click($('btnCheck')); }
else if(d.querySelector('#qBody .tile')){
  const ts=[...d.querySelectorAll('#qBody .tile')];
  ts.slice(0,d.querySelectorAll('#qBody .slot').length).forEach(click);
  click($('btnCheck'));
} else if($('typed')){
  $('typed').value='z'; $('typed').dispatchEvent(new w.Event('input',{bubbles:true}));
  click($('btnCheck'));
}
ok(disp($('qFb'))!=='none','作答後回饋區要顯示');

// 單字表說明預設收合
click([...d.querySelectorAll('.nav button')].find(b=>b.dataset.view==='vList'));
const n1=d.querySelector('#listBody .note');
ok(disp(n1)==='none','單字表說明預設要收合');
click(d.querySelector('#listBody .ex'));
ok(disp(n1)!=='none','點展開鈕要看得到說明');

// 分頁切換
ok(disp($('vList'))!=='none' && disp($('vQuiz'))==='none','分頁切換要正確');

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail?1:0);
