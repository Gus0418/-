# 方案決策檔 (Plan)

## 專案目標
使用 Claude API 建構 AI 應用，整合多模型支援。

## 技術選型
- **主模型**: Claude (Anthropic)
- **框架**: Vercel AI SDK (`ai` + `@ai-sdk/anthropic`)
- **MCP**: `@modelcontextprotocol/sdk` 擴充工具能力
- **語言**: TypeScript + Node.js
- **Python 備援**: `anthropic` SDK

## 架構決策
1. 單一入口 `run.ts` 執行主流程
2. `.env` 管理所有 API Keys
3. `preview.ts` 快速驗證輸出結果

## API Keys 需求
| 服務 | 環境變數 |
|------|---------|
| Claude | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Gemini | `GOOGLE_GENERATIVE_AI_API_KEY` |
| Groq | `GROQ_API_KEY` |
| AWS Bedrock | `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` |

## 執行流程
```
plan.md → preview.ts（驗證）→ run.ts（正式執行）
```
