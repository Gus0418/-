import Anthropic from "@anthropic-ai/sdk";
import * as dotenv from "dotenv";
dotenv.config();

const client = new Anthropic();

async function preview() {
  console.log("=== 預覽模式：快速驗證 Claude 連線 ===\n");

  const message = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: "用一句話說明你能做什麼。",
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  console.log("Claude 回應:", text);
  console.log("\n模型:", message.model);
  console.log(
    "Token 使用:",
    `輸入 ${message.usage.input_tokens} / 輸出 ${message.usage.output_tokens}`
  );
  console.log("\n✅ 連線正常，可執行 run.ts");
}

preview().catch(console.error);
