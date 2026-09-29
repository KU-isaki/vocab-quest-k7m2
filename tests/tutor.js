/* 家教單字：從 tutor-bot 讀這週要背的字，做成一顆範圍按鈕

   - 抓得到：出現「家教單字 N」，只算 1200 裡有的字；按下去只考這些字，一輪最多就這麼多題
   - 按分類或「全部」就離開家教模式；再按一次家教單字也會取消
   - 抓不到：用上次存的；從沒抓到過就不顯示按鈕，其他照常
   - 沒開雲端同步的裝置不發請求
   - API 回怪東西不能讓頁面壞掉 */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('  ✗ '+m))};
const WORDS15=["raise","appear","dentist","Christmas","businessman","cheat","treat","fan","deal","shopkeeper","band","lovely","office","lead","eve"];
function boot({reply, seed, cloud=true}={}){
  const calls=[];
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',beforeParse(win){
    if(cloud) win.localStorage.setItem('cq-sync',JSON.stringify({api:'https://english-api.ku-ai.cc',code:'w'}));
    if(seed) seed(win.localStorage);
    win.fetch=(url,opt)=>{ calls.push(url);
      if(!String(url).includes('tutor-bot')) return new Promise(()=>{});
      if(reply==='fail') return Promise.reject(new Error('offline'));
      return Promise.resolve({ok:true,json:()=>Promise.resolve(reply)}); };
  }});
  const w=dom.window; w.alert=()=>{}; w.confirm=()=>true; w.scrollTo=()=>{}; w.HTMLElement.prototype.scrollIntoView=function(){};
  return {w,d:w.document,$:id=>w.document.getElementById(id),ev:x=>w.eval(x),ls:w.localStorage,calls,
          click:e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}))};
}
const tick=()=>new Promise(r=>setTimeout(r,20));
const chip=(t,c)=>t.d.querySelector(`#catChips .chip[data-cat="${c}"]`);

(async()=>{
  // ① 抓得到：出現按鈕、只算 1200 裡有的字、存起來
  {
    const t=boot({reply:{lesson:"2026-09-26 第1堂",date:"2026-09-26",words:[...WORDS15,"notaword"]}});
    await tick();
    ok(t.calls.some(u=>String(u)==='https://tutor-bot.ku-ai.cc/words'),'要去 tutor-bot 抓家教單字');
    const b=chip(t,'tutor');
    ok(!!b,'要出現家教單字按鈕');
    ok(b && b.textContent.trim()==='家教單字 15','只算 1200 裡有的字 (15), 實得 '+(b&&b.textContent));
    ok(b && b.getAttribute('aria-label').includes('2026-09-26 第1堂'),'按鈕要唸得出是哪一堂');
    ok(b && b.getAttribute('aria-pressed')==='false','一開始不選');
    ok(chip(t,'tutor')===t.$('catChips').firstElementChild,'家教單字要排第一顆');
    const saved=JSON.parse(t.ls.getItem('cq-tutor-words-v1')||'null');
    ok(saved && saved.words.length===16 && saved.lesson==='2026-09-26 第1堂','抓到的要存起來給離線用');

    // ② 按下去：只考這些字
    t.click(chip(t,'tutor'));
    ok(chip(t,'tutor').getAttribute('aria-pressed')==='true','按下去要亮');
    ok(chip(t,'all').getAttribute('aria-pressed')==='false','「全部」要熄');
    const pool=t.ev('pool().map(w=>w.w)');
    ok(pool.length===15 && WORDS15.every(x=>pool.includes(x)),'題目範圍要剛好是這 15 字, 實得 '+pool.length);
    const q=t.ev('drawRound(pool(), 30).map(x=>x.word.w)');
    ok(q.length===15 && new Set(q).size===15 && q.every(x=>WORDS15.includes(x)),'選 30 題也只出這 15 字各一次, 實得 '+q.length);

    // ③ 按分類就離開家教模式，而且只選那一類
    t.click(chip(t,'c27'));
    ok(t.ev('tutorMode')===false,'按分類要離開家教模式');
    ok(chip(t,'c27').getAttribute('aria-pressed')==='true' && t.ev('pickedCats.size')===1,'切回分類要從頭選，只選那一類');
    ok(t.ev('pool().every(w=>w.cats.includes("c27"))'),'出題回到分類範圍');

    // ④ 再按一次家教單字 → 取消
    t.click(chip(t,'tutor')); t.click(chip(t,'tutor'));
    ok(t.ev('tutorMode')===false,'再按一次要取消');
    t.click(chip(t,'tutor')); t.click(chip(t,'all'));
    ok(t.ev('tutorMode')===false && t.ev('pickedCats.size===CATS.length'),'按「全部」要離開家教模式並選全部');
  }

  // ⑤ 抓不到：用上次存的
  {
    const t=boot({reply:'fail',seed:ls=>ls.setItem('cq-tutor-words-v1',JSON.stringify({lesson:"舊的一堂",words:["raise","band"]}))});
    await tick();
    const b=chip(t,'tutor');
    ok(b && b.textContent.trim()==='家教單字 2','離線要用上次存的, 實得 '+(b&&b.textContent));
  }

  // ⑥ 從沒抓到過：不顯示按鈕，其他照常
  {
    const t=boot({reply:'fail'});
    await tick();
    ok(!chip(t,'tutor'),'沒有家教單字就不顯示按鈕');
    ok(!!chip(t,'all') && t.ev('pool().length')===t.ev('WORDS.length'),'其他照常');
  }

  // ⑦ API 回空清單或怪東西
  {
    const t=boot({reply:{lesson:"",words:[]},seed:ls=>ls.setItem('cq-tutor-words-v1',JSON.stringify({lesson:"x",words:["raise"]}))});
    await tick();
    ok(!chip(t,'tutor'),'老師這週沒給單字 → 按鈕要收起來（覆蓋舊的）');
    const t2=boot({reply:{nope:1}});
    await tick();
    ok(!chip(t2,'tutor') && !!chip(t2,'all'),'回怪東西不得壞掉');
    const t3=boot({reply:{lesson:'<img src=x onerror=alert(1)>',words:["raise"]}});
    await tick();
    ok(!t3.d.querySelector('#catChips img'),'堂名要跳脫，不得插進 HTML');
  }

  // ⑨ 沒開雲端：一個請求都不發（跟同步同一條規矩），有存過的照樣顯示
  {
    const t=boot({cloud:false,reply:{lesson:"a",words:["raise"]}});
    await tick();
    ok(!t.calls.some(u=>String(u).includes('tutor-bot')),'沒開雲端不得去抓');
    ok(!chip(t,'tutor'),'沒開雲端又沒存過就不顯示');
  }

  // ⑧ 在家教模式時清單變成空的 → 自動回到一般範圍
  {
    const t=boot({reply:{lesson:"a",words:["raise"]}});
    await tick();
    t.click(chip(t,'tutor'));
    t.ev('tutor={lesson:"",words:[]}; renderChips();');
    ok(t.ev('tutorMode')===false && t.ev('pool().length')===t.ev('WORDS.length'),'清單沒了要自動回一般範圍');
  }

  console.log(`通過 ${pass} / 失敗 ${fail}`);
  process.exit(fail?1:0);
})();
