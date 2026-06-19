/** MCP 整合示範 — 用 Claude 透過 MCP 協議操作工具 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import Anthropic from "@anthropic-ai/sdk";
import * as dotenv from "dotenv";
dotenv.config();

const claude = new Anthropic();

async function runWithMcp() {
  // 連線到 MCP filesystem server
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["@modelcontextprotocol/server-filesystem", "./generated"],
  });

  const mcpClient = new Client({ name: "claude-master", version: "1.0" }, { capabilities: {} });
  await mcpClient.connect(transport);

  // 取得可用工具清單
  const { tools } = await mcpClient.listTools();
  console.log(`📦 MCP 工具: ${tools.map(t => t.name).join(", ")}\n`);

  // 轉換為 Claude 工具格式
  const claudeTools: Anthropic.Tool[] = tools.map(t => ({
    name: t.name,
    description: t.description ?? "",
    input_schema: (t.inputSchema as Anthropic.Tool["input_schema"]),
  }));

  // 讓 Claude 使用 MCP 工具
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: "列出 generated 目錄的所有檔案" },
  ];

  while (true) {
    const response = await claude.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      tools: claudeTools,
      messages,
    });

    for (const block of response.content) {
      if (block.type === "text") console.log("Claude:", block.text);
    }

    if (response.stop_reason !== "tool_use") break;

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        console.log(`🔧 MCP: ${block.name}`);
        const result = await mcpClient.callTool({ name: block.name, arguments: block.input as Record<string, unknown> });
        const text = result.content.map((c: any) => c.text ?? "").join("");
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: text });
      }
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });
  }

  await mcpClient.close();
}

runWithMcp().catch(console.error);
