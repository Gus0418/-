/**
 * LLM 評估框架範本
 * 功能：評估 AI 回應品質、一致性、準確性，支援多種評估指標
 * 使用方式：ts-node eval/index.ts
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

/**
 * 評估測試案例介面
 */
interface TestCase {
  id: string;
  name: string;
  input: string;
  expectedOutput?: string;    // 可選的預期輸出（用於精確比對）
  criteria: EvaluationCriteria[];
  systemPrompt?: string;
}

/**
 * 評估標準介面
 */
interface EvaluationCriteria {
  name: string;               // 評估標準名稱
  description: string;        // 評估描述
  weight: number;             // 權重（0-1，所有標準合計應為 1）
}

/**
 * 單項評估結果
 */
interface CriteriaScore {
  criteriaName: string;
  score: number;              // 0-10
  weight: number;
  weightedScore: number;
  reasoning: string;
}

/**
 * 測試案例評估結果
 */
interface EvaluationResult {
  testCaseId: string;
  testCaseName: string;
  input: string;
  actualOutput: string;
  criteriaScores: CriteriaScore[];
  overallScore: number;       // 加權平均分
  passed: boolean;            // 是否通過（分數 >= 7）
  summary: string;
  tokensUsed: number;
}

/**
 * 評估報告
 */
interface EvaluationReport {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  averageScore: number;
  results: EvaluationResult[];
  timestamp: string;
}

/**
 * 生成模型回應
 */
async function generateResponse(
  input: string,
  systemPrompt?: string
): Promise<{ output: string; tokens: number }> {
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: systemPrompt || "你是一個有幫助的 AI 助手，請用繁體中文回答。",
    messages: [{ role: "user", content: input }],
  });

  const output = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return {
    output,
    tokens: response.usage.input_tokens + response.usage.output_tokens,
  };
}

/**
 * 使用 Claude 作為評估者（LLM-as-Judge 模式）
 */
async function evaluateResponse(
  testCase: TestCase,
  actualOutput: string
): Promise<{ scores: CriteriaScore[]; summary: string; evalTokens: number }> {
  const criteriaText = testCase.criteria
    .map(
      (c) =>
        `- ${c.name}（權重 ${c.weight}）：${c.description}`
    )
    .join("\n");

  const expectedText = testCase.expectedOutput
    ? `\n預期輸出：\n${testCase.expectedOutput}\n`
    : "";

  const evalPrompt = `你是一個 AI 評估專家。請評估以下 AI 回應的品質。

===輸入===
${testCase.input}
${expectedText}
===實際回應===
${actualOutput}

===評估標準===
${criteriaText}

請對每個評估標準給出 0-10 的分數和理由。
回應格式（嚴格 JSON）：
{
  "scores": [
    {
      "criteriaName": "標準名稱",
      "score": 分數,
      "reasoning": "評分理由"
    }
  ],
  "summary": "整體評估摘要"
}`;

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: "你是一個客觀公正的 AI 評估專家，擅長評估 AI 回應的品質。請用繁體中文回答。",
    messages: [{ role: "user", content: evalPrompt }],
    thinking: { type: "adaptive" },
  });

  const responseText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  const evalTokens = response.usage.input_tokens + response.usage.output_tokens;

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      // 計算加權分數
      const scores: CriteriaScore[] = parsed.scores.map(
        (s: { criteriaName: string; score: number; reasoning: string }) => {
          const criteria = testCase.criteria.find(
            (c) => c.name === s.criteriaName
          );
          const weight = criteria?.weight || 0;
          return {
            criteriaName: s.criteriaName,
            score: s.score,
            weight,
            weightedScore: s.score * weight,
            reasoning: s.reasoning,
          };
        }
      );

      return { scores, summary: parsed.summary, evalTokens };
    }
  } catch {
    // 解析失敗
  }

  // 回退到預設評分
  const defaultScores: CriteriaScore[] = testCase.criteria.map((c) => ({
    criteriaName: c.name,
    score: 5,
    weight: c.weight,
    weightedScore: 5 * c.weight,
    reasoning: "無法解析評估結果",
  }));

  return {
    scores: defaultScores,
    summary: responseText.substring(0, 200),
    evalTokens,
  };
}

/**
 * 執行完整測試案例評估
 */
