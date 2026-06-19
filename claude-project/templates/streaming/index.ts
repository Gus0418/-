/**
 * 串流輸出範本
 * 功能：示範 SSE 事件處理、即時輸出、串流統計
 * 使用方式：ts-node streaming/index.ts
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

/**
 * 串流統計介面
 */
interface StreamStats {
  firstTokenTime: number | null;
  lastTokenTime: number | null;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCharacters: number;
  duration: number;
}

/**
 * 基本串流輸出示範
 * 展示如何逐字輸出 Claude 的回應
 */
async function basicStreaming(): Promise<void> {
  console.log("\n📡 示範一：基本串流輸出");
  console.log("-".repeat(40));
  console.log("AI 回應（即時輸出）：\n");

  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: "請用繁體中文，簡單介紹量子電腦的基本原理（約 100 字）",
      },
    ],
  });

  // 逐字輸出（on text 事件）
  stream.on("text", (text) => {
    process.stdout.write(text);
  });

  // 等待完成並取得最終訊息
  const finalMessage = await stream.finalMessage();

  console.log("\n\n📊 基本統計：");
  console.log(`  輸入 Tokens：${finalMessage.usage.input_tokens}`);
  console.log(`  輸出 Tokens：${finalMessage.usage.output_tokens}`);
  console.log(`  停止原因：${finalMessage.stop_reason}`);
}

/**
 * 詳細串流事件監聽示範
 * 展示所有可用的串流事件
 */
async function detailedStreamEvents(): Promise<void> {
  console.log("\n📡 示範二：詳細串流事件監聽");
  console.log("-".repeat(40));

  const stats: StreamStats = {
    firstTokenTime: null,
    lastTokenTime: null,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalCharacters: 0,
    duration: 0,
  };

  const startTime = Date.now();
  let fullText = "";

  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: "請列出 5 個學習程式設計的有效方法，每個方法請簡短說明",
      },
    ],
    system: "你是一個程式教學專家，請用繁體中文回答。",
  });

  // 監聽串流開始事件
  stream.on("streamEvent", (event) => {
    if (event.type === "message_start") {
      console.log("  ✅ 串流已開始\n");
    } else if (event.type === "message_delta") {
      stats.outputTokens = event.usage?.output_tokens || 0;
    } else if (event.type === "message_stop") {
      console.log("\n\n  ✅ 串流已結束");
    }
  });

  // 監聽文字塊事件（包含每個文字片段）
  stream.on("text", (text) => {
    const now = Date.now();
    if (!stats.firstTokenTime) {
      stats.firstTokenTime = now - startTime;
      console.log(`  ⏱️  首個 Token 延遲：${stats.firstTokenTime}ms\n`);
      console.log("回應內容：");
    }
    stats.lastTokenTime = now - startTime;
    stats.totalCharacters += text.length;
    process.stdout.write(text);
    fullText += text;
  });

  // 等待完成
  const finalMessage = await stream.finalMessage();
  stats.duration = Date.now() - startTime;
  stats.inputTokens = finalMessage.usage.input_tokens;
  stats.totalTokens =
    finalMessage.usage.input_tokens + finalMessage.usage.output_tokens;

  // 輸出詳細統計
  console.log("\n\n📊 詳細串流統計：");
  console.log(`  首個 Token 延遲：${stats.firstTokenTime}ms`);
  console.log(`  總耗時：${stats.duration}ms`);
  console.log(`  輸入 Tokens：${stats.inputTokens}`);
  console.log(`  輸出 Tokens：${stats.outputTokens}`);
  console.log(`  總 Tokens：${stats.totalTokens}`);
  console.log(`  總字元數：${stats.totalCharacters}`);
  if (stats.duration > 0) {
    const tokensPerSecond = Math.round((stats.outputTokens / stats.duration) * 1000);
    console.log(`  輸出速度：${tokensPerSecond} tokens/秒`);
  }
}

/**
 * 串流思考過程示範
 * 展示帶有 thinking 塊的串流
 */
async function streamingWithThinking(): Promise<void> {
  console.log("\n📡 示範三：串流思考過程");
  console.log("-".repeat(40));

  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 8096,
    thinking: { type: "adaptive" }, // 啟用自適應思考
    messages: [
      {
        role: "user",
        content: "如果一個水桶有 3.5 公升的水，每次倒出 0.4 公升，需要倒幾次才能倒完？",
      },
    ],
  });

  let inThinking = false;

  // 監聽所有串流事件以分辨思考和回答
  stream.on("streamEvent", (event) => {
    if (event.type === "content_block_start") {
      if (event.content_block.type === "thinking") {
        inThinking = true;
        console.log("🧠 思考過程：");
        console.log("(以下為 AI 的內部推理)");
        console.log("-".repeat(30));
      } else if (event.content_block.type === "text") {
        if (inThinking) {
          inThinking = false;
          console.log("-".repeat(30));
          console.log("\n💬 最終回答：");
        }
      }
    } else if (event.type === "content_block_delta") {
      if (event.delta.type === "thinking_delta") {
        process.stdout.write(event.delta.thinking);
      } else if (event.delta.type === "text_delta") {
        process.stdout.write(event.delta.text);
      }
    }
  });

  await stream.finalMessage();
  console.log("\n");
}

/**
 * 多個並行串流請求示範
 */
async function parallelStreaming(): Promise<void> {
  console.log("\n📡 示範四：並行串流請求");
  console.log("-".repeat(40));

  const topics = ["人工智慧", "區塊鏈", "物聯網"];
  const startTime = Date.now();

  // 同時發起多個串流請求
  const streamPromises = topics.map(async (topic, index) => {
    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `請用一句話（30字以內）說明${topic}的核心概念`,
        },
      ],
    });

    let response = "";
    stream.on("text", (text) => {
      response += text;
    });

    await stream.finalMessage();
    return { topic, response, index };
  });

  // 等待所有串流完成
  const results = await Promise.all(streamPromises);

  const totalTime = Date.now() - startTime;
  console.log("並行請求結果：\n");
  for (const result of results) {
    console.log(`📌 ${result.topic}：`);
    console.log(`   ${result.response}\n`);
  }
  console.log(`⏱️  並行執行總耗時：${totalTime}ms`);
}

/**
 * 主程式
 */
async function main(): Promise<void> {
  console.log("=".repeat(50));
  console.log("  串流輸出（Streaming）完整示範");
  console.log("=".repeat(50));

  // 依序執行各示範
  await basicStreaming();
  await detailedStreamEvents();
  await streamingWithThinking();
  await parallelStreaming();

  console.log("\n✅ 所有串流示範完成！");
}

main().catch(console.error);
