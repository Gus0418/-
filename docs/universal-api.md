# 萬用 API 速查手冊

**Endpoint**
```
POST https://iixxaaeurdcyuvouqzlz.supabase.co/functions/v1/universal-api
```

**必要 Header**
```
X-Webhook-Secret: <你的 WEBHOOK_SECRET>
Content-Type: application/json
```

**請求格式**
```json
{
  "project_id": "default",   // 省略時自動用 "default"
  "action": "<action名稱>",
  "payload": { ... }
}
```

---

## Action 總覽

| action | 功能 |
|---|---|
| `ai/chat` | 呼叫 Claude AI 對話 |
| `data/query` | 查詢資料表 |
| `data/insert` | 新增資料 |
| `data/update` | 更新資料（by id） |
| `data/delete` | 刪除資料（by id） |
| `notify` | 建立通知 |
| `notion/sync` | 同步 integration_events 到 Notion |
| `webhook/forward` | 轉發給 latenode-webhook |
| `projects/list` | 列出所有啟用的專案 |

---

## 各 Action 範例

### ai/chat
```json
{
  "project_id": "default",
  "action": "ai/chat",
  "payload": {
    "messages": [
      { "role": "user", "content": "你好，幫我寫一段摘要" }
    ],
    "model": "claude-sonnet-4-6",
    "max_tokens": 1024
  }
}
```
回傳：`{ "reply": "...", "usage": {...}, "model": "..." }`

---

### data/query
```json
{
  "action": "data/query",
  "payload": {
    "table": "notifications",
    "filter": { "status": "unread" },
    "order": "created_at",
    "ascending": false,
    "limit": 10
  }
}
```
可用 table：`api_tokens` / `webhook_logs` / `integration_events` / `notifications`

---

### data/insert
```json
{
  "action": "data/insert",
  "payload": {
    "table": "notifications",
    "data": {
      "title": "測試",
      "message": "Hello",
      "source": "manual",
      "status": "unread"
    }
  }
}
```

---

### data/update
```json
{
  "action": "data/update",
  "payload": {
    "table": "notifications",
    "id": "uuid-here",
    "data": { "status": "read" }
  }
}
```

---

### data/delete
```json
{
  "action": "data/delete",
  "payload": {
    "table": "notifications",
    "id": "uuid-here"
  }
}
```

---

### notify
```json
{
  "action": "notify",
  "payload": {
    "title": "任務完成",
    "message": "自動化流程已執行完畢",
    "source": "latenode",
    "notion_sync": true
  }
}
```
`notion_sync: true` 會同時在 Notion 建立頁面。

---

### notion/sync
```json
{
  "action": "notion/sync",
  "payload": { "limit": 20 }
}
```
把尚未同步到 Notion 的 `integration_events` 批次推送過去。

---

### webhook/forward
```json
{
  "action": "webhook/forward",
  "payload": {
    "event_type": "my_event",
    "title": "通知標題",
    "message": "內容"
  }
}
```

---

### projects/list
```json
{ "action": "projects/list" }
```
回傳所有啟用的專案（不含 credentials）。

---

## 新增專案

在 Supabase SQL Editor 執行：
```sql
INSERT INTO projects (id, name, supabase_url, supabase_service_key, claude_api_key, notion_token, notion_db_ids)
VALUES (
  'proj_x',                          -- 自訂 ID
  '專案名稱',
  'https://xxxxx.supabase.co',
  'eyJ...',                          -- service_role key
  'sk-ant-...',                      -- Claude API Key
  'secret_...',                      -- Notion Integration Token
  '{
    "notifications": "notion-db-id",
    "integration_events": "notion-db-id"
  }'
);
```

停用專案：
```sql
UPDATE projects SET active = false WHERE id = 'proj_x';
```

---

## 環境變數（Supabase Edge Function Secrets）

| 變數 | 說明 |
|---|---|
| `WEBHOOK_SECRET` | API 驗證密鑰 |
| `CLAUDE_API_KEY` | 預設 Claude Key（default 專案用） |
| `NOTION_TOKEN` | 預設 Notion Token（default 專案用） |

各專案的 credentials 優先從 `projects` 表讀取；  
若表中為空，則 fallback 到 `{PROJECT_ID}_CLAUDE_API_KEY` 等環境變數，  
再 fallback 到上方的預設環境變數。

---

## 快速測試（curl）

```bash
SECRET="你的WEBHOOK_SECRET"
URL="https://iixxaaeurdcyuvouqzlz.supabase.co/functions/v1/universal-api"

# 列出專案
curl -s -X POST $URL \
  -H "X-Webhook-Secret: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"projects/list"}' | jq

# 查詢最新 5 筆通知
curl -s -X POST $URL \
  -H "X-Webhook-Secret: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"data/query","payload":{"table":"notifications","limit":5,"order":"created_at","ascending":false}}' | jq

# Claude 對話
curl -s -X POST $URL \
  -H "X-Webhook-Secret: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"ai/chat","payload":{"messages":[{"role":"user","content":"你好"}]}}' | jq
```
