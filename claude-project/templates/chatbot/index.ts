/**
 * 多輪對話聊天機器人範本
 * 功能：記憶對話歷史、角色設定、串流輸出
 * 使用方式：ts-node chatbot/index.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";

// 初始化 Anthropic 客戶端（自動讀取 ANTHROPIC_API_KEY 環境變數）
const client = new Anthropic();

// 對話歷史記憶（多輪對話的核心）
const conversationHistory: Anthropic.MessageParam[] = [];

// 聊天機器人角色設定
const SYSTEM_PROMPT = `你是一位友善、有耐心的 AI 助手，名叫「小智」。
你的特點：
- 使用繁體中文回答問題
- 回答簡潔清楚，避免過度冗長
- 遇到不懂的問題會坦誠說明
- 善於舉例說明複雜概念
- 記得對話中提到的重要資訊`;

/**
 * 發送訊息並取得串流回應
 * @param userMessage 使用者輸入的訊息
 */
async function chat(userMessage: string): Promise<void> {
  // 將使用者訊息加入對話歷史
  conversationHistory.push({
    role: "user",
    content: userMessage,
  });

  console.log("\n小智：");

  try {
    // 使用串流模式取得回應（適合長回答）
    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 8096,
      system: SYSTEM_PROMPT,
      messages: conversationHistory,
      thinking: { type: "adaptive" }, // 啟用自適應思考模式
    });

    let fullResponse = "";

    // 即時輸出串流內容
    stream.on("text", (text) => {
      process.stdout.write(text);
      fullResponse += text;
    });

    // 等待串流完成
    await stream.finalMessage();

    console.log("\n");

    // 將 AI 回應加入對話歷史（維持多輪對話狀態）
    conversationHistory.push({
      role: "assistant",
      content: fullResponse,
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`API 錯誤 ${error.status}: ${error.message}`);
    } else {
      throw error;
    }
  }
}

/**
 * 顯示對話統計資訊
 */
function showStats(): void {
  const turns = Math.floor(conversationHistory.length / 2);
  console.log(`\n📊 對話統計：已進行 ${turns} 輪對話`);
}

/**
 * 清除對話歷史
 */
function clearHistory(): void {
  conversationHistory.length = 0;
  console.log("✅ 對話歷史已清除，開始新的對話。\n");
}

/**
 * 主程式入口
 */
async function main(): Promise<void> {
  console.log("=".repeat(50));
  console.log("  歡迎使用多輪對話聊天機器人「小智」");
  console.log("=".repeat(50));
  console.log("指令說明：");
  console.log("  /clear  - 清除對話歷史");
  console.log("  /stats  - 顯示對話統計");
  console.log("  /quit   - 結束程式");
  console.log("=".repeat(50) + "\n");

  // 建立命令列介面
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // 提示輸入的函式（Promise 化）
  const prompt = (question: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(question, resolve);
    });
  };

  // 主要對話迴圈
  while (true) {
    const userInput = await prompt("你：");
    const trimmed = userInput.trim();

    if (!trimmed) continue;

    // 處理特殊指令
    if (trimmed === "/quit") {
      showStats();
      console.log("再見！感謝使用小智聊天機器人。");
      rl.close();
      break;
    } else if (trimmed === "/clear") {
      clearHistory();
    } else if (trimmed === "/stats") {
      showStats();
    } else {
      // 一般對話
      await chat(trimmed);
    }
  }
}

// 執行主程式
main().catch(console.error);
