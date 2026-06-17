/**
 * ALL-AI 統一介面
 * 整合所有主流 AI 供應商，單一 API 呼叫任意模型
 */
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { createCohere } from "@ai-sdk/cohere";
import { generateText, streamText } from "ai";
import * as dotenv from "dotenv";
dotenv.config();

// ── 所有模型清單 ─────────────────────────────────────────────────────
export const ALL_MODELS = {
  // Anthropic Claude
  "claude-opus-4-8":      { provider: "anthropic", name: "Claude Opus 4.8 (最強)" },
  "claude-sonnet-4-6":    { provider: "anthropic", name: "Claude Sonnet 4.6 (平衡)" },
  "claude-haiku-4-5-20251001": { provider: "anthropic", name: "Claude Haiku 4.5 (最快)" },
  // OpenAI
  "gpt-4o":               { provider: "openai", name: "GPT-4o" },
  "gpt-4o-mini":          { provider: "openai", name: "GPT-4o Mini" },
  "o1":                   { provider: "openai", name: "OpenAI o1 (推理)" },
  "o3-mini":              { provider: "openai", name: "OpenAI o3 Mini" },
  // Google
  "gemini-2.0-flash":     { provider: "google", name: "Gemini 2.0 Flash" },
  "gemini-1.5-pro":       { provider: "google", name: "Gemini 1.5 Pro" },
  // Groq (超快)
  "llama-3.3-70b-versatile": { provider: "groq", name: "Llama 3.3 70B (Groq)" },
  "mixtral-8x7b-32768":   { provider: "groq", name: "Mixtral 8x7B (Groq)" },
  // Mistral
  "mistral-large-latest": { provider: "mistral", name: "Mistral Large" },
  "mistral-small-latest": { provider: "mistral", name: "Mistral Small" },
  // Cohere
  "command-r-plus":       { provider: "cohere", name: "Command R+" },
  "command-r":            { provider: "cohere", name: "Command R" },
} as const;

export type ModelId = keyof typeof ALL_MODELS;

// ── 統一呼叫介面 ─────────────────────────────────────────────────────
export async function askAI(
  modelId: ModelId,
  prompt: string,
  options: { system?: string; maxTokens?: number } = {}
): Promise<string> {
  const info = ALL_MODELS[modelId];
  const maxTokens = options.maxTokens ?? 1024;

  switch (info.provider) {
    case "anthropic": {
      const client = new Anthropic();
      const msgs: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
      const res = await client.messages.create({
        model: modelId,
        max_tokens: maxTokens,
        ...(options.system ? { system: options.system } : {}),
        messages: msgs,
      });
      return res.content[0].type === "text" ? res.content[0].text : "";
    }

    case "openai": {
      const client = new OpenAI();
      const res = await client.chat.completions.create({
        model: modelId,
        max_tokens: maxTokens,
        messages: [
          ...(options.system ? [{ role: "system" as const, content: options.system }] : []),
          { role: "user" as const, content: prompt },
        ],
      });
      return res.choices[0]?.message?.content ?? "";
    }

    case "google": {
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);
      const model = genAI.getGenerativeModel({ model: modelId });
      const res = await model.generateContent(prompt);
      return res.response.text();
    }

    case "groq": {
      const client = new Groq();
      const res = await client.chat.completions.create({
        model: modelId,
        max_tokens: maxTokens,
        messages: [
          ...(options.system ? [{ role: "system" as const, content: options.system }] : []),
          { role: "user" as const, content: prompt },
        ],
      });
      return res.choices[0]?.message?.content ?? "";
    }

    case "mistral":
    case "cohere": {
      const providerMap = {
        mistral: createMistral(),
        cohere: createCohere(),
      };
      const { text } = await generateText({
        model: (providerMap[info.provider] as any)(modelId),
        prompt,
        maxTokens,
        ...(options.system ? { system: options.system } : {}),
      });
      return text;
    }

    default:
      throw new Error(`未知供應商: ${info.provider}`);
  }
}

// ── 多模型競賽：同一問題同時問所有 AI ──────────────────────────────
export async function raceAllModels(
  prompt: string,
  modelIds: ModelId[] = Object.keys(ALL_MODELS) as ModelId[]
): Promise<Record<string, string>> {
  console.log(`\n🏁 多模型競賽：${modelIds.length} 個模型同時回答`);
  console.log(`❓ 問題：${prompt}\n`);

  const results = await Promise.allSettled(
    modelIds.map(async (id) => {
      const start = Date.now();
      try {
        const text = await askAI(id, prompt, { maxTokens: 512 });
        const ms = Date.now() - start;
        console.log(`✅ ${ALL_MODELS[id].name} (${ms}ms)`);
        return { id, text, ms };
      } catch (e: any) {
        console.log(`❌ ${ALL_MODELS[id].name}: ${e.message}`);
        return { id, text: `[錯誤: ${e.message}]`, ms: 0 };
      }
    })
  );

  const out: Record<string, string> = {};
  for (const r of results) {
    if (r.status === "fulfilled") out[r.value.id] = r.value.text;
  }
  return out;
}

// ── 串流統一介面 ─────────────────────────────────────────────────────
export async function streamAI(
  modelId: ModelId,
  prompt: string,
  onChunk: (text: string) => void
): Promise<void> {
  const info = ALL_MODELS[modelId];

  if (info.provider === "anthropic") {
    const client = new Anthropic();
    const stream = await client.messages.stream({
      model: modelId,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        onChunk(event.delta.text);
      }
    }
    return;
  }

  const providerFn: Record<string, any> = {
    openai: createOpenAI(),
    google: createGoogleGenerativeAI(),
    mistral: createMistral(),
    cohere: createCohere(),
  };

  if (!providerFn[info.provider]) throw new Error(`串流不支援: ${info.provider}`);

  const { textStream } = streamText({
    model: providerFn[info.provider](modelId),
    prompt,
  });
  for await (const chunk of textStream) onChunk(chunk);
}

// ── 主程式示範 ───────────────────────────────────────────────────────
async function main() {
  const prompt = process.argv[2] ?? "用一句繁體中文說明你是誰。";

  if (process.argv[3] === "race") {
    const results = await raceAllModels(prompt, [
      "claude-sonnet-4-6",
      "gpt-4o-mini",
      "gemini-2.0-flash",
      "llama-3.3-70b-versatile",
    ]);
    console.log("\n📊 競賽結果：");
    for (const [id, text] of Object.entries(results)) {
      console.log(`\n[${id}]\n${text}`);
    }
    return;
  }

  const modelId = (process.argv[3] as ModelId) ?? "claude-sonnet-4-6";
  console.log(`\n🤖 使用模型：${ALL_MODELS[modelId]?.name ?? modelId}`);
  process.stdout.write("回應：");
  await streamAI(modelId, prompt, (chunk) => process.stdout.write(chunk));
  console.log("\n");
}

main().catch(console.error);
