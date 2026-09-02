/* 單字闖關 · 雲端備份 API
 *
 * 兩把鑰匙，權限在路由層強制分開：
 *   WRITE_CODE（小孩裝置）只能 PUT /s/:child —— 碰不到任何讀取路徑
 *   READ_CODE （家長儀表板）只能 GET /p/*    —— 碰不到任何寫入路徑
 * 家長端「唯讀」不是靠畫面上不放按鈕，是這裡擋掉的。
 *
 * 雲端只增不改：每次上傳寫一把新的 snap: 鑰匙（保留 90 天），
 * 另外覆寫一把 head: 當最新指標。小孩若貼了一張舊備份碼把 head 蓋掉，
 * 歷史還在 snap: 裡，查得到也救得回來。
 */

const HIST_DAYS = 90;
const MAX_BODY  = 1024 * 1024;         // 1 MB。備份碼滿載約 40 KB，這是防呆不是限制
const MAX_NAME  = 40;

function timingSafe(a, b){             // 別用 === 直接比密鑰
  // 兩邊都是空字串時長度相等、迴圈不跑、d 是 0 —— 會回傳 true。
  // 也就是密鑰沒設定時「不帶 Authorization」反而通過，等於全世界都能寫。
  // 這裡先擋掉空字串，下面 fetch 開頭再擋一次沒設定的情況。
  if(!a || !b) return false;
  if(typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for(let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function bearer(req){
  const h = req.headers.get("Authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7) : "";
}
function corsHeaders(req, env){
  const allow = String(env.ALLOW_ORIGIN || "").split(",").map(s=>s.trim()).filter(Boolean);
  const origin = req.headers.get("Origin") || "";
  const h = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
  if(allow.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}
function json(body, status, req, env){
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({"Content-Type":"application/json; charset=utf-8",
                            "Cache-Control":"no-store"}, corsHeaders(req, env))
  });
}
const pad = n => String(n).padStart(12, "0");

// KV 的鑰匙用 : 分段，名字裡混進 : 會汙染整個結構
// （叫「amy:x」的人，他的 snap 會混進「amy」的歷史裡）
const NAME_OK = /^[\w\u4e00-\u9fff .-]{1,40}$/;
function dec(s){ try{ return decodeURIComponent(s); }catch(e){ return null; } }

// KV 的 list 一頁最多 1000 把鑰匙。90 天的歷史一定會超過，
// 不接 cursor 的話拿到的是「最舊的那 1000 把」，最新的反而看不到。
async function listAll(kv, prefix){
  let cursor, out = [], page = 0;
  do{
    const r = await kv.list({prefix, cursor});
    out = out.concat(r.keys.map(k=>k.name));
    cursor = r.list_complete ? null : r.cursor;
  }while(cursor && ++page < 20);
  return out;
}

export default {
  async fetch(req, env){
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);

    if(req.method === "OPTIONS") return new Response(null, {status:204, headers:corsHeaders(req, env)});

    // 密鑰沒綁就整支停用。寧可壞掉也不要默默變成沒有門的房子。
    if(!env.WRITE_CODE || !env.READ_CODE) return json({e:"not configured"}, 500, req, env);

    // ---- 寫入：只有小孩那把鑰匙進得來 ----
    if(req.method === "PUT" && parts[0] === "s" && parts.length === 2){
      if(!timingSafe(bearer(req), env.WRITE_CODE || "")) return json({e:"bad code"}, 401, req, env);

      const child = (dec(parts[1]) || "").trim();
      if(!NAME_OK.test(child) || child.length > MAX_NAME) return json({e:"bad child"}, 400, req, env);

      const raw = await req.text();
      if(raw.length > MAX_BODY) return json({e:"too big"}, 413, req, env);
      let body;
      try{ body = JSON.parse(raw); }catch(e){ return json({e:"bad json"}, 400, req, env); }
      if(!body || typeof body.code !== "string") return json({e:"bad payload"}, 400, req, env);

      const at = Math.floor(Date.now() / 1000);
      const dev = (String((body.sum && body.sum.dev) || "").replace(/[^\w-]/g, "").slice(0, 16)) || "x";
      const rec = JSON.stringify({at, child, dev, code:body.code, sum:body.sum || null});

      await env.KV.put(`snap:${child}:${dev}:${pad(at)}`, rec,
                       {expirationTtl: HIST_DAYS * 86400});   // 歷史，只增不改
      await env.KV.put(`head:${child}`, rec);                 // 最新指標
      return json({ok:true, at}, 200, req, env);
    }

    // ---- 讀取：只有家長那把鑰匙進得來，而且只有 GET ----
    if(parts[0] === "p"){
      if(req.method !== "GET") return json({e:"read-only"}, 405, req, env);
      if(!timingSafe(bearer(req), env.READ_CODE || "")) return json({e:"bad code"}, 401, req, env);

      if(parts[1] === "list" && parts.length === 2){
        const ks = await env.KV.list({prefix:"head:"});
        const out = [];
        for(const k of ks.keys){
          const v = await env.KV.get(k.name);
          if(!v) continue;
          try{
            const r = JSON.parse(v);
            out.push({child:r.child, dev:r.dev, at:r.at, sum:r.sum});   // 刻意不回傳 code
          }catch(e){}
        }
        out.sort((a, b)=>String(a.child).localeCompare(String(b.child)));
        return json({children:out}, 200, req, env);
      }

      if(parts[1] === "snap" && parts.length === 3){         // 家長要拿完整備份碼時才給
        const child = dec(parts[2]);
        if(!child || !NAME_OK.test(child)) return json({e:"bad child"}, 400, req, env);
        const v = await env.KV.get(`head:${child}`);
        if(!v) return json({e:"not found"}, 404, req, env);
        return new Response(v, {status:200,
          headers:Object.assign({"Content-Type":"application/json; charset=utf-8",
                                 "Cache-Control":"no-store"}, corsHeaders(req, env))});
      }

      if(parts[1] === "history" && parts.length === 3){      // 出事時倒退查
        const child = dec(parts[2]);
        if(!child || !NAME_OK.test(child)) return json({e:"bad child"}, 400, req, env);
        const ks = await listAll(env.KV, `snap:${child}:`);
        return json({keys:ks.sort().reverse().slice(0, 50)}, 200, req, env);
      }

      // 光有鑰匙名稱救不回東西，要能真的把那一份取出來
      if(parts[1] === "at" && parts.length >= 3){
        const key = dec(url.pathname.slice(url.pathname.indexOf("/at/") + 4));
        if(!key || !key.startsWith("snap:")) return json({e:"bad key"}, 400, req, env);
        const v = await env.KV.get(key);
        if(!v) return json({e:"not found"}, 404, req, env);
        return new Response(v, {status:200,
          headers:Object.assign({"Content-Type":"application/json; charset=utf-8",
                                 "Cache-Control":"no-store"}, corsHeaders(req, env))});
      }
    }

    return json({e:"not found"}, 404, req, env);
  }
};
