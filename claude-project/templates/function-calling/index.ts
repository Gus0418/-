/**
 * 工具呼叫（Function Calling）範本
 * 功能：天氣查詢、計算機、日曆工具整合
 * 使用方式：ts-node function-calling/index.ts
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// ===== 工具定義 =====

// 天氣查詢工具
const weatherTool: Anthropic.Tool = {
  name: "get_weather",
  description: "查詢指定城市的當前天氣狀況，包含溫度、濕度、天氣描述",
  input_schema: {
    type: "object" as const,
    properties: {
      city: {
        type: "string",
        description: "城市名稱，例如：台北、台中、高雄",
      },
      unit: {
        type: "string",
        enum: ["celsius", "fahrenheit"],
        description: "溫度單位，預設為 celsius（攝氏）",
      },
    },
    required: ["city"],
  },
};

// 計算機工具
const calculatorTool: Anthropic.Tool = {
  name: "calculate",
  description: "執行數學計算，支援基本四則運算和常用數學函數",
  input_schema: {
    type: "object" as const,
    properties: {
      expression: {
        type: "string",
        description: "數學運算式，例如：2 + 3 * 4、sqrt(16)、10 % 3",
      },
    },
    required: ["expression"],
  },
};

// 日曆工具
const calendarTool: Anthropic.Tool = {
  name: "get_calendar",
  description: "查詢指定日期的行程安排",
  input_schema: {
    type: "object" as const,
    properties: {
      date: {
        type: "string",
        description: "日期，格式為 YYYY-MM-DD，例如：2024-01-15",
      },
    },
    required: ["date"],
  },
};

// ===== 工具實作 =====

/**
 * 模擬天氣 API（實際應用中應呼叫真實 API）
 */
function getWeather(
  city: string,
  unit: string = "celsius"
): Record<string, unknown> {
  // 模擬天氣資料
  const weatherData: Record<string, { temp: number; humidity: number; desc: string }> = {
    台北: { temp: 28, humidity: 75, desc: "多雲有時晴" },
    台中: { temp: 30, humidity: 65, desc: "晴天" },
    高雄: { temp: 32, humidity: 70, desc: "晴時多雲" },
    花蓮: { temp: 27, humidity: 80, desc: "陰天偶有小雨" },
    台南: { temp: 31, humidity: 68, desc: "晴天" },
  };

  const data = weatherData[city] || { temp: 25, humidity: 60, desc: "晴天" };
  const temp =
    unit === "fahrenheit" ? Math.round((data.temp * 9) / 5 + 32) : data.temp;
  const unitSymbol = unit === "fahrenheit" ? "°F" : "°C";

  return {
    city,
    temperature: `${temp}${unitSymbol}`,
    humidity: `${data.humidity}%`,
    description: data.desc,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 安全的數學計算器
 */
function calculate(expression: string): Record<string, unknown> {
  try {
    // 限制只允許數學運算（安全性考量）
    const sanitized = expression
      .replace(/sqrt\(/g, "Math.sqrt(")
      .replace(/abs\(/g, "Math.abs(")
      .replace(/pow\(/g, "Math.pow(")
      .replace(/[^0-9+\-*/().%,Math. ]/g, "");

    // eslint-disable-next-line no-eval
    const result = eval(sanitized);
    return { expression, result, status: "success" };
  } catch {
    return { expression, result: null, status: "error", message: "無效的運算式" };
  }
}

/**
 * 模擬日曆查詢
 */
function getCalendar(date: string): Record<string, unknown> {
  // 模擬行程資料
  const events: Record<string, string[]> = {
    "2024-01-15": ["10:00 團隊會議", "14:00 產品評審", "17:00 一對一面談"],
    "2024-01-16": ["09:00 技術分享", "15:30 客戶電話"],
    "2024-01-17": ["全天空閒"],
  };

  return {
    date,
    events: events[date] || ["無行程安排"],
  };
}

/**
 * 執行工具並返回結果
 */
function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>
): string {
  console.log(`  🔧 執行工具：${toolName}`);
  console.log(`  📥 輸入：${JSON.stringify(toolInput, null, 2)}`);

  let result: Record<string, unknown>;

  switch (toolName) {
    case "get_weather":
      result = getWeather(
        toolInput.city as string,
        toolInput.unit as string
      );
      break;
    case "calculate":
      result = calculate(toolInput.expression as string);
      break;
    case "get_calendar":
      result = getCalendar(toolInput.date as string);
      break;
    default:
      result = { error: `未知工具：${toolName}` };
  }

  console.log(`  📤 結果：${JSON.stringify(result, null, 2)}\n`);
  return JSON.stringify(result);
}

/**
 * 執行帶有工具呼叫的對話（自動迴圈）
 */
async function runWithTools(userMessage: string): Promise<void> {
  console.log(`\n👤 使用者：${userMessage}\n`);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  // 工具呼叫迴圈
  while (true) {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      tools: [weatherTool, calculatorTool, calendarTool],
      messages,
      system: "你是一個能使用各種工具的智慧助手，請用繁體中文回答。",
    });

    // 處理回應中的每個內容塊
    for (const block of response.content) {
      if (block.type === "text" && block.text) {
        console.log(`🤖 AI：${block.text}`);
      }
    }

    // 如果不需要呼叫工具，結束迴圈
    if (response.stop_reason !== "tool_use") {
      break;
    }

    // 收集所有工具呼叫請求
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    // 將 AI 回應加入歷史
    messages.push({ role: "assistant", content: response.content });

    // 執行所有工具並收集結果
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      const result = executeTool(
        toolUse.name,
        toolUse.input as Record<string, unknown>
      );
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    // 將工具結果加入歷史，繼續對話
    messages.push({ role: "user", content: toolResults });
  }
}

/**
 * 主程式
 */
async function main(): Promise<void> {
  console.log("=== 工具呼叫示範系統 ===");

  // 測試不同的工具呼叫場景
  const queries = [
    "台北現在天氣如何？順便換算成華氏溫度。",
    "請計算 (125 + 375) * 0.8 的結果，然後查一下 2024-01-15 的行程。",
    "幫我查台中和高雄的天氣，並告訴我哪個城市比較涼爽？",
  ];

  for (const query of queries) {
    console.log("\n" + "=".repeat(60));
    await runWithTools(query);
  }
}

main().catch(console.error);
