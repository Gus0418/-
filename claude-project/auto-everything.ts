/**
 * 全自動一切系統 (Auto Everything)
 * 自動行為引擎：監控 → 決策 → 執行 → 學習 → 循環
 * 整合所有 AI + 自動選擇最佳模型 + 自動處理所有邊界情況
 */
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import Groq from "groq-sdk";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { createCohere } from "@ai-sdk/cohere";
import { generateText } from "ai";
import * as fs from "fs";
import * as crypto from "crypto";
import * as dotenv from "dotenv";
dotenv.config();

// ── 全 AI 供應商清單 ─────────────────────────────────────────────────
const PROVIDERS = {
  anthropic: {
    models: ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
    strength: ["reasoning", "code", "analysis", "creative", "long-context"],
  },
  openai: {
    models: ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"],
    strength: ["general", "function-calling", "vision"],
  },
  google: {
    models: ["gemini-2.0-flash", "gemini-1.5-pro"],
    strength: ["multimodal", "long-context", "fast"],
  },
  groq: {
    models: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"],
    strength: ["speed", "open-source"],
  },
  mistral: {
    models: ["mistral-large-latest", "mistral-small-latest"],
    strength: ["european", "efficient"],
  },
  cohere: {
    models: ["command-r-plus", "command-r"],
    strength: ["rag", "search", "enterprise"],
  },
} as const;

type Provider = keyof typeof PROVIDERS;

// ── 效能記錄（自動學習）──────────────────────────────────────────────
interface PerformanceRecord {
  provider: string;
  model: string;
  task: string;
  latency: number;
  success: boolean;
  quality: number; // 0-1
}

const perfDB: PerformanceRecord[] = [];
const PERF_FILE = "./.perf.json";
if (fs.existsSync(PERF_FILE)) {
  perfDB.push(...JSON.parse(fs.readFileSync(PERF_FILE, "utf-8")));
}

function savePerfDB() {
  fs.writeFileSync(PERF_FILE, JSON.stringify(perfDB.slice(-500)));
}

function getBestModel(task: string): { provider: Provider; model: string } {
  // 根據歷史效能選最佳
  const taskRecords = perfDB.filter(r =>
    r.task === task && r.success && r.latency < 30000
  );
  if (taskRecords.length >= 3) {
    const best = taskRecords.sort((a, b) =>
      (b.quality - b.latency / 100000) - (a.quality - a.latency / 100000)
    )[0];
    return { provider: best.provider as Provider, model: best.model };
  }

  // 規則選擇
  if (/code|程式|函式|bug/.test(task)) return { provider: "anthropic", model: "claude-sonnet-4-6" };
  if (/fast|快速|即時/.test(task)) return { provider: "groq", model: "llama-3.3-70b-versatile" };
  if (/complex|複雜|分析|推理/.test(task)) return { provider: "anthropic", model: "claude-opus-4-8" };
  if (/image|圖片|視覺/.test(task)) return { provider: "google", model: "gemini-2.0-flash" };
  if (/search|搜尋|rag/.test(task)) return { provider: "cohere", model: "command-r-plus" };
  return { provider: "anthropic", model: "claude-sonnet-4-6" };
}

// ── 統一呼叫層（含自動 fallback）────────────────────────────────────
async function callAI(
  prompt: string,
  provider: Provider,
  model: string,
  options: { system?: string; maxTokens?: number } = {}
): Promise<string> {
  const maxTokens = options.maxTokens ?? 1024;

  if (provider === "anthropic") {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model, max_tokens: maxTokens,
      ...(options.system ? { system: options.system } : {}),
      messages: [{ role: "user", content: prompt }],
    });
    return msg.content[0].type === "text" ? msg.content[0].text : "";
  }

  if (provider === "openai") {
    const client = new OpenAI();
    const res = await client.chat.completions.create({
      model, max_tokens: maxTokens,
      messages: [
        ...(options.system ? [{ role: "system" as const, content: options.system }] : []),
        { role: "user", content: prompt },
      ],
    });
    return res.choices[0]?.message?.content ?? "";
  }

  if (provider === "groq") {
    const client = new Groq();
    const res = await client.chat.completions.create({
      model, max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });
    return res.choices[0]?.message?.content ?? "";
  }

  // google / mistral / cohere via AI SDK
  const sdkMap = {
    google: createGoogleGenerativeAI(),
    mistral: createMistral(),
    cohere: createCohere(),
  } as Record<string, any>;

  const { text } = await generateText({
    model: sdkMap[provider](model),
    prompt,
    maxTokens,
    ...(options.system ? { system: options.system } : {}),
  });
  return text;
}

// ── 自動 fallback 鏈 ─────────────────────────────────────────────────
const FALLBACK_CHAIN: { provider: Provider; model: string }[] = [
  { provider: "anthropic", model: "claude-sonnet-4-6" },
  { provider: "openai",    model: "gpt-4o-mini" },
  { provider: "groq",      model: "llama-3.3-70b-versatile" },
  { provider: "google",    model: "gemini-2.0-flash" },
  { provider: "mistral",   model: "mistral-small-latest" },
];

