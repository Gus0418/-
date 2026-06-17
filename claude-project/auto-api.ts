/**
 * 自動 API 系統
 * 自動選模型 → 自動設參數 → 自動重試 → 自動快取 → 自動計費追蹤
 */
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as crypto from "crypto";
import * as dotenv from "dotenv";
dotenv.config();

const client = new Anthropic();

// ── 快取層 ───────────────────────────────────────────────────────────
const CACHE_DIR = "./.cache";
fs.mkdirSync(CACHE_DIR, { recursive: true });

function cacheKey(prompt: string, model: string): string {
  return crypto.createHash("md5").update(`${model}:${prompt}`).digest("hex");
}
function cacheGet(key: string): string | null {
  const f = `${CACHE_DIR}/${key}.json`;
  if (!fs.existsSync(f)) return null;
  const { text, ts } = JSON.parse(fs.readFileSync(f, "utf-8"));
  if (Date.now() - ts > 3_600_000) return null; // 1小時TTL
  return text;
}
function cacheSet(key: string, text: string) {
  fs.writeFileSync(`${CACHE_DIR}/${key}.json`, JSON.stringify({ text, ts: Date.now() }));
}

// ── 計費追蹤 ─────────────────────────────────────────────────────────
const PRICING: Record<string, { in: number; out: number }> = {
  "claude-opus-4-8":          { in: 15,    out: 75    }, // per 1M tokens
  "claude-sonnet-4-6":        { in: 3,     out: 15    },
  "claude-haiku-4-5-20251001":{ in: 0.25,  out: 1.25  },
};

const usageLog: { model: string; in: number; out: number; cost: number; ts: number }[] = [];

function trackUsage(model: string, inputTokens: number, outputTokens: number) {
  const price = PRICING[model] ?? { in: 3, out: 15 };
  const cost = (inputTokens * price.in + outputTokens * price.out) / 1_000_000;
  usageLog.push({ model, in: inputTokens, out: outputTokens, cost, ts: Date.now() });
  return cost;
}

function usageSummary() {
  const total = usageLog.reduce((s, r) => s + r.cost, 0);
  const tokens = usageLog.reduce((s, r) => s + r.in + r.out, 0);
  return { total: total.toFixed(6), tokens, calls: usageLog.length };
}

// ── 自動模型選擇 ─────────────────────────────────────────────────────
type TaskType = "quick" | "balanced" | "complex" | "code" | "analysis";

function autoSelectModel(prompt: string, taskType?: TaskType): string {
  if (taskType === "quick") return "claude-haiku-4-5-20251001";
  if (taskType === "complex" || taskType === "analysis") return "claude-opus-4-8";
  if (taskType === "code") return "claude-sonnet-4-6";

  // 自動推斷
  const len = prompt.length;
  if (len < 100) return "claude-haiku-4-5-20251001";
  if (len > 2000 || /分析|架構|設計|優化|比較/.test(prompt)) return "claude-opus-4-8";
  return "claude-sonnet-4-6";
}

// ── 自動 max_tokens 設定 ─────────────────────────────────────────────
function autoMaxTokens(prompt: string, taskType?: TaskType): number {
  if (taskType === "quick") return 512;
  if (taskType === "analysis") return 8192;
  if (/寫|生成|程式|代碼/.test(prompt)) return 4096;
  if (/摘要|總結|一句/.test(prompt)) return 256;
  return 1024;
}

// ── 核心：全自動 API 呼叫 ────────────────────────────────────────────
export interface AutoCallOptions {
  model?: string;
  taskType?: TaskType;
  system?: string;
  useCache?: boolean;
  stream?: boolean;
  onStream?: (chunk: string) => void;
}

