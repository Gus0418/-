/**
 * MCP 伺服器範本
 * 功能：建立 Model Context Protocol 伺服器，提供工具給 AI 使用
 * 使用方式：ts-node mcp-server/index.ts
 * 需要安裝：npm install @modelcontextprotocol/sdk
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";

// 建立 MCP 伺服器實例
const server = new Server(
  {
    name: "my-mcp-server",    // 伺服器名稱
    version: "1.0.0",          // 版本號
  },
  {
    capabilities: {
      tools: {},  // 宣告此伺服器提供工具功能
    },
  }
);

// ===== 工具定義 =====

/**
 * 定義所有可用工具的列表
 * 這些工具將被 AI 客戶端發現和使用
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "read_file",
        description: "讀取指定路徑的檔案內容",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "要讀取的檔案路徑",
            },
            encoding: {
              type: "string",
              enum: ["utf8", "base64"],
              description: "讀取編碼，預設為 utf8",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "write_file",
        description: "將內容寫入指定路徑的檔案",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "要寫入的檔案路徑",
            },
            content: {
              type: "string",
              description: "要寫入的內容",
            },
          },
          required: ["path", "content"],
        },
      },
      {
        name: "list_directory",
        description: "列出指定目錄下的所有檔案和資料夾",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "要列出的目錄路徑，預設為當前目錄",
            },
          },
          required: [],
        },
      },
      {
        name: "get_system_info",
        description: "取得系統資訊，包含作業系統、Node.js 版本等",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "calculate",
        description: "執行簡單的數學計算",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: ["add", "subtract", "multiply", "divide"],
              description: "運算類型",
            },
            a: {
              type: "number",
              description: "第一個數字",
            },
            b: {
              type: "number",
              description: "第二個數字",
            },
          },
          required: ["operation", "a", "b"],
        },
      },
    ],
  };
});

// ===== 工具實作 =====

/**
 * 處理工具呼叫請求
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "read_file": {
      // 讀取檔案工具
      const filePath = args?.path as string;
      const encoding = (args?.encoding as BufferEncoding) || "utf8";

      try {
        const absolutePath = path.resolve(filePath);
        const content = fs.readFileSync(absolutePath, encoding);
        return {
          content: [
            {
              type: "text",
              text: `檔案內容（${absolutePath}）：\n${content}`,
            },
          ],
        };
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `無法讀取檔案：${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    case "write_file": {
      // 寫入檔案工具
      const filePath = args?.path as string;
      const content = args?.content as string;

      try {
        const absolutePath = path.resolve(filePath);
        // 確保目錄存在
        fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
        fs.writeFileSync(absolutePath, content, "utf8");
        return {
          content: [
            {
              type: "text",
              text: `✅ 成功寫入檔案：${absolutePath}`,
            },
          ],
        };
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `無法寫入檔案：${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    case "list_directory": {
      // 列出目錄工具
      const dirPath = (args?.path as string) || ".";

      try {
        const absolutePath = path.resolve(dirPath);
        const items = fs.readdirSync(absolutePath, { withFileTypes: true });

        const fileList = items.map((item) => {
          const type = item.isDirectory() ? "📁" : "📄";
          return `${type} ${item.name}`;
        });

        return {
          content: [
            {
              type: "text",
              text: `目錄內容（${absolutePath}）：\n${fileList.join("\n")}`,
            },
          ],
        };
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `無法列出目錄：${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    case "get_system_info": {
      // 系統資訊工具
      const info = {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        pid: process.pid,
        uptime: `${Math.floor(process.uptime())} 秒`,
        memoryUsage: {
          rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
          heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
        },
        cwd: process.cwd(),
        timestamp: new Date().toISOString(),
      };

      return {
        content: [
          {
            type: "text",
            text: `系統資訊：\n${JSON.stringify(info, null, 2)}`,
          },
        ],
      };
    }

    case "calculate": {
      // 計算工具
      const operation = args?.operation as string;
      const a = args?.a as number;
      const b = args?.b as number;

      let result: number;
      switch (operation) {
        case "add":
          result = a + b;
          break;
        case "subtract":
          result = a - b;
          break;
        case "multiply":
          result = a * b;
          break;
        case "divide":
          if (b === 0) {
            throw new McpError(ErrorCode.InvalidParams, "除數不能為零");
          }
          result = a / b;
          break;
        default:
          throw new McpError(ErrorCode.InvalidParams, `不支援的運算：${operation}`);
      }

      return {
        content: [
          {
            type: "text",
            text: `計算結果：${a} ${operation} ${b} = ${result}`,
          },
        ],
      };
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `未知工具：${name}`);
  }
});

/**
 * 主程式：啟動 MCP 伺服器
 */
async function main(): Promise<void> {
  // 使用標準輸入/輸出作為傳輸層（適合與 Claude Desktop 等客戶端整合）
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // 輸出到 stderr（不影響 stdio 協定）
  console.error("✅ MCP 伺服器已啟動，等待連線...");
  console.error("📦 可用工具：read_file, write_file, list_directory, get_system_info, calculate");
}

main().catch((error) => {
  console.error("MCP 伺服器錯誤：", error);
  process.exit(1);
});
