const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  beforeParse(win){ win.speechSynthesis={speak(){},cancel(){},getVoices:()=>[{lang:'en-US',name:'S'}],addEventListener(){}};
    win.SpeechSynthesisUtterance=function(t){this.text=t;}; }});
const w=dom.window,d=w.document; w.alert=()=>{}; w.scrollTo=()=>{};
w.HTMLElement.prototype.scrollIntoView=function(){};
const $=id=>d.getElementById(id), click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
let issues=[];
const bad=(m)=>issues.push(m);

// 1. 語言標記
if(!d.documentElement.lang) bad('缺少 lang 屬性（螢幕閱讀器會用錯語言念中文）');
// 2. 按鈕都要有可讀名稱
[...d.querySelectorAll('button')].forEach(b=>{
  const name=(b.textContent||'').trim()||b.getAttribute('aria-label')||'';
  if(!name) bad(`按鈕沒有可讀名稱: id=${b.id||'(無)'} class=${b.className}`);
});
// 3. 輸入欄要有標籤
[...d.querySelectorAll('input,textarea')].forEach(el=>{
  const has=el.getAttribute('aria-label')||el.getAttribute('aria-labelledby')||
    (el.id&&d.querySelector(`label[for="${el.id}"]`));
  if(!has) bad(`輸入欄沒有標籤: id=${el.id||'(無)'} type=${el.type||'textarea'} placeholder="${el.placeholder||''}"`);
});
// 4. 用 onclick 但不可鍵盤操作的元素
[...d.querySelectorAll('div,span,li,p')].forEach(el=>{
  if(el.getAttribute('onclick')||el.onclick){
    const t=el.getAttribute('tabindex'), r=el.getAttribute('role');
    // dialog 是容器，靠內部按鈕與 Esc 操作，不需要自己可聚焦
    const isContainer = r==='dialog' || r==='group' || r==='region';
    if(!isContainer && (t===null||!r))
      bad(`可點但不能用鍵盤: <${el.tagName.toLowerCase()} id=${el.id||'(無)'}> role=${r} tabindex=${t}`);
  }
});
// 5. 題目變動要讓螢幕閱讀器知道
const q=$('qPrompt');
if(q && !q.getAttribute('aria-live') && !(q.closest('[aria-live]'))) bad('題目區沒有 aria-live，換題時螢幕閱讀器不會念');
// 6. 圖片替代文字
[...d.querySelectorAll('img')].forEach(im=>{ if(!im.hasAttribute('alt')) bad('圖片缺 alt'); });
// 7. 焦點樣式
if(!/:focus-visible/.test(html)) bad('沒有 :focus-visible 樣式，鍵盤使用者看不到焦點在哪');
// 8. 標題階層
const hs=[...d.querySelectorAll('h1,h2,h3')].map(h=>h.tagName);
if(!hs.includes('H1')) bad('整頁沒有 h1');
// 9. 縮放限制
if(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/.test(html)) bad('viewport 禁止縮放（放大手勢會失效）');

console.log(issues.length? `發現 ${issues.length} 個無障礙問題：\n` + issues.map(x=>'  ✗ '+x).join('\n')
  : '✅ 無障礙檢查通過');
