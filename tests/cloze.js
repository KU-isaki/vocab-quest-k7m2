const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  beforeParse(win){ win.speechSynthesis={speak(){},cancel(){},getVoices:()=>[{lang:'en-US',name:'S'}],addEventListener(){}};
    win.SpeechSynthesisUtterance=function(t){this.text=t;}; }});
const w=dom.window,d=w.document; w.alert=m=>console.log('ALERT',m); w.confirm=()=>true; w.scrollTo=()=>{};
w.HTMLElement.prototype.scrollIntoView=function(){};
const $=id=>d.getElementById(id), click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('  ✗ '+m))};
const EX=w.eval('EXAMPLES'), SW=w.eval('SUMMER_WORDS'), FW=w.eval('FULL_WORDS'), ROUND=w.eval('ROUND');

// ① 資料完整性
ok(Object.keys(EX).length>1190,'應有 1200 句左右的例句, 實得 '+Object.keys(EX).length);
ok(SW.every(x=>x.ex),'暑假版每個字都要有例句, 缺 '+SW.filter(x=>!x.ex).map(x=>x.w));
ok(SW.every(x=>x.ex[0].length<60),'例句不該太長');
ok(SW.every(x=>x.ex[1].length>0),'每句都要有中文翻譯');
// 挖空可行性：spellable 的字一定要能在例句中被單字邊界找到
const cantBlank=SW.filter(x=>x.spellable && !new RegExp('\\b'+x.w+'\\b','i').test(x.ex[0]));
ok(cantBlank.length===0,'可拼字的字都要能挖空, 失敗: '+cantBlank.map(x=>x.w+'→'+x.ex[0]));
// 總整理版共用例句
const fwEx=FW.filter(x=>x.ex).length;
ok(fwEx===FW.length,`總整理版 ${FW.length} 字應全部有例句, 實得 ${fwEx}`);
console.log('  總整理版', fwEx, '/', FW.length, '字有例句');
// 總整理版所有可拼字的字，例句都必須挖得掉
const fwBad=FW.filter(x=>x.spellable && x.ex && !new RegExp('\\b'+x.w+'\\b','i').test(x.ex[0]));
ok(fwBad.length===0,'總整理版例句都要挖得掉, 失敗 '+fwBad.length+' 個: '+fwBad.slice(0,5).map(x=>x.w+'→'+x.ex[0]));
// 句子長度
const fwLong=FW.filter(x=>x.ex && x.ex[0].length>72);
ok(fwLong.length===0,'例句不該過長, 超過的 '+fwLong.length);
// 每句都要有中文
const fwNoZh=FW.filter(x=>x.ex && !/[\u4e00-\u9fff]/.test(x.ex[1]));
ok(fwNoZh.length===0,'每句都要有中文翻譯, 缺 '+fwNoZh.length);

// ② 挖空題實際出題
const byZh={}; SW.forEach(x=>(byZh[x.zh]=byZh[x.zh]||[]).push(x.w));
let sawCloze=false, clozeChecks=0;
for(let r=0;r<8 && clozeChecks<12;r++){
  click($('btnStart'));
  for(let i=0;i<ROUND;i++){
    const t=$('qKind').textContent;
    if(t.includes('填單字')){
      sawCloze=true; clozeChecks++;
      const sen=d.querySelector('#qPrompt .sentence').textContent;
      const zh=d.querySelector('#qPrompt .sen-zh').textContent;
      ok(sen.includes('＿＿＿'),'挖空題要有空格, 實得 '+sen);
      ok(zh.length>0,'挖空題要有中文翻譯');
      const slots=d.querySelectorAll('#qBody .slot').length;
      ok(slots>0,'挖空題要有字母格');
      // 找出正解：句子還原後比對
      const ans=SW.find(x=>x.ex && x.ex[1]===zh);
      ok(!!ans,'應能對回原單字');
      if(ans){
        ok(!new RegExp('\\b'+ans.w+'\\b','i').test(sen),'句子裡不該還看得到答案, 句='+sen);
        ok(slots===ans.w.length,`字母格數應等於單字長度 ${ans.w}(${ans.w.length}) vs ${slots}`);
        const tiles=[...d.querySelectorAll('#qBody .tile')];
        const seq=ans.w.toLowerCase().split('').map(c=>tiles.find(x=>x.textContent===c&&!x.classList.contains('used')));
        ok(seq.every(Boolean),'字母 tile 要湊得出正解 '+ans.w);
        if(seq.every(Boolean)){ seq.forEach(click); click($('btnCheck'));
          ok($('fbTitle').textContent.includes('✓'),'拼對應判定正確, 實得 '+$('fbTitle').textContent); }
        else click($('btnCheck'));
      } else click($('btnCheck'));
    } else {
      // 其他題型隨便答
      if(d.querySelector('#qBody .choice')){
        click(d.querySelector('#qBody .choice')); click($('btnCheck')); }
      else if(t.includes('拼英文')){ const ts=[...d.querySelectorAll('#qBody .tile')];
        ts.slice(0,d.querySelectorAll('#qBody .slot').length).forEach(click); click($('btnCheck')); }
      else { $('typed').value='z'; click($('btnCheck')); }
    }
    click($('btnNext'));
  }
  click($('btnBackHome'));
}
ok(sawCloze,'應該要出得到挖空題');
console.log('  檢查了', clozeChecks, '題挖空題');

