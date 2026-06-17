/**
 * 自我改善引擎
 * 讀取已生成的程式碼 → 找出問題 → 自動修復 → 迭代至無法改善
 */
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

const client = new Anthropic();

interface Issue {
  file: string;
  type: "bug" | "performance" | "security" | "style" | "missing-feature";
  description: string;
  fix: string;
}

interface ImproveState {
  round: number;
  totalFixes: number;
  filesImproved: Set<string>;
}

const state: ImproveState = { round: 0, totalFixes: 0, filesImproved: new Set() };

function readAllTs(dir: string): { path: string; content: string }[] {
  if (!fs.existsSync(dir)) return [];
  const results: { path: string; content: string }[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...readAllTs(full));
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".mjs")) {
      results.push({ path: full, content: fs.readFileSync(full, "utf-8") });
    }
  }
  return results;
}

async function analyzeCode(files: { path: string; content: string }[]): Promise<Issue[]> {
  if (!files.length) return [];
  const summary = files.map(f =>
    `=== ${f.path} ===\n${f.content.slice(0, 800)}\n`
  ).join("\n");

  const msg = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 3000,
    system: `你是資深程式碼審查員。分析程式碼並找出可改善之處。
輸出 JSON 陣列，每項包含：
- file: 檔案路徑
- type: "bug"|"performance"|"security"|"style"|"missing-feature"
- description: 問題描述
- fix: 建議修復方式
最多回報 8 個問題。若程式碼已最佳化，回傳 []。`,
    messages: [{
      role: "user",
      content: `分析以下程式碼：\n\n${summary}\n\n問題清單（JSON）：`,
    }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "[]";
  const match = text.match(/\[[\s\S]*\]/);
  try { return JSON.parse(match?.[0] ?? "[]"); } catch { return []; }
}

async function applyFix(issue: Issue): Promise<string> {
  let original = "";
  try { original = fs.readFileSync(issue.file, "utf-8"); } catch { return ""; }

  const msg = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    system: "你是程式碼修復引擎。輸出修復後的完整程式碼，不要任何說明或 markdown。",
    messages: [{
      role: "user",
      content: `問題：${issue.description}\n修復方式：${issue.fix}\n\n原始程式碼：\n${original}\n\n修復後的完整程式碼：`,
    }],
  });

  return msg.content[0].type === "text" ? msg.content[0].text : original;
}

async function selfImprove() {
  console.log("🔧 自我改善引擎啟動");
  const MAX_ROUNDS = 5;
  const targetDir = "./claude-project";

  while (state.round < MAX_ROUNDS) {
    state.round++;
    console.log(`\n${"─".repeat(50)}`);
    console.log(`🔄 改善輪次 ${state.round}/${MAX_ROUNDS}`);

    const files = readAllTs(targetDir);
    console.log(`📂 掃描 ${files.length} 個檔案`);

    const issues = await analyzeCode(files);
    if (!issues.length) {
      console.log("✨ 程式碼已達最佳狀態，無更多改善空間");
      break;
    }

    console.log(`🔍 發現 ${issues.length} 個問題：`);
    issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. [${issue.type}] ${path.basename(issue.file)}: ${issue.description}`);
    });

    for (const issue of issues) {
      console.log(`\n🔨 修復: ${issue.description}`);
      const fixed = await applyFix(issue);
      if (fixed && fixed.length > 50) {
        fs.writeFileSync(issue.file, fixed, "utf-8");
        state.totalFixes++;
        state.filesImproved.add(issue.file);
        console.log(`  ✅ 已修復 ${path.basename(issue.file)}`);
      }
    }
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log("🎉 自我改善完成");
  console.log(`📊 總修復次數: ${state.totalFixes}`);
  console.log(`📁 改善檔案數: ${state.filesImproved.size}`);
}

selfImprove().catch(console.error);
