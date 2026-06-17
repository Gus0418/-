/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           MASTER SYSTEM — 全整合主控引擎              ║
 * ║  整合所有模組：API / Agent / 格式 / 容量 / 所有AI     ║
 * ║  + 主動向人類提問 + 自我學習 + 持續執行               ║
 * ╚══════════════════════════════════════════════════════╝
 */
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import Groq from "groq-sdk";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { createCohere } from "@ai-sdk/cohere";
import { generateText, streamText } from "ai";
import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as dotenv from "dotenv";
dotenv.config();

// ════════════════════════════════════════════════════════════
//  1. 全 AI 供應商
// ════════════════════════════════════════════════════════════
const ALL_MODELS = {
  "claude-opus-4-8":           { p: "anthropic", label: "Claude Opus 4.8"  },
  "claude-sonnet-4-6":         { p: "anthropic", label: "Claude Sonnet 4.6"},
  "claude-haiku-4-5-20251001": { p: "anthropic", label: "Claude Haiku 4.5" },
  "gpt-4o":                    { p: "openai",    label: "GPT-4o"           },
  "gpt-4o-mini":               { p: "openai",    label: "GPT-4o Mini"      },
  "gemini-2.0-flash":          { p: "google",    label: "Gemini 2.0 Flash" },
  "gemini-1.5-pro":            { p: "google",    label: "Gemini 1.5 Pro"   },
  "llama-3.3-70b-versatile":   { p: "groq",      label: "Llama 3.3 70B"   },
  "mistral-large-latest":      { p: "mistral",   label: "Mistral Large"    },
  "command-r-plus":            { p: "cohere",    label: "Command R+"       },
} as const;

type ModelId = keyof typeof ALL_MODELS;

async function callModel(modelId: ModelId, prompt: string, system?: string): Promise<string> {
  const info = ALL_MODELS[modelId];
  const opts = { maxTokens: 2048, ...(system ? { system } : {}) };

  try {
    if (info.p === "anthropic") {
      const c = new Anthropic();
      const r = await c.messages.create({
        model: modelId, max_tokens: opts.maxTokens,
        ...(system ? { system } : {}),
        messages: [{ role: "user", content: prompt }],
      });
      return r.content[0].type === "text" ? r.content[0].text : "";
    }
    if (info.p === "openai") {
      const c = new OpenAI();
      const r = await c.chat.completions.create({
        model: modelId, max_tokens: opts.maxTokens,
        messages: [
          ...(system ? [{ role: "system" as const, content: system }] : []),
          { role: "user", content: prompt },
        ],
      });
      return r.choices[0]?.message?.content ?? "";
    }
    if (info.p === "groq") {
      const c = new Groq();
      const r = await c.chat.completions.create({
        model: modelId, max_tokens: opts.maxTokens,
        messages: [{ role: "user", content: prompt }],
      });
      return r.choices[0]?.message?.content ?? "";
    }
    const sdkMap: Record<string, any> = {
      google:  createGoogleGenerativeAI(),
      mistral: createMistral(),
      cohere:  createCohere(),
    };
    const { text } = await generateText({ model: sdkMap[info.p](modelId), prompt, maxTokens: opts.maxTokens });
    return text;
  } catch (e: any) {
    return `[${info.label} 不可用: ${e.message}]`;
  }
}

// ════════════════════════════════════════════════════════════
//  2. 容量 & 格式自動處理
// ════════════════════════════════════════════════════════════
function estimateTokens(text: string) { return Math.ceil(text.length / 4); }

