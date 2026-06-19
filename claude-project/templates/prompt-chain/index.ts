/**
 * 提示鏈（Prompt Chaining）範本
 * 功能：串連多個 AI 呼叫完成複雜任務，每個步驟的輸出作為下一步的輸入
 * 使用方式：ts-node prompt-chain/index.ts
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

/**
 * 鏈節點介面
 */
interface ChainNode {
  name: string;           // 步驟名稱
  description: string;    // 步驟描述
  systemPrompt: string;   // 系統提示
  buildPrompt: (input: string, context: ChainContext) => string; // 建立提示的函式
}

/**
 * 鏈上下文介面（儲存各步驟的結果）
 */
interface ChainContext {
  originalInput: string;
  steps: Array<{
    name: string;
    input: string;
    output: string;
    tokens: number;
  }>;
  metadata: Record<string, unknown>;
}

/**
 * 執行單一鏈節點
 */
async function executeChainNode(
  node: ChainNode,
  input: string,
  context: ChainContext
): Promise<string> {
  console.log(`\n⚡ 步驟：${node.name}`);
  console.log(`   ${node.description}`);
  console.log("   處理中...");

  const prompt = node.buildPrompt(input, context);

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    system: node.systemPrompt,
    messages: [{ role: "user", content: prompt }],
    thinking: { type: "adaptive" },
  });

  const output = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  const tokens = response.usage.input_tokens + response.usage.output_tokens;

  // 記錄步驟結果
  context.steps.push({ name: node.name, input, output, tokens });

  console.log(`   ✅ 完成（${tokens} tokens）`);

  return output;
}

/**
 * 執行完整的提示鏈
 */
async function runChain(
  initialInput: string,
  nodes: ChainNode[]
): Promise<ChainContext> {
  const context: ChainContext = {
    originalInput: initialInput,
    steps: [],
    metadata: {},
  };

  let currentInput = initialInput;

  for (const node of nodes) {
    currentInput = await executeChainNode(node, currentInput, context);
  }

  return context;
}

// ===== 示範一：部落格文章生成鏈 =====
// 步驟：主題分析 → 大綱生成 → 內容撰寫 → 標題優化 → SEO 關鍵字

const blogWritingChain: ChainNode[] = [
  {
    name: "主題分析",
    description: "分析主題並確定目標受眾和寫作角度",
    systemPrompt: "你是一個內容策略師，擅長分析主題並制定內容策略。請用繁體中文回答。",
    buildPrompt: (input) =>
      `請分析以下部落格主題，說明：
1. 目標受眾是誰
2. 主要痛點或需求
3. 建議的寫作角度
4. 文章的核心價值主張

主題：${input}`,
  },
  {
    name: "文章大綱",
    description: "根據分析結果生成詳細大綱",
    systemPrompt: "你是一個資深部落格作者，擅長建構清晰有邏輯的文章結構。請用繁體中文回答。",
    buildPrompt: (input, context) =>
      `根據以下主題分析，請為文章「${context.originalInput}」創建詳細大綱：

分析結果：
${input}

大綱要求：
- 包含引言、3-5個主要章節、結論
- 每個章節需有子主題
- 估計每個章節的字數`,
  },
  {
    name: "內容撰寫",
    description: "根據大綱撰寫完整文章",
    systemPrompt: "你是一個專業部落格寫手，擅長撰寫吸引人且有深度的文章。請用繁體中文回答。",
    buildPrompt: (input, context) =>
      `請根據以下大綱撰寫完整文章。文章主題：「${context.originalInput}」

大綱：
${input}

要求：
- 文章總長約 800-1000 字
- 包含實際案例或數據
- 語氣專業但易讀
- 適當使用標題和段落`,
  },
  {
    name: "標題優化",
    description: "生成多個吸引點擊的標題選項",
    systemPrompt: "你是一個文案專家，擅長撰寫吸引注意力的標題。請用繁體中文回答。",
    buildPrompt: (_, context) => {
      const article = context.steps.find((s) => s.name === "內容撰寫")?.output || "";
      return `請為以下文章生成 5 個不同風格的標題選項：
1. 問句型
2. 數字型（如「7個方法...」）
3. 懸念型
4. 利益型
5. 對比型

文章摘要（前200字）：
${article.substring(0, 200)}...`;
    },
  },
];

