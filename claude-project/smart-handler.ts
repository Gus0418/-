/**
 * 智慧容量 & 格式處理器
 * 自動偵測 → 分塊 → 格式轉換 → 重試 → 合併，無需人工介入
 */
import Anthropic from "@anthropic-ai/sdk";
import * as tiktoken from "@anthropic-ai/tokenizer";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

const client = new Anthropic();

// ── 模型容量上限表 ───────────────────────────────────────────────────
const MODEL_LIMITS: Record<string, { context: number; output: number }> = {
  "claude-opus-4-8":          { context: 200_000, output: 32_000 },
  "claude-sonnet-4-6":        { context: 200_000, output: 64_000 },
  "claude-haiku-4-5-20251001":{ context: 200_000, output: 16_000 },
  "gpt-4o":                   { context: 128_000, output: 16_000 },
  "gpt-4o-mini":              { context: 128_000, output: 16_000 },
  "gemini-2.0-flash":         { context: 1_000_000, output: 8_000 },
};

// ── Token 計算 ───────────────────────────────────────────────────────
function countTokens(text: string): number {
  try {
    const enc = tiktoken.getTokenizer("cl100k_base");
    return enc.encode(text).length;
  } catch {
    return Math.ceil(text.length / 4); // 估算：4字元≈1token
  }
}

// ── 自動格式偵測 ─────────────────────────────────────────────────────
type TextFormat = "json" | "markdown" | "csv" | "yaml" | "code" | "plain";

function detectFormat(text: string): TextFormat {
  const t = text.trim();
  if (t.startsWith("{") || t.startsWith("[")) return "json";
  if (t.startsWith("---") || /^[a-z_]+:\s/m.test(t)) return "yaml";
  if (/^#{1,6}\s/m.test(t) || /\*\*.*\*\*/.test(t)) return "markdown";
  if (/^".*",".*"/m.test(t) || t.split("\n")[0]?.includes(",")) return "csv";
  if (/^(import|export|const|function|class|def |public |private )/.test(t)) return "code";
  return "plain";
}

// ── 格式轉換器 ───────────────────────────────────────────────────────
async function convertFormat(
  text: string,
  from: TextFormat,
  to: TextFormat
): Promise<string> {
  if (from === to) return text;

  // 純文字轉換（不需 API）
  if (from === "json" && to === "yaml") {
    const obj = JSON.parse(text);
    return Object.entries(obj)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join("\n");
  }
  if (from === "csv" && to === "json") {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
    const rows = lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim().replace(/"/g, ""));
      return Object.fromEntries(headers.map((h, i) => [h, vals[i]]));
    });
    return JSON.stringify(rows, null, 2);
  }

  // 複雜轉換用 Claude
  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: `你是格式轉換器。將輸入從 ${from} 格式轉換為 ${to} 格式。只輸出轉換後的內容，不要說明。`,
    messages: [{ role: "user", content: text.slice(0, 8000) }],
  });
  return msg.content[0].type === "text" ? msg.content[0].text : text;
}