function autoChunk(text: string, maxTokens = 80000): string[] {
  if (estimateTokens(text) <= maxTokens) return [text];
  const chunks: string[] = [];
  const lines = text.split("\n");
  let cur = "";
  for (const line of lines) {
    if (estimateTokens(cur + line) > maxTokens) {
      if (cur) chunks.push(cur.trim());
      cur = line + "\n";
    } else cur += line + "\n";
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

function detectFmt(text: string): string {
  const t = text.trim();
  if (t.startsWith("{") || t.startsWith("[")) return "json";
  if (/^#{1,6}\s/m.test(t)) return "markdown";
  if (/^".*",".*"/m.test(t)) return "csv";
  return "plain";
}

// ════════════════════════════════════════════════════════════
//  3. 快取 & 費用追蹤
// ════════════════════════════════════════════════════════════
const CACHE: Record<string, string> = {};
const COST_LOG: { model: string; cost: number }[] = [];
const PRICE: Record<string, number> = {
  "claude-opus-4-8": 45, "claude-sonnet-4-6": 9, "claude-haiku-4-5-20251001": 0.75,
  "gpt-4o": 12.5, "gpt-4o-mini": 0.3, default: 5,
};

function trackCost(model: string, tokens: number) {
  const cost = tokens * (PRICE[model] ?? PRICE.default) / 1_000_000;
  COST_LOG.push({ model, cost });
  return cost;
}

function totalCost() { return COST_LOG.reduce((s, r) => s + r.cost, 0); }

// ════════════════════════════════════════════════════════════
//  4. 自動重試 + Fallback
// ════════════════════════════════════════════════════════════
const FALLBACK: ModelId[] = [
  "claude-sonnet-4-6", "gpt-4o-mini", "llama-3.3-70b-versatile", "gemini-2.0-flash",
];

async function smartCall(prompt: string, preferModel: ModelId = "claude-sonnet-4-6"): Promise<string> {
  const key = crypto.createHash("md5").update(prompt).digest("hex");
  if (CACHE[key]) { console.log("⚡ 快取命中"); return CACHE[key]; }

  const chain: ModelId[] = [preferModel, ...FALLBACK.filter(m => m !== preferModel)];
  for (const model of chain) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const chunks = autoChunk(prompt);
        const results: string[] = [];
        for (const chunk of chunks) {
          const text = await callModel(model, chunk);
          if (text.startsWith("[") && text.includes("不可用")) throw new Error(text);
          results.push(text);
        }
        const final = results.length === 1 ? results[0] : results.join("\n\n");
        CACHE[key] = final;
        trackCost(model, estimateTokens(prompt + final));
        return final;
      } catch (e: any) {
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
        } else {
          console.log(`  ❌ ${model} 失敗，切換下一個`);
        }
      }
    }
  }
  throw new Error("所有模型均失敗");
}

