/**
 * 全自動程式碼生成引擎
 * 持續規劃 → 生成 → 驗證 → 迭代，直到無法再擴充
 */
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

const client = new Anthropic();
const OUTPUT_DIR = "./generated";
const LOG_FILE = "./auto-coder.log";

// ── 狀態追蹤 ────────────────────────────────────────────────────────
interface CodeFile { path: string; content: string; description: string; }
interface BuildState {
  iteration: number;
  filesGenerated: string[];
  totalTokens: number;
  plan: string[];
  completed: string[];
  nextTasks: string[];
}

const state: BuildState = {
  iteration: 0,
  filesGenerated: [],
  totalTokens: 0,
  plan: [],
  completed: [],
  nextTasks: [],
};

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\n");
}

function saveFile(file: CodeFile) {
  const fullPath = path.join(OUTPUT_DIR, file.path);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, file.content, "utf-8");
  state.filesGenerated.push(file.path);
  log(`✅ 生成: ${file.path} (${file.content.length} 字元)`);
}

// ── 步驟 1：規劃 ────────────────────────────────────────────────────
async function planNextFeatures(existing: string[]): Promise<string[]> {
  const msg = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: `你是一個全自動軟體架構師。
根據已完成的模組，規劃下一批要實作的功能。
輸出 JSON 陣列，每項為一個任務描述字串。
最多規劃 5 個新任務。若所有核心功能都已完成，回傳空陣列 []。`,
    messages: [{
      role: "user",
      content: `已完成模組:\n${existing.length ? existing.join("\n") : "（尚未開始）"}\n\n專案目標：建構完整的 Claude AI 開發框架，含 API 封裝、工具系統、記憶體、串流、多模態、MCP 整合、測試、文件等。\n\n請規劃下一批任務（JSON 陣列）：`,
    }],
  });
  state.totalTokens += msg.usage.input_tokens + msg.usage.output_tokens;
  const text = msg.content[0].type === "text" ? msg.content[0].text : "[]";
  const match = text.match(/\[[\s\S]*\]/);
  try { return JSON.parse(match?.[0] ?? "[]"); } catch { return []; }
}

// ── 步驟 2：生成程式碼 ───────────────────────────────────────────────
async function generateCode(task: string, context: string[]): Promise<CodeFile[]> {
  const msg = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    system: `你是一個全自動程式碼生成引擎。
根據任務描述，生成完整、可執行的 TypeScript 程式碼。
輸出格式為 JSON 陣列，每個元素包含：
- path: 檔案路徑（相對於專案根目錄）
- content: 完整程式碼內容
- description: 一句話說明

只輸出 JSON，不要其他文字。`,
    messages: [{
      role: "user",
      content: `任務：${task}\n\n已有模組：${context.slice(-10).join(", ")}\n\n生成程式碼（JSON 陣列）：`,
    }],
  });
  state.totalTokens += msg.usage.input_tokens + msg.usage.output_tokens;
  const text = msg.content[0].type === "text" ? msg.content[0].text : "[]";
  const match = text.match(/\[[\s\S]*\]/);
  try { return JSON.parse(match?.[0] ?? "[]"); } catch { return []; }
}

// ── 步驟 3：生成測試 ─────────────────────────────────────────────────
async function generateTests(files: CodeFile[]): Promise<CodeFile[]> {
  if (!files.length) return [];
  const summary = files.map(f => `${f.path}: ${f.description}`).join("\n");
  const msg = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: `你是一個測試工程師。為提供的模組生成 Vitest 單元測試。
輸出格式同上：JSON 陣列，path/content/description。`,
    messages: [{
      role: "user",
      content: `為以下模組生成測試：\n${summary}\n\n生成測試程式碼（JSON）：`,
    }],
  });
  state.totalTokens += msg.usage.input_tokens + msg.usage.output_tokens;
  const text = msg.content[0].type === "text" ? msg.content[0].text : "[]";
  const match = text.match(/\[[\s\S]*\]/);
  try { return JSON.parse(match?.[0] ?? "[]"); } catch { return []; }
}

// ── 步驟 4：生成文件 ─────────────────────────────────────────────────
async function generateDocs(allFiles: string[]): Promise<CodeFile> {
  const msg = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 3000,
    system: "你是技術文件撰寫者。生成繁體中文的完整 API 文件（Markdown 格式）。",
    messages: [{
      role: "user",
      content: `為以下模組生成 API 文件：\n${allFiles.join("\n")}\n\n輸出 Markdown：`,
    }],
  });
  state.totalTokens += msg.usage.input_tokens + msg.usage.output_tokens;
  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  return { path: "docs/API.md", content: text, description: "完整 API 文件" };
}

// ── 主循環 ───────────────────────────────────────────────────────────
async function autoCode() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  log("🚀 全自動程式碼生成引擎啟動");

  const MAX_ITERATIONS = 8;

  while (state.iteration < MAX_ITERATIONS) {
    state.iteration++;
    log(`\n${"═".repeat(60)}`);
    log(`🔄 迭代 ${state.iteration}/${MAX_ITERATIONS}`);

    // 規劃
    log("📋 規劃下一批功能...");
    const tasks = await planNextFeatures(state.completed);
    if (!tasks.length) {
      log("✨ 所有功能已完成，無更多任務");
      break;
    }
    state.nextTasks = tasks;
    log(`📌 本輪任務：\n  ${tasks.join("\n  ")}`);

    // 每個任務生成程式碼
    for (const task of tasks) {
      log(`\n⚙️  處理：${task}`);
      const files = await generateCode(task, state.filesGenerated);
      files.forEach(saveFile);

      // 生成對應測試
      const tests = await generateTests(files);
      tests.forEach(saveFile);

      state.completed.push(task);
    }

    log(`\n📊 累計生成 ${state.filesGenerated.length} 個檔案，${state.totalTokens} tokens`);
  }

  // 最終：生成完整文件
  log("\n📚 生成完整 API 文件...");
  const docs = await generateDocs(state.filesGenerated);
  saveFile(docs);

  // 生成索引
  const index = generateIndex();
  saveFile(index);

  log(`\n${"═".repeat(60)}`);
  log("🎉 自動程式碼生成完成！");
  log(`📁 輸出目錄: ${OUTPUT_DIR}/`);
  log(`📄 共生成: ${state.filesGenerated.length} 個檔案`);
  log(`🔢 消耗 tokens: ${state.totalTokens}`);
  log(`📋 完成任務: ${state.completed.length} 個`);
}

function generateIndex(): CodeFile {
  const tree = state.filesGenerated.map(f => `- ${f}`).join("\n");
  const content = `# 自動生成程式碼索引

> 由 auto-coder.ts 全自動生成 @ ${new Date().toISOString()}

## 生成統計
- 檔案數量：${state.filesGenerated.length}
- 完成任務：${state.completed.length}
- 消耗 Tokens：${state.totalTokens}

## 檔案清單
${tree}

## 已完成任務
${state.completed.map((t, i) => `${i + 1}. ${t}`).join("\n")}
`;
  return { path: "INDEX.md", content, description: "自動生成索引" };
}

autoCode().catch(console.error);
