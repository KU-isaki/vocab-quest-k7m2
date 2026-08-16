const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/'});
const w=dom.window,d=w.document; w.alert=()=>{}; w.scrollTo=()=>{};
w.HTMLElement.prototype.scrollIntoView=function(){};
const $=id=>d.getElementById(id), click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('  ✗ '+m))};

// jsdom 不解析 var()，改用「CSS 規則層級」檢查：
// 找出所有會設定 .btn color 的規則，確認沒有比 .btn.ghost / .btn.quiet 更強的通用規則
const css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
const rules=[...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
  .map(m=>({sel:m[1].trim(), body:m[2]}))
  .filter(r=>/(^|[;\s])color\s*:/.test(r.body) && /\.btn/.test(r.sel));
console.log('=== 會設定 .btn 文字色的規則 ===');
rules.forEach(r=>console.log('   ', r.sel, '→', r.body.match(/(^|[;\s])color\s*:[^;]*/)[0].trim()));
const spec=sel=>{ // 粗略特異性：id, class/attr/pseudo-class, type
  const ids=(sel.match(/#[\w-]+/g)||[]).length;
  const cls=(sel.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g)||[]).length;
  return ids*100+cls*10;
};
// 狀態選擇器（:disabled/:hover/:active/:focus）本來就該覆蓋基礎樣式，不算「通用規則」
const generic=rules.filter(r=>!/\.ghost|\.quiet|\.done|:disabled|:hover|:active|:focus/.test(r.sel));
const ghost=rules.find(r=>/\.ghost/.test(r.sel));
const quiet=rules.find(r=>/\.quiet/.test(r.sel));
ok(!!ghost && !!quiet,'ghost / quiet 都要自己設定文字色');
generic.forEach(g=>{
  ok(spec(g.sel) < spec(ghost.sel), `通用規則「${g.sel}」特異性(${spec(g.sel)}) 不得 >= .btn.ghost(${spec(ghost.sel)})，否則會蓋掉次要按鈕文字色`);
  ok(spec(g.sel) < spec(quiet.sel), `通用規則「${g.sel}」不得蓋過 .btn.quiet`);
});
ok(generic.every(g=>!/#fff|#FFF|white/i.test(g.body)) || generic.every(g=>/var\(/.test(g.body)),
   '主按鈕文字色應走 token，不要硬寫白色（深淺色模式會相反）');
ok(/--btn-fg/.test(css),'應該有 --btn-fg token');
const dis=/\.btn:disabled\{([^}]*)\}/.exec(css);
ok(!!dis,'應有 .btn:disabled 樣式，否則停用時看起來仍可按');
if(dis){
  const fg=/(?:^|[;\s])color\s*:\s*var\(([^)]+)\)/.exec(dis[1]);
  const bg=/background\s*:\s*var\(([^)]+)\)/.exec(dis[1]);
  ok(!!bg,'停用按鈕要換背景色，才看得出不能按');
  ok(!(fg&&bg&&fg[1]===bg[1]),'停用按鈕的文字與背景不得用同一個顏色 token');
}
const darkBlocks=css.split('prefers-color-scheme:dark')[1]||'';
ok(/--btn-fg/.test(darkBlocks) || /data-theme="dark"[\s\S]*--btn-fg/.test(css),'深色模式要重新定義 --btn-fg');

// 複製按鈕的回饋標示
w.navigator.clipboard={writeText:async()=>{}};
(async()=>{
  const b=$('btnShare');
  const before=b.textContent;
  ok(/複製/.test(before),'按鈕文案要讓人看得出是複製, 實得 '+before);
  click(b);
  await new Promise(r=>setTimeout(r,20));
  ok(b.textContent.includes('已複製'),'按下去要變成「已複製」, 實得 '+b.textContent);
  ok(b.classList.contains('done'),'應加上成功樣式');
  ok(/貼上/.test(b.textContent),'要告訴小孩下一步去貼上');
  console.log(`\n通過 ${pass} / 失敗 ${fail}`);
  process.exit(fail?1:0);
})();