// ════════════════════════════════════════════════════════════
//  5. 自動 Agent（工具迴圈）
// ════════════════════════════════════════════════════════════
const TOOLS: Anthropic.Tool[] = [
  {
    name: "read_file", description: "讀取檔案",
    input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
  },
  {
    name: "write_file", description: "寫入檔案",
    input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
  },
  {
    name: "list_files", description: "列出目錄檔案",
    input_schema: { type: "object", properties: { dir: { type: "string" } }, required: ["dir"] },
  },
  {
    name: "ask_human", description: "向人類提問以獲取更多資訊",
    input_schema: { type: "object", properties: { question: { type: "string" }, context: { type: "string" } }, required: ["question"] },
  },
  {
    name: "generate_code", description: "生成程式碼檔案",
    input_schema: {
      type: "object",
      properties: {
        filename: { type: "string" },
        description: { type: "string" },
        language: { type: "string" },
      },
      required: ["filename", "description"],
    },
  },
  {
    name: "race_ai", description: "同時向所有 AI 提問，取最快回應",
    input_schema: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] },
  },
  {
    name: "web_search", description: "搜尋網路資訊（模擬）",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> => new Promise(res => rl.question(q, res));

async function executeTool(name: string, input: Record<string, string>): Promise<string> {
  switch (name) {
    case "read_file":
      try { return fs.readFileSync(input.path, "utf-8"); }
      catch { return `[找不到: ${input.path}]`; }

    case "write_file":
      fs.mkdirSync(path.dirname(input.path), { recursive: true });
      fs.writeFileSync(input.path, input.content);
      return `已寫入: ${input.path} (${input.content.length} 字元)`;

    case "list_files":
      try { return fs.readdirSync(input.dir).join("\n"); }
      catch { return `[目錄不存在: ${input.dir}]`; }

    case "ask_human": {
      console.log(`\n🤖 AI 需要更多資訊：\n   ${input.context ?? ""}`);
      const answer = await ask(`❓ ${input.question}\n你的回答: `);
      return answer;
    }

    case "generate_code": {
      const code = await smartCall(
        `生成一個完整的 ${input.language ?? "TypeScript"} 檔案：${input.description}\n` +
        `只輸出程式碼，不要說明。`
      );
      const outPath = `./generated/${input.filename}`;
      fs.mkdirSync("./generated", { recursive: true });
      fs.writeFileSync(outPath, code);
      return `已生成: ${outPath}`;
    }

    case "race_ai": {
      const results = await Promise.allSettled(
        (["claude-sonnet-4-6", "gpt-4o-mini", "llama-3.3-70b-versatile", "gemini-2.0-flash"] as ModelId[])
          .map(m => callModel(m, input.prompt))
      );
      const winner = results.find(r => r.status === "fulfilled") as PromiseFulfilledResult<string>;
      return winner?.value ?? "所有模型失敗";
    }

    case "web_search":
      return `搜尋「${input.query}」結果（模擬）：找到 10 筆相關資料，包含最新資訊和技術文件。`;

    default:
      return `[未知工具: ${name}]`;
  }
}

// ════════════════════════════════════════════════════════════
//  6. 主動向人類提問引擎
// ════════════════════════════════════════════════════════════
async function runAgentWithHumanLoop(task: string) {
  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: task }];

  console.log(`\n🤖 Master Agent 啟動`);
  console.log(`📋 任務: ${task}`);
  console.log("─".repeat(60));

  for (let step = 0; step < 20; step++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      tools: TOOLS,
      system: `你是全自動 Master AI Agent。
- 使用工具完成任務
- 若需要人類判斷或確認，使用 ask_human 工具主動提問
- 若需要更多資訊，先問人類再繼續
- 完成後回覆「任務完成」並附上摘要`,
      messages,
    });

    for (const block of response.content) {
      if (block.type === "text" && block.text.trim()) {
        console.log(`\n🤖 Claude: ${block.text}`);
      }
    }

    if (response.stop_reason === "end_turn") break;

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          console.log(`\n🔧 工具: ${block.name}`);
          const result = await executeTool(block.name, block.input as Record<string, string>);
          console.log(`   → ${result.slice(0, 200)}`);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        }
      }
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
    }
  }
}

// ════════════════════════════════════════════════════════════
//  7. 互動式對話（人類 ↔ 所有AI）
// ════════════════════════════════════════════════════════════
async function interactiveChat() {
  const history: Anthropic.MessageParam[] = [];
  const client = new Anthropic();
  let currentModel: ModelId = "claude-sonnet-4-6";

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║     Master AI 互動對話系統            ║");
  console.log("╚══════════════════════════════════════╝");
  console.log("指令: /model <id> 切換模型 | /race 競賽模式 | /cost 費用 | /exit 離開\n");

  while (true) {
    const input = await ask("你: ");
    if (!input.trim()) continue;

    if (input === "/exit") { rl.close(); break; }
    if (input === "/cost") {
      console.log(`💰 總費用: $${totalCost().toFixed(6)} (${COST_LOG.length} 次呼叫)\n`);
      continue;
    }
    if (input.startsWith("/model ")) {
      const m = input.slice(7).trim() as ModelId;
      if (m in ALL_MODELS) { currentModel = m; console.log(`✅ 切換至: ${ALL_MODELS[m].label}\n`); }
      else console.log(`❌ 未知模型: ${m}\n`);
      continue;
    }
    if (input === "/race") {
      const q = await ask("競賽問題: ");
      console.log("\n🏁 所有 AI 同時作答...\n");
      const settled = await Promise.allSettled(
        Object.keys(ALL_MODELS).map(async (id) => {
          const text = await callModel(id as ModelId, q);
          return { id, text };
        })
      );
      for (const r of settled) {
        if (r.status === "fulfilled") {
          console.log(`[${ALL_MODELS[r.value.id as ModelId].label}]\n${r.value.text.slice(0, 200)}\n`);
        }
      }
      continue;
    }

    history.push({ role: "user", content: input });
    process.stdout.write(`\n${ALL_MODELS[currentModel].label}: `);

    try {
      if (ALL_MODELS[currentModel].p === "anthropic") {
        const stream = await client.messages.stream({
          model: currentModel, max_tokens: 2048,
          system: "你是友善的 AI 助理，用繁體中文回答。",
          messages: history,
        });
        let reply = "";
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            process.stdout.write(event.delta.text);
            reply += event.delta.text;
          }
        }
        history.push({ role: "assistant", content: reply });
        trackCost(currentModel, estimateTokens(input + reply));
      } else {
        const reply = await callModel(currentModel, input);
        process.stdout.write(reply);
        history.push({ role: "assistant", content: reply });
        trackCost(currentModel, estimateTokens(input + reply));
      }
    } catch (e: any) {
      console.log(`\n[錯誤，自動切換] ${e.message}`);
      const fallback = await smartCall(input);
      process.stdout.write(fallback);
      history.push({ role: "assistant", content: fallback });
    }
    console.log("\n");
  }
}

