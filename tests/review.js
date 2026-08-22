const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  beforeParse(win){ win.speechSynthesis={speak(){},cancel(){},getVoices:()=>[{lang:'en-US',name:'S'}],addEventListener(){}};
    win.SpeechSynthesisUtterance=function(t){this.text=t;}; }});
const w=dom.window,d=w.document; w.alert=()=>{}; w.confirm=()=>true; w.scrollTo=()=>{};
w.HTMLElement.prototype.scrollIntoView=function(){};
const $=id=>d.getElementById(id), click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('  ✗ '+m))};
const list=()=>click([...d.querySelectorAll('.nav button')].find(b=>b.dataset.view==='vList'));
const deckBtn=k=>[...d.querySelectorAll('.deck')].find(b=>b.dataset.deck===k);

// ① 暑假版分類列
list();
let chips=[...d.querySelectorAll('#listCats .chip')];
ok(chips.length===6,'暑假版應有 6 顆分類鈕（含全部）, 實得 '+chips.length);
ok(chips[0].textContent.includes('114'),'全部鈕要顯示總字數, 實得 '+chips[0].textContent);
ok(chips[0].getAttribute('aria-pressed')==='true','預設選全部');
ok(d.querySelectorAll('#listBody .wrow').length===114,'預設顯示全部 114 字');

// 點某一類只顯示該類
const bodyChip=chips.find(c=>c.textContent.includes('身體部位'));
click(bodyChip);
const n=d.querySelectorAll('#listBody .wrow').length;
ok(n===23,'身體部位應有 23 字, 實得 '+n);
ok(d.querySelectorAll('#listBody .grouphead').length===1,'只該顯示一個分類標題');
ok($('listInfo').textContent.includes('身體部位'),'應顯示目前分類, 實得 '+$('listInfo').textContent);
ok($('listInfo').textContent.includes('23'),'應顯示字數');

// 搜尋時自動跳回全部
$('search').value='happy';
$('search').dispatchEvent(new w.Event('input',{bubbles:true}));
ok([...d.querySelectorAll('#listCats .chip')][0].getAttribute('aria-pressed')==='true','搜尋時應跳回全部');
const rows=[...d.querySelectorAll('#listBody .wrow .en')].map(e=>e.textContent);
ok(rows.includes('happy')&&rows.includes('unhappy'),'搜尋要跨全部分類, 實得 '+rows);
$('search').value=''; $('search').dispatchEvent(new w.Event('input',{bubbles:true}));

// ② 總整理版 37 類
click([...d.querySelectorAll('.nav button')].find(b=>b.dataset.view==='vQuiz'));
click(deckBtn('full'));
list();
chips=[...d.querySelectorAll('#listCats .chip')];
ok(chips.length===38,'總整理版應有 38 顆分類鈕, 實得 '+chips.length);
const verbChip=chips.find(c=>c.textContent.includes('其他動詞'));
ok(!!verbChip,'應有「其他動詞」分類');
click(verbChip);
const vn=d.querySelectorAll('#listBody .wrow').length;
ok(vn>150&&vn<180,'其他動詞應約 168 字, 實得 '+vn);
ok(d.querySelectorAll('#listBody .grouphead').length===1,'只顯示該分類');
ok(!!d.querySelector('#listBody .tip'),'該分類應顯示記憶提示');
console.log('  切到「其他動詞」→', vn, '字，DOM 列數大幅減少');