export async function autoCall(
  prompt: string,
  options: AutoCallOptions = {}
): Promise<{ text: string; model: string; cost: number; cached: boolean }> {
  const model = options.model ?? autoSelectModel(prompt, options.taskType);
  const maxTokens = autoMaxTokens(prompt, options.taskType);
  const useCache = options.useCache ?? true;

  // 快取命中
  if (useCache) {
    const key = cacheKey(prompt + (options.system ?? ""), model);
    const cached = cacheGet(key);
    if (cached) {
      console.log(`⚡ 快取命中 [${model}]`);
      return { text: cached, model, cost: 0, cached: true };
    }
  }

  console.log(`🤖 自動選模型: ${model} | max_tokens: ${maxTokens}`);

  // 串流模式
  if (options.stream && options.onStream) {
    let fullText = "";
    const stream = await client.messages.stream({
      model,
      max_tokens: maxTokens,
      ...(options.system ? { system: options.system } : {}),
      messages: [{ role: "user", content: prompt }],
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        options.onStream(event.delta.text);
        fullText += event.delta.text;
      }
    }
    const final = await stream.finalMessage();
    const cost = trackUsage(model, final.usage.input_tokens, final.usage.output_tokens);
    if (useCache) cacheSet(cacheKey(prompt + (options.system ?? ""), model), fullText);
    return { text: fullText, model, cost, cached: false };
  }

  // 一般模式（含自動重試）
  let lastErr: any;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const msg = await client.messages.create({
        model,
        max_tokens: maxTokens,
        ...(options.system ? { system: options.system } : {}),
        messages: [{ role: "user", content: prompt }],
      });
      const text = msg.content[0].type === "text" ? msg.content[0].text : "";
      const cost = trackUsage(model, msg.usage.input_tokens, msg.usage.output_tokens);
      if (useCache) cacheSet(cacheKey(prompt + (options.system ?? ""), model), text);
      return { text, model, cost, cached: false };
    } catch (err: any) {
      lastErr = err;
      if (err?.status === 429 || err?.status === 529 || err?.status >= 500) {
        const delay = 1000 * 2 ** attempt;
        console.log(`  ⚠️  重試 ${attempt + 1}/4，等待 ${delay}ms (${err.status})`);
        await new Promise(r => setTimeout(r, delay));

        // 降級模型
        if (attempt === 2 && model === "claude-opus-4-8") {
          console.log("  ⬇️  降級至 claude-sonnet-4-6");
          return autoCall(prompt, { ...options, model: "claude-sonnet-4-6" });
        }
      } else throw err;
    }
  }
  throw lastErr;
}

// ── 批次自動呼叫 ─────────────────────────────────────────────────────
export async function autoBatch(
  prompts: string[],
  options: AutoCallOptions = {},
  concurrency = 3
): Promise<string[]> {
  console.log(`\n📦 批次處理 ${prompts.length} 個請求 (並發: ${concurrency})`);
  const results: string[] = new Array(prompts.length).fill("");

  for (let i = 0; i < prompts.length; i += concurrency) {
    const batch = prompts.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map(p => autoCall(p, options).then(r => r.text))
    );
    settled.forEach((r, j) => {
      results[i + j] = r.status === "fulfilled" ? r.value : `[錯誤: ${(r as any).reason?.message}]`;
    });
    console.log(`  ✅ ${Math.min(i + concurrency, prompts.length)}/${prompts.length} 完成`);
  }

  const summary = usageSummary();
  console.log(`\n💰 批次完成 | 總費用: $${summary.total} | Tokens: ${summary.tokens.toLocaleString()}`);
  return results;
}

// ── 主程式示範 ───────────────────────────────────────────────────────
async function main() {
  console.log("=== 全自動 API 系統示範 ===\n");

  // 1. 自動選模型
  const r1 = await autoCall("hi");
  console.log(`[短問] 模型:${r1.model} | 回應:${r1.text.slice(0, 60)}\n`);

  // 2. 串流
  console.log("[串流模式]");
  process.stdout.write("Claude: ");
  const r2 = await autoCall("用繁體中文列出三個台灣城市", {
    stream: true,
    onStream: c => process.stdout.write(c),
  });
  console.log(`\n費用: $${r2.cost.toFixed(6)}\n`);

  // 3. 批次
  const results = await autoBatch(["台北特色?", "台中特色?", "高雄特色?"]);
  results.forEach((r, i) => console.log(`[${i+1}] ${r.slice(0, 80)}`));

  // 4. 快取示範（第二次不呼叫 API）
  await autoCall("hi"); // 從快取取得

  const s = usageSummary();
  console.log(`\n📊 使用統計: ${s.calls} 次呼叫 | ${s.tokens} tokens | $${s.total}`);
}

main().catch(console.error);
