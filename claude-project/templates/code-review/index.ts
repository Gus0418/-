/**
 * 自動程式碼審查機器人範本
 * 功能：程式碼品質分析、安全性檢查、效能建議、自動評分
 * 使用方式：ts-node code-review/index.ts
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

/**
 * 程式碼審查結果介面
 */
interface CodeReviewResult {
  overallScore: number;       // 整體評分 (1-10)
  summary: string;            // 總結
  issues: ReviewIssue[];      // 問題列表
  suggestions: string[];      // 改進建議
  securityConcerns: string[]; // 安全疑慮
  performanceTips: string[];  // 效能提示
}

/**
 * 審查問題介面
 */
interface ReviewIssue {
  severity: "critical" | "major" | "minor" | "info";
  line?: number;
  description: string;
  suggestion: string;
}

/**
 * 待審查的程式碼範例
 */
const CODE_SAMPLES = {
  // 有問題的 JavaScript 程式碼
  problematicJS: `
// 使用者登入函式
function login(username, password) {
  // 直接在 SQL 查詢中拼接字串（SQL 注入漏洞）
  const query = "SELECT * FROM users WHERE username='" + username + "' AND password='" + password + "'";

  // 使用 eval 執行用戶輸入（XSS 漏洞）
  eval(username);

  // 密碼未加密存儲
  localStorage.setItem('password', password);

  // 錯誤的比較運算子
  if (result == null) {
    return false;
  }

  // 未處理的 Promise
  fetch('/api/log').then(r => r.json());

  // 效能問題：在迴圈中查詢 DOM
  for (var i = 0; i < 1000; i++) {
    document.getElementById('list').innerHTML += '<li>' + i + '</li>';
  }

  return true;
}`,

  // 較好的 TypeScript 程式碼
  goodTypeScript: `
import bcrypt from 'bcrypt';
import { db } from './database';

interface LoginResult {
  success: boolean;
  userId?: number;
  token?: string;
}

async function login(username: string, password: string): Promise<LoginResult> {
  // 輸入驗證
  if (!username || !password) {
    return { success: false };
  }

  try {
    // 使用參數化查詢防止 SQL 注入
    const user = await db.query(
      'SELECT id, password_hash FROM users WHERE username = $1',
      [username]
    );

    if (!user) {
      return { success: false };
    }

    // 安全的密碼比對
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return { success: false };
    }

    // 生成安全的 JWT token
    const token = generateSecureToken(user.id);

    return { success: true, userId: user.id, token };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false };
  }
}`,

  // Python 程式碼
  pythonCode: `
def process_data(data):
    result = []
    for i in range(len(data)):
        if data[i] != None:
            result.append(data[i] * 2)

    # 可能的效能問題
    big_string = ""
    for item in result:
        big_string = big_string + str(item)

    return big_string`,
};

/**
 * 執行程式碼審查
 * @param code 要審查的程式碼
 * @param language 程式語言
 * @param context 額外上下文
 */
async function reviewCode(
  code: string,
  language: string,
  context?: string
): Promise<CodeReviewResult> {
  const systemPrompt = `你是一個專業的程式碼審查工程師，擅長發現安全漏洞、效能問題和程式碼品質問題。

請對提供的程式碼進行全面審查，並以 JSON 格式輸出審查結果。
JSON 格式如下：
{
  "overallScore": 評分(1-10),
  "summary": "整體評估摘要",
  "issues": [
    {
      "severity": "critical|major|minor|info",
      "line": 行號(選填),
      "description": "問題描述",
      "suggestion": "修正建議"
    }
  ],
  "suggestions": ["整體改進建議1", "整體改進建議2"],
  "securityConcerns": ["安全疑慮1", "安全疑慮2"],
  "performanceTips": ["效能提示1", "效能提示2"]
}

嚴重程度說明：
- critical：嚴重安全漏洞或功能性錯誤，必須立即修正
- major：重要問題，影響程式品質或安全性
- minor：次要問題，建議改進但非必要
- info：資訊性建議，最佳實踐提示`;

  const userMessage = `請審查以下 ${language} 程式碼：
${context ? `背景說明：${context}\n` : ""}
\`\`\`${language}
${code}
\`\`\`

請嚴格以 JSON 格式回應，不要包含其他文字。`;

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    thinking: { type: "adaptive" }, // 使用思考模式進行深度分析
  });

  // 提取 JSON 回應
  const textContent = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  try {
    // 嘗試解析 JSON
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as CodeReviewResult;
    }
  } catch {
    // 如果解析失敗，返回預設格式
  }

  return {
    overallScore: 0,
    summary: textContent,
    issues: [],
    suggestions: [],
    securityConcerns: [],
    performanceTips: [],
  };
}

