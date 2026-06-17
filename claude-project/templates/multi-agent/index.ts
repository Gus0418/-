/**
 * 多代理人協作系統範本
 * 功能：規劃者、執行者、審查者三角色協作完成複雜任務
 * 使用方式：ts-node multi-agent/index.ts
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// ===== 代理人角色定義 =====

// 規劃代理人：分析任務並制定執行計劃
const PLANNER_SYSTEM = `你是一個專業的任務規劃代理人。
你的職責：
1. 分析使用者的任務需求
2. 將複雜任務分解成可執行的步驟
3. 評估每個步驟的優先順序和依賴關係
4. 輸出結構化的執行計劃（JSON 格式）

輸出格式：
{
  "task_summary": "任務摘要",
  "steps": [
    {"id": 1, "action": "步驟描述", "expected_output": "預期產出"}
  ],
  "estimated_complexity": "low|medium|high"
}`;

// 執行代理人：根據計劃執行各步驟
const EXECUTOR_SYSTEM = `你是一個專業的任務執行代理人。
你的職責：
1. 根據規劃代理人的計劃逐步執行
2. 對每個步驟提供詳細的執行結果
3. 如果遇到問題，提出替代方案
4. 確保輸出的品質和完整性

請詳細執行每個步驟，並說明你的思考過程。`;

// 審查代理人：評估執行結果的品質
const REVIEWER_SYSTEM = `你是一個嚴格但公正的品質審查代理人。
你的職責：
1. 評估執行代理人的工作成果
2. 檢查是否符合原始任務需求
3. 指出不足之處或需要改進的地方
4. 給出最終品質評分（1-10分）和改進建議

輸出格式：
{
  "score": 評分,
  "strengths": ["優點1", "優點2"],
  "weaknesses": ["缺點1", "缺點2"],
  "suggestions": ["建議1", "建議2"],
  "approved": true/false
}`;

/**
 * 代理人基礎介面
 */
interface Agent {
  name: string;
  system: string;
  role: "planner" | "executor" | "reviewer";
}

/**
 * 代理人回應介面
 */
interface AgentResponse {
  agentName: string;
  role: string;
  content: string;
  tokens: number;
}

/**
 * 執行單一代理人任務
 */
async function runAgent(
  agent: Agent,
  userMessage: string,
  context?: string
): Promise<AgentResponse> {
  console.log(`\n🤖 [${agent.name}] 開始處理...`);

  // 組合訊息（包含上下文）
  const fullMessage = context
    ? `前一步驟的輸出：\n${context}\n\n當前任務：\n${userMessage}`
    : userMessage;

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 8096,
    system: agent.system,
    messages: [{ role: "user", content: fullMessage }],
    thinking: { type: "adaptive" },
  });

  // 提取文字內容（跳過思考塊）
  const textContent = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const totalTokens =
    response.usage.input_tokens + response.usage.output_tokens;

  console.log(`✅ [${agent.name}] 完成處理 (使用 ${totalTokens} tokens)`);

  return {
    agentName: agent.name,
    role: agent.role,
    content: textContent,
    tokens: totalTokens,
  };
}

/**
 * 解析 JSON 格式的回應（容錯處理）
 */
function parseJsonResponse(text: string): Record<string, unknown> | null {
  try {
    // 嘗試提取 JSON 區塊
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // 忽略解析錯誤
  }
  return null;
}

/**
 * 多代理人協作流程
 * @param task 需要完成的任務描述
 * @param maxIterations 最大迭代次數（審查未通過時重新執行）
 */
async function runMultiAgentWorkflow(
  task: string,
  maxIterations: number = 2
): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 多代理人協作系統啟動");
  console.log("=".repeat(60));
  console.log(`📋 任務：${task}\n`);

  // 定義三個代理人
  const planner: Agent = {
    name: "規劃代理人",
    system: PLANNER_SYSTEM,
    role: "planner",
  };

  const executor: Agent = {
    name: "執行代理人",
    system: EXECUTOR_SYSTEM,
    role: "executor",
  };

  const reviewer: Agent = {
    name: "審查代理人",
    system: REVIEWER_SYSTEM,
    role: "reviewer",
  };

  let totalTokens = 0;
  let iteration = 0;

  // 步驟一：規劃
  console.log("\n📌 階段一：任務規劃");
  console.log("-".repeat(40));
  const planResult = await runAgent(planner, task);
  totalTokens += planResult.tokens;

  console.log("\n規劃結果：");
  console.log(planResult.content);

  const plan = parseJsonResponse(planResult.content);

  // 迭代執行與審查
  while (iteration < maxIterations) {
    iteration++;
    console.log(`\n📌 階段二：任務執行（第 ${iteration} 次）`);
    console.log("-".repeat(40));

    // 執行
    const executionResult = await runAgent(
      executor,
      task,
      planResult.content
    );
    totalTokens += executionResult.tokens;

    console.log("\n執行結果：");
    console.log(executionResult.content);

    // 審查
    console.log(`\n📌 階段三：品質審查（第 ${iteration} 次）`);
    console.log("-".repeat(40));

    const reviewContext = `原始任務：${task}\n\n執行結果：${executionResult.content}`;
    const reviewResult = await runAgent(reviewer, "請審查以下任務執行結果", reviewContext);
    totalTokens += reviewResult.tokens;

    console.log("\n審查結果：");
    console.log(reviewResult.content);

    const review = parseJsonResponse(reviewResult.content);

    // 判斷是否通過審查
    if (review && review.approved === true) {
      console.log(`\n✅ 任務通過審查！評分：${review.score}/10`);
      break;
    } else if (review && review.score !== undefined) {
      console.log(
        `\n⚠️  審查未通過（評分：${review.score}/10），需要改進`
      );
      if (iteration >= maxIterations) {
        console.log("已達最大迭代次數，結束流程");
      }
    } else {
      console.log("\n審查完成，結束流程");
      break;
    }
  }

  // 統計資訊
  console.log("\n" + "=".repeat(60));
  console.log("📊 協作統計");
  console.log(`  執行迭代次數：${iteration}`);
  console.log(`  總計使用 Tokens：${totalTokens}`);
  console.log(`  涉及代理人：3 個（規劃者、執行者、審查者）`);
  console.log("=".repeat(60));
}

/**
 * 主程式
 */
async function main(): Promise<void> {
  // 示範任務：請求代理人協作完成一個技術文件
  const task = `請為一個 TypeScript REST API 專案撰寫 README 文件，包含：
  1. 專案簡介
  2. 安裝說明
  3. 使用方式（附程式碼範例）
  4. API 端點說明
  5. 環境變數設定`;

  await runMultiAgentWorkflow(task, 2);
}

main().catch(console.error);