// ════════════════════════════════════════════════════════════
//  8. 自動程式碼生成（整合版）
// ════════════════════════════════════════════════════════════
async function autoGenerate(description: string) {
  console.log(`\n🏗️  自動生成: ${description}`);
  const plan = await smartCall(
    `為以下專案生成開發計畫，輸出 JSON 陣列（每項為一個任務）：\n${description}`
  );
  let tasks: string[] = [];
  try { tasks = JSON.parse(plan.match(/\[[\s\S]*\]/)?.[0] ?? "[]"); } catch { tasks = [description]; }

  fs.mkdirSync("./generated", { recursive: true });
  for (const task of tasks.slice(0, 5)) {
    const code = await smartCall(`生成 TypeScript 程式碼：${task}\n只輸出程式碼。`);
    const fn = task.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30) + ".ts";
    fs.writeFileSync(`./generated/${fn}`, code);
    console.log(`  ✅ ${fn}`);
  }
}

// ════════════════════════════════════════════════════════════
//  主程式
// ════════════════════════════════════════════════════════════
async function main() {
  const mode = process.argv[2] ?? "chat";

  switch (mode) {
    case "chat":
      await interactiveChat();
      break;

    case "agent": {
      const task = process.argv.slice(3).join(" ") || "分析 claude-project 目錄，列出所有檔案並提供改善建議";
      await runAgentWithHumanLoop(task);
      rl.close();
      break;
    }

    case "generate": {
      const desc = process.argv.slice(3).join(" ") || "一個 REST API 客戶端";
      await autoGenerate(desc);
      rl.close();
      break;
    }

    case "race": {
      const prompt = process.argv[3] ?? "什麼是 AI Agent？";
      console.log(`🏁 競賽: ${prompt}\n`);
      const results = await Promise.allSettled(
        Object.keys(ALL_MODELS).map(id => callModel(id as ModelId, prompt))
      );
      Object.keys(ALL_MODELS).forEach((id, i) => {
        const r = results[i];
        console.log(`[${ALL_MODELS[id as ModelId].label}]`);
        console.log(r.status === "fulfilled" ? r.value.slice(0, 300) : `❌ ${(r as any).reason?.message}`);
        console.log();
      });
      rl.close();
      break;
    }

    default:
      console.log("使用方式:");
      console.log("  tsx master.ts chat                  # 互動對話");
      console.log("  tsx master.ts agent <任務>           # 自動 Agent");
      console.log("  tsx master.ts generate <描述>        # 自動生成程式碼");
      console.log("  tsx master.ts race <問題>            # 所有 AI 競賽");
      rl.close();
  }
}

main().catch(e => { console.error(e); rl.close(); });
