const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  virtualConsole:new (require('jsdom').VirtualConsole)().on('jsdomError',e=>{ if(!/Not implemented: navigation/.test(e.message)) errs.push(e.message); })});
const w=dom.window,d=w.document; w.alert=m=>console.log('ALERT',m); w.confirm=()=>true; w.scrollTo=()=>{};
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

const NOTES=w.eval('NOTES');
ok(Object.keys(NOTES).length===222,'NOTES 應有 222 條, 實得 '+Object.keys(NOTES).length);
const SW=w.eval('SUMMER_WORDS'), FW=w.eval('FULL_WORDS');
ok(SW.every(x=>x.use && x.use.length>5),'暑假版 114 字每字都要有用法, 缺 '+SW.filter(x=>!x.use).length);
ok(SW.find(x=>x.w==='child').use.includes('children'),'child 的說明應提到 children');
const fwUse=FW.filter(x=>x.use).length;
ok(fwUse>200,'總整理版應有 200+ 字帶說明, 實得 '+fwUse);
ok(FW.find(x=>x.w==='its').use.includes("it's"),'its 應解釋跟 it\'s 的差別');

// 單字表展開
click([...d.querySelectorAll('.nav button')].find(b=>b.dataset.view==='vList'));
const exs=d.querySelectorAll('#listBody .ex');
ok(exs.length===114,'暑假版每列都該有展開鈕, 實得 '+exs.length);
const notes=d.querySelectorAll('#listBody .note');
ok(notes.length===114,'應有 114 個說明區塊, 實得 '+notes.length);
ok([...notes].every(n=>n.hidden),'預設全部收合');
click(exs[0]);
ok(!$(exs[0].dataset.note).hidden,'點一下應展開');
ok(exs[0].getAttribute('aria-expanded')==='true','aria-expanded 應為 true');
ok($(exs[0].dataset.note).textContent.length>8,'展開內容不該是空的');
click(exs[0]);
ok($(exs[0].dataset.note).hidden,'再點一下應收合');

// 答錯顯示用法、答對不顯示
click([...d.querySelectorAll('.nav button')].find(b=>b.dataset.view==='vQuiz'));
const byZh={}; SW.forEach(x=>(byZh[x.zh]=byZh[x.zh]||[]).push(x.w));
let sawWrong=false, sawRight=false;
for(let r=0;r<3 && !(sawWrong&&sawRight);r++){ click($('btnStart'));
  for(let i=0;i<R;i++){ const t=$('qKind').textContent;
    const wrong = i%2===0;
    if(d.querySelector('#qBody .choice')){
      const aw=w.eval('queue[idx].word.w');
      const bs=[...d.querySelectorAll('#qBody .choice')];
      click(wrong ? bs.find(b=>b.dataset.w!==aw) : bs.find(b=>b.dataset.w===aw));
      click($('btnCheck'));
    } else {
      const ans=ansOf();
      if((t.includes('拼英文')||t.includes('填單字'))){
        const tiles=[...d.querySelectorAll('#qBody .tile')];
        const seq = wrong ? tiles.slice(0,d.querySelectorAll('#qBody .slot').length)
                          : ans.toLowerCase().split('').map(ch=>tiles.find(x=>x.textContent===ch&&!x.classList.contains('used')));
        if(seq.every(Boolean)) seq.forEach(click);
        click($('btnCheck'));
      } else { $('typed').value = wrong?'zzzz':ans; click($('btnCheck')); }
    }
    const isWrong=$('fbTitle').textContent.includes('✗');
    if(isWrong){ sawWrong=true; ok(!$('fbUse').hidden,'答錯時應顯示用法'); ok($('fbUse').textContent.length>5,'用法內容不該空'); }
    else { sawRight=true; ok($('fbUse').hidden,'答對時不該顯示用法'); }
    click($('btnNext')); } }
ok(sawWrong&&sawRight,'測試應同時涵蓋答對與答錯');

// 分享文字：不得含個資
const t1=w.eval('reportText(true)'), t2=w.eval('reportText(false)');
console.log('  ── 本輪成績訊息 ──\n'+t1.split('\n').map(s=>'    '+s).join('\n'));
console.log('  ── 整體進度訊息 ──\n'+t2.split('\n').map(s=>'    '+s).join('\n'));
ok(!/http|www\.|\.com|https/.test(t1+t2),'訊息不得含任何網址');
ok(!/姓名|name:|我是/.test(t1+t2),'訊息不得含姓名欄位');
ok(t1.includes('單字闖關')&&new RegExp('\\d+ / '+R).test(t1),'本輪訊息應有輪次成績, 實得 '+t1.split('\n')[1]);
ok(t2.includes('累積'),'整體訊息應有累積數據');
// 隱私說明有些改成點開才看（<details class="info">），兩種都算
const privacyBlocks=d.querySelectorAll('.privacy, .info');
ok(privacyBlocks.length>=2,'成績頁與進度頁都要有隱私說明, 實得 '+privacyBlocks.length);
ok([...privacyBlocks].some(x=>/不上傳|網址/.test(x.textContent)),'要講清楚不會上傳、不會產生網址');
ok($('btnShare')&&$('btnShareAll'),'兩顆分享按鈕都存在');
// 不得殘留任何會把成績送出去的網址
const src=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
ok(!/line\.me\/R\/msg/.test(src),'不得再用 line.me 訊息網址（會把成績送到伺服器）');
ok(!/location\.href\s*=\s*["'`]https?:/.test(src),'不得有把成績帶進網址的跳轉');
// 複製失敗要有手動備援（非同步，等 microtask）
ok($('sheet').hidden,'備援面板預設隱藏');
(async()=>{
  w.navigator.clipboard=undefined;
  click($('btnShare'));
  await new Promise(r=>setTimeout(r,20));
  ok(!$('sheet').hidden,'複製失敗時要跳出手動複製面板');
  ok($('sheetText').value.includes('單字闖關'),'面板要帶入成績文字');
  ok($('sheetText').readOnly,'文字框應為唯讀');
  ok(!/http/.test($('sheetText').value),'面板文字不得含網址');
  click($('sheetClose'));
  ok($('sheet').hidden,'關閉鈕要能收起面板');
  console.log(`\n通過 ${pass} / 失敗 ${fail}`);
  if(errs.length) console.log('JS 錯誤:', errs.slice(0,3));
  process.exit(fail?1:0);
})();
