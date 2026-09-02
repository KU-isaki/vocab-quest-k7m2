/* 事件身分：dev（哪台裝置）+ seq（第幾號）+ ts（什麼時候）

   兩個小孩各自有裝置，日後要把紀錄合起來看時，「這兩筆是不是同一筆」只能靠一組
   穩定的識別碼。時間戳不夠用：同一秒可能兩筆，而且早期版本備份碼還原時把 ts 洗成 0。
   這組欄位現在還沒有人用，但格式必須先定對 —— 之後再補等於要遷移全部歷史紀錄。 */
const fs=require('fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
function boot(seed){
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
    beforeParse(win){ win.speechSynthesis={speak(){},cancel(){},getVoices:()=>[{lang:'en-US',name:'S'}],addEventListener(){}};
      win.SpeechSynthesisUtterance=function(t){this.text=t;};
      if(seed) seed(win.localStorage); }});
  const w=dom.window; w.alert=()=>{}; w.confirm=()=>true; w.scrollTo=()=>{};
  w.HTMLElement.prototype.scrollIntoView=function(){};
  return w;
}
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('  ✗ '+m))};

const w=boot(); const ev=x=>w.eval(x), $=id=>w.document.getElementById(id);
const click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const REWARD=w.eval('REWARD');
const gifts=()=>JSON.parse(ev('JSON.stringify(SHARED.gifts)'));
const coupons=()=>JSON.parse(ev('JSON.stringify(SHARED.coupons)'));
const reset=()=>ev('SHARED={days:{},bank:{earned:0,used:0,bonus:0},gifts:[],coupons:[]}; saveShared();');
// 比對內容而不是 JSON 字面：物件的鍵順序在還原前後本來就不同，那不是問題
const norm=e=>[e.d, e.m===undefined?"":e.m, e.on||"", e.dev, +e.seq, +e.ts, e.why].join("/");
const all=()=>[...gifts(),...coupons()].map(norm).join(" | ");
function run(id,...a){ let i=0; w.prompt=()=>a[i++]; click($(id)); }

// ① 裝置編號要生得出來、而且不會每次都換
const dev=ev('deviceId()');
ok(/^[a-z0-9]{4,8}$/.test(dev),`裝置編號格式要乾淨（不能有備份碼的分隔符）, 實得 ${dev}`);
ok(ev('deviceId()')===dev,'同一台裝置每次拿到的編號要一樣');
ok(w.localStorage.getItem('cq-device')===dev,'裝置編號要存起來');
const w2=boot(); ok(w2.eval('deviceId()')!==dev,'不同裝置要拿到不同編號');

// ② 每筆新事件都要蓋章
reset();
run('btnGift','30','幫忙洗碗');
run('btnGift','10','考試進步');
run('btnCoupon','週末衝刺');
const g=gifts(), c=coupons();
ok(g.length===2&&c.length===1,'事件要記得下來');
[...g,...c].forEach((e,i)=>{
  ok(e.dev===dev,`第 ${i+1} 筆要記下哪台裝置, 實得 ${e.dev}`);
  ok(+e.seq>0,`第 ${i+1} 筆要有序號, 實得 ${e.seq}`);
  ok(+e.ts>1e9&&+e.ts<1e11,`第 ${i+1} 筆的時間戳要是「秒」不是毫秒, 實得 ${e.ts}`);
});
const seqs=[...g,...c].map(e=>+e.seq);
ok(new Set(seqs).size===seqs.length,`同一台裝置的序號不得重複, 實得 ${seqs}`);
ok(Math.max(...seqs)===seqs.length,`序號要連續遞增, 實得 ${seqs}`);
ok(g[0].seq<g[1].seq,'先發生的序號要比較小');
ok(c[0].seq>g[1].seq,'贈送與加倍券要共用同一組序號，不得各自從 1 開始');

// ③ 舊紀錄（沒有 dev/seq、ts 是毫秒）載入時要補齊
const w3=boot(ls=>ls.setItem('cq-shared-v1', JSON.stringify({
  days:{}, bank:{earned:0,used:0,bonus:0},
  gifts:[{d:'2026-08-01',m:30,why:'舊紀錄',ts:1755000000000}],
  coupons:[{d:'2026-08-02',on:null,why:'舊券'}]})));
const og=JSON.parse(w3.eval('JSON.stringify(SHARED.gifts)'))[0];
const oc=JSON.parse(w3.eval('JSON.stringify(SHARED.coupons)'))[0];
ok(!!og.dev&&+og.seq>0,`舊贈送要補上身分, 實得 ${JSON.stringify(og)}`);
ok(og.ts===1755000000,`毫秒要換算成秒, 實得 ${og.ts}`);
ok(!!oc.dev&&+oc.seq>0,'舊加倍券也要補上身分');
ok(og.why==='舊紀錄'&&oc.why==='舊券','補身分不得動到原本的內容');

