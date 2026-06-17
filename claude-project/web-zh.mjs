/**
 * 繁體中文全功能 Web 介面
 * 整合所有模組：聊天 / Agent / 競賽 / 生成 / 系統狀態
 */
import http from "http";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const PORT = process.env.PORT || 3000;

const HTML = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Claude Master System — 繁體中文介面</title>
  <style>
    :root {
      --bg: #0f172a; --surface: #1e293b; --border: #334155;
      --accent: #7c3aed; --accent2: #0ea5e9; --text: #e2e8f0;
      --muted: #94a3b8; --success: #22c55e; --warn: #f59e0b; --err: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Segoe UI", system-ui, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; }

    /* 頂部導覽 */
    nav { background: var(--surface); border-bottom: 1px solid var(--border); padding: 0 1.5rem; display: flex; align-items: center; gap: 1rem; height: 56px; }
    nav h1 { font-size: 1.1rem; font-weight: 700; color: var(--accent2); white-space: nowrap; }
    .nav-tabs { display: flex; gap: 0.25rem; flex: 1; }
    .tab { padding: 0.4rem 0.9rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; color: var(--muted); border: none; background: none; transition: all .15s; }
    .tab:hover { background: var(--border); color: var(--text); }
    .tab.active { background: var(--accent); color: #fff; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); margin-left: auto; }

    /* 主體 */
    main { flex: 1; display: flex; }
    .panel { display: none; flex: 1; flex-direction: column; padding: 1.5rem; gap: 1rem; overflow: auto; }
    .panel.active { display: flex; }

    /* 聊天介面 */
    .chat-config { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    select, input, textarea, button { border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 0.9rem; }
    select { padding: 0.45rem 0.75rem; }
    input, textarea { padding: 0.6rem 0.9rem; flex: 1; }
    textarea { resize: vertical; min-height: 60px; font-family: inherit; }
    button { padding: 0.6rem 1.2rem; cursor: pointer; border: none; font-weight: 600; transition: opacity .15s; }
    button:hover { opacity: .85; }
    button:disabled { opacity: .4; cursor: not-allowed; }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-secondary { background: var(--accent2); color: #fff; }
    .btn-danger { background: var(--err); color: #fff; }

    #chat-box { flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; overflow-y: auto; min-height: 300px; max-height: 500px; display: flex; flex-direction: column; gap: 0.75rem; }
    .msg { padding: 0.6rem 1rem; border-radius: 8px; line-height: 1.6; max-width: 85%; white-space: pre-wrap; word-break: break-word; }
    .msg.user { background: #1d4ed8; align-self: flex-end; }
    .msg.ai { background: var(--border); align-self: flex-start; }
    .msg.sys { background: #065f46; font-size: 0.8rem; color: #6ee7b7; align-self: center; }
    .chat-input-row { display: flex; gap: 0.5rem; }

    /* 卡片 */
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; }
    .card h3 { font-size: 1rem; margin-bottom: 0.75rem; color: var(--accent2); }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
    @media(max-width:768px) { .grid2,.grid3 { grid-template-columns: 1fr; } }

    /* 競賽面板 */
    .race-result { background: var(--border); border-radius: 8px; padding: 0.75rem; font-size: 0.85rem; }
    .race-result h4 { color: var(--warn); margin-bottom: 0.4rem; font-size: 0.8rem; }
    .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-left: 0.4rem; }
    .badge.fast { background: var(--success); color: #000; }
    .badge.err { background: var(--err); color: #fff; }

    /* 系統狀態 */
    .stat { display: flex; justify-content: space-between; padding: 0.35rem 0; border-bottom: 1px solid var(--border); font-size: 0.85rem; }
    .stat:last-child { border: none; }
    .stat-val { color: var(--success); font-weight: 600; }
    .model-chip { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 4px; background: var(--border); font-size: 0.75rem; margin: 0.15rem; }

    /* 載入動畫 */
    .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--border); border-top-color: var(--accent2); border-radius: 50%; animation: spin .6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    code { font-family: monospace; background: var(--bg); padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.85rem; }
  </style>
</head>
<body>
<nav>
  <h1>🤖 Claude Master System</h1>
  <div class="nav-tabs">
    <button class="tab active" onclick="showTab('chat')">💬 對話</button>
    <button class="tab" onclick="showTab('race')">🏁 AI 競賽</button>
    <button class="tab" onclick="showTab('agent')">🦾 Agent</button>
    <button class="tab" onclick="showTab('status')">📊 系統狀態</button>
  </div>
  <div class="status-dot" id="dot" title="系統正常"></div>
</nav>

<main>
  <!-- 對話 -->
  <div class="panel active" id="panel-chat">
    <div class="chat-config">
      <select id="model">
        <optgroup label="Anthropic Claude">
          <option value="claude-opus-4-8">Claude Opus 4.8 — 最強</option>
          <option value="claude-sonnet-4-6" selected>Claude Sonnet 4.6 — 平衡</option>
          <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 — 最快</option>
        </optgroup>
        <optgroup label="OpenAI">
          <option value="gpt-4o">GPT-4o</option>
          <option value="gpt-4o-mini">GPT-4o Mini</option>
        </optgroup>
        <optgroup label="Google">
          <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
        </optgroup>
        <optgroup label="Groq（超快）">
          <option value="llama-3.3-70b-versatile">Llama 3.3 70B</option>
        </optgroup>
      </select>
      <select id="mode">
        <option value="chat">💬 一般對話</option>
        <option value="stream">⚡ 串流</option>
        <option value="tools">🔧 工具呼叫</option>
      </select>
      <button class="btn-danger" onclick="clearChat()">清除</button>
    </div>
    <div id="chat-box"></div>
    <div class="chat-input-row">
      <textarea id="msg-input" rows="2" placeholder="輸入訊息…（Enter 送出，Shift+Enter 換行）"></textarea>
      <button class="btn-primary" id="send-btn" onclick="sendMessage()">送出</button>
    </div>
  </div>

  <!-- AI 競賽 -->
  <div class="panel" id="panel-race">
    <div class="card">
      <h3>🏁 所有 AI 同時競賽</h3>
      <p style="font-size:.85rem;color:var(--muted);margin-bottom:.75rem">向所有模型同時提問，比較回應速度與品質</p>
      <div style="display:flex;gap:.5rem">
        <input id="race-input" type="text" placeholder="輸入問題…" value="用一句話介紹台灣" />
        <button class="btn-secondary" id="race-btn" onclick="runRace()">開始競賽</button>
      </div>
    </div>
    <div class="grid3" id="race-results"></div>
  </div>

  <!-- Agent -->
  <div class="panel" id="panel-agent">
    <div class="card">
      <h3>🦾 自動 Agent 執行</h3>
      <textarea id="agent-task" rows="3" placeholder="描述任務，Agent 會自動規劃並執行…&#10;例：分析專案程式碼並找出可改善的地方"></textarea>
      <div style="display:flex;gap:.5rem;margin-top:.75rem">
        <button class="btn-primary" id="agent-btn" onclick="runAgent()">執行 Agent</button>
        <select id="agent-model">
          <option value="claude-opus-4-8">Claude Opus 4.8</option>
          <option value="claude-sonnet-4-6" selected>Claude Sonnet 4.6</option>
        </select>
      </div>
    </div>
    <div class="card">
      <h3>📋 Agent 執行日誌</h3>
      <div id="agent-log" style="font-family:monospace;font-size:.8rem;line-height:1.8;color:var(--muted);min-height:150px;white-space:pre-wrap"></div>
    </div>
  </div>

  <!-- 系統狀態 -->
  <div class="panel" id="panel-status">
    <div class="grid2">
      <div class="card">
        <h3>🟢 系統資訊</h3>
        <div class="stat"><span>版本</span><span class="stat-val">3.0.0</span></div>
        <div class="stat"><span>Node.js</span><span class="stat-val" id="node-ver">—</span></div>
        <div class="stat"><span>伺服器時間</span><span class="stat-val" id="srv-time">—</span></div>
        <div class="stat"><span>本次對話</span><span class="stat-val" id="msg-count">0 則</span></div>
      </div>
      <div class="card">
        <h3>🤖 支援模型</h3>
        <div id="model-list"></div>
      </div>
    </div>
    <div class="card">
      <h3>📦 可用功能模組</h3>
      <div id="module-list" style="display:flex;flex-wrap:wrap;gap:.4rem"></div>
    </div>
    <div class="card">
      <h3>⌨️ npm 指令</h3>
      <div id="scripts-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.4rem"></div>
    </div>
  </div>
</main>

<script>
const MODELS = {
  anthropic: ["claude-opus-4-8","claude-sonnet-4-6","claude-haiku-4-5-20251001"],
  openai:    ["gpt-4o","gpt-4o-mini"],
  google:    ["gemini-2.0-flash","gemini-1.5-pro"],
  groq:      ["llama-3.3-70b-versatile","mixtral-8x7b-32768"],
  mistral:   ["mistral-large-latest","mistral-small-latest"],
  cohere:    ["command-r-plus","command-r"],
};
const MODULES = ["auto-api","smart-handler","all-ai","auto-everything","agent-auto","auto-coder","self-improve","master","memory","vector-store","logger","rate-limiter","pre-call-hooks","openai-compat","MCP SDK","LangChain"];
const SCRIPTS = ["preview","run","agent","web","auto-code","self-improve","all-ai:race","master","master:race","benchmark","smart","auto-everything","auto:watch"];

let msgCount = 0;
const chatBox = document.getElementById('chat-box');

// Tab 切換
function showTab(id) {
  document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', ['chat','race','agent','status'][i]===id));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id==='panel-'+id));
  if (id==='status') initStatus();
}

// 聊天
function addMsg(role, text) {
  const d = document.createElement('div');
  d.className = 'msg ' + role;
  d.textContent = text;
  chatBox.appendChild(d);
  chatBox.scrollTop = chatBox.scrollHeight;
  return d;
}
function clearChat() { chatBox.innerHTML=''; msgCount=0; document.getElementById('msg-count').textContent='0 則'; }

document.getElementById('msg-input').addEventListener('keydown', e => {
  if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

async function sendMessage() {
  const input = document.getElementById('msg-input');
  const msg = input.value.trim();
  if (!msg) return;
  const model = document.getElementById('model').value;
  input.value = '';
  addMsg('user', msg);
  msgCount++;

  const aiDiv = addMsg('ai', '');
  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  aiDiv.appendChild(spinner);
  document.getElementById('send-btn').disabled = true;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ message: msg, model }),
    });
    const data = await res.json();
    aiDiv.textContent = data.text || ('[錯誤] ' + data.error);
    document.getElementById('msg-count').textContent = msgCount + ' 則';
  } catch(e) {
    aiDiv.textContent = '[網路錯誤] ' + e.message;
  }
  document.getElementById('send-btn').disabled = false;
}

// 競賽
async function runRace() {
  const q = document.getElementById('race-input').value.trim();
  if (!q) return;
  const container = document.getElementById('race-results');
  container.innerHTML = '';
  document.getElementById('race-btn').disabled = true;

  const allModels = Object.values(MODELS).flat();
  allModels.forEach(m => {
    const card = document.createElement('div');
    card.className = 'race-result';
    card.id = 'race-' + m.replace(/[^a-z0-9]/gi,'_');
    card.innerHTML = \`<h4>\${m}</h4><span class="spinner"></span>\`;
    container.appendChild(card);
  });

  await Promise.allSettled(allModels.map(async model => {
    const start = Date.now();
    try {
      const res = await fetch('/api/chat', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ message: q, model }),
      });
      const data = await res.json();
      const ms = Date.now() - start;
      const el = document.getElementById('race-' + model.replace(/[^a-z0-9]/gi,'_'));
      if (el) el.innerHTML = \`<h4>\${model}<span class="badge fast">\${ms}ms</span></h4>\${(data.text||'').slice(0,200)}\`;
    } catch(e) {
      const el = document.getElementById('race-' + model.replace(/[^a-z0-9]/gi,'_'));
      if (el) el.innerHTML = \`<h4>\${model}<span class="badge err">失敗</span></h4>\${e.message}\`;
    }
  }));
  document.getElementById('race-btn').disabled = false;
}

// Agent
async function runAgent() {
  const task = document.getElementById('agent-task').value.trim();
  if (!task) return;
  const log = document.getElementById('agent-log');
  const model = document.getElementById('agent-model').value;
  log.textContent = '';
  document.getElementById('agent-btn').disabled = true;

  const addLog = t => { log.textContent += t + '\n'; log.scrollTop = log.scrollHeight; };
  addLog('🤖 Agent 啟動: ' + task);

  try {
    const res = await fetch('/api/agent', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ task, model }),
    });
    const data = await res.json();
    addLog('\n' + (data.result || JSON.stringify(data)));
  } catch(e) {
    addLog('[錯誤] ' + e.message);
  }
  document.getElementById('agent-btn').disabled = false;
}

// 系統狀態
function initStatus() {
  document.getElementById('srv-time').textContent = new Date().toLocaleString('zh-TW');
  document.getElementById('msg-count').textContent = msgCount + ' 則';

  const ml = document.getElementById('model-list');
  ml.innerHTML = Object.entries(MODELS).map(([p,ms]) =>
    \`<div class="stat"><span>\${p}</span><span class="stat-val">\${ms.length} 個</span></div>\`
  ).join('');

  const modEl = document.getElementById('module-list');
  modEl.innerHTML = MODULES.map(m => \`<span class="model-chip">\${m}</span>\`).join('');

  const scrEl = document.getElementById('scripts-list');
  scrEl.innerHTML = SCRIPTS.map(s => \`<code>npm run \${s}</code>\`).join('');

  fetch('/health').then(r=>r.json()).then(d => {
    document.getElementById('node-ver').textContent = d.node || '—';
    document.getElementById('dot').title = '系統正常';
  });
}

// 初始化
initStatus();
</script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  const setJson = (code) => res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });

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
        const prompt = message || task;
        const useModel = model || "claude-sonnet-4-6";

        const msg = await client.messages.create({
          model: useModel,
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        });
        const text = msg.content[0].type === "text" ? msg.content[0].text : "";
        setJson(200);
        res.end(JSON.stringify({ text, model: useModel }));
      } catch (e) {
        setJson(500);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    setJson(200);
    return res.end(JSON.stringify({
      status: "ok",
      node: process.version,
      time: new Date().toISOString(),
    }));
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`\n🌐 繁體中文 Web 介面啟動`);
  console.log(`   → http://localhost:${PORT}`);
  console.log(`   功能：對話 / AI競賽 / Agent / 系統狀態\n`);
});
