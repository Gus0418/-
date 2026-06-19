/**
 * RAG（檢索增強生成）範本
 * 功能：文件分塊、向量搜尋模擬、問答系統
 * 使用方式：ts-node rag/index.ts
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// 模擬知識庫文件
const DOCUMENTS = [
  {
    id: "doc1",
    title: "TypeScript 基礎",
    content: `TypeScript 是 JavaScript 的超集合，加入了靜態型別系統。
    主要特性包括：型別推論、介面、泛型、列舉、裝飾器。
    TypeScript 需要編譯成 JavaScript 才能在瀏覽器或 Node.js 中執行。
    使用 tsc 指令進行編譯，或搭配 ts-node 直接執行。`,
  },
  {
    id: "doc2",
    title: "React Hooks 說明",
    content: `React Hooks 是 React 16.8 引入的新功能，讓函式元件也能使用狀態。
    常用 Hooks：useState 管理狀態、useEffect 處理副作用、useContext 存取 Context。
    自訂 Hook 可以封裝可重用的邏輯，命名必須以 use 開頭。
    Hooks 不能在條件式或迴圈中呼叫，只能在函式元件最頂層呼叫。`,
  },
  {
    id: "doc3",
    title: "Node.js 非同步程式設計",
    content: `Node.js 使用事件迴圈處理非同步操作，避免阻塞 I/O。
    非同步模式演進：Callback → Promise → async/await。
    Promise.all() 可以並行執行多個非同步操作。
    async/await 讓非同步程式碼看起來像同步程式碼，更易讀易維護。
    錯誤處理使用 try/catch 包裹 await 呼叫。`,
  },
  {
    id: "doc4",
    title: "REST API 設計原則",
    content: `REST API 遵循 HTTP 協定語義：GET 查詢、POST 建立、PUT 更新、DELETE 刪除。
    URL 設計應以資源為中心，使用名詞而非動詞，例如 /users 而非 /getUsers。
    狀態碼：200 成功、201 建立成功、400 請求錯誤、401 未授權、404 找不到、500 伺服器錯誤。
    建議使用版本號，例如 /api/v1/users，方便未來維護與升級。`,
  },
  {
    id: "doc5",
    title: "資料庫索引最佳化",
    content: `資料庫索引可以大幅提升查詢效能，但也會增加寫入成本。
    B-Tree 索引適合等值查詢和範圍查詢；Hash 索引只適合等值查詢。
    複合索引的欄位順序很重要，遵循最左前綴原則。
    避免過多索引，每個索引都會佔用額外儲存空間並降低寫入效能。
    定期分析查詢計劃（EXPLAIN）可以找出效能瓶頸。`,
  },
];

// 文件分塊介面定義
interface DocumentChunk {
  id: string;
  docId: string;
  title: string;
  content: string;
  chunkIndex: number;
}

// 搜尋結果介面
interface SearchResult {
  chunk: DocumentChunk;
  score: number;
}

/**
 * 將文件分割成較小的塊（chunking）
 * @param doc 原始文件
 * @param chunkSize 每塊的最大字元數
 */
function chunkDocument(
  doc: (typeof DOCUMENTS)[0],
  chunkSize: number = 200
): DocumentChunk[] {
  const sentences = doc.content.split(/[。！？\n]+/).filter((s) => s.trim());
  const chunks: DocumentChunk[] = [];
  let currentChunk = "";
  let chunkIndex = 0;

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize && currentChunk) {
      chunks.push({
        id: `${doc.id}_chunk${chunkIndex}`,
        docId: doc.id,
        title: doc.title,
        content: currentChunk.trim(),
        chunkIndex,
      });
      chunkIndex++;
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? "。" : "") + sentence;
    }
  }

  if (currentChunk) {
    chunks.push({
      id: `${doc.id}_chunk${chunkIndex}`,
      docId: doc.id,
      title: doc.title,
      content: currentChunk.trim(),
      chunkIndex,
    });
  }

  return chunks;
}

/**
 * 簡易關鍵字相似度搜尋（模擬向量搜尋）
 * 實際應用中應使用嵌入向量（embeddings）計算語意相似度
 * @param query 查詢文字
 * @param chunks 所有文件塊
 * @param topK 返回前 K 個結果
 */
function searchChunks(
  query: string,
  chunks: DocumentChunk[],
  topK: number = 3
): SearchResult[] {
  // 提取查詢關鍵字
  const queryWords = query
    .toLowerCase()
    .split(/[\s，,。！？]+/)
    .filter((w) => w.length > 1);

  // 計算每個塊與查詢的相關分數
  const results: SearchResult[] = chunks.map((chunk) => {
    const chunkText = (chunk.title + " " + chunk.content).toLowerCase();
    let score = 0;

    for (const word of queryWords) {
      // 計算關鍵字出現次數
      const regex = new RegExp(word, "g");
      const matches = chunkText.match(regex);
      if (matches) {
        score += matches.length;
      }
    }

    return { chunk, score };
  });

  // 依分數排序並返回前 K 個
  return results
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * 使用 Claude 根據檢索到的內容回答問題
 * @param query 使用者問題
 * @param context 相關文件內容
 */
async function generateAnswer(query: string, context: string): Promise<string> {
  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    system: `你是一個知識問答助手。請根據提供的參考資料回答使用者的問題。
如果參考資料中沒有相關資訊，請說明你無法從現有資料中找到答案。
回答請使用繁體中文，並引用資料來源。`,
    messages: [
      {
        role: "user",
        content: `參考資料：\n${context}\n\n問題：${query}`,
      },
    ],
  });

  let answer = "";
  stream.on("text", (text) => {
    process.stdout.write(text);
    answer += text;
  });

  await stream.finalMessage();
  return answer;
}

/**
 * 主程式：示範 RAG 完整流程
 */
async function main(): Promise<void> {
  console.log("=== RAG 檢索增強生成系統 ===\n");

  // 步驟一：建立文件庫（分塊處理）
  console.log("📚 正在建立知識庫...");
  const allChunks: DocumentChunk[] = [];
  for (const doc of DOCUMENTS) {
    const chunks = chunkDocument(doc);
    allChunks.push(...chunks);
    console.log(`  ✓ ${doc.title}：分割成 ${chunks.length} 個塊`);
  }
  console.log(`  總計：${allChunks.length} 個文件塊\n`);

  // 步驟二：定義測試問題
  const queries = [
    "TypeScript 如何編譯執行？",
    "React 的 useState 和 useEffect 有什麼用途？",
    "如何設計好的 REST API URL？",
  ];

  // 步驟三：對每個問題執行 RAG 流程
  for (const query of queries) {
    console.log("=".repeat(60));
    console.log(`❓ 問題：${query}\n`);

    // 檢索相關文件塊
    const searchResults = searchChunks(query, allChunks, 2);

    if (searchResults.length === 0) {
      console.log("⚠️  未找到相關資料\n");
      continue;
    }

    // 建立上下文
    console.log("🔍 找到相關資料：");
    const contextParts: string[] = [];
    for (const result of searchResults) {
      console.log(
        `  - [${result.chunk.title}] 相關分數：${result.score} 分`
      );
      contextParts.push(`【${result.chunk.title}】\n${result.chunk.content}`);
    }

    const context = contextParts.join("\n\n");

    // 生成回答
    console.log("\n💡 AI 回答：");
    await generateAnswer(query, context);
    console.log("\n");
  }
}

main().catch(console.error);
