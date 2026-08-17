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
const SW=w.eval('SUMMER_WORDS'); const byZh={}; SW.forEach(x=>(byZh[x.zh]=byZh[x.zh]||[]).push(x.w));
// n 題答對, 之後可選擇中途結束
function answer(correct){
  const t=$('qKind').textContent;
  if(t.includes('說中文')){
    const en=d.querySelector('#qPrompt .en').textContent.trim();
    const bs=[...d.querySelectorAll('#qBody .choice')];
    click(correct? bs.find(b=>b.dataset.w===en) : bs.find(b=>b.dataset.w!==en));
    click($('btnCheck'));   // 選完要按檢查才送出
  } else {
    const ans=ansOf();
    if((t.includes('拼英文')||t.includes('填單字'))){
      const tiles=[...d.querySelectorAll('#qBody .tile')];
      const seq= correct ? ans.toLowerCase().split('').map(c=>tiles.find(x=>x.textContent===c&&!x.classList.contains('used')))
                         : tiles.slice(0,d.querySelectorAll('#qBody .slot').length);
      if(seq.every(Boolean)) seq.forEach(click);
      click($('btnCheck'));
    } else { $('typed').value= correct?ans:'zzzz'; click($('btnCheck')); }
  }
}

// ① 中途結束：答 4 題全對就退出
click($('btnStart'));
for(let i=0;i<4;i++){ answer(true); click($('btnNext')); }
click($('btnQuit'));
ok($('sumScore').textContent==='4','分子應為 4, 實得 '+$('sumScore').textContent);
ok($('sumTotal').textContent==='/4','分母應為實際答題數 4, 實得 '+$('sumTotal').textContent);
ok(!/10/.test($('sumTotal').textContent),'分母不得寫死 10');
const rep=w.eval('reportText(true)');
console.log('  ── 提早結束的訊息 ──\n'+rep.split('\n').map(s=>'    '+s).join('\n'));
ok(rep.includes('4 / 4'),'訊息分母要跟實際一致');
ok(rep.includes('提早結束'),'提早結束要標示出來');
ok(!new RegExp('4 / '+R).test(rep),'訊息不得出現假分母');
ok(/全對/.test(rep),'4 題全對仍應說全對');
const line1=rep.split('\n')[1];
ok(!( /全對/.test(rep) && new RegExp('/ '+R).test(line1) ),'不得同時出現「全對」和滿分分母的矛盾, 實得 '+line1);

// ② 答題中途（該題還沒作答）就結束 → 不該算那一題
click($('btnBackHome')); click($('btnStart'));
answer(true); click($('btnNext'));   // 答完第 1 題
click($('btnQuit'));                 // 第 2 題還沒作答就退出
ok($('sumTotal').textContent==='/1','未作答的題不該算進去, 實得 '+$('sumTotal').textContent);

// ③ 一題都沒答就結束
click($('btnBackHome')); click($('btnStart')); click($('btnQuit'));
ok($('sumTotal').textContent==='/0','沒作答應為 /0, 實得 '+$('sumTotal').textContent);
ok($('sumTitle').textContent.includes('還沒作答'),'應提示還沒作答');

// ④ 待加強清單每輪都要顯示（即使這輪全對）
click($('btnBackHome')); click($('btnStart'));
for(let i=0;i<R;i++){ answer(i===0?false:true); click($('btnNext')); }  // 錯 1 題
ok(!$('sumWeak').hidden,'有待加強的字時要顯示區塊');
const n1=d.querySelectorAll('#sumWeak .ws button').length;
ok(n1>0,'待加強清單要列出單字, 實得 '+n1);
click($('btnAgain'));
for(let i=0;i<R;i++){ answer(true); click($('btnNext')); }              // 這輪全對
ok(!$('sumWeak').hidden,'這輪全對時，之前沒學會的字仍要顯示');
console.log('  這輪全對時仍列出:', [...d.querySelectorAll('#sumWeak .ws button')].map(b=>b.textContent).join('、')||'(無)');
const rep2=w.eval('reportText(true)');
ok(/還要加強 \d+ 字：|沒有待加強/.test(rep2),'訊息要列出待加強的字而不只是數量');
console.log('  ── 全對那輪的訊息 ──\n'+rep2.split('\n').map(s=>'    '+s).join('\n'));

// ⑤ 答對率必須等於 累積答對/累積答題
const S=JSON.parse(w.localStorage.getItem('cq-vocab-v1:summer'));
const expect=Math.round(S.right/S.done*100);
ok(rep2.includes(`答對率 ${expect}%`),`答對率應為 ${expect}%（${S.right}/${S.done}）`);
ok(rep2.includes(`累積：${S.done} 題`),'累積題數要跟實際一致');

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail?1:0);
