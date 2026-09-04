/* 無障礙檢查，抽成共用：單字闖關和成語ㄚ喵兩頁都要過同一關。
   規則跟原本 tests/a11y.js 一樣，只是把「開哪一頁」變成參數。
   放在 tests/lib/ 底下，run.js 只跑 tests/ 第一層的 .js，不會把它當成測試跑。 */
const fs = require("fs"), path = require("path"), {JSDOM} = require("jsdom");

function check(file, opts = {}){
  const html = fs.readFileSync(file, "utf8");
  const dom = new JSDOM(html, {runScripts:"dangerously", pretendToBeVisual:true, url:"https://x.test/" + path.basename(file),
    beforeParse(win){
      win.speechSynthesis = {speak(){}, cancel(){}, getVoices:()=>[{lang:"en-US", name:"S"}], addEventListener(){}};
      win.SpeechSynthesisUtterance = function(t){ this.text = t; };
    }});
  const w = dom.window, d = w.document;
  w.alert = ()=>{}; w.scrollTo = ()=>{}; w.HTMLElement.prototype.scrollIntoView = function(){};
  const issues = [], bad = m => issues.push(m);

  if(!d.documentElement.lang) bad("缺少 lang 屬性（螢幕閱讀器會用錯語言念中文）");
  [...d.querySelectorAll("button")].forEach(b=>{
    const name = (b.textContent || "").trim() || b.getAttribute("aria-label") || "";
    if(!name) bad(`按鈕沒有可讀名稱: id=${b.id || "(無)"} class=${b.className}`);
  });
  [...d.querySelectorAll("input,textarea")].forEach(el=>{
    const has = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") ||
      (el.id && d.querySelector(`label[for="${el.id}"]`));
    if(!has) bad(`輸入欄沒有標籤: id=${el.id || "(無)"} type=${el.type || "textarea"}`);
  });
  [...d.querySelectorAll("div,span,li,p")].forEach(el=>{
    if(el.getAttribute("onclick") || el.onclick){
      const t = el.getAttribute("tabindex"), r = el.getAttribute("role");
      const isContainer = r === "dialog" || r === "group" || r === "region";
      if(!isContainer && (t === null || !r)) bad(`可點但不能用鍵盤: <${el.tagName.toLowerCase()} id=${el.id || "(無)"}>`);
    }
  });
  if(opts.live){
    const q = d.getElementById(opts.live);
    if(q && !q.getAttribute("aria-live") && !q.closest("[aria-live]")) bad(`#${opts.live} 沒有 aria-live，換題時螢幕閱讀器不會念`);
  }
  [...d.querySelectorAll("img")].forEach(im=>{ if(!im.hasAttribute("alt")) bad("圖片缺 alt"); });
  if(!/:focus-visible/.test(html)) bad("沒有 :focus-visible 樣式，鍵盤使用者看不到焦點在哪");
  if(![...d.querySelectorAll("h1,h2,h3")].some(h=>h.tagName === "H1")) bad("整頁沒有 h1");
  if(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/.test(html)) bad("viewport 禁止縮放（放大手勢會失效）");
  // 停用的導覽鈕要用 aria-disabled 而不是 disabled：後者會讓它從 tab 順序消失，
  // 螢幕閱讀器使用者根本不知道有這一頁
  [...d.querySelectorAll(".nav button[disabled]")].forEach(b=>bad(`導覽鈕「${b.textContent.trim()}」用了 disabled，應改用 aria-disabled 才進得了 tab 順序`));
  return issues;
}
module.exports = {check};
