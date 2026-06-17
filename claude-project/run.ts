import Anthropic from "@anthropic-ai/sdk";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, streamText } from "ai";
import * as dotenv from "dotenv";
dotenv.config();

const anthropic = new Anthropic();
const aiSdkAnthropic = createAnthropic();

// ── 1. 直接呼叫 Claude API ──────────────────────────────────────────
async function runDirect(prompt: string) {
  console.log("=== [1] 直接 API 呼叫 ===");
  const msg = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  console.log(text);
  return text;
}

// ── 2. Vercel AI SDK（統一介面，可切換任意模型）──────────────────────
async function runAiSdk(prompt: string) {
  console.log("\n=== [2] Vercel AI SDK ===");
  const { text } = await generateText({
    model: aiSdkAnthropic("claude-opus-4-8"),
    prompt,
  });
  console.log(text);
  return text;
}

// ── 3. 串流輸出 ────────────────────────────────────────────────────
async function runStream(prompt: string) {
  console.log("\n=== [3] 串流模式 ===");
  const { textStream } = streamText({
    model: aiSdkAnthropic("claude-opus-4-8"),
    prompt,
  });
  process.stdout.write("Claude: ");
  for await (const chunk of textStream) {
    process.stdout.write(chunk);
  }
  console.log("\n");
}

// ── 4. 工具呼叫 (Tool Use) ─────────────────────────────────────────
async function runWithTools(prompt: string) {
  console.log("=== [4] 工具呼叫 ===");
  const msg = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    tools: [
      {
        name: "get_weather",
        description: "取得指定城市的天氣資訊",
        input_schema: {
          type: "object" as const,
          properties: {
            city: { type: "string", description: "城市名稱" },
          },
          required: ["city"],
        },
      },
    ],
    messages: [{ role: "user", content: prompt }],
  });

  for (const block of msg.content) {
    if (block.type === "tool_use") {
      console.log(`呼叫工具: ${block.name}`, block.input);
    } else if (block.type === "text") {
      console.log(block.text);
    }
  }
}

// ── 主程式 ──────────────────────────────────────────────────────────
async function main() {
  const prompt = process.argv[2] || "用繁體中文介紹台北的三個特色景點。";

  await runDirect(prompt);
  await runAiSdk(prompt);
  await runStream(prompt);
  await runWithTools("台北今天天氣如何？");
}

main().catch(console.error);
