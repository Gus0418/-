/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║        Claude Master System — 系統整合主入口             ║
 * ║  統一匯出所有模組，一個 import 取得全部功能              ║
 * ╚══════════════════════════════════════════════════════════╝
 */

// ── 核心 API ────────────────────────────────────────────────
export { autoCall, autoBatch }         from "./auto-api.js";
export { smartCall, processFile }      from "./smart-handler.js";
export { askAI, raceAllModels, streamAI, ALL_MODELS } from "./all-ai.js";
export { autoEverything, watchAndAct } from "./auto-everything.js";

// ── 插件 ────────────────────────────────────────────────────
export { memory }                      from "./plugins/memory.js";
export { vectorStore }                 from "./plugins/vector-store.js";

// ── 中介層 ──────────────────────────────────────────────────
export { withLogging, readLogs, logStats } from "./middleware/logger.js";
export { withRateLimit, checkRateLimit }   from "./middleware/rate-limiter.js";

// ── Hooks ───────────────────────────────────────────────────
export { registerPreCallHook, runPreCallHooks } from "./hooks/pre-call.js";

// ── SDK 相容層 ──────────────────────────────────────────────
export { openaiCompat }                from "./sdk-wrappers/openai-compat.js";

// ── 型別 ────────────────────────────────────────────────────
export type {
  ModelId, Provider, TaskType, TextFormat,
  Message, CallOptions, CallResult,
  AgentTool, AgentState, UsageRecord, ModelInfo,
} from "./types/index.js";

// ── 便利函式（直接可用）────────────────────────────────────
import Anthropic from "@anthropic-ai/sdk";
import { autoCall } from "./auto-api.js";
import { memory } from "./plugins/memory.js";
import type { ModelId } from "./types/index.js";

export const claude = new Anthropic();

/**
 * 最簡單的使用方式：一行呼叫 Claude
 * @example const reply = await ask("你好！");
 */
export async function ask(prompt: string, model?: ModelId): Promise<string> {
  const result = await autoCall(prompt, { model });
  return result.text;
}

/**
 * 帶記憶的對話
 * @example const reply = await chat("記住我叫 Gus", "user");
 */
export async function chat(
  prompt: string,
  role: "user" | "assistant" = "user",
  model?: ModelId
): Promise<string> {
  const systemPrompt = memory.buildSystemPrompt();
  const result = await autoCall(prompt, {
    model,
    system: systemPrompt || "你是友善的 AI 助理，用繁體中文回答。",
  });
  memory.addHistory(`用戶: ${prompt.slice(0, 50)} | AI: ${result.text.slice(0, 50)}`);
  return result.text;
}

/**
 * 系統狀態
 */
export function systemStatus() {
  return {
    version: "3.0.0",
    modules: [
      "auto-api", "smart-handler", "all-ai", "auto-everything",
      "agent-auto", "auto-coder", "self-improve", "master",
      "memory", "vector-store", "logger", "rate-limiter",
      "pre-call-hooks", "openai-compat",
    ],
    models: {
      anthropic: ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
      openai:    ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"],
      google:    ["gemini-2.0-flash", "gemini-1.5-pro"],
      groq:      ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"],
      mistral:   ["mistral-large-latest", "mistral-small-latest"],
      cohere:    ["command-r-plus", "command-r"],
    },
    scripts: [
      "preview", "run", "agent", "agent:batch",
      "web", "dev", "dev:web",
      "auto-code", "self-improve",
      "all-ai", "all-ai:race", "all-ai:stream",
      "smart", "smart:file",
      "auto-api", "auto-everything", "auto:watch", "auto:race",
      "master", "master:agent", "master:race", "master:gen",
      "benchmark",
    ],
    templates: [
      "chatbot", "rag", "function-calling", "multi-agent",
      "mcp-server", "mcp-client", "streaming", "vision",
      "code-review", "summarizer",
    ],
  };
}
