/* 舊版把日曆與存摺存在各題庫裡，改版後要合併到共用儲存且不能遺失 */
const fs=require('fs');
const {JSDOM}=require('jsdom');
const htmlPath=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(htmlPath,'utf8');
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('  ✗ '+m))};

function boot(seed){
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://x.test/'});
  seed(dom.window.localStorage);
  const dom2=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
    beforeParse(w){
      w.speechSynthesis={speak(){},cancel(){},getVoices:()=>[],addEventListener(){}};
      w.SpeechSynthesisUtterance=function(){};
      seed(w.localStorage);
    }});
  dom2.window.alert=()=>{}; dom2.window.scrollTo=()=>{};
  dom2.window.HTMLElement.prototype.scrollIntoView=function(){};
  return dom2.window;
}

// ① 舊版存檔：days / bank 各自放在兩個題庫裡
const w1=boot(ls=>{
  ls.setItem('cq-vocab-v1:summer', JSON.stringify({
    done:50, right:45, stats:{happy:{r:3,x:0,streak:3}},
    days:{'2026-08-10':{n:20,r:18,paid:4}, '2026-08-11':{n:30,r:28,paid:15}},
    bank:{earned:19, used:15, bonus:0}
  }));
  ls.setItem('cq-vocab-v1:full', JSON.stringify({
    done:30, right:25, stats:{water:{r:2,x:1,streak:0}},
    days:{'2026-08-11':{n:10,r:9,paid:2}, '2026-08-12':{n:25,r:22,paid:5}},
    bank:{earned:7, used:0, bonus:30}
  }));
});
const shared=w1.eval('SHARED');
// 兩份答題紀錄現在要併成一份（日曆與存摺照舊先合併到 cq-shared-v1）
ok(w1.eval('S.done')===80 && w1.eval('S.right')===70,'暑假版與總整理版的答題數要相加, 實得 '+w1.eval('S.done'));
ok(w1.eval('S.stats.happy.streak')===3 && w1.eval('S.stats.water.x')===1,'兩邊的字都要在');
ok(w1.localStorage.getItem('cq-vocab-v1:summer')===null,'併完暑假版那份要刪掉');
ok(!!shared,'應建立共用紀錄');
ok(Object.keys(shared.days).length===3,`三天的紀錄都要在（8/10、8/11、8/12），實得 ${Object.keys(shared.days).length}`);
ok(shared.days['2026-08-10'].n===20,'只有暑假版的那天要保留, 實得 '+shared.days['2026-08-10'].n);
ok(shared.days['2026-08-11'].n===40,`同一天兩個題庫要合併 30+10=40, 實得 ${shared.days['2026-08-11'].n}`);
ok(shared.days['2026-08-11'].r===37,`答對數也要合併 28+9=37, 實得 ${shared.days['2026-08-11'].r}`);
ok(shared.days['2026-08-12'].n===25,'只有總整理版的那天要保留');
ok(shared.bank.earned===26,`存摺賺到要相加 19+7=26, 實得 ${shared.bank.earned}`);
ok(shared.bank.used===15,`已用要相加 15+0=15, 實得 ${shared.bank.used}`);
ok(shared.bank.bonus===30,`紅利要相加 0+30=30, 實得 ${shared.bank.bonus}`);
ok(w1.eval('bankLeft()')===41,`可用餘額 26+30-15=41, 實得 ${w1.eval('bankLeft()')}`);
// 單字統計不受影響
ok(w1.eval('S.done')===80,'兩份答題數要併成一份 (50+30), 實得 '+w1.eval('S.done'));
ok(w1.eval('S.stats.happy.streak')===3,'單字連對紀錄要保留');
// 遷移後要寫進新的 key
ok(!!w1.localStorage.getItem('cq-shared-v1'),'應寫入 cq-shared-v1');
console.log('  舊存檔 → 合併後', Object.keys(shared.days).length, '天，存摺', w1.eval('bankLeft()'), '分鐘');

// ② 舊版 paid:true（更早的版本）也要能換算
const w2=boot(ls=>{
  ls.setItem('cq-vocab-v1:summer', JSON.stringify({
    done:10, right:10, stats:{},
    days:{'2026-08-09':{n:30,r:30,paid:true}},
    bank:{earned:15, used:0, bonus:0}
  }));
});
ok(w2.eval('SHARED.days["2026-08-09"].paid')>0,'paid:true 要換算成分鐘數, 實得 '+w2.eval('SHARED.days["2026-08-09"].paid'));

// ③ 全新使用者不該壞掉
const w3=boot(()=>{});
ok(w3.eval('Object.keys(SHARED.days).length')===0,'全新使用者日曆應為空');
ok(w3.eval('bankLeft()')===0,'全新使用者存摺應為 0');

// ④ 已經是新版的存檔，不該被重新遷移覆蓋
const w4=boot(ls=>{
  ls.setItem('cq-shared-v1', JSON.stringify({days:{'2026-08-01':{n:99,r:88}}, bank:{earned:5,used:0,bonus:0}}));
  ls.setItem('cq-vocab-v1:summer', JSON.stringify({done:1,right:1,stats:{},days:{'2026-08-02':{n:7,r:7}},bank:{earned:100,used:0,bonus:0}}));
});
ok(w4.eval('SHARED.days["2026-08-01"].n')===99,'既有的共用紀錄要照用');
ok(!w4.eval('SHARED.days["2026-08-02"]'),'不該再去合併題庫裡的舊欄位');
ok(w4.eval('SHARED.bank.earned')===5,'存摺要用共用的那份, 實得 '+w4.eval('SHARED.bank.earned'));

// ⑤ 備份碼要包含共用紀錄
const code=w1.eval('exportCode()');
ok(code.startsWith(w1.eval('BK_PREFIX')),'備份碼格式正確, 實得 '+code.slice(0,4));
ok(code.includes('shared')===false,'備份碼是編碼過的，不該看得到明文');
const w5=boot(()=>{});
ok(w5.eval(`importCode(${JSON.stringify(code)})`)==='','還原備份不該報錯');
ok(w5.eval('Object.keys(SHARED.days).length')===3,`還原後日曆要有 3 天, 實得 ${w5.eval('Object.keys(SHARED.days).length')}`);
ok(w5.eval('bankLeft()')===41,`還原後存摺要一致, 實得 ${w5.eval('bankLeft()')}`);

console.log(`\n通過 ${pass} / 失敗 ${fail}`);
process.exit(fail?1:0);
