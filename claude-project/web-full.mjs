/**
 * Claude Master System — 全風格完整 Web 介面
 * 20 種主題 × 4 功能頁籤 × 串流 × 所有 AI
 */
import http from "http";
import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const PORT = process.env.PORT || 3000;

const THEMES = [
  { val:"dark",        label:"🌑 深色（預設）"   },
  { val:"light",       label:"☀️ 亮色"           },
  { val:"neon",        label:"💥 霓虹賽博"        },
  { val:"minimal",     label:"⬜ 極簡白"          },
  { val:"glass",       label:"🪟 玻璃擬態"        },
  { val:"tech",        label:"🖥️ 科技藍"          },
  { val:"nature",      label:"🌿 自然綠"          },
  { val:"retro",       label:"📟 復古終端機"      },
  { val:"ocean",       label:"🌊 深海藍"          },
  { val:"sunset",      label:"🌅 日落橙紫"        },
  { val:"arctic",      label:"❄️ 北極白藍"        },
  { val:"forest",      label:"🌲 森林深綠"        },
  { val:"luxury",      label:"✨ 奢華金黑"        },
  { val:"cyberpunk",   label:"🤖 賽博龐克"        },
  { val:"sakura",      label:"🌸 粉嫩櫻花"        },
  { val:"dracula",     label:"🧛 德古拉暗色"      },
  { val:"monokai",     label:"🎨 Monokai 程式碼" },
  { val:"nord",        label:"🏔️ 北歐清冷"        },
  { val:"solarized-dark", label:"🌞 護眼深色"    },
  { val:"material",    label:"📐 Material 設計"  },
];

const MODELS = {
  "── 直連 Anthropic ──":       "",
  "Claude Opus 4.8":            "claude-opus-4-8",
  "Claude Sonnet 4.6":          "claude-sonnet-4-6",
  "Claude Haiku 4.5":           "claude-haiku-4-5-20251001",
  "── 直連 OpenAI ──":          "",
  "GPT-4o":                     "gpt-4o",
  "GPT-4o Mini":                "gpt-4o-mini",
  "── 直連 Google ──":          "",
  "Gemini 2.0 Flash":           "gemini-2.0-flash",
  "── 直連 Groq/Mistral ──":    "",
  "Llama 3.3 70B (Groq)":       "llama-3.3-70b-versatile",
  "Mistral Large":               "mistral-large-latest",
  "Command R+":                  "command-r-plus",
  "── OpenRouter (300+ 模型) ──": "",
  "OR: Claude Opus 4":          "or/anthropic/claude-opus-4",
  "OR: GPT-4o":                 "or/openai/gpt-4o",
  "OR: Gemini 2.0 Flash":       "or/google/gemini-2.0-flash-001",
  "OR: DeepSeek V3":            "or/deepseek/deepseek-chat",
  "OR: DeepSeek R1 (推理)":     "or/deepseek/deepseek-r1",
  "OR: Llama 3.3 70B":          "or/meta-llama/llama-3.3-70b-instruct",
  "OR: Qwen 2.5 72B":           "or/qwen/qwen-2.5-72b-instruct",
  "OR: Grok 3 (xAI)":           "or/x-ai/grok-3",
};

// 讀取 themes.css
const THEMES_CSS_PATH = new URL("./styles/themes.css", import.meta.url).pathname;
const ANIM_CSS_PATH   = new URL("./styles/animations.css", import.meta.url).pathname;
const THEMES_CSS = fs.existsSync(THEMES_CSS_PATH) ? fs.readFileSync(THEMES_CSS_PATH, "utf-8") : "";
const ANIM_CSS   = fs.existsSync(ANIM_CSS_PATH)   ? fs.readFileSync(ANIM_CSS_PATH, "utf-8") : "";

const MODEL_OPTIONS = Object.entries(MODELS)
  .map(([label, val]) => val === ""
    ? `<option value="" disabled>──────────── ${label} ────────────</option>`
    : `<option value="${val}">${label}</option>`)
  .join("\n");

const THEME_OPTIONS = THEMES
  .map(t => `<option value="${t.val}">${t.label}</option>`)
  .join("\n");

