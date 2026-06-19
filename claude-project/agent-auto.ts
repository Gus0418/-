import Anthropic from "@anthropic-ai/sdk";
import * as dotenv from "dotenv";
dotenv.config();

const client = new Anthropic();

// 工具定義
const tools: Anthropic.Tool[] = [
  {
    name: "read_file",
    description: "讀取檔案內容",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "檔案路徑" } },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "寫入檔案",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "檔案路徑" },
        content: { type: "string", description: "檔案內容" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "run_command",
    description: "執行 shell 指令",
    input_schema: {
      type: "object",
      properties: { command: { type: "string", description: "指令" } },
      required: ["command"],
    },
  },
  {
    name: "web_search",
    description: "搜尋網路資訊",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "搜尋關鍵字" } },
      required: ["query"],
    },
  },
  {
    name: "analyze_code",
    description: "分析程式碼並給出建議",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string", description: "程式碼內容" },
        language: { type: "string", description: "程式語言" },
      },
      required: ["code"],
    },
  },
];

// 模擬工具執行
function executeTool(name: string, input: Record<string, string>): string {
  switch (name) {
    case "read_file":
      return `[模擬] 讀取 ${input.path} 成功，內容：範例檔案內容`;
    case "write_file":
      return `[模擬] 已寫入 ${input.path}，${input.content.length} 字元`;
    case "run_command":
      return `[模擬] 執行: ${input.command}\n輸出: 指令執行成功`;
    case "web_search":
      return `[模擬] 搜尋「${input.query}」，找到 10 筆結果`;
    case "analyze_code":
      return `[模擬] 分析完成：程式碼結構良好，建議加入錯誤處理`;
    default:
      return `[未知工具: ${name}]`;
  }
}

// 全自動 Agent 循環
async function runAgent(task: string, maxSteps = 10) {
  console.log(`\n🤖 全自動 Agent 啟動`);
  console.log(`📋 任務: ${task}`);
  console.log("─".repeat(50));

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: task },
  ];

  let step = 0;

  while (step < maxSteps) {
    step++;
    console.log(`\n[步驟 ${step}]`);

    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      tools,
      system:
        "你是一個全自動 AI Agent。分析任務，使用可用工具完成目標。完成後回覆「任務完成」。",
      messages,
    });

    // 顯示 Claude 的文字回應
    for (const block of response.content) {
      if (block.type === "text" && block.text) {
        console.log("Claude:", block.text);
      }
    }

    // 如果沒有工具呼叫，任務完成
    if (response.stop_reason === "end_turn") {
      console.log("\n✅ Agent 任務完成");
      break;
    }

    // 執行所有工具呼叫
    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          console.log(`🔧 呼叫工具: ${block.name}`);
          console.log(`   輸入:`, JSON.stringify(block.input));
          const result = executeTool(block.name, block.input as Record<string, string>);
          console.log(`   結果: ${result}`);

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      // 更新對話歷史
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
    }
  }

  if (step >= maxSteps) {
    console.log(`\n⚠️ 達到最大步驟數 (${maxSteps})，Agent 停止`);
  }
}

// 批次自動執行多個任務
async function runBatch(tasks: string[]) {
  console.log(`\n🚀 批次自動執行 ${tasks.length} 個任務\n`);
  for (let i = 0; i < tasks.length; i++) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`任務 ${i + 1}/${tasks.length}`);
    await runAgent(tasks[i]);
  }
  console.log(`\n${"═".repeat(60)}`);
  console.log("🎉 所有任務完成");
}

// 主程式
const task = process.argv[2] || "分析目前專案結構，讀取 package.json，並建議優化方向。";

if (process.argv[3] === "batch") {
  await runBatch([
    "讀取 plan.md 並產生執行摘要",
    "分析 run.ts 的程式碼品質",
    "搜尋最新的 Claude API 功能",
  ]);
} else {
  await runAgent(task);
}
