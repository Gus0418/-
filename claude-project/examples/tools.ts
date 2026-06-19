/** 工具呼叫範例 */
import Anthropic from "@anthropic-ai/sdk";
import * as dotenv from "dotenv";
dotenv.config();

const client = new Anthropic();

const tools: Anthropic.Tool[] = [
  {
    name: "calculator",
    description: "執行數學計算",
    input_schema: {
      type: "object",
      properties: { expression: { type: "string", description: "數學表達式，如 '2+2'" } },
      required: ["expression"],
    },
  },
  {
    name: "get_time",
    description: "取得當前時間",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

function runTool(name: string, input: Record<string, string>): string {
  if (name === "calculator") {
    try { return String(eval(input.expression)); } catch { return "計算錯誤"; }
  }
  if (name === "get_time") return new Date().toLocaleString("zh-TW");
  return "未知工具";
}

async function main() {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: "現在幾點？另外幫我算 123 * 456 等於多少" },
  ];

  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      tools,
      messages,
    });

    for (const block of response.content) {
      if (block.type === "text") console.log("Claude:", block.text);
    }

    if (response.stop_reason !== "tool_use") break;

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const result = runTool(block.name, block.input as Record<string, string>);
        console.log(`🔧 ${block.name} → ${result}`);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });
  }
}

main().catch(console.error);