const HTML = `<!DOCTYPE html>
<html lang="zh-TW" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Claude Master System</title>
<style>
${THEMES_CSS}
${ANIM_CSS}

/* ── 版面 ─────────────────────────────────────────────── */
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:var(--font,"Segoe UI",system-ui,sans-serif);background:var(--bg);color:var(--text);min-height:100vh;display:flex;flex-direction:column;}
nav{background:var(--surface);border-bottom:1px solid var(--border);padding:0 1rem;display:flex;align-items:center;gap:.5rem;height:52px;flex-wrap:wrap;}
nav h1{font-size:1rem;font-weight:700;color:var(--accent2);white-space:nowrap;margin-right:.5rem;}
.tabs{display:flex;gap:.2rem;flex:1;}
.tab{padding:.35rem .8rem;border-radius:6px;cursor:pointer;font-size:.82rem;color:var(--muted);border:none;background:none;transition:all .15s;}
.tab:hover{background:var(--surface2);color:var(--text);}
.tab.active{background:var(--accent);color:#fff;}
.theme-sel{padding:.3rem .6rem;font-size:.78rem;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--text);cursor:pointer;}
.dot{width:8px;height:8px;border-radius:50%;background:var(--success,#22c55e);flex-shrink:0;}

main{flex:1;display:flex;}
.panel{display:none;flex:1;flex-direction:column;padding:1rem;gap:.75rem;overflow:auto;}
.panel.active{display:flex;}

/* ── 元件 ─────────────────────────────────────────────── */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius,12px);padding:1rem;box-shadow:var(--shadow,none);}
.card h3{font-size:.9rem;color:var(--accent2);margin-bottom:.6rem;}
.row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;}
select,input,textarea{border-radius:var(--radius,8px);border:1px solid var(--border);background:var(--surface2);color:var(--text);padding:.5rem .75rem;font-size:.85rem;font-family:inherit;}
textarea{resize:vertical;min-height:56px;}
button{padding:.5rem 1rem;border-radius:var(--radius,8px);border:none;cursor:pointer;font-size:.85rem;font-weight:600;transition:all .15s;}
button:hover{opacity:.85;}
button:disabled{opacity:.35;cursor:not-allowed;}
.btn-p{background:var(--accent);color:#fff;}
.btn-s{background:var(--accent2);color:#fff;}
.btn-d{background:var(--err,#ef4444);color:#fff;}
.btn-g{background:var(--surface2);color:var(--text);border:1px solid var(--border);}

/* ── 聊天 ─────────────────────────────────────────────── */
#chat-box{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius,12px);padding:.75rem;overflow-y:auto;min-height:260px;max-height:460px;display:flex;flex-direction:column;gap:.5rem;}
.msg{padding:.55rem .9rem;border-radius:8px;line-height:1.65;max-width:88%;white-space:pre-wrap;word-break:break-word;animation:fadeIn .25s ease both;}
.msg.user{background:#1d4ed8;align-self:flex-end;color:#fff;}
.msg.ai{background:var(--surface2);align-self:flex-start;}
.msg.sys{background:var(--accent3,#10b981)22;color:var(--accent3,#10b981);font-size:.78rem;align-self:center;border-radius:4px;}
.typing{opacity:.6;font-style:italic;}

/* ── 競賽 ─────────────────────────────────────────────── */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.6rem;}
.race-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius,10px);padding:.75rem;font-size:.8rem;animation:fadeInScale .3s ease both;}
.race-card h4{color:var(--accent2);margin-bottom:.4rem;font-size:.78rem;display:flex;align-items:center;gap:.4rem;}
.badge{padding:.1rem .45rem;border-radius:4px;font-size:.7rem;font-weight:700;}
.badge.ok{background:var(--success,#22c55e);color:#000;}
.badge.err{background:var(--err,#ef4444);color:#fff;}
.badge.slow{background:var(--warn,#f59e0b);color:#000;}

/* ── Agent ────────────────────────────────────────────── */
#agent-log{font-family:monospace;font-size:.78rem;line-height:1.9;color:var(--muted);background:var(--surface);border:1px solid var(--border);border-radius:var(--radius,12px);padding:.75rem;min-height:180px;max-height:380px;overflow-y:auto;white-space:pre-wrap;}

/* ── 狀態 ─────────────────────────────────────────────── */
.stat{display:flex;justify-content:space-between;padding:.3rem 0;border-bottom:1px solid var(--border);font-size:.82rem;}
.stat:last-child{border:none;}
.sv{color:var(--accent3,#10b981);font-weight:600;}
.chip{display:inline-block;padding:.15rem .5rem;border-radius:4px;background:var(--surface2);border:1px solid var(--border);font-size:.72rem;margin:.1rem;}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;}
@media(max-width:600px){.g2,.g3{grid-template-columns:1fr;}}
</style>
</head>
<body>
<nav>
  <h1>🤖 Claude Master</h1>
  <div class="tabs">
    <button class="tab active" onclick="show('chat')">💬 對話</button>
    <button class="tab" onclick="show('race')">🏁 競賽</button>
    <button class="tab" onclick="show('agent')">🦾 Agent</button>
    <button class="tab" onclick="show('status')">📊 狀態</button>
  </div>
  <select class="theme-sel" onchange="setTheme(this.value)" title="切換主題">
    ${THEME_OPTIONS}
  </select>
  <div class="dot" title="系統正常"></div>
</nav>

<main>
<!-- ① 對話 -->
<div class="panel active" id="panel-chat">
  <div class="row">
    <select id="model">${MODEL_OPTIONS}</select>
    <select id="chat-mode">
      <option value="normal">一般</option>
      <option value="stream">串流</option>
      <option value="tools">工具</option>
    </select>
    <button class="btn-d" onclick="clearChat()">清除</button>
  </div>
  <div id="chat-box"></div>
  <div class="row">
    <textarea id="msg" rows="2" placeholder="輸入訊息…（Enter送出，Shift+Enter換行）" style="flex:1"></textarea>
    <button class="btn-p" id="send-btn" onclick="send()">送出</button>
  </div>
</div>

<!-- ② 競賽 -->
<div class="panel" id="panel-race">
  <div class="card">
    <h3>🏁 所有 AI 同時競賽</h3>
    <div class="row">
      <input id="race-q" type="text" placeholder="輸入問題…" value="用一句話說明台灣最有名的事物" style="flex:1">
      <button class="btn-s" id="race-btn" onclick="race()">開始</button>
    </div>
  </div>
  <div class="grid" id="race-grid"></div>
</div>

<!-- ③ Agent -->
<div class="panel" id="panel-agent">
  <div class="card">
    <h3>🦾 自動 Agent</h3>
    <textarea id="agent-task" rows="3" placeholder="描述任務…&#10;例：幫我分析這個專案並給出三個改善建議"></textarea>
    <div class="row" style="margin-top:.5rem">
      <select id="agent-model">${MODEL_OPTIONS}</select>
      <button class="btn-p" id="agent-btn" onclick="runAgent()">執行</button>
    </div>
  </div>
  <div id="agent-log">等待任務...</div>
</div>

<!-- ④ 狀態 -->
<div class="panel" id="panel-status">
  <div class="g2">
    <div class="card">
      <h3>🟢 系統資訊</h3>
      <div class="stat"><span>版本</span><span class="sv">3.0.0</span></div>
      <div class="stat"><span>主題數</span><span class="sv">20 種</span></div>
      <div class="stat"><span>模型數</span><span class="sv">${Object.keys(MODELS).length} 個</span></div>
      <div class="stat"><span>伺服器時間</span><span class="sv" id="s-time">—</span></div>
    </div>
    <div class="card">
      <h3>🎨 所有主題</h3>
      <div>${THEMES.map(t=>`<span class="chip" style="cursor:pointer" onclick="setTheme('${t.val}')" title="${t.val}">${t.label}</span>`).join("")}</div>
    </div>
  </div>
  <div class="card">
    <h3>🤖 支援模型</h3>
    <div>${Object.entries(MODELS).map(([l,v])=>`<span class="chip" title="${v}">${l}</span>`).join("")}</div>
  </div>
  <div class="card">
    <h3>📦 npm 指令</h3>
    <div class="g3">
      ${[
          ["preview",      "驗證連線"],
          ["run",          "執行主程式"],
          ["agent",        "自動Agent"],
          ["web:full",     "全功能介面"],
          ["auto-code",    "自動寫程式"],
          ["self-improve", "自我改善"],
          ["all-ai:race",  "AI競賽"],
          ["master",       "主控對話"],
          ["benchmark",    "效能測試"],
          ["install:full", "完整安裝"],
        ].map(([s,l])=>`<div style="display:flex;flex-direction:column;gap:.1rem"><code style="font-size:.72rem;background:var(--surface2);padding:.2rem .5rem;border-radius:4px">npm run ${s}</code><span style="font-size:.7rem;color:var(--muted)">${l}</span></div>`).join("")}
    </div>
  </div>
</div>
</main>

<script>
// 主題切換
function setTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  localStorage.setItem('theme',t);
  document.querySelector('.theme-sel').value=t;
}
// 初始化主題
const saved=localStorage.getItem('theme')||'dark';
setTheme(saved);

// Tab
function show(id){
  document.querySelectorAll('.tab').forEach((t,i)=>
    t.classList.toggle('active',['chat','race','agent','status'][i]===id));
  document.querySelectorAll('.panel').forEach(p=>
    p.classList.toggle('active',p.id==='panel-'+id));
  if(id==='status') document.getElementById('s-time').textContent=new Date().toLocaleString('zh-TW');
}

// 聊天
const box=document.getElementById('chat-box');
function addMsg(cls,text){
  const d=document.createElement('div');
  d.className='msg '+cls;
  d.textContent=text;
  box.appendChild(d);
  box.scrollTop=box.scrollHeight;
  return d;
}
function clearChat(){box.innerHTML='';}
document.getElementById('msg').addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}
});
async function send(){
  const inp=document.getElementById('msg');
  const m=inp.value.trim(); if(!m)return;
  const model=document.getElementById('model').value;
  inp.value='';
  addMsg('user',m);
  const aiDiv=addMsg('ai typing','思考中…');
  document.getElementById('send-btn').disabled=true;
  try{
    const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message:m,model})});
    const d=await r.json();
    aiDiv.className='msg ai animate-fadeIn';
    aiDiv.textContent=d.text||('[錯誤] '+d.error);
  }catch(e){aiDiv.textContent='[網路錯誤] '+e.message;aiDiv.className='msg ai';}
  document.getElementById('send-btn').disabled=false;
}

// 競賽
async function race(){
  const q=document.getElementById('race-q').value.trim(); if(!q)return;
  const grid=document.getElementById('race-grid'); grid.innerHTML='';
  document.getElementById('race-btn').disabled=true;
  const models=${JSON.stringify(Object.entries(MODELS))};
  models.forEach(([label,val],i)=>{
    const c=document.createElement('div');
    c.className='race-card'; c.id='rc-'+i;
    c.innerHTML='<h4>'+label+'</h4><span class="animate-spin" style="display:inline-block;width:12px;height:12px;border:2px solid var(--border);border-top-color:var(--accent2);border-radius:50%;"></span>';
    grid.appendChild(c);
  });
  await Promise.allSettled(models.map(async([label,val],i)=>{
    const start=Date.now();
    try{
      const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({message:q,model:val})});
      const d=await r.json();
      const ms=Date.now()-start;
      const cls=ms<2000?'ok':ms<5000?'slow':'err';
      document.getElementById('rc-'+i).innerHTML=
        '<h4>'+label+'<span class="badge '+cls+'">'+ms+'ms</span></h4>'+(d.text||d.error||'').slice(0,200);
    }catch(e){
      document.getElementById('rc-'+i).innerHTML=
        '<h4>'+label+'<span class="badge err">失敗</span></h4>'+e.message;
    }
  }));
  document.getElementById('race-btn').disabled=false;
}

// Agent
async function runAgent(){
  const task=document.getElementById('agent-task').value.trim(); if(!task)return;
  const model=document.getElementById('agent-model').value;
  const log=document.getElementById('agent-log');
  log.textContent='';
  document.getElementById('agent-btn').disabled=true;
  const add=t=>{log.textContent+=t+'\\n';log.scrollTop=log.scrollHeight;};
  add('🤖 Agent 啟動');add('📋 任務: '+task);add('🧠 模型: '+model);add('─'.repeat(40));
  try{
    const r=await fetch('/api/agent',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({task,model})});
    const d=await r.json();
    add('\\n✅ 完成\\n');add(d.result||JSON.stringify(d));
  }catch(e){add('[錯誤] '+e.message);}
  document.getElementById('agent-btn').disabled=false;
}
</script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  const json = (code, data) => {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(data));
  };

  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(HTML);
  }

  if (req.method === "POST" && (req.url === "/api/chat" || req.url === "/api/agent")) {
    let body = "";
    req.on("data", c => (body += c));
    req.on("end", async () => {
      try {
        const { message, model, task } = JSON.parse(body);
        const prompt = message || task || "Hello";
        const useModel = model || "claude-sonnet-4-6";
        let text = "";

        if (useModel.startsWith("or/")) {
          // OpenRouter 路徑
          const orKey = process.env.OPENROUTER_API_KEY;
          if (!orKey) throw new Error("請設定 OPENROUTER_API_KEY");
          const realModel = useModel.replace(/^or\//, "");
          const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${orKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://github.com/Gus0418/-",
              "X-Title": "Claude Master System",
            },
            body: JSON.stringify({
              model: realModel,
              max_tokens: 1024,
              messages: [{ role: "user", content: prompt }],
            }),
          });
          const orJson = await orRes.json();
          text = orJson.choices?.[0]?.message?.content ?? JSON.stringify(orJson);
        } else {
          // 直連 Anthropic
          const msg = await client.messages.create({
            model: useModel, max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
          });
          text = msg.content[0].type === "text" ? msg.content[0].text : "";
        }

        json(200, { text, model: useModel });
      } catch (e) { json(500, { error: e.message }); }
    });
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    return json(200, { status: "ok", node: process.version, themes: THEMES.length, models: Object.keys(MODELS).length });
  }

  res.writeHead(404); res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`\n🎨 全風格 Web 介面 (20 主題 × 所有AI)`);
  console.log(`   → http://localhost:${PORT}\n`);
});