// ③ 複習模式
ok(!!$('btnReview'),'應有複習按鈕');
ok($('btnReview').textContent.includes(String(vn)),'複習鈕要顯示字數, 實得 '+$('btnReview').textContent);
ok($('review').hidden,'複習畫面預設隱藏');
ok(w.getComputedStyle($('review')).display==='none','複習畫面實際上要看不到');
click($('btnReview'));
ok(!$('review').hidden,'點了應開啟複習');
ok(w.getComputedStyle($('review')).display!=='none','開啟後要看得到');
ok($('rvCount').textContent==='1 / '+vn,'應顯示進度 1/N, 實得 '+$('rvCount').textContent);
ok(!!d.querySelector('#rvFront .big-en'),'預設正面應顯示英文');
ok($('rvBack').hidden,'背面預設蓋著');
ok(!$('rvTap').hidden,'應提示點卡片看答案');
const firstEn=d.querySelector('#rvFront .big-en').textContent;
// 翻卡
click($('rvCard'));
ok(!$('rvBack').hidden,'點卡片應翻面');
ok($('rvTap').hidden,'翻面後不再提示');
ok(!!d.querySelector('#rvBack .ans'),'背面要有中文答案');
ok(!!d.querySelector('#rvBack .ex'),'背面要有例句');
console.log('  卡片範例:', firstEn, '→', d.querySelector('#rvBack .ans').textContent);
// 下一張
click($('rvNext'));
ok($('rvCount').textContent==='2 / '+vn,'應前進到第 2 張');
ok($('rvBack').hidden,'新卡片應重新蓋著');
ok(d.querySelector('#rvFront .big-en').textContent!==firstEn,'應換成不同的字');
// 上一張
click($('rvPrev'));
ok($('rvCount').textContent==='1 / '+vn,'應回到第 1 張');
click($('rvPrev'));
ok($('rvCount').textContent===vn+' / '+vn,'第一張往前應繞到最後一張');
// 先看中文模式
click($('rvMode'));
ok($('rvMode').getAttribute('aria-pressed')==='true','模式應切換');
ok(!!d.querySelector('#rvFront .big-zh'),'正面應改成中文');
click($('rvCard'));
ok(!!d.querySelector('#rvBack .ans-en'),'背面應顯示英文');
// 複習不該影響統計
const before=JSON.stringify(w.eval('S.stats'));
click($('rvNext')); click($('rvCard')); click($('rvNext'));
ok(JSON.stringify(w.eval('S.stats'))===before,'複習不得改動答題統計');
ok(w.eval('S.done')===0,'複習不得計入答題數');
// 關閉
click($('rvClose'));
ok($('review').hidden,'應能關閉複習');

// ④ 從「全部」進複習
click([...d.querySelectorAll('#listCats .chip')][0]);
click($('btnReview'));
const total=w.eval('WORDS.length');
ok($('rvCount').textContent.endsWith('/ '+total),`全部模式應可複習全部 ${total} 字, 實得 `+$('rvCount').textContent);
click($('rvClose'));

// ⑥ 例句發音：單字表展開的例句、翻卡背面的例句都要能念整句（兩個題庫共用同一套畫面）
const exBtn1=d.querySelector('#listBody .note .exline .sp-ex');
ok(!!exBtn1,'單字表的例句要有發音鈕');
ok(exBtn1&&/\s/.test(exBtn1.dataset.say||''),'例句發音鈕要念整句而不是單字, 實得 '+(exBtn1&&exBtn1.dataset.say));
let spoken=''; w.speechSynthesis.speak=u=>{spoken=u.text;};
click(exBtn1);
ok(spoken===exBtn1.dataset.say.replace(/-/g,' '),'按例句發音鈕要念出例句, 實得 '+spoken);
click($('btnReview'));
let guard=0;                                   // 翻到一張有例句的卡
while(guard++<300){ click($('rvCard')); if(d.querySelector('#rvBack .ex .sp-ex')) break; click($('rvNext')); }
const exBtn2=d.querySelector('#rvBack .ex .sp-ex');
ok(!!exBtn2,'翻卡背面的例句要有發音鈕');
spoken='';
click(exBtn2);
ok(spoken===exBtn2.dataset.say.replace(/-/g,' '),'翻卡的例句發音鈕要念出例句, 實得 '+spoken);
ok(!$('rvBack').hidden,'按例句發音不該影響卡片狀態');
click($('rvClose'));

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail?1:0);
