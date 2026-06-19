/** 所有 AI 效能基準測試 */
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import Groq from "groq-sdk";
import * as dotenv from "dotenv";
dotenv.config();

const PROMPTS = [
  "Hello, what's 2+2?",
  "用繁體中文說明 TypeScript 的優點，30字以內",
  "Write a bubble sort in Python",
];

async function bench(name: string, fn: () => Promise<string>) {
  const start = Date.now();
  try {
    const text = await fn();
    const ms = Date.now() - start;
    return { name, ms, chars: text.length, ok: true };
  } catch (e: any) {
    return { name, ms: Date.now() - start, chars: 0, ok: false, error: e.message };
  }
}

async function main() {
  console.log("⏱️  AI 效能基準測試\n");
  const prompt = PROMPTS[1];
  console.log(`問題: ${prompt}\n`);

  const anthropic = new Anthropic();
  const openai = new OpenAI();
  const groq = new Groq();

  const tests = await Promise.all([
    bench("Claude Opus 4.8", async () => {
      const r = await anthropic.messages.create({ model: "claude-opus-4-8", max_tokens: 256, messages: [{ role: "user", content: prompt }] });
      return r.content[0].type === "text" ? r.content[0].text : "";
    }),
    bench("Claude Sonnet 4.6", async () => {
      const r = await anthropic.messages.create({ model: "claude-sonnet-4-6", max_tokens: 256, messages: [{ role: "user", content: prompt }] });
      return r.content[0].type === "text" ? r.content[0].text : "";
    }),
    bench("Claude Haiku 4.5", async () => {
      const r = await anthropic.messages.create({ model: "claude-haiku-4-5-20251001", max_tokens: 256, messages: [{ role: "user", content: prompt }] });
      return r.content[0].type === "text" ? r.content[0].text : "";
    }),
    bench("GPT-4o", async () => {
      const r = await openai.chat.completions.create({ model: "gpt-4o", max_tokens: 256, messages: [{ role: "user", content: prompt }] });
      return r.choices[0]?.message?.content ?? "";
    }),
    bench("GPT-4o Mini", async () => {
      const r = await openai.chat.completions.create({ model: "gpt-4o-mini", max_tokens: 256, messages: [{ role: "user", content: prompt }] });
      return r.choices[0]?.message?.content ?? "";
    }),
    bench("Llama 3.3 70B (Groq)", async () => {
      const r = await groq.chat.completions.create({ model: "llama-3.3-70b-versatile", max_tokens: 256, messages: [{ role: "user", content: prompt }] });
      return r.choices[0]?.message?.content ?? "";
    }),
  ]);

  console.log("結果：");
  console.log("─".repeat(55));
  const sorted = tests.sort((a, b) => a.ms - b.ms);
  for (const t of sorted) {
    const bar = "█".repeat(Math.round(t.ms / 200)).slice(0, 20);
    console.log(`${t.name.padEnd(24)} ${t.ok ? "✅" : "❌"} ${String(t.ms).padStart(5)}ms ${bar}`);
  }
  console.log("─".repeat(55));
  console.log(`🏆 最快: ${sorted[0].name} (${sorted[0].ms}ms)`);
}

main().catch(console.error);