// ===== 示範二：程式碼審查與重構鏈 =====

const codeRefactorChain: ChainNode[] = [
  {
    name: "程式碼分析",
    description: "分析程式碼的問題和改進空間",
    systemPrompt: "你是一個資深軟體工程師，擅長程式碼審查。請用繁體中文說明，但程式碼保持原語言。",
    buildPrompt: (input) =>
      `請分析以下程式碼，找出：
1. 潛在的 bug 或邏輯錯誤
2. 效能問題
3. 可讀性問題
4. 最佳實踐違反

程式碼：
${input}`,
  },
  {
    name: "重構建議",
    description: "提供具體的重構方案",
    systemPrompt: "你是一個程式碼重構專家，擅長改善程式碼品質。請用繁體中文說明重構理由。",
    buildPrompt: (input, context) =>
      `根據以下分析，請提供具體的重構方案：

原始程式碼：
${context.originalInput}

分析結果：
${input}

請提供：
1. 重構後的完整程式碼
2. 每個改動的說明`,
  },
  {
    name: "單元測試",
    description: "為重構後的程式碼生成單元測試",
    systemPrompt: "你是一個測試工程師，擅長撰寫全面的單元測試。",
    buildPrompt: (input) =>
      `請為以下重構後的程式碼撰寫單元測試：

${input}

要求：
- 使用 Jest 測試框架
- 覆蓋正常情況和邊界情況
- 包含錯誤情況的測試`,
  },
];

/**
 * 顯示鏈執行摘要
 */
function displayChainSummary(context: ChainContext): void {
  const totalTokens = context.steps.reduce((sum, step) => sum + step.tokens, 0);

  console.log("\n" + "=".repeat(55));
  console.log("📊 提示鏈執行摘要");
  console.log("=".repeat(55));
  console.log(`原始輸入：${context.originalInput}`);
  console.log(`執行步驟：${context.steps.length} 個`);
  console.log(`總計 Tokens：${totalTokens}`);
  console.log("\n各步驟結果預覽：");

  for (const step of context.steps) {
    const preview = step.output.substring(0, 100).replace(/\n/g, " ");
    console.log(`\n  📌 ${step.name}（${step.tokens} tokens）`);
    console.log(`     ${preview}...`);
  }
}

/**
 * 主程式
 */
async function main(): Promise<void> {
  console.log("=".repeat(55));
  console.log("  提示鏈（Prompt Chaining）系統");
  console.log("=".repeat(55));

  // ===== 示範一：部落格文章生成 =====
  console.log("\n\n🔗 示範一：部落格文章生成鏈");
  console.log("輸入主題：「如何用 AI 提升工作效率」\n");

  const blogContext = await runChain(
    "如何用 AI 提升工作效率",
    blogWritingChain
  );

  displayChainSummary(blogContext);

  // 顯示最終文章標題選項
  const titleStep = blogContext.steps.find((s) => s.name === "標題優化");
  if (titleStep) {
    console.log("\n\n🎯 最終標題選項：");
    console.log(titleStep.output);
  }

  // ===== 示範二：程式碼重構 =====
  console.log("\n\n🔗 示範二：程式碼重構鏈");

  const sampleCode = `
function getUserData(userId) {
  var data = [];
  for (var i = 0; i < users.length; i++) {
    if (users[i].id == userId) {
      data = users[i];
      break;
    }
  }
  if (data != null) {
    return data;
  }
}`;

  console.log("輸入程式碼：");
  console.log(sampleCode);

  const codeContext = await runChain(sampleCode, codeRefactorChain);
  displayChainSummary(codeContext);

  console.log("\n\n✅ 提示鏈示範完成！");
}

main().catch(console.error);
