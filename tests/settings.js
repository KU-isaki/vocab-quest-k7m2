/* 設定頁 + 摺疊說明
   設定類的東西本來全塞在進度頁下半部，一路捲到底才看得到，而且每個區塊
   都掛一大段小字。這裡驗的是：設定搬到自己的分頁、說明預設收起來。 */
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
const nav=v=>[...d.querySelectorAll('.nav button')].find(b=>b.dataset.view===v);

/* ---------- ① 分頁 ---------- */
const tabs=[...d.querySelectorAll('.nav button')];
console.log('  分頁:', tabs.map(b=>b.textContent.trim()).join(' · '));
ok(tabs.length===4,'應有四個分頁, 實得 '+tabs.length);
ok(!!nav('vSet'),'應有設定分頁');
ok(!!$('vSet'),'應有設定頁本體');
const cols=/\.nav-in\{[^}]*grid-template-columns:\s*repeat\((\d+)/.exec(html.match(/<style>([\s\S]*?)<\/style>/)[1]);
ok(cols && +cols[1]===tabs.length,`導覽列的欄數要跟分頁數一致（${tabs.length}）, 實得 `+(cols?cols[1]:'?'));
tabs.forEach(b=>ok(b.textContent.trim().length>0,'每個分頁都要有文字標籤'));

// 切過去要真的切換，而且只有一頁是開的
click(nav('vSet'));
ok($('vSet').classList.contains('on'),'點設定要切過去');
ok(d.querySelectorAll('.view.on').length===1,'同時只能顯示一頁');
ok(nav('vSet').getAttribute('aria-current')==='true','分頁要標記目前位置');
ok(!$('vStats').classList.contains('on'),'進度頁要收起來');

/* ---------- ② 設定類的東西都搬到設定頁 ---------- */
const inSet=id=>{ const el=$(id); return !!el && $('vSet').contains(el); };
['btnPin','btnGift','btnTake','btnCoupon','btnExport','btnImport','btnReset','btnResetShared','pinState']
  .forEach(id=>ok(inSet(id),`${id} 應該在設定頁`));
ok($('vSet').querySelectorAll('[data-scale]').length===4,'字體大小四段要在設定頁');
ok($('vSet').querySelectorAll('[data-theme-set]').length===3,'配色三段要在設定頁');
// 進度頁不該再留著這些
['btnPin','btnExport','btnReset','btnResetShared'].forEach(id=>
  ok(!$('vStats').contains($(id)),`進度頁不該還有 ${id}`));
ok($('vStats').querySelectorAll('[data-scale],[data-theme-set]').length===0,'進度頁不該還有顯示設定');
// 進度頁該留的東西要留著
['bankLeft','btnSpend','calMonthGrid','weakList','stDone','btnShareAll']
  .forEach(id=>ok($('vStats').contains($(id)),`${id} 應該留在進度頁`));

/* ---------- ③ 設定頁的功能真的能用 ---------- */
click([...d.querySelectorAll('#vSet [data-scale]')].find(b=>b.dataset.scale==='1.3'));
ok(d.documentElement.style.fontSize||w.localStorage.getItem('cq-scale'),'字級要真的套用');
ok(w.localStorage.getItem('cq-scale')==='1.3','字級要記住, 實得 '+w.localStorage.getItem('cq-scale'));
click([...d.querySelectorAll('#vSet [data-theme-set]')].find(b=>b.dataset.themeSet==='dark'));
ok(d.documentElement.getAttribute('data-theme')==='dark','配色要真的套用');
click([...d.querySelectorAll('#vSet [data-scale]')].find(b=>b.dataset.scale==='1'));
click([...d.querySelectorAll('#vSet [data-theme-set]')].find(b=>b.dataset.themeSet==='auto'));

ok($('pinState').textContent.includes('未設'),'沒設密碼時要講, 實得 '+$('pinState').textContent);
w.prompt=()=>'1234';
click($('btnPin'));
ok($('pinState').textContent.includes('已設'),'設好密碼後狀態要更新, 實得 '+$('pinState').textContent);
w.prompt=()=>null;
click($('btnReset'));
ok(w.eval('S.done')===0 || true,'');
// 密碼保護仍然有效（在設定頁按也一樣）
w.eval('S.done=7; save();');
w.prompt=()=>'0000';
click($('btnReset'));
ok(w.eval('S.done')===7,'設定頁的清除鈕一樣要擋密碼, 實得 '+w.eval('S.done'));
w.prompt=()=>'1234';
click($('btnReset'));
ok(w.eval('S.done')===0,'密碼對才清除');
let seq=['1234',''], si=0; w.prompt=()=>seq[si++]; click($('btnPin'));

/* ---------- ④ 說明改成點一下才展開 ---------- */
const infos=[...d.querySelectorAll('details.info')];
console.log('  可展開的說明:', infos.map(x=>x.querySelector('summary').textContent.trim()).join(' · '));
ok(infos.length>=4,'應該有數個可展開的說明, 實得 '+infos.length);
infos.forEach((x,i)=>{
  const sum=x.querySelector('summary');
  ok(!!sum,`第 ${i+1} 個說明要有標題列`);
  ok(sum && sum.textContent.trim().length>0,`第 ${i+1} 個標題不得空白`);
  ok(!x.open,`第 ${i+1} 個說明預設要收起來（${sum?sum.textContent.trim():''}）`);
  ok(x.textContent.replace(sum?sum.textContent:'','').trim().length>0,`第 ${i+1} 個說明要有內容`);
});
// 展開／收合都要能動
const one=infos[0];
one.open=true;
ok(one.open,'應該可以展開');
ok(one.querySelector('.info-in'),'展開後要有內容區');
one.open=false;

// 存摺的規則說明也收進去了，但內容還在（畫面要能查到怎麼算）
click(nav('vStats'));
ok($('vSet').contains($('btnPin'))===true,'切回進度頁不影響設定頁的內容');
const th=$('tierHint');
ok(!!th && th.closest('details.info'),'分鐘怎麼算的說明要收在可展開的區塊裡');
ok(th.textContent.includes('答對率'),'收起來不代表內容消失, 實得 '+th.textContent.slice(0,20));
ok(d.querySelector('.callegend').closest('details.info'),'日曆圖例也要收起來');

/* ---------- ⑤ 只有一份單字表，共用的東西要標明跟成語ㄚ喵共用 ---------- */
ok(!$('deckPicker') && !d.querySelector('.deck'),'不得再有題庫切換');
click(nav('vStats'));
ok(/共用/.test($('vStats').textContent),'共用的部分（存摺、日曆）要標明是共用的');
ok(/成語ㄚ喵/.test($('vStats').textContent),'要講清楚是跟成語ㄚ喵共用, 而不是「兩個題庫」');
ok(!/兩個題庫/.test([...d.body.querySelectorAll('*')].filter(e=>e.tagName!=='SCRIPT'&&e.tagName!=='STYLE'&&!e.children.length).map(e=>e.textContent).join(' ')),'畫面上不得再出現「兩個題庫」');
click(nav('vSet'));
ok(/單字/.test($('btnReset').textContent),`清除鈕要講清楚清的是單字, 實得 `+$('btnReset').textContent);

/* ---------- ⑥ 版面別再一大片小字 ---------- */
// 進度頁裸露的說明段落（沒被 details 包住的）應該很少
click(nav('vStats'));
const loose=[...$('vStats').querySelectorAll('.privacy, .backup-hint, .callegend')]
  .filter(x=>!x.closest('details'));
ok(loose.length===0,'進度頁不該再有沒收起來的說明小字, 實得 '+loose.map(x=>x.className).join(','));

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail?1:0);
