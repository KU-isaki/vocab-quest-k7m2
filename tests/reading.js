/* 每輪結算頁附的閱讀題組
   使用者要的是「每次練習都附上一個小題組來增加閱讀能力」，但題目數/答對率獎勵
   已經是調好的機制（難度倍率、答對率倍率、防刷題），不該被這個新功能牽動。
   所以驗證重點：①內容本身乾淨可用 ②真的會出現在結算頁 ③兩段式作答 ④完全不
   影響分鐘數／答題統計 ⑤同一篇不會連續出現。 */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  beforeParse(win){ win.speechSynthesis={speak(){},cancel(){},getVoices:()=>[{lang:'en-US',name:'S'}],addEventListener(){}};
    win.SpeechSynthesisUtterance=function(t){this.text=t;}; }});
const w=dom.window,d=w.document; w.alert=()=>{}; w.confirm=()=>true; w.scrollTo=()=>{};
w.HTMLElement.prototype.scrollIntoView=function(){};
const $=id=>d.getElementById(id), click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('  ✗ '+m))};

/* ---------- ① 內容本身要乾淨 ---------- */
const SETS=w.eval('READING_SETS');
ok(Array.isArray(SETS)&&SETS.length>=30,'閱讀題組應擴充到 30 篇, 實得 '+(SETS&&SETS.length));
SETS.forEach((s,i)=>{
  const tag=`第 ${i+1} 篇「${s.t}」`;
  ok(typeof s.t==='string'&&s.t.trim().length>0,`${tag} 要有標題`);
  const words=s.p.trim().split(/\s+/).length;
  ok(words>=20&&words<=90,`${tag} 篇幅要「不用太長」, 實得 ${words} 字`);
  ok(Array.isArray(s.q)&&s.q.length===8,`${tag} 題目池應該有 8 題, 實得 ${s.q&&s.q.length}`);
  ok(new Set((s.q||[]).map(x=>x.q)).size===(s.q||[]).length,`${tag} 題目池內的題目不能重複`);
  s.q.forEach((item,qi)=>{
    const qtag=`${tag} 第 ${qi+1} 小題`;
    ok(typeof item.q==='string'&&item.q.trim().length>0,`${qtag} 要有題目文字`);
    ok(Array.isArray(item.opts)&&item.opts.length===4,`${qtag} 應該有四個選項, 實得 ${item.opts&&item.opts.length}`);
    ok(new Set(item.opts).size===4,`${qtag} 四個選項不能重複`);
    ok(Number.isInteger(item.a)&&item.a>=0&&item.a<4,`${qtag} 正確答案索引要在 0-3 之間, 實得 ${item.a}`);
  });
});

/* ---------- 跑完一輪，走到結算頁 ---------- */
const R=w.eval('ROUND');
function ansOf(){
  const en=d.querySelector('#qPrompt .en');
  if(en) return en.textContent.trim();
  const sz=d.querySelector('#qPrompt .sen-zh');
  if(sz){ const hit=w.eval('WORDS').find(x=>x.ex&&x.ex[1]===sz.textContent.trim()); return hit&&hit.w; }
  const zh=d.querySelector('#qPrompt .zh');
  if(zh){ const list=w.eval('WORDS').filter(x=>x.zh===zh.textContent.trim()); return list[0]&&list[0].w; }
  return null;
}
function answerWord(){ const t=$('qKind').textContent;
  if(t.includes('說中文')||t.includes('只聽')){ const r=$('reveal'); if(r) click(r);
    const en=(d.querySelector('#qPrompt .en')||{textContent:''}).textContent.trim();
    const bs=[...d.querySelectorAll('#qBody .choice')];
    click(bs.find(x=>x.dataset.w===en)||bs[0]); click($('btnCheck'));
  }else if(t.includes('拼英文')||t.includes('填單字')){ const a=ansOf();
    const ts=[...d.querySelectorAll('#qBody .tile')];
    const seq=a.toLowerCase().split('').map(c=>ts.find(x=>x.textContent===c&&!x.classList.contains('used')));
    if(seq.every(Boolean)) seq.forEach(click); click($('btnCheck'));
  }else{ $('typed').value=ansOf(); click($('btnCheck')); }
  click($('btnNext'));
}
function runRound(){ click($('btnStart')); for(let i=0;i<R;i++) answerWord(); }
runRound();

/* ---------- ② 真的會出現在結算頁 ---------- */
ok($('sumCard').hidden===false,'跑完一輪應該進到結算頁');
ok($('readBlock').hidden===false,'結算頁應該附一個閱讀題組');
ok(w.getComputedStyle($('readBlock')).display!=='none','閱讀題組實際算出來的 display 也要顯示');
const shownSet=SETS.find(s=>$('readPassage').textContent.includes(s.t));
ok(!!shownSet,'畫面上的文章應該對得到 READING_SETS 裡的一篇');
ok($('readPassage').textContent.includes(shownSet.p.slice(0,20)),'畫面應顯示文章內容');
ok($('readCount').textContent.includes('1')&&$('readCount').textContent.includes('2'),'題號要顯示第幾題／共幾題, 實得 '+$('readCount').textContent);
const item1=shownSet.q.find(x=>x.q===$('readPrompt').textContent);
ok(!!item1,'第一題應來自這一篇的題目池, 實得 '+$('readPrompt').textContent);
ok(d.querySelectorAll('#readBody .choice').length===4,'閱讀題應該有四個選項');

