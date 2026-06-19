/** 輕量向量儲存插件 (無需外部資料庫) */
import * as fs from "fs";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const STORE_FILE = "./.vector-store.json";

interface VectorEntry { id: string; text: string; embedding: number[]; meta?: Record<string, string>; }

function load(): VectorEntry[] {
  if (!fs.existsSync(STORE_FILE)) return [];
  return JSON.parse(fs.readFileSync(STORE_FILE, "utf-8"));
}
function save(entries: VectorEntry[]) {
  fs.writeFileSync(STORE_FILE, JSON.stringify(entries));
}

// 餘弦相似度
function cosineSim(a: number[], b: number[]): number {
  const dot = a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
  const normA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const normB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return dot / (normA * normB + 1e-10);
}

// 用 Claude 生成假向量（實際上用 TF-IDF 近似）
function textToVector(text: string, dim = 128): number[] {
  const vec = new Array(dim).fill(0);
  const words = text.toLowerCase().split(/\W+/);
  for (const word of words) {
    let hash = 5381;
    for (const c of word) hash = ((hash << 5) + hash) + c.charCodeAt(0);
    vec[Math.abs(hash) % dim] += 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / norm);
}

export const vectorStore = {
  add(id: string, text: string, meta?: Record<string, string>) {
    const entries = load();
    const existing = entries.findIndex(e => e.id === id);
    const entry = { id, text, embedding: textToVector(text), meta };
    if (existing >= 0) entries[existing] = entry;
    else entries.push(entry);
    save(entries);
  },

  search(query: string, topK = 5): (VectorEntry & { score: number })[] {
    const qVec = textToVector(query);
    return load()
      .map(e => ({ ...e, score: cosineSim(qVec, e.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  },

  delete(id: string) {
    save(load().filter(e => e.id !== id));
  },

  count() { return load().length; },

  async ragQuery(question: string, topK = 3): Promise<string> {
    const relevant = this.search(question, topK);
    if (!relevant.length) return "找不到相關資料";
    const context = relevant.map(r => `[${r.id}] ${r.text}`).join("\n\n");
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: "根據提供的文件回答問題。只用文件中的資訊，找不到就說不知道。",
      messages: [{ role: "user", content: `文件：\n${context}\n\n問題：${question}` }],
    });
    return msg.content[0].type === "text" ? msg.content[0].text : "";
  },
};
