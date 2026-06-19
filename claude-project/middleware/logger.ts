/** 全域 AI 呼叫日誌中介層 */
import * as fs from "fs";

const LOG = "./ai-calls.log";

export function withLogging<T extends (...args: any[]) => Promise<any>>(fn: T, label: string): T {
  return (async (...args: any[]) => {
    const start = Date.now();
    const entry: Record<string, unknown> = { ts: new Date().toISOString(), fn: label, args: args[0]?.slice?.(0, 100) };
    try {
      const result = await fn(...args);
      entry.ms = Date.now() - start;
      entry.ok = true;
      fs.appendFileSync(LOG, JSON.stringify(entry) + "\n");
      return result;
    } catch (e: any) {
      entry.ms = Date.now() - start;
      entry.ok = false;
      entry.error = e.message;
      fs.appendFileSync(LOG, JSON.stringify(entry) + "\n");
      throw e;
    }
  }) as T;
}

export function readLogs(limit = 100) {
  if (!fs.existsSync(LOG)) return [];
  return fs.readFileSync(LOG, "utf-8").trim().split("\n").slice(-limit).map(l => JSON.parse(l));
}

export function logStats() {
  const logs = readLogs(1000);
  const ok = logs.filter(l => l.ok).length;
  const avgMs = logs.filter(l => l.ok).reduce((s, l) => s + (l.ms ?? 0), 0) / Math.max(ok, 1);
  return { total: logs.length, success: ok, failed: logs.length - ok, avgLatencyMs: avgMs.toFixed(0) };
}