// ④ 新版備份碼要把身分原封不動帶著走
const snap=all();
const code=ev('exportCode()');
ok(code.startsWith('CQ4:'),`備份碼要升到 CQ4, 實得 ${code.slice(0,4)}`);
reset();
ok(ev(`importCode(${JSON.stringify(code)})`)==='','新版備份碼要還原得回來');
ok(all()===snap,`身分欄位要原封不動:\n  還原前 ${snap}\n  還原後 ${all()}`);

// ⑤ 還原之後再新增，序號不得跟還原進來的撞號
run('btnGift','5','還原後再送');
const after=gifts().slice(-1)[0];
ok(!gifts().slice(0,-1).some(x=>x.dev===after.dev&&x.seq===after.seq),
  `新事件不得跟已存在的撞號, 實得 ${after.dev}#${after.seq}`);
ok(+after.seq===Math.max(...[...gifts(),...coupons()].filter(e=>e.dev===dev).map(e=>+e.seq)),
  '新事件要拿到最大的序號');

// ⑥ CQ3 舊碼：沒有身分欄位，還原時要補一組「同一張碼還原幾次都一樣」的
reset();
run('btnGift','20','舊碼測試');
run('btnCoupon','舊券測試');
const cq3=ev(`(()=>{
  const gf=SHARED.gifts.map(g=>sd(g.d)+":"+g.m+":"+g.why).join(";");
  const cp=SHARED.coupons.map(c=>sd(c.d)+":"+sd(c.on)+":"+c.why).join(";");
  return "CQ3:"+b64e("~shared=0|0|0|0|0||"+"|"+gf+"|"+cp);})()`);
reset();
ok(ev(`importCode(${JSON.stringify(cq3)})`)==='','CQ3 舊碼要還原得回來');
const a1=JSON.stringify([...gifts(),...coupons()].map(e=>[e.dev,e.seq]));
ok(gifts()[0].why==='舊碼測試','CQ3 的內容要還原正確');
ok(!!gifts()[0].dev&&+gifts()[0].seq>0,`CQ3 還原的事件也要有身分, 實得 ${JSON.stringify(gifts()[0])}`);
reset();
ev(`importCode(${JSON.stringify(cq3)})`);
ok(JSON.stringify([...gifts(),...coupons()].map(e=>[e.dev,e.seq]))===a1,
  '同一張 CQ3 碼還原兩次要得到同一組身分（否則之後合併會算成兩筆）');

// ⑦ CQ2 最舊的碼還是要還原得回來，而且不得再把每天灌成上限 60
reset();
const cq2='CQ2:'+w.btoa('~shared=0|0|18|0|0||260816:30,30,1');
ok(ev(`importCode(${JSON.stringify(cq2)})`)==='','CQ2 舊碼要還原得回來');
const paid=ev('paidOf(SHARED.days["2026-08-16"])');
ok(paid>0&&paid<REWARD,`CQ2 的達標日要回推出合理分鐘、不得是上限 ${REWARD}, 實得 ${paid}`);
ok(ev('importCode("CQ5:亂打")')!=='','不認得的版本要擋下來');
ok(ev('importCode("亂打一通")')!=='','不是備份碼要擋下來');

// ⑧ 「這台是誰在用」：只存本機，但要跟著備份碼搬家
ok(ev('getWho()')==='','預設沒有名字');
run('btnWho','大寶');
ok(ev('getWho()')==='大寶',`名字要存得起來, 實得 ${ev('getWho()')}`);
ok(w.localStorage.getItem('cq-profile')==='大寶','名字要存在 localStorage');
ok($('whoState').textContent==='大寶','設定頁要顯示目前的名字');
run('btnWho','a|b~c;d:e,f=g');
ok(!/[|~;:,=]/.test(ev('getWho()')),`名字不得殘留備份碼的分隔符, 實得 ${ev('getWho()')}`);
run('btnWho','二寶');
const code2=ev('exportCode()');
const w4=boot();
ok(w4.eval('getWho()')==='','新裝置本來沒有名字');
ok(w4.eval(`importCode(${JSON.stringify(code2)})`)==='','還原不得報錯');
ok(w4.eval('getWho()')==='二寶',`名字要跟著備份碼搬過去, 實得 ${w4.eval('getWho()')}`);
run('btnWho','');
ok(ev('getWho()')==='','留空要能清掉名字');
ok($('whoState').textContent==='還沒填','清掉後設定頁要標示還沒填');

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail?1:0);