/* ---------- ③ 兩段式作答：沒選不能按檢查 ---------- */
ok($('readCheck').disabled===true,'沒選答案前檢查鈕應該是disabled');
const firstChoice=d.querySelectorAll('#readBody .choice')[0];
click(firstChoice);
ok($('readCheck').disabled===false,'選了答案後檢查鈕才能按');
ok(firstChoice.classList.contains('sel'),'選到的選項要標記起來');
click(firstChoice); // 再點一次不該提早送出
ok($('readFb').className.indexOf('on')===-1,'按選項不會直接送出答案，要按檢查才算');

/* ---------- ④ 完全不影響分鐘數／答題統計 ---------- */
const beforeDone=w.eval('S.done');
const beforeDay=JSON.parse(JSON.stringify(w.eval("SHARED.days[dayKey()]||{}")));
const beforeBank=w.eval('SHARED.bank ? SHARED.bank.earned : 0');
const correctIdx=item1.a;
click(d.querySelectorAll('#readBody .choice')[correctIdx]);
click($('readCheck'));
ok($('readFb').className.includes('on ok'),'答對閱讀題應該顯示答對的樣式');
ok($('readFbTitle').textContent.includes('答對'),'答對要有對應文字, 實得 '+$('readFbTitle').textContent);
ok(w.eval('S.done')===beforeDone,'答閱讀題不該計入答題數');
ok(JSON.stringify(w.eval("SHARED.days[dayKey()]||{}"))===JSON.stringify(beforeDay),'答閱讀題不該動到今天的答題紀錄');
ok(w.eval('SHARED.bank ? SHARED.bank.earned : 0')===beforeBank,'答閱讀題不該影響遊戲時間存摺');

// 第二小題故意答錯，確認錯誤樣式也正常，一樣不影響統計
click($('readNext'));
const item2=shownSet.q.find(x=>x.q===$('readPrompt').textContent);
ok(!!item2&&item2!==item1,'第二題也應來自題目池, 且跟第一題不同');
const wrongIdx=(item2.a+1)%4;
click(d.querySelectorAll('#readBody .choice')[wrongIdx]);
click($('readCheck'));
ok($('readFb').className.includes('on no'),'答錯閱讀題應該顯示答錯的樣式');
ok(w.eval('S.done')===beforeDone,'答錯閱讀題一樣不該計入答題數');
ok($('readNext').textContent==='完成','最後一小題答完，按鈕文字要變成「完成」, 實得 '+$('readNext').textContent);
click($('readNext'));
ok($('readNext').hidden===true,'兩題都做完後應該收起下一題按鈕');
ok($('readFbTitle').textContent.includes('完成'),'應該有完成的提示, 實得 '+$('readFbTitle').textContent);
// .btn{display:flex} 曾經蓋掉 [hidden]，按鈕看起來收起來了其實還在、還能按，
// 小孩手滑多按幾下「完成」，完成提示就會一直疊加（真實回報過的 bug）
const css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
ok(/#readNext\[hidden\]\{[^}]*display:\s*none/.test(css),'#readNext[hidden] 要明確設成 display:none, 否則會被 .btn{display:flex} 蓋掉');
ok(w.getComputedStyle($('readNext')).display==='none','按鈕實際算出來的 display 也要是 none, 不能只靠 DOM 的 hidden 屬性');
const titleBefore=$('readFbTitle').textContent;
click($('readNext')); click($('readNext')); click($('readNext'));   // 模擬手滑連點好幾下
ok($('readFbTitle').textContent===titleBefore,'完成後再點幾次不該讓完成提示一直疊加, 實得 '+$('readFbTitle').textContent);

/* ---------- ⑤ 同一篇不會連續出現 ---------- */
click($('btnBackHome'));
runRound();
const shownSet2=SETS.find(s=>$('readPassage').textContent.includes(s.t));
ok(!!shownSet2,'第二輪畫面上的文章也應該對得到 READING_SETS 裡的一篇');
ok(shownSet2.t!==shownSet.t,'不該連續兩輪出現同一篇文章, 實得 '+shownSet.t+' / '+shownSet2.t);

/* ---------- ⑥ 每次從 8 題的題目池隨機抽 2 題 ---------- */
let sawLate=false, drawsOk=true;
for(let i=0;i<40;i++){
  w.eval('startReadBlock()');
  const que=w.eval('readQueue'), set=w.eval('readSet');
  if(que.length!==2||que[0]===que[1]||!que.every(x=>set.q.includes(x))) drawsOk=false;
  if(que.some(x=>set.q.indexOf(x)>=2)) sawLate=true;
}
ok(drawsOk,'每次都應從該篇題目池抽出 2 題不同的題目');
ok(sawLate,'40 次抽題應該抽得到第 3 題以後的題目（不能永遠只出前兩題）');

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail?1:0);
