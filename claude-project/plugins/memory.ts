/** 持久化記憶插件 — 讓 AI 記住跨會話資訊 */
import * as fs from "fs";

const MEMORY_FILE = "./.memory.json";

interface Memory {
  facts: string[];
  preferences: Record<string, string>;
  history: { ts: number; summary: string }[];
}

function load(): Memory {
  if (!fs.existsSync(MEMORY_FILE)) return { facts: [], preferences: {}, history: [] };
  return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
}

function save(mem: Memory) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(mem, null, 2));
}

export const memory = {
  remember(fact: string) {
    const m = load();
    if (!m.facts.includes(fact)) { m.facts.push(fact); save(m); }
  },
  forget(fact: string) {
    const m = load();
    m.facts = m.facts.filter(f => f !== fact);
    save(m);
  },
  setPreference(key: string, value: string) {
    const m = load();
    m.preferences[key] = value;
    save(m);
  },
  getPreference(key: string) {
    return load().preferences[key];
  },
  addHistory(summary: string) {
    const m = load();
    m.history.push({ ts: Date.now(), summary });
    if (m.history.length > 100) m.history = m.history.slice(-100);
    save(m);
  },
  buildSystemPrompt(): string {
    const m = load();
    const parts: string[] = [];
    if (m.facts.length) parts.push(`已知事實：\n${m.facts.map(f => `- ${f}`).join("\n")}`);
    if (Object.keys(m.preferences).length) {
      parts.push(`使用者偏好：\n${Object.entries(m.preferences).map(([k, v]) => `- ${k}: ${v}`).join("\n")}`);
    }
    if (m.history.length) {
      parts.push(`最近對話：\n${m.history.slice(-5).map(h => `- ${h.summary}`).join("\n")}`);
    }
    return parts.join("\n\n");
  },
  clear() { save({ facts: [], preferences: {}, history: [] }); },
  dump() { return load(); },
};
