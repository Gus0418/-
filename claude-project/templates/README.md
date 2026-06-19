# Claude API TypeScript 專案範本集

本目錄包含 15 個完整可執行的 TypeScript 範本，展示各種 Claude AI 應用場景。

## 環境需求

- Node.js 18+
- TypeScript 5+
- Anthropic API Key（設定 `ANTHROPIC_API_KEY` 環境變數）

## 快速開始

```bash
# 安裝相依套件
npm install @anthropic-ai/sdk @modelcontextprotocol/sdk typescript ts-node

# 設定 API Key
export ANTHROPIC_API_KEY="your-api-key-here"

# 執行任一範本
ts-node chatbot/index.ts
```

## 範本列表

### 1. 聊天機器人 (`chatbot/`)
多輪對話、記憶歷史、串流輸出、角色設定

```bash
ts-node chatbot/index.ts
```

### 2. RAG 檢索增強生成 (`rag/`)
文件分塊、關鍵字搜尋、問答系統

```bash
ts-node rag/index.ts
```

### 3. 工具呼叫 (`function-calling/`)
天氣查詢、計算機、日曆整合，自動工具迴圈

```bash
ts-node function-calling/index.ts
```

### 4. 多代理人協作 (`multi-agent/`)
規劃者、執行者、審查者三角色協作

```bash
ts-node multi-agent/index.ts
```

### 5. MCP 伺服器 (`mcp-server/`)
建立 Model Context Protocol 伺服器，提供檔案讀寫、系統資訊等工具

```bash
ts-node mcp-server/index.ts
```

### 6. MCP 客戶端 (`mcp-client/`)
連接 MCP 伺服器並讓 Claude 使用工具

```bash
ts-node mcp-client/index.ts
```

### 7. 串流輸出 (`streaming/`)
即時串流、事件監聽、思考過程串流、並行請求

```bash
ts-node streaming/index.ts
```

### 8. 視覺理解 (`vision/`)
圖片分析（URL/base64）、多圖比較、OCR

```bash
ts-node vision/index.ts
```

### 9. 程式碼審查 (`code-review/`)
安全性檢查、效能分析、品質評分

```bash
ts-node code-review/index.ts
```

### 10. 長文摘要 (`summarizer/`)
自動分塊、遞迴摘要、多種風格

```bash
ts-node summarizer/index.ts
```

### 11. 多語言翻譯 (`translator/`)
支援所有語言、術語表、批次翻譯

```bash
ts-node translator/index.ts
```

### 12. 資料擷取 (`data-extractor/`)
從非結構化文字提取 JSON 結構資料

```bash
ts-node data-extractor/index.ts
```

### 13. 提示鏈 (`prompt-chain/`)
多步驟 AI 流程，每步驟輸出作為下一步輸入

```bash
ts-node prompt-chain/index.ts
```

### 14. LLM 評估框架 (`eval/`)
LLM-as-Judge 模式，自動評估 AI 回應品質

```bash
ts-node eval/index.ts
```

### 15. AI 網頁解析 (`web-scraper-ai/`)
抓取網頁、AI 提取結構化資料、內容分析

```bash
ts-node web-scraper-ai/index.ts
```

## 關鍵技術概念

### 模型選擇
預設使用 `claude-opus-4-8`，適合大多數任務。

### 自適應思考
複雜任務啟用 `thinking: { type: "adaptive" }` 提升推理品質。

### 串流輸出
長回應使用 `.stream()` 搭配 `.finalMessage()` 避免超時。

### 工具呼叫流程
```
1. 定義工具（Tool Schema）
2. 發送請求
3. 檢查 stop_reason === "tool_use"
4. 執行工具，取得結果
5. 將結果加入訊息歷史
6. 重複直到 stop_reason !== "tool_use"
```

### 多輪對話
API 是無狀態的，需在每次請求中傳送完整對話歷史。

## 環境變數

| 變數名稱 | 說明 | 必填 |
|---------|------|------|
| `ANTHROPIC_API_KEY` | Anthropic API 金鑰 | 是 |

## 相依套件

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "ts-node": "^10.0.0",
    "@types/node": "^20.0.0"
  }
}
```