async function runTestCase(testCase: TestCase): Promise<EvaluationResult> {
  console.log(`\n  📋 測試案例：${testCase.name}`);

  // 步驟一：生成回應
  const { output: actualOutput, tokens: responseTokens } =
    await generateResponse(testCase.input, testCase.systemPrompt);

  console.log(`     生成回應完成（${responseTokens} tokens）`);

  // 步驟二：評估回應
  const { scores, summary, evalTokens } = await evaluateResponse(
    testCase,
    actualOutput
  );

  console.log(`     評估完成（${evalTokens} tokens）`);

  // 計算總分
  const overallScore = scores.reduce((sum, s) => sum + s.weightedScore, 0);
  const passed = overallScore >= 7;

  console.log(
    `     整體評分：${overallScore.toFixed(2)}/10 ${passed ? "✅ 通過" : "❌ 未通過"}`
  );

  return {
    testCaseId: testCase.id,
    testCaseName: testCase.name,
    input: testCase.input,
    actualOutput,
    criteriaScores: scores,
    overallScore,
    passed,
    summary,
    tokensUsed: responseTokens + evalTokens,
  };
}

/**
 * 執行完整評估套件
 */
async function runEvalSuite(testCases: TestCase[]): Promise<EvaluationReport> {
  console.log(`🚀 開始執行評估套件（${testCases.length} 個測試案例）\n`);

  const results: EvaluationResult[] = [];

  for (const testCase of testCases) {
    const result = await runTestCase(testCase);
    results.push(result);
  }

  const passedTests = results.filter((r) => r.passed).length;
  const averageScore =
    results.reduce((sum, r) => sum + r.overallScore, 0) / results.length;

  return {
    totalTests: results.length,
    passedTests,
    failedTests: results.length - passedTests,
    averageScore,
    results,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 格式化輸出評估報告
 */
function displayReport(report: EvaluationReport): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 評估報告");
  console.log("=".repeat(60));
  console.log(`執行時間：${report.timestamp}`);
  console.log(`總測試數：${report.totalTests}`);
  console.log(`通過率：${report.passedTests}/${report.totalTests} (${Math.round(report.passedTests / report.totalTests * 100)}%)`);
  console.log(`平均分數：${report.averageScore.toFixed(2)}/10`);

  console.log("\n詳細結果：");
  for (const result of report.results) {
    const status = result.passed ? "✅" : "❌";
    console.log(`\n  ${status} ${result.testCaseName}（${result.overallScore.toFixed(2)}/10）`);
    console.log(`     ${result.summary.substring(0, 100)}...`);

    // 顯示各標準分數
    for (const score of result.criteriaScores) {
      const bar = "█".repeat(Math.round(score.score)) + "░".repeat(10 - Math.round(score.score));
      console.log(`     ${score.criteriaName}: ${bar} ${score.score}/10`);
    }
  }

  const totalTokens = report.results.reduce(
    (sum, r) => sum + r.tokensUsed,
    0
  );
  console.log(`\n總計使用 Tokens：${totalTokens}`);
}

// ===== 測試案例定義 =====

const TEST_CASES: TestCase[] = [
  {
    id: "TC001",
    name: "技術問題解答",
    input: "什麼是 RESTful API？請用簡單易懂的方式解釋",
    criteria: [
      {
        name: "準確性",
        description: "回答在技術上是否正確",
        weight: 0.4,
      },
      {
        name: "易讀性",
        description: "解釋是否簡單易懂，適合初學者",
        weight: 0.3,
      },
      {
        name: "完整性",
        description: "是否涵蓋了關鍵概念",
        weight: 0.3,
      },
    ],
  },
  {
    id: "TC002",
    name: "程式碼生成",
    input: "請用 TypeScript 寫一個計算費氏數列的函式（支援遞迴和動態規劃兩種方式）",
    criteria: [
      {
        name: "程式碼正確性",
        description: "程式碼邏輯是否正確，能否正常執行",
        weight: 0.5,
      },
      {
        name: "程式碼品質",
        description: "是否遵循最佳實踐，型別是否正確",
        weight: 0.3,
      },
      {
        name: "說明品質",
        description: "是否有清楚的說明",
        weight: 0.2,
      },
    ],
  },
  {
    id: "TC003",
    name: "創意寫作",
    input: "請寫一首關於人工智慧的現代詩（8行）",
    criteria: [
      {
        name: "創意性",
        description: "是否有獨特的視角和創意",
        weight: 0.4,
      },
      {
        name: "文學性",
        description: "語言是否優美，有詩意",
        weight: 0.4,
      },
      {
        name: "主題契合度",
        description: "是否緊扣人工智慧主題",
        weight: 0.2,
      },
    ],
  },
];

/**
 * 主程式
 */
async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  LLM 評估框架（LLM-as-Judge）");
  console.log("=".repeat(60));

  const report = await runEvalSuite(TEST_CASES);
  displayReport(report);

  console.log("\n\n✅ 評估完成！");
}

main().catch(console.error);
