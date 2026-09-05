/* 只有一份單字表：暑假版併進國中必備 1200

   以前分「暑假版／總整理版」兩個題庫各記各的進度。併掉之後：
   舊裝置上的暑假版紀錄要併進 1200 那份（答對答錯相加、連對取高的）、併過就刪，不得併兩次；
   舊備份碼裡的 summer= 段也要併進來；畫面上不得再有題庫切換。 */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('  ✗ '+m))};
function boot(seed){
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',beforeParse(win){ if(seed) seed(win.localStorage); }});
  const w=dom.window; w.alert=()=>{}; w.confirm=()=>true; w.scrollTo=()=>{}; w.HTMLElement.prototype.scrollIntoView=function(){};
  return {w, d:w.document, $:id=>w.document.getElementById(id), ev:x=>w.eval(x), ls:w.localStorage,
          click:e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}))};
}
const today=new Date().toISOString().slice(0,10);

// ① 單字表：1200 + hard-working，暑假版的提示搬過來
{
  const t=boot();
  ok(!t.d.querySelector('.deck') && !t.$('deckPicker'),'不得再有題庫切換');
  ok(t.$('hDeck').textContent==='國中必備 1200','標題只剩一份, 實得 '+t.$('hDeck').textContent);
  ok(t.ev('WORDS.length')===1207,'1206 + hard-working = 1207 字, 實得 '+t.ev('WORDS.length'));
  ok(t.ev('typeof SUMMER_WORDS')==='undefined' && t.ev('typeof DECKS')==='undefined','暑假版的資料與兩題庫的結構要拿掉');
  const hw=t.ev('WORDS.find(x=>x.w==="hard-working")');
  ok(!!hw && hw.cats.includes('c2') && hw.hint==='hard + working','hard-working 要補在個人特徵, 實得 '+JSON.stringify(hw&&[hw.cats,hw.hint]));
  ok(t.ev('WORDS.find(x=>x.w==="child").hint')==='複數 children','暑假版的提示要搬到 1200 上');
  ok(t.ev('WORDS.filter(x=>x.hint).length')>=79,'79 條提示都要在');
  ok(t.ev('S.done')===0 && t.ls.getItem('cq-vocab-v1:summer')===null,'全新裝置什麼都不併');
  ok(t.$('btnReset').textContent.includes('單字'),'清除鈕要講清楚是單字, 實得 '+t.$('btnReset').textContent);
  ok(!/兩個題庫/.test([...t.d.body.querySelectorAll('*')].filter(e=>e.tagName!=='SCRIPT'&&e.tagName!=='STYLE'&&!e.children.length).map(e=>e.textContent).join(' ')),'畫面上不得再提「兩個題庫」');
}

// ② 舊裝置：暑假版 + 總整理版各有紀錄 → 併成一份
{
  const t=boot(ls=>{
    ls.setItem('cq-deck-v1','summer');
    ls.setItem('cq-vocab-v1:summer',JSON.stringify({done:10,right:8,stats:{child:{r:3,x:1,streak:2,due:'2099-01-01'},boy:{r:1,x:0,streak:1,due:today}}}));
    ls.setItem('cq-vocab-v1:full',JSON.stringify({done:5,right:5,stats:{child:{r:1,x:0,streak:1,due:today},king:{r:2,x:0,streak:2,due:'2098-01-01'}}}));
  });
  ok(t.ev('S.done')===15 && t.ev('S.right')===13,`總題數要相加 (15/13), 實得 ${t.ev('S.done')}/${t.ev('S.right')}`);
  const c=t.ev('S.stats.child');
  ok(c.r===4 && c.x===1,'同一個字答對答錯要相加, 實得 '+JSON.stringify(c));
  ok(c.streak===2 && c.due==='2099-01-01','連對取高的那份，複習日跟著它, 實得 '+JSON.stringify(c));
  ok(t.ev('S.stats.boy.streak')===1 && t.ev('S.stats.king.streak')===2,'只在一邊的字要原樣保留');
  ok(t.ls.getItem('cq-vocab-v1:summer')===null && t.ls.getItem('cq-deck-v1')===null,'併過的舊紀錄要刪掉');
  ok(JSON.parse(t.ls.getItem('cq-vocab-v1:full')).done===15,'併完要存起來');
  // 重開一次不得再併
  const t2=boot(ls=>{ ls.setItem('cq-vocab-v1:full',t.ls.getItem('cq-vocab-v1:full')); });
  ok(t2.ev('S.done')===15,'重開不得再併一次, 實得 '+t2.ev('S.done'));
}

