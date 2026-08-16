const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  beforeParse(win){ win.speechSynthesis={speak(){},cancel(){},getVoices:()=>[{lang:'en-US',name:'S'}],addEventListener(){}};
    win.SpeechSynthesisUtterance=function(t){this.text=t;}; }});
const w=dom.window,d=w.document; w.alert=()=>{}; w.scrollTo=()=>{};
w.HTMLElement.prototype.scrollIntoView=function(){};
const $=id=>d.getElementById(id), click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('  ✗ '+m))};
const root=d.documentElement;

// 語言
ok(root.lang==='zh-TW','應設定 lang=zh-TW, 實得 '+root.lang);
// 字級
ok(root.style.getPropertyValue('--scale')==='1','預設字級為 1');
const big=[...d.querySelectorAll('[data-scale]')].find(b=>b.dataset.scale==='1.3');
click(big);
ok(root.style.getPropertyValue('--scale')==='1.3','應套用特大字級');
ok(big.getAttribute('aria-pressed')==='true','選中的按鈕要標示');
ok([...d.querySelectorAll('[data-scale]')].filter(b=>b.getAttribute('aria-pressed')==='true').length===1,'只能有一個選中');
ok(w.localStorage.getItem('cq-scale')==='1.3','字級要記住');
// 配色
ok(!root.hasAttribute('data-theme'),'預設跟隨系統');
const dark=[...d.querySelectorAll('[data-theme-set]')].find(b=>b.dataset.themeSet==='dark');
click(dark);
ok(root.getAttribute('data-theme')==='dark','應切到深色');
ok(w.localStorage.getItem('cq-theme')==='dark','配色要記住');
const auto=[...d.querySelectorAll('[data-theme-set]')].find(b=>b.dataset.themeSet==='auto');
click(auto);
ok(!root.hasAttribute('data-theme'),'切回跟隨系統應移除屬性');
// 鍵盤操作複習卡
click([...d.querySelectorAll('.nav button')].find(b=>b.dataset.view==='vList'));
click($('btnReview'));
ok(!$('review').hidden,'複習應開啟');
ok($('rvCard').getAttribute('role')==='button','卡片要有 button 角色');
ok($('rvCard').getAttribute('tabindex')==='0','卡片要能取得焦點');
const key=(el,k)=>el.dispatchEvent(new w.KeyboardEvent('keydown',{key:k,bubbles:true}));
key($('rvCard'),'Enter');
ok(!$('rvBack').hidden,'按 Enter 要翻面');
const before=$('rvCount').textContent;
key($('rvCard'),'ArrowRight');
ok($('rvCount').textContent!==before,'右方向鍵要換下一張');
key($('rvCard'),'ArrowLeft');
ok($('rvCount').textContent===before,'左方向鍵要回上一張');
key(d.body,'Escape');
ok($('review').hidden,'Esc 要關掉複習');
// PWA 檔案齊全
ok(/rel="manifest"/.test(html),'應連結 manifest');
ok(/apple-touch-icon/.test(html),'應有 iOS 圖示');
ok(/serviceWorker/.test(html),'應註冊 service worker');
ok(!!$('updateBar'),'應有更新提示列');
ok($('updateBar').hidden,'更新提示預設隱藏');
ok(w.getComputedStyle($('updateBar')).display==='none','更新提示實際上要看不到');
w.eval('showUpdate({postMessage(){}})');
ok(!$('updateBar').hidden,'有新版時要顯示提示');
click($('btnUpdate'));
ok($('updateBar').hidden,'按了更新要收起提示');

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail?1:0);
