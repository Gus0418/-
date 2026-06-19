/**
 * MCP 客戶端範本
 * 功能：連接 MCP 伺服器並讓 Claude 使用其提供的工具
 * 使用方式：ts-node mcp-client/index.ts
 * 需要安裝：npm install @anthropic-ai/sdk @modelcontextprotocol/sdk
 */

import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";

const anthropic = new Anthropic();

/**
 * MCP 工具資訊介面
 */
interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * 將 MCP 工具格式轉換為 Anthropic Tool 格式
 */
function convertMCPToolToAnthropicTool(mcpTool: MCPTool): Anthropic.Tool {
  return {
    name: mcpTool.name,
    description: mcpTool.description,
    input_schema: mcpTool.inputSchema as Anthropic.Tool["input_schema"],
  };
}

/**
 * MCP 客戶端管理類別
 */
class MCPClientManager {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private tools: MCPTool[] = [];

  constructor() {
    // 建立 MCP 客戶端實例
    this.client = new Client(
      {
        name: "my-mcp-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );
  }

  /**
   * 連接到 MCP 伺服器
   * @param serverCommand 伺服器執行指令
   * @param serverArgs 伺服器執行參數
   */
  async connect(serverCommand: string, serverArgs: string[]): Promise<void> {
    console.log(`🔌 連接到 MCP 伺服器: ${serverCommand} ${serverArgs.join(" ")}`);

    // 啟動伺服器子程序
    const serverProcess = spawn(serverCommand, serverArgs, {
      stdio: ["pipe", "pipe", "inherit"],
    });

    // 建立 stdio 傳輸層
    this.transport = new StdioClientTransport({
      command: serverCommand,
      args: serverArgs,
    });

    // 連接客戶端
    await this.client.connect(this.transport);
    console.log("✅ 已成功連接到 MCP 伺服器\n");

    // 清理子程序（避免記憶體洩漏）
    serverProcess.kill();

    // 取得可用工具列表
    await this.loadTools();
  }

  /**
   * 載入伺服器提供的工具列表
   */
  async loadTools(): Promise<void> {
    const response = await this.client.listTools();
    this.tools = response.tools as MCPTool[];

    console.log(`🔧 發現 ${this.tools.length} 個可用工具：`);
    for (const tool of this.tools) {
      console.log(`  - ${tool.name}: ${tool.description}`);
    }
    console.log();
  }

  /**
   * 取得 Anthropic 格式的工具列表
   */
  getAnthropicTools(): Anthropic.Tool[] {
    return this.tools.map(convertMCPToolToAnthropicTool);
  }

  /**
   * 呼叫 MCP 工具
   * @param toolName 工具名稱
   * @param toolInput 工具輸入參數
   */
  async callTool(
    toolName: string,
    toolInput: Record<string, unknown>
  ): Promise<string> {
    try {
      console.log(`  🔧 呼叫工具：${toolName}`);
      console.log(`  📥 輸入：${JSON.stringify(toolInput)}`);

      const result = await this.client.callTool({
        name: toolName,
        arguments: toolInput,
      });

      // 提取文字內容
      const textContent = result.content
        .filter((item: { type: string }) => item.type === "text")
        .map((item: { type: string; text?: string }) => item.text || "")
        .join("\n");

      console.log(`  📤 結果：${textContent.substring(0, 100)}...\n`);
      return textContent;
    } catch (error) {
      const errorMessage = `工具呼叫失敗：${error instanceof Error ? error.message : String(error)}`;
      console.error(`  ❌ ${errorMessage}`);
      return errorMessage;
    }
  }

  /**
   * 關閉連線
   */
  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.client.close();
      console.log("🔌 已斷開 MCP 伺服器連線");
    }
  }
}

/**
 * 使用 MCP 工具與 Claude 對話
 * @param mcpClient MCP 客戶端管理器
 * @param userMessage 使用者訊息
 */
async function chatWithMCPTools(
  mcpClient: MCPClientManager,
  userMessage: string
): Promise<void> {
  console.log(`\n👤 使用者：${userMessage}\n`);

  const anthropicTools = mcpClient.getAnthropicTools();
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  // 工具呼叫迴圈
  while (true) {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      tools: anthropicTools,
      messages,
      system: "你是一個能使用 MCP 工具的智慧助手，請用繁體中文回答。",
    });

    // 輸出文字回應
    for (const block of response.content) {
      if (block.type === "text" && block.text) {
        console.log(`🤖 Claude：${block.text}`);
      }
    }

    // 如果不需要工具，結束
    if (response.stop_reason !== "tool_use") {
      break;
    }

    // 處理工具呼叫
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      const result = await mcpClient.callTool(
        toolUse.name,
        toolUse.input as Record<string, unknown>
      );
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }
}

/**
 * 示範：直接模擬 MCP 工具（不需要真實伺服器）
 */
async function demoWithSimulatedTools(): Promise<void> {
  console.log("=== MCP 客戶端示範（模擬模式）===\n");

  // 直接使用 Anthropic SDK 模擬 MCP 工具行為
  const simulatedTools: Anthropic.Tool[] = [
    {
      name: "read_file",
      description: "讀取指定路徑的檔案內容",
      input_schema: {
        type: "object" as const,
        properties: {
          path: { type: "string", description: "檔案路徑" },
        },
        required: ["path"],
      },
    },
    {
      name: "list_directory",
      description: "列出目錄內容",
      input_schema: {
        type: "object" as const,
        properties: {
          path: { type: "string", description: "目錄路徑" },
        },
        required: [],
      },
    },
  ];

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: "請列出當前目錄的內容" },
  ];

  console.log("👤 使用者：請列出當前目錄的內容\n");

  while (true) {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      tools: simulatedTools,
      messages,
      system: "你是一個使用 MCP 工具的助手，請用繁體中文回答。",
    });

    for (const block of response.content) {
      if (block.type === "text") {
        console.log(`🤖 Claude：${block.text}`);
      }
    }

    if (response.stop_reason !== "tool_use") break;

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    messages.push({ role: "assistant", content: response.content });

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      console.log(`\n  🔧 工具呼叫：${toolUse.name}`);
      // 模擬工具回應
      const mockResult =
        toolUse.name === "list_directory"
          ? "📁 node_modules\n📄 package.json\n📄 tsconfig.json\n📁 src"
          : "檔案內容示範";

      results.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: mockResult,
      });
    }

    messages.push({ role: "user", content: results });
  }
}

/**
 * 主程式
 */
async function main(): Promise<void> {
  // 執行示範（使用模擬工具）
  await demoWithSimulatedTools();

  console.log("\n\n📝 說明：");
  console.log("如要連接真實 MCP 伺服器，請使用以下方式：");
  console.log("  const mcpClient = new MCPClientManager();");
  console.log('  await mcpClient.connect("node", ["path/to/mcp-server.js"]);');
  console.log('  await chatWithMCPTools(mcpClient, "你的問題");');
  console.log("  await mcpClient.disconnect();");
}

main().catch(console.error);
