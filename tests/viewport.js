/* iPhone 主畫面 App：鍵盤收起後底部工具列卡在半空的預防（settleViewport）

   jsdom 沒有真的鍵盤，也不會算版面，所以這裡驗的是「有接上、沒改到行為」：
   - 包過的 prompt／confirm 回傳值要跟原本一樣
   - 對話框關掉後，要把畫面推 1px 再推回原位
   - 可見高度變小（鍵盤叫出來）不要亂推；變大（鍵盤收起來）才推
   假的 prompt／confirm／scrollTo／visualViewport 要在頁面程式跑之前放好，那一層才會包到它們。 */
const fs = require("fs"), path = require("path"), {JSDOM} = require("jsdom");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const sleep = ms => new Promise(r=>setTimeout(r, ms));

function boot(file){
  const html = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const calls = []; let vv = null;
  const dom = new JSDOM(html, {runScripts:"dangerously", pretendToBeVisual:true, url:"https://x.test/" + file,
    beforeParse(w){
      w.speechSynthesis = {speak(){}, cancel(){}, getVoices:()=>[], addEventListener(){}};
      w.SpeechSynthesisUtterance = function(t){ this.text = t; };
      w.prompt = ()=>"答案"; w.confirm = ()=>true; w.alert = ()=>{};
      w.scrollTo = (x, y)=>calls.push([x, y]);
      w.HTMLElement.prototype.scrollIntoView = function(){};
      vv = new w.EventTarget(); vv.height = 800; w.visualViewport = vv;
    }});
  return {w:dom.window, calls, vv};
}

(async()=>{
  for(const file of ["index.html", "idiom.html"]){
    const {w, calls, vv} = boot(file);
    await sleep(50);
    ok(typeof w.settleViewport === "function", `${file}：要有 settleViewport`);

    calls.length = 0;
    const v = w.eval('prompt("?")');
    ok(v === "答案", `${file}：包過的 prompt 回傳值要不變, 實得 ${v}`);
    await sleep(100);
    const y0 = w.scrollY || 0, last = calls[calls.length - 1];
    ok(calls.length >= 2 && Math.abs(calls[0][1] - y0) === 1 && last && last[1] === y0,
      `${file}：輸入框關掉後要把畫面推 1px 再推回原位, 實得 ${JSON.stringify(calls)}`);

    calls.length = 0;
    ok(w.eval('confirm("?")') === true, `${file}：包過的 confirm 回傳值要不變`);
    await sleep(100);
    ok(calls.length >= 2, `${file}：確認框關掉後也要推畫面, 實得 ${calls.length} 次`);

    calls.length = 0;
    vv.height = 450; vv.dispatchEvent(new w.Event("resize")); await sleep(100);
    ok(calls.length === 0, `${file}：鍵盤叫出來（可見高度變小）不要亂推, 實得 ${calls.length} 次`);
    vv.height = 800; vv.dispatchEvent(new w.Event("resize")); await sleep(100);
    ok(calls.length >= 2, `${file}：鍵盤收起來（可見高度變大）要推畫面, 實得 ${calls.length} 次`);

    calls.length = 0;
    vv.height = 790; vv.dispatchEvent(new w.Event("resize")); await sleep(100);
    ok(calls.length === 0, `${file}：高度小小晃動（網址列伸縮那種）不要推, 實得 ${calls.length} 次`);
    w.close();
  }
  console.log(`\n通過 ${pass} / 失敗 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
