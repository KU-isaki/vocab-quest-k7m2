/* 防誤按：沒拼滿不能按「檢查」，作答區與按鈕要有距離 */
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

click($('btnStart'));
let kind='';
for(let i=0;i<200;i++){
  kind=$('qKind').textContent;
  if(kind.includes('拼英文')) break;
  if(d.querySelector('#qBody .choice')) click(d.querySelector('#qBody .choice'));
  else if(d.querySelector('#qBody .tile')){
    const ts=[...d.querySelectorAll('#qBody .tile')];
    ts.slice(0,d.querySelectorAll('#qBody .slot').length).forEach(click);
    click($('btnCheck'));
  } else if($('typed')){
    $('typed').value='z'; $('typed').dispatchEvent(new w.Event('input',{bubbles:true})); click($('btnCheck'));
  }
  if($('btnNext')) click($('btnNext'));
  if($('qCard').hidden && $('btnAgain')) click($('btnAgain'));
}
ok(kind.includes('拼英文'),'應該找得到拼字題');

const slots=d.querySelectorAll('#qBody .slot').length;
const tiles=[...d.querySelectorAll('#qBody .tile')];
ok(slots>1,'應有字母格, 實得 '+slots);
ok(tiles.length>=slots,'字母數要夠拼');

// ① 一開始不能按
ok($('btnCheck').disabled,'還沒拼就不能按檢查');
ok($('btnCheck').textContent.includes(`還差 ${slots}`),`應提示還差 ${slots} 個字母, 實得 `+$('btnCheck').textContent);
ok($('btnBack').disabled,'沒東西可退時退格鍵要停用');

// ② 誤按不得送出
click($('btnCheck'));
ok(!$('qFb').classList.contains('on'),'停用時按下去不得作答');

// ③ 逐格拼，每一步都要正確反映還差幾格
for(let i=0;i<slots;i++){
  click(tiles[i]);
  const left=slots-i-1;
  ok(d.querySelectorAll('#qBody .slot.filled').length===i+1,`點第 ${i+1} 個字母後應填 ${i+1} 格`);
  if(left>0){
    ok($('btnCheck').disabled,`還差 ${left} 格時不能按`);
    ok($('btnCheck').textContent.includes(`還差 ${left}`),`應顯示還差 ${left} 個, 實得 `+$('btnCheck').textContent);
  }
}
// ④ 拼滿才啟用
ok(!$('btnCheck').disabled,'拼滿後才可以按');
ok($('btnCheck').textContent==='檢查','拼滿後文字回到「檢查」, 實得 '+$('btnCheck').textContent);
ok(!$('btnBack').disabled,'退格鍵可用');

// ⑤ 退一格又停用
click($('btnBack'));
ok($('btnCheck').disabled,'退一格後又不能按');
ok(d.querySelectorAll('#qBody .slot.filled').length===slots-1,'退格要少一格');

// ⑥ 補回來就能正常作答
click(tiles.find(t=>!t.classList.contains('used')));
click($('btnCheck'));
ok($('qFb').classList.contains('on'),'拼滿後按檢查要能正常作答');

// ⑦ 版面距離
const css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
const m=css.match(/\.spellbar\{[^}]*margin-top:(\d+)px/);
ok(m && +m[1]>=24, `作答區與按鈕距離應 >=24px, 實得 ${m?m[1]:'未設定'}px`);

// ⑧ 打字題：空白不能送出
click($('btnNext'));
let typed=null;
for(let i=0;i<200 && !typed;i++){
  if($('typed')){ typed=$('typed'); break; }
  if(d.querySelector('#qBody .choice')) click(d.querySelector('#qBody .choice'));
  else if(d.querySelector('#qBody .tile')){
    const ts=[...d.querySelectorAll('#qBody .tile')];
    ts.slice(0,d.querySelectorAll('#qBody .slot').length).forEach(click);
    click($('btnCheck'));
  }
  if($('btnNext')) click($('btnNext'));
  if($('qCard').hidden && $('btnAgain')) click($('btnAgain'));
}
if(typed){
  ok($('btnCheck').disabled,'打字題沒輸入時不能按檢查');
  typed.value='a'; typed.dispatchEvent(new w.Event('input',{bubbles:true}));
  ok(!$('btnCheck').disabled,'有輸入後才可以按');
  typed.value='   '; typed.dispatchEvent(new w.Event('input',{bubbles:true}));
  ok($('btnCheck').disabled,'只有空白也不能按');
}else console.log('  （這輪沒抽到打字題，略過該段）');

// ⑨ 停用的按鈕要看起來就是停用（不能長得跟可按的一樣）
const disabledRule=/\.btn:disabled\{[^}]*\}/.exec(css);
ok(!!disabledRule,'應有 .btn:disabled 樣式，否則停用時看起來仍可按');
ok(disabledRule && /background/.test(disabledRule[0]),'停用樣式要改變背景色, 實得 '+(disabledRule?disabledRule[0]:''));

// ⑩ 破壞性操作要有家長密碼把關，避免誤觸
click([...d.querySelectorAll('.nav button')].find(b=>b.dataset.view==='vStats'));
w.eval('S.done=42; S.stats={happy:{r:1,x:0,streak:1}}; save();');
w.eval('SHARED.days["2026-08-01"]={n:30,r:28,paid:15}; SHARED.bank={earned:15,used:0,bonus:0}; saveShared();');
w.prompt=()=>'1234';
click($('btnPin'));                       // 設定家長密碼
ok(w.eval('getPin()')==='1234','先設好家長密碼');

// 密碼錯 → 兩種清除都不得執行
w.prompt=()=>'0000';
click($('btnReset'));
ok(w.eval('S.done')===42,'密碼錯不得清除題庫紀錄, 實得 '+w.eval('S.done'));
click($('btnResetShared'));
ok(!!w.eval('SHARED.days["2026-08-01"]'),'密碼錯不得清除日曆');
ok(w.eval('SHARED.bank.earned')===15,'密碼錯不得清除存摺');

// 取消輸入（按 Esc）也不得執行
w.prompt=()=>null;
click($('btnReset'));
ok(w.eval('S.done')===42,'取消輸入密碼不得清除');
click($('btnResetShared'));
ok(!!w.eval('SHARED.days["2026-08-01"]'),'取消輸入密碼不得清除日曆');

// 密碼對才清除，而且各清各的
w.prompt=()=>'1234';
click($('btnReset'));
ok(w.eval('S.done')===0,'密碼正確才清除題庫紀錄');
ok(!!w.eval('SHARED.days["2026-08-01"]'),'清題庫紀錄不該動到共用日曆');
ok(w.eval('SHARED.bank.earned')===15,'清題庫紀錄不該動到存摺');
click($('btnResetShared'));
ok(!w.eval('SHARED.days["2026-08-01"]'),'密碼正確才清除日曆');
ok(w.eval('SHARED.bank.earned')===0,'存摺也要清掉');

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail?1:0);