// ── 智慧分塊 ─────────────────────────────────────────────────────────
function smartChunk(text: string, maxTokens: number): string[] {
  const chunks: string[] = [];
  const fmt = detectFormat(text);

  // JSON：按頂層 key 分塊
  if (fmt === "json") {
    try {
      const obj = JSON.parse(text);
      if (Array.isArray(obj)) {
        const chunkSize = Math.ceil(obj.length / Math.ceil(countTokens(text) / maxTokens));
        for (let i = 0; i < obj.length; i += chunkSize) {
          chunks.push(JSON.stringify(obj.slice(i, i + chunkSize), null, 2));
        }
        return chunks;
      }
    } catch { /* fallthrough */ }
  }

  // CSV：按行分塊
  if (fmt === "csv") {
    const lines = text.split("\n");
    const header = lines[0];
    let current = header;
    for (const line of lines.slice(1)) {
      if (countTokens(current + "\n" + line) > maxTokens) {
        chunks.push(current);
        current = header + "\n" + line;
      } else {
        current += "\n" + line;
      }
    }
    if (current !== header) chunks.push(current);
    return chunks;
  }

  // Markdown：按標題分塊
  if (fmt === "markdown") {
    const sections = text.split(/(?=^#{1,3}\s)/m);
    let current = "";
    for (const section of sections) {
      if (countTokens(current + section) > maxTokens) {
        if (current) chunks.push(current);
        current = section;
      } else {
        current += section;
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }

  // 程式碼：按函式/類別分塊
  if (fmt === "code") {
    const lines = text.split("\n");
    let current = "";
    for (const line of lines) {
      if (countTokens(current + line) > maxTokens) {
        chunks.push(current);
        current = line + "\n";
      } else {
        current += line + "\n";
      }
    }
    if (current.trim()) chunks.push(current);
    return chunks;
  }

  // 純文字：按句子分塊
  const sentences = text.match(/[^。！？.!?]+[。！？.!?]*/g) ?? [text];
  let current = "";
  for (const s of sentences) {
    if (countTokens(current + s) > maxTokens) {
      chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

// ── 自動重試（指數退避）─────────────────────────────────────────────
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 4,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isRetryable =
        err?.status === 429 || err?.status === 529 ||
        err?.status === 500 || err?.status === 503 ||
        err?.message?.includes("overloaded");
      if (!isRetryable || attempt === maxRetries) throw err;
      const delay = baseDelay * 2 ** attempt + Math.random() * 500;
      console.log(`  ⚠️  重試 ${attempt + 1}/${maxRetries}，等待 ${Math.round(delay)}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("超過最大重試次數");
}

// ── 主函式：智慧 AI 呼叫 ─────────────────────────────────────────────
export interface SmartCallOptions {
  model?: string;
  system?: string;
  maxOutputTokens?: number;
  targetFormat?: TextFormat;
  mergeStrategy?: "concat" | "summarize" | "structured";
}

export async function smartCall(
  prompt: string,
  input: string,
  options: SmartCallOptions = {}
): Promise<string> {
  const model = options.model ?? "claude-sonnet-4-6";
  const limits = MODEL_LIMITS[model] ?? { context: 100_000, output: 4096 };
  const maxOutput = Math.min(options.maxOutputTokens ?? 4096, limits.output);
  const maxInput = limits.context - maxOutput - countTokens(prompt) - 1000; // 留buffer

  const inputFmt = detectFormat(input);
  const targetFmt = options.targetFormat ?? inputFmt;

  console.log(`📊 輸入: ${countTokens(input)} tokens | 模型上限: ${limits.context.toLocaleString()}`);
  console.log(`🔍 格式偵測: ${inputFmt}${targetFmt !== inputFmt ? ` → 轉換為 ${targetFmt}` : ""}`);

  // 格式轉換
  let processedInput = input;
  if (targetFmt !== inputFmt) {
    console.log(`🔄 轉換格式: ${inputFmt} → ${targetFmt}`);
    processedInput = await convertFormat(input, inputFmt, targetFmt);
  }

  // 若在容量內，直接呼叫
  if (countTokens(processedInput) <= maxInput) {
    console.log("✅ 容量足夠，直接處理");
    return withRetry(() =>
      client.messages.create({
        model,
        max_tokens: maxOutput,
        ...(options.system ? { system: options.system } : {}),
        messages: [{ role: "user", content: `${prompt}\n\n${processedInput}` }],
      }).then(r => r.content[0].type === "text" ? r.content[0].text : "")
    );
  }

  // 超出容量 → 分塊處理
  const chunks = smartChunk(processedInput, maxInput);
  console.log(`📦 超出容量，自動分成 ${chunks.length} 塊處理`);

  const results: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    console.log(`  🔄 處理第 ${i + 1}/${chunks.length} 塊 (${countTokens(chunks[i])} tokens)...`);
    const chunkPrompt = chunks.length > 1
      ? `${prompt}\n\n[第 ${i + 1}/${chunks.length} 部分，請處理此部分：]\n\n${chunks[i]}`
      : `${prompt}\n\n${chunks[i]}`;

    const result = await withRetry(() =>
      client.messages.create({
        model,
        max_tokens: maxOutput,
        ...(options.system ? { system: options.system } : {}),
        messages: [{ role: "user", content: chunkPrompt }],
      }).then(r => r.content[0].type === "text" ? r.content[0].text : "")
    );
    results.push(result);
  }

  // 合併結果
  if (results.length === 1) return results[0];
  return mergeResults(results, options.mergeStrategy ?? "summarize", model, prompt);
}

// ── 結果合併 ─────────────────────────────────────────────────────────
async function mergeResults(
  results: string[],
  strategy: "concat" | "summarize" | "structured",
  model: string,
  originalPrompt: string
): Promise<string> {
  console.log(`🔗 合併 ${results.length} 個結果 (策略: ${strategy})`);

  if (strategy === "concat") return results.join("\n\n---\n\n");

  if (strategy === "structured") {
    const allJson = results.map(r => { try { return JSON.parse(r); } catch { return r; } });
    if (allJson.every(Array.isArray)) return JSON.stringify(allJson.flat(), null, 2);
    if (allJson.every(r => typeof r === "object")) return JSON.stringify(Object.assign({}, ...allJson), null, 2);
    return results.join("\n");
  }

  // summarize：再問 Claude 統整
  const combined = results.map((r, i) => `[部分 ${i + 1}]\n${r}`).join("\n\n");
  const merged = await withRetry(() =>
    client.messages.create({
      model,
      max_tokens: 4096,
      system: "你是摘要整合專家。將多個部分的分析結果整合為一份完整、連貫的最終報告。",
      messages: [{
        role: "user",
        content: `原始任務：${originalPrompt}\n\n各部分結果：\n${combined}\n\n請整合為最終完整報告：`,
      }],
    }).then(r => r.content[0].type === "text" ? r.content[0].text : combined)
  );
  return merged;
}

// ── 自動處理檔案 ─────────────────────────────────────────────────────
export async function processFile(
  filePath: string,
  prompt: string,
  outputPath?: string,
  options: SmartCallOptions = {}
): Promise<void> {
  const content = fs.readFileSync(filePath, "utf-8");
  const bytes = Buffer.byteLength(content);
  console.log(`\n📁 處理檔案: ${filePath} (${(bytes / 1024).toFixed(1)} KB)`);

  const result = await smartCall(prompt, content, options);
  const out = outputPath ?? filePath.replace(/(\.[^.]+)$/, ".output$1");
  fs.writeFileSync(out, result, "utf-8");
  console.log(`💾 輸出: ${out}`);
}

// ── 主程式 ───────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "file" && args[1]) {
    await processFile(args[1], args[2] ?? "分析並摘要此檔案內容");
    return;
  }

  // 示範：自動處理各種格式與容量情境
  console.log("=== 智慧容量 & 格式處理器示範 ===\n");

  // 情境 1：大型 JSON
  const bigJson = JSON.stringify(
    Array.from({ length: 200 }, (_, i) => ({ id: i, name: `項目${i}`, value: Math.random() })),
    null, 2
  );
  console.log("【情境 1】大型 JSON 自動分塊");
  const r1 = await smartCall("統計這些項目的數量和平均值", bigJson, { mergeStrategy: "summarize" });
  console.log("結果:", r1.slice(0, 200), "\n");

  // 情境 2：格式轉換
  const csvData = "name,age,city\n張三,25,台北\n李四,30,台中\n王五,28,高雄";
  console.log("【情境 2】CSV → JSON 格式轉換");
  const r2 = await smartCall("整理這份資料", csvData, { targetFormat: "json" });
  console.log("結果:", r2.slice(0, 300), "\n");

  // 情境 3：超大文字自動分塊
  const bigText = "這是一段很長的測試文字。".repeat(500);
  console.log("【情境 3】超大文字自動分塊");
  const r3 = await smartCall("摘要這段文字的重點", bigText, { mergeStrategy: "summarize" });
  console.log("結果:", r3.slice(0, 200));
}

main().catch(console.error);