// ③ 單字表展開要看得到例句
click([...d.querySelectorAll('.nav button')].find(b=>b.dataset.view==='vList'));
const ex0=d.querySelector('#listBody .ex');
click(ex0);
const note=$(ex0.dataset.note);
ok(!note.hidden,'展開後應顯示');
ok(!!note.querySelector('.exline'),'展開區應包含例句');
ok(note.querySelector('.exline b').textContent.length>5,'例句英文不該空');
console.log('  單字表例句範例:', note.querySelector('.exline b').textContent);

// ④ 總整理版實際出挖空題
click([...d.querySelectorAll('.nav button')].find(b=>b.dataset.view==='vQuiz'));
click([...d.querySelectorAll('.deck')].find(b=>b.dataset.deck==='full'));
const FWORDS=w.eval('WORDS');
let fullCloze=0;
for(let r=0;r<6 && fullCloze<10;r++){
  click($('btnStart'));
  for(let i=0;i<ROUND;i++){
    const t=$('qKind').textContent;
    if(t.includes('填單字')){
      fullCloze++;
      const sen=d.querySelector('#qPrompt .sentence').textContent;
      const zh=d.querySelector('#qPrompt .sen-zh').textContent;
      const hit=FWORDS.find(x=>x.ex&&x.ex[1]===zh);
      ok(!!hit,'總整理版挖空題應能對回單字, 翻譯='+zh);
      if(hit){
        ok(!new RegExp('\\b'+hit.w+'\\b','i').test(sen),'句子不該洩漏答案: '+sen);
        const slots=d.querySelectorAll('#qBody .slot').length;
        ok(slots===hit.w.length,`字母格數要對 ${hit.w}(${hit.w.length}) vs ${slots}`);
        const tiles=[...d.querySelectorAll('#qBody .tile')];
        const seq=hit.w.toLowerCase().split('').map(c=>tiles.find(x=>x.textContent===c&&!x.classList.contains('used')));
        ok(seq.every(Boolean),'tiles 要湊得出 '+hit.w);
        if(seq.every(Boolean)){ seq.forEach(click); click($('btnCheck'));
          ok($('fbTitle').textContent.includes('✓'),'拼對要判定正確 '+hit.w); }
        else click($('btnCheck'));
      } else click($('btnCheck'));
    } else {
      const rv=$('reveal'); if(rv) click(rv);
      if(d.querySelector('#qBody .choice')){ click(d.querySelector('#qBody .choice')); click($('btnCheck')); }
      else if(d.querySelector('#qBody .tile')){
        [...d.querySelectorAll('#qBody .tile')].slice(0,d.querySelectorAll('#qBody .slot').length).forEach(click);
        click($('btnCheck'));
      } else { $('typed').value='z'; click($('btnCheck')); }
    }
    click($('btnNext'));
  }
  click($('btnBackHome'));
}
ok(fullCloze>0,'總整理版也要出得到挖空題');
console.log('  總整理版實測', fullCloze, '題挖空題');

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail?1:0);
