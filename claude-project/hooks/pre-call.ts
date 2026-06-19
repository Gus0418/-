/** Pre-call hooks — 呼叫 AI 前自動執行 */
import type { CallOptions } from "../types/index.js";

type Hook = (prompt: string, options: CallOptions) => Promise<{ prompt: string; options: CallOptions }>;

const hooks: Hook[] = [];

export function registerPreCallHook(hook: Hook) { hooks.push(hook); }

export async function runPreCallHooks(prompt: string, options: CallOptions) {
  let p = prompt;
  let o = options;
  for (const hook of hooks) {
    const result = await hook(p, o);
    p = result.prompt;
    o = result.options;
  }
  return { prompt: p, options: o };
}

// 內建 hooks
registerPreCallHook(async (prompt, options) => {
  // 自動加系統提示（繁體中文）
  if (!options.system) options = { ...options, system: "請用繁體中文回答。" };
  return { prompt, options };
});

registerPreCallHook(async (prompt, options) => {
  // 自動偵測任務類型
  if (!options.taskType) {
    if (prompt.length < 50) options = { ...options, taskType: "quick" };
    else if (/程式|code|bug|函式/.test(prompt)) options = { ...options, taskType: "code" };
    else if (/分析|比較|評估/.test(prompt)) options = { ...options, taskType: "analysis" };
  }
  return { prompt, options };
});
