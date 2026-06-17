import http from "http";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const PORT = process.env.PORT || 3000;

const HTML = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <title>Claude Web Interface</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 2rem; }
    h1 { font-size: 1.8rem; margin-bottom: 1.5rem; color: #7dd3fc; }
    #chat { width: 100%; max-width: 800px; background: #1e293b; border-radius: 12px; padding: 1.5rem; min-height: 300px; max-height: 500px; overflow-y: auto; margin-bottom: 1rem; }
    .msg { margin-bottom: 1rem; padding: 0.75rem 1rem; border-radius: 8px; line-height: 1.6; }
    .user { background: #1d4ed8; text-align: right; }
    .claude { background: #334155; }
    #form { display: flex; gap: 0.5rem; width: 100%; max-width: 800px; }
    #input { flex: 1; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #475569; background: #1e293b; color: #e2e8f0; font-size: 1rem; }
    button { padding: 0.75rem 1.5rem; background: #7c3aed; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; }
    button:hover { background: #6d28d9; }
    button:disabled { background: #475569; cursor: not-allowed; }
    #model { padding: 0.5rem; background: #1e293b; color: #e2e8f0; border: 1px solid #475569; border-radius: 8px; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <h1>🤖 Claude Web Interface</h1>
  <select id="model">
    <option value="claude-opus-4-8">Claude Opus 4.8 (最強)</option>
    <option value="claude-sonnet-4-6" selected>Claude Sonnet 4.6 (平衡)</option>
    <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (最快)</option>
  </select>
  <div id="chat"></div>
  <form id="form">
    <input id="input" type="text" placeholder="輸入訊息..." autocomplete="off" />
    <button type="submit" id="btn">傳送</button>
  </form>
  <script>
    const chat = document.getElementById('chat');
    const form = document.getElementById('form');
    const input = document.getElementById('input');
    const btn = document.getElementById('btn');
    const modelSel = document.getElementById('model');

    function addMsg(role, text) {
      const div = document.createElement('div');
      div.className = 'msg ' + role;
      div.textContent = (role === 'user' ? '你: ' : 'Claude: ') + text;
      chat.appendChild(div);
      chat.scrollTop = chat.scrollHeight;
      return div;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = input.value.trim();
      if (!msg) return;
      input.value = '';
      btn.disabled = true;
      addMsg('user', msg);
      const claudeDiv = addMsg('claude', '思考中...');
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg, model: modelSel.value })
        });
        const data = await res.json();
        claudeDiv.textContent = 'Claude: ' + (data.text || data.error);
      } catch (err) {
        claudeDiv.textContent = 'Claude: 錯誤 - ' + err.message;
      }
      btn.disabled = false;
      input.focus();
    });
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(HTML);
  }

  if (req.method === "POST" && req.url === "/api/chat") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { message, model } = JSON.parse(body);
        const msg = await client.messages.create({
          model: model || "claude-sonnet-4-6",
          max_tokens: 1024,
          messages: [{ role: "user", content: message }],
        });
        const text =
          msg.content[0].type === "text" ? msg.content[0].text : "";
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ text }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok", time: new Date().toISOString() }));
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`\n🚀 Claude Web Server 啟動`);
  console.log(`   本機: http://localhost:${PORT}`);
  console.log(`   API:  http://localhost:${PORT}/api/chat`);
  console.log(`   健康: http://localhost:${PORT}/health\n`);
});