/**
 * 格式化輸出審查結果
 */
function displayReviewResult(
  result: CodeReviewResult,
  codeTitle: string
): void {
  const scoreEmoji =
    result.overallScore >= 8
      ? "🟢"
      : result.overallScore >= 6
      ? "🟡"
      : result.overallScore >= 4
      ? "🟠"
      : "🔴";

  console.log(`\n${"=".repeat(60)}`);
  console.log(`📋 程式碼審查報告：${codeTitle}`);
  console.log("=".repeat(60));
  console.log(`\n${scoreEmoji} 整體評分：${result.overallScore}/10`);
  console.log(`\n📝 總結：${result.summary}`);

  // 顯示問題
  if (result.issues.length > 0) {
    console.log("\n❗ 發現的問題：");
    for (const issue of result.issues) {
      const severityEmoji = {
        critical: "🔴",
        major: "🟠",
        minor: "🟡",
        info: "🔵",
      }[issue.severity];

      const lineInfo = issue.line ? `（第 ${issue.line} 行）` : "";
      console.log(`  ${severityEmoji} [${issue.severity.toUpperCase()}]${lineInfo} ${issue.description}`);
      console.log(`     💡 建議：${issue.suggestion}`);
    }
  }

  // 顯示安全疑慮
  if (result.securityConcerns.length > 0) {
    console.log("\n🔒 安全疑慮：");
    result.securityConcerns.forEach((concern) =>
      console.log(`  • ${concern}`)
    );
  }

  // 顯示效能提示
  if (result.performanceTips.length > 0) {
    console.log("\n⚡ 效能提示：");
    result.performanceTips.forEach((tip) => console.log(`  • ${tip}`));
  }

  // 顯示改進建議
  if (result.suggestions.length > 0) {
    console.log("\n✨ 整體改進建議：");
    result.suggestions.forEach((suggestion) =>
      console.log(`  • ${suggestion}`)
    );
  }
}

/**
 * 主程式
 */
async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  自動程式碼審查機器人");
  console.log("=".repeat(60));
  console.log("🔍 開始審查程式碼...\n");

  // 審查有問題的 JavaScript
  console.log("正在審查：有安全問題的 JavaScript 程式碼...");
  const jsResult = await reviewCode(
    CODE_SAMPLES.problematicJS,
    "javascript",
    "這是一個使用者登入函式"
  );
  displayReviewResult(jsResult, "有安全問題的 JavaScript");

  // 審查好的 TypeScript
  console.log("\n正在審查：良好的 TypeScript 程式碼...");
  const tsResult = await reviewCode(
    CODE_SAMPLES.goodTypeScript,
    "typescript",
    "這是改進後的使用者登入函式"
  );
  displayReviewResult(tsResult, "改進後的 TypeScript");

  // 審查 Python 程式碼
  console.log("\n正在審查：Python 資料處理程式碼...");
  const pyResult = await reviewCode(
    CODE_SAMPLES.pythonCode,
    "python",
    "資料處理工具函式"
  );
  displayReviewResult(pyResult, "Python 資料處理");

  console.log("\n\n✅ 所有程式碼審查完成！");
}

main().catch(console.error);
