/* 句子題型：🔊 聽例句選中文、看中文選英文句
   兩種都掛在既有選擇題機制上（選項 data-w 存單字、兩段式檢查），
   驗證：①配方裡抽得到、聽力關掉就不出聽例句 ②畫面與選項正確
   ③跟一般題一樣計分 ④聽例句念的是整句、聽不到可以顯示句子 */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
let spoken='';
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  beforeParse(win){ win.speechSynthesis={speak(u){spoken=u.text;},cancel(){},getVoices:()=>[{lang:'en-US',name:'S'}],addEventListener(){}};
    win.SpeechSynthesisUtterance=function(t){this.text=t;}; }});
const w=dom.window,d=w.document; w.alert=()=>{}; w.confirm=()=>true; w.scrollTo=()=>{};
w.HTMLElement.prototype.scrollIntoView=function(){};
const $=id=>d.getElementById(id), click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('  ✗ '+m))};

/* ---------- ① 配方 ---------- */
const kinds=n=>new Set(Array.from({length:n},()=>w.eval('pickKind(WORDS.find(x=>x.w==="hand"))')));
const k1=kinds(400);
ok(k1.has('zh2en'),'有例句的字應抽得到「看中文選英文句」');
ok(k1.has('senlisten'),'聽力開著時應抽得到「聽例句選中文」');
w.eval('listenOn=false');
const k2=kinds(400);
ok(!k2.has('senlisten'),'聽力題關掉就不該出聽例句');
ok(!k2.has('listen'),'聽力題關掉也不該出單字聽力題');
ok(k2.has('zh2en'),'看中文選英文句不吃聽力開關');
w.eval('listenOn=true');

/* ---------- ② 聽例句 · 選中文 ---------- */
click($('btnStart'));
w.eval('queue[idx]={word:WORDS.find(x=>x.w==="hand"), kind:"senlisten"}; showQ()');
const W1=w.eval('queue[idx].word');
ok($('qKind').textContent.includes('聽例句'),'題型標籤要寫聽例句, 實得 '+$('qKind').textContent);
ok(spoken===W1.ex[0].replace(/-/g,' '),'應自動念出整句例句, 實得 '+spoken);
ok(!!$('spk'),'要有重聽按鈕');
const opts1=[...d.querySelectorAll('#qBody .choice')];
ok(opts1.length===4,'應有四個選項');
ok(new Set(opts1.map(b=>b.textContent.slice(1))).size===4,'四個選項的中文句不得重複');
ok(opts1.every(b=>{const x=w.eval(`WORDS.find(x=>x.w===${JSON.stringify(b.dataset.w)})`); return x&&x.ex;}),'每個選項都要對得到有例句的字');
const right1=opts1.find(b=>b.dataset.w===W1.w);
ok(!!right1,'正解選項要在裡面');
ok(right1.textContent.includes(W1.ex[1]),'正解選項要顯示這個字的例句中文, 實得 '+right1.textContent);
ok(d.querySelector('#qBody .choices').classList.contains('sen'),'句子選項要有 sen 樣式');
// 聽不到 → 顯示句子
click($('reveal'));
ok((d.querySelector('#qPrompt .sentence')||{textContent:''}).textContent===W1.ex[0],'按了顯示句子要看到英文例句');
// 兩段式 + 計分
ok($('btnCheck').disabled,'沒選答案前不能按檢查');
const done0=w.eval('S.done'), r0=w.eval('S.right');
click(right1); click($('btnCheck'));
ok($('fbTitle').textContent.includes('✓'),'選對要判定正確');
ok(w.eval('S.done')===done0+1&&w.eval('S.right')===r0+1,'句子題要跟一般題一樣計分');
click($('btnNext'));

/* ---------- ③ 看中文 · 選英文句 ---------- */
w.eval('queue[idx]={word:WORDS.find(x=>x.w==="foot"), kind:"zh2en"}; showQ()');
const W2=w.eval('queue[idx].word');
ok($('qKind').textContent.includes('選英文句'),'題型標籤要寫選英文句, 實得 '+$('qKind').textContent);
ok((d.querySelector('#qPrompt .sen-zh')||{textContent:''}).textContent===W2.ex[1],'題目要顯示例句的中文');
ok(!$('spk'),'看中文選英文句不該有發音鈕（不然等於念答案）');
const opts2=[...d.querySelectorAll('#qBody .choice')];
ok(opts2.length===4,'應有四個選項');
ok(new Set(opts2.map(b=>b.textContent.slice(1))).size===4,'四個英文句不得重複');
const right2=opts2.find(b=>b.dataset.w===W2.w);
ok(right2&&right2.textContent.includes(W2.ex[0]),'正解選項要是這個字的英文例句');
ok(d.querySelector('#qBody .choices').classList.contains('sen-en'),'英文句選項要有 sen-en 樣式');
// 答錯也要正常計分
const x0=w.eval('S.stats[queue[idx].word.w] ? S.stats[queue[idx].word.w].x : 0');
const wrong2=opts2.find(b=>b.dataset.w!==W2.w);
click(wrong2); click($('btnCheck'));
ok($('fbTitle').textContent.includes('✗'),'選錯要判定錯誤');
ok(w.eval(`S.stats[${JSON.stringify(W2.w)}].x`)===x0+1,'答錯要記進錯題統計');
ok(right2.classList.contains('right')&&wrong2.classList.contains('wrong'),'要標出正解與錯選');

/* 例句的中文不得重複 —— 兩個字共用同一句中文的話：
   「看中文選英文句」會出現兩個選項的題目一模一樣（跟單字選擇題不得重複中文同一個道理），
   而且測試也分不出題目問的是哪一個字，會變成偶發失敗。
   （garbage / trash 就踩過這個坑，兩句都是「請把垃圾丟進垃圾桶。」） */
{
  const ex = w.eval('EXAMPLES'), byZh = {}, byEn = {};
  for(const k in ex){
    (byZh[ex[k][1]] = byZh[ex[k][1]] || []).push(k);
    (byEn[ex[k][0]] = byEn[ex[k][0]] || []).push(k);
  }
  const dupZh = Object.entries(byZh).filter(([, v])=>v.length > 1);
  const dupEn = Object.entries(byEn).filter(([, v])=>v.length > 1);
  ok(dupZh.length === 0, '例句的中文不得重複: ' + dupZh.map(([z, v])=>v.join('/') + '→' + z).join('、'));
  ok(dupEn.length === 0, '例句的英文不得重複: ' + dupEn.map(([e, v])=>v.join('/') + '→' + e).join('、'));
  ok(Object.keys(ex).length > 1000, `例句數量檢查, 實得 ${Object.keys(ex).length}`);
}

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail?1:0);