// ③ 更舊的裝置：還沒分題庫的 cq-vocab-v1 也要併；跟 :summer 同時在時只算一次
{
  const t=boot(ls=>ls.setItem('cq-vocab-v1',JSON.stringify({done:4,right:4,stats:{girl:{r:4,x:0,streak:3,due:'2099-03-03'}}})));
  ok(t.ev('S.done')===4 && t.ev('S.stats.girl.streak')===3,'還沒分題庫的舊紀錄要併進來');
  ok(t.ls.getItem('cq-vocab-v1')===null,'併過要刪');
  const t3=boot(ls=>{
    ls.setItem('cq-vocab-v1',JSON.stringify({done:4,right:4,stats:{girl:{r:4,x:0,streak:3}}}));
    ls.setItem('cq-vocab-v1:summer',JSON.stringify({done:4,right:4,stats:{girl:{r:4,x:0,streak:3}}}));   // 改版時複製的那份
  });
  ok(t3.ev('S.done')===4 && t3.ev('S.stats.girl.r')===4,'兩把舊鑰匙是同一份，只能算一次, 實得 '+t3.ev('S.done'));
  ok(t3.ls.getItem('cq-vocab-v1')===null && t3.ls.getItem('cq-vocab-v1:summer')===null,'兩把都要刪');
}

// ④ 舊備份碼帶 summer= 段 → 併進來；新備份碼只有一段英文
{
  const t=boot();
  const code=t.ev(`BK_PREFIX + b64e("summer=" + packDeck({done:2,right:2,stats:{boy:{r:2,x:0,streak:2,due:"2099-02-02"}}})
    + "~full=" + packDeck({done:1,right:1,stats:{king:{r:1,x:0,streak:1},boy:{r:1,x:1,streak:0,due:"${today}"}}})
    + "~shared=" + packDeck(SHARED))`);
  ok(t.ev(`importCode(${JSON.stringify(code)})`)==='','舊備份碼要還原得回來');
  ok(t.ev('S.done')===3 && t.ev('S.right')===3,'兩段要相加, 實得 '+t.ev('S.done'));
  const b=t.ev('S.stats.boy');
  ok(b.r===3 && b.x===1 && b.streak===2 && b.due==='2099-02-02','同一個字要併（連對取高）, 實得 '+JSON.stringify(b));
  ok(t.ev('S.stats.king.r')===1,'只在 full 段的字要在');
  const fresh=t.ev('exportCode()');
  const plain=t.ev(`b64d(${JSON.stringify(fresh.slice(4))})`);
  ok(/(^|~)full=/.test(plain) && !/summer=/.test(plain),'新備份碼只有 full 一段英文');
  const t2=boot();
  ok(t2.ev(`importCode(${JSON.stringify(fresh)})`)==='' && t2.ev('S.done')===3,'新備份碼往返要一致, 實得 '+t2.ev('S.done'));
}

// ⑤ 選擇題不得出現重複中文（1200 字裡同義字多，這條以前是總整理版的檢查）
{
  const t=boot(), {d,$,click}=t; const R=t.ev('ROUND');
  let dupOpt=0, checked=0;
  for(let r=0;r<9;r++){ click($('btnStart'));
    for(let i=0;i<R;i++){ const k=$('qKind').textContent;
      if(d.querySelector('#qBody .choice')){ const zs=[...d.querySelectorAll('#qBody .choice')].map(b=>b.textContent.slice(1));
        checked++; if(new Set(zs).size!==zs.length) dupOpt++;
        click(d.querySelector('#qBody .choice')); click($('btnCheck')); }
      else if(k.includes('拼英文')||k.includes('填單字')){ [...d.querySelectorAll('#qBody .tile')].slice(0,d.querySelectorAll('#qBody .slot').length).forEach(click); click($('btnCheck')); }
      else { $('typed').value='q'; click($('btnCheck')); }
      click($('btnNext')); } }
  ok(dupOpt===0, `選擇題出現重複中文 ${dupOpt} 次 / 共 ${checked} 題`);
}

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail?1:0);
