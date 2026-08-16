/* 一次跑完所有測試，任何一組失敗就整體失敗（給 CI 用） */
const { execFileSync } = require("child_process");
const fs = require("fs"), path = require("path");

const files = fs.readdirSync(__dirname)
  .filter(f => f.endsWith(".js") && f !== "run.js")
  .sort();

let total = 0, failed = 0;
const broken = [];

for(const f of files){
  let out = "";
  try{
    out = execFileSync(process.execPath, [path.join(__dirname, f)], { encoding: "utf8" });
  }catch(e){
    out = (e.stdout || "") + (e.stderr || "");
    broken.push(f);
  }
  const m = out.match(/通過 (\d+) \/ 失敗 (\d+)/);
  if(m){
    total += +m[1]; failed += +m[2];
    console.log(`${f.padEnd(14)} 通過 ${m[1]} / 失敗 ${m[2]}`);
    if(+m[2] > 0) console.log(out.split("\n").filter(l => l.includes("✗")).join("\n"));
  }else if(/無障礙檢查通過/.test(out)){
    total += 1;
    console.log(`${f.padEnd(14)} 無障礙檢查通過`);
  }else{
    console.log(`${f.padEnd(14)} ⚠️ 沒有回報結果`);
    console.log(out.split("\n").slice(-12).join("\n"));
  }
}

console.log("─".repeat(46));
console.log(`合計 ${total} 項，失敗 ${failed}` + (broken.length ? `，執行錯誤: ${broken.join(", ")}` : ""));
process.exit(failed > 0 || broken.length ? 1 : 0);