export async function autoEverything(
  task: string,
  prompt: string,
  options: { system?: string; race?: boolean; parallel?: number } = {}
): Promise<string> {
  // 競賽模式：同時問多個 AI，取最快成功的
  if (options.race) {
    console.log(`🏁 競賽模式：${FALLBACK_CHAIN.length} 個 AI 同時作答`);
    const result = await Promise.any(
      FALLBACK_CHAIN.map(async ({ provider, model }) => {
        const start = Date.now();
        try {
          const text = await callAI(prompt, provider, model, options);
          const latency = Date.now() - start;
          console.log(`  🥇 ${provider}/${model} 最快 (${latency}ms)`);
          perfDB.push({ provider, model, task, latency, success: true, quality: 0.8 });
          savePerfDB();
          return text;
        } catch {
          throw new Error(`${provider} 失敗`);
        }
      })
    );
    return result;
  }

  // 智慧選擇模式
  const { provider, model } = getBestModel(task);
  console.log(`🧠 自動選擇: ${provider}/${model}`);

  // Fallback 鏈
  for (let i = 0; i < FALLBACK_CHAIN.length; i++) {
    const target = i === 0
      ? { provider, model }
      : FALLBACK_CHAIN[i];

    try {
      const start = Date.now();
      const text = await callAI(prompt, target.provider, target.model, options);
      const latency = Date.now() - start;
      perfDB.push({ provider: target.provider, model: target.model, task, latency, success: true, quality: 0.8 });
      savePerfDB();
      if (i > 0) console.log(`  ✅ Fallback 成功: ${target.provider}/${target.model}`);
      return text;
    } catch (err: any) {
      console.log(`  ❌ ${target.provider}/${target.model} 失敗: ${err.message}`);
      if (i < FALLBACK_CHAIN.length - 1) {
        console.log(`  ⬇️  切換至 ${FALLBACK_CHAIN[i + 1].provider}/${FALLBACK_CHAIN[i + 1].model}`);
      }
      perfDB.push({ provider: target.provider, model: target.model, task, latency: 0, success: false, quality: 0 });
    }
  }

  throw new Error("所有 AI 供應商均不可用");
}

// ── 自動行為監控迴圈 ─────────────────────────────────────────────────
interface AutoBehavior {
  trigger: RegExp;
  task: string;
  action: (input: string) => Promise<void>;
}

const AUTO_BEHAVIORS: AutoBehavior[] = [
  {
    trigger: /\.ts$|\.js$/,
    task: "code",
    action: async (file) => {
      const code = fs.readFileSync(file, "utf-8");
      const review = await autoEverything("code", `Code review:\n${code.slice(0, 3000)}`);
      fs.writeFileSync(file + ".review.md", review);
      console.log(`📋 Code review 完成: ${file}.review.md`);
    },
  },
  {
    trigger: /\.json$/,
    task: "analysis",
    action: async (file) => {
      const data = fs.readFileSync(file, "utf-8");
      const analysis = await autoEverything("analysis", `分析此 JSON 結構：\n${data.slice(0, 2000)}`);
      console.log(`📊 JSON 分析: ${analysis.slice(0, 200)}`);
    },
  },
];

export async function watchAndAct(dir: string, intervalMs = 5000) {
  console.log(`👁️  監控目錄: ${dir} (每 ${intervalMs / 1000}s)`);
  const seen = new Set<string>();

  setInterval(() => {
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
      const full = `${dir}/${file}`;
      if (seen.has(full)) continue;
      seen.add(full);
      for (const behavior of AUTO_BEHAVIORS) {
        if (behavior.trigger.test(file)) {
          behavior.action(full).catch(console.error);
        }
      }
    }
  }, intervalMs);
}

// ── 主程式 ───────────────────────────────────────────────────────────
async function main() {
  console.log("=== 全自動一切系統 ===\n");

  const mode = process.argv[2];

  if (mode === "watch") {
    await watchAndAct(process.argv[3] ?? "./claude-project");
    console.log("監控中... (Ctrl+C 停止)");
    await new Promise(() => {}); // 永久運行
    return;
  }

  if (mode === "race") {
    const prompt = process.argv[3] ?? "介紹台灣";
    const result = await autoEverything("general", prompt, { race: true });
    console.log("\n🏆 最快回應:", result);
    return;
  }

  // 示範所有自動行為
  const tasks = [
    { task: "quick", prompt: "hi" },
    { task: "code", prompt: "寫一個 TypeScript 的 sleep 函式" },
    { task: "analysis", prompt: "分析台灣 AI 產業發展趨勢" },
  ];

  for (const { task, prompt } of tasks) {
    console.log(`\n📌 任務類型: ${task}`);
    const result = await autoEverything(task, prompt);
    console.log(`回應: ${result.slice(0, 150)}...`);
  }

  // 效能報告
  const successRate = perfDB.filter(r => r.success).length / Math.max(perfDB.length, 1);
  const avgLatency = perfDB.filter(r => r.success).reduce((s, r) => s + r.latency, 0) / Math.max(1, perfDB.filter(r => r.success).length);
  console.log(`\n📊 效能報告: 成功率 ${(successRate * 100).toFixed(1)}% | 平均延遲 ${avgLatency.toFixed(0)}ms`);
}

main().catch(console.error);
