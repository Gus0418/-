/**
 * AI 輔助網頁資料解析範本
 * 功能：使用 AI 解析網頁內容、提取結構化資料、智慧過濾
 * 使用方式：ts-node web-scraper-ai/index.ts
 * 注意：實際抓取需安裝 node-fetch 或使用 Node.js 內建 fetch
 */

import Anthropic from "@anthropic-ai/sdk";
import * as https from "https";
import * as http from "http";

const client = new Anthropic();

/**
 * 網頁抓取結果介面
 */
interface ScrapedPage {
  url: string;
  title?: string;
  rawContent: string;
  fetchTime: number;        // 抓取耗時（毫秒）
  contentLength: number;
}

/**
 * 結構化提取結果介面
 */
interface ExtractedData {
  url: string;
  extractedAt: string;
  dataType: string;
  data: Record<string, unknown>;
  confidence: string;
}

/**
 * 簡易 HTTP 抓取函式（不使用第三方套件）
 */
function fetchPage(url: string): Promise<ScrapedPage> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const protocol = url.startsWith("https") ? https : http;

    const request = protocol.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AI-Scraper/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    }, (res) => {
      // 處理重定向
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          fetchPage(redirectUrl).then(resolve).catch(reject);
          return;
        }
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        return;
      }

      let rawContent = "";
      res.on("data", (chunk: Buffer) => {
        rawContent += chunk.toString();
      });

      res.on("end", () => {
        const fetchTime = Date.now() - startTime;

        // 嘗試從 HTML 提取標題
        const titleMatch = rawContent.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : undefined;

        resolve({
          url,
          title,
          rawContent,
          fetchTime,
          contentLength: rawContent.length,
        });
      });
    });

    request.on("error", reject);
    request.setTimeout(15000, () => {
      request.destroy(new Error("請求逾時"));
    });
  });
}

/**
 * 清理 HTML 標籤，提取純文字
 */
function cleanHtml(html: string): string {
  return html
    // 移除 script 和 style 區塊
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    // 移除 HTML 標籤
    .replace(/<[^>]+>/g, " ")
    // 解碼常見 HTML 實體
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // 移除多餘空白
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 截取文字（避免超過 Token 限制）
 */
function truncateText(text: string, maxChars: number = 8000): string {
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars) + "\n\n[內容已截斷...]";
}

/**
 * 使用 AI 從網頁內容中提取結構化資料
 * @param page 已抓取的網頁
 * @param extractionGoal 提取目標描述
 * @param outputSchema 輸出格式描述
 */
async function extractWithAI(
  page: ScrapedPage,
  extractionGoal: string,
  outputSchema: string
): Promise<ExtractedData> {
  const cleanedContent = cleanHtml(page.rawContent);
  const truncatedContent = truncateText(cleanedContent);

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    system: `你是一個專業的網頁資料提取助手。
你的任務是從網頁原始內容中提取所需的結構化資訊。

提取原則：
1. 只提取明確存在於內容中的資訊
2. 如果資訊不存在，使用 null
3. 嚴格按照指定的 JSON 格式輸出
4. 不要捏造或推測不存在的資訊`,
    messages: [
      {
        role: "user",
        content: `URL：${page.url}
頁面標題：${page.title || "未知"}

提取目標：${extractionGoal}

輸出格式（JSON Schema）：
${outputSchema}

網頁內容：
${truncatedContent}

請嚴格以 JSON 格式回應，不包含其他文字。`,
      },
    ],
  });

  const responseText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  try {
    const cleanJson = responseText
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return {
        url: page.url,
        extractedAt: new Date().toISOString(),
        dataType: extractionGoal,
        data,
        confidence: "high",
      };
    }
  } catch {
    // 解析失敗
  }

  return {
    url: page.url,
    extractedAt: new Date().toISOString(),
    dataType: extractionGoal,
    data: { raw: responseText },
    confidence: "low",
  };
}

/**
 * AI 驅動的內容分析（不需要抓取外部頁面）
 */
async function analyzeContent(
  content: string,
  analysisType: string
): Promise<string> {
  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: "你是一個網頁內容分析專家，擅長提取和整理網路資訊。請用繁體中文回答。",
    messages: [
      {
        role: "user",
        content: `請對以下內容進行${analysisType}：\n\n${content}`,
      },
    ],
  });

  let result = "";
  stream.on("text", (text) => {
    process.stdout.write(text);
    result += text;
  });

  await stream.finalMessage();
  return result;
}

/**
 * 模擬網頁內容（避免網路請求失敗）
 */
const MOCK_PAGES = {
  news: `
<html>
<head><title>科技新聞 - 最新科技資訊</title></head>
<body>
<article>
  <h1>台積電宣布新世代晶片技術突破</h1>
  <time>2024-03-20</time>
  <p class="author">記者：李小明</p>
  <p>台積電今日宣布成功開發出新世代2奈米製程技術，預計2025年量產。
  此次技術突破將使晶片效能提升30%，耗電量減少20%。</p>
  <p>執行長魏哲家表示，此項技術將在人工智慧晶片市場發揮關鍵作用。</p>
  <p class="tags">標籤：半導體、晶片技術、人工智慧</p>
</article>
<article>
  <h1>Apple 發布新款 MacBook Pro</h1>
  <time>2024-03-19</time>
  <p>Apple 發布搭載 M4 晶片的新款 MacBook Pro，效能大幅提升。</p>
</article>
</body>
</html>`,

  products: `
<html>
<head><title>商品列表 - 電子產品</title></head>
<body>
<div class="product" id="p1">
  <h2>Sony WH-1000XM5 藍牙耳機</h2>
  <span class="price">NT$ 10,900</span>
  <span class="rating">4.8/5 (1,234 評價)</span>
  <p class="desc">業界頂級降噪技術，30小時電池壽命</p>
  <span class="stock">有庫存</span>
</div>
<div class="product" id="p2">
  <h2>Apple AirPods Pro (第2代)</h2>
  <span class="price">NT$ 7,490</span>
  <span class="rating">4.7/5 (2,567 評價)</span>
  <p class="desc">主動降噪，個人化空間音訊</p>
  <span class="stock">有庫存</span>
</div>
<div class="product" id="p3">
  <h2>Jabra Evolve2 85 商務耳機</h2>
  <span class="price">NT$ 12,500</span>
  <span class="rating">4.6/5 (456 評價)</span>
  <p class="desc">專業商務視訊通話，多點連線</p>
  <span class="stock">缺貨中</span>
</div>
</body>
</html>`,
};

/**
 * 主程式
 */
async function main(): Promise<void> {
  console.log("=".repeat(55));
  console.log("  AI 輔助網頁資料解析系統");
  console.log("=".repeat(55));

  // ===== 示範一：從模擬新聞頁面提取文章資訊 =====
  console.log("\n📌 示範一：提取新聞文章資訊\n");

  const newsPage: ScrapedPage = {
    url: "https://example.com/tech-news",
    title: "科技新聞",
    rawContent: MOCK_PAGES.news,
    fetchTime: 0,
    contentLength: MOCK_PAGES.news.length,
  };

  const newsSchema = `{
  "articles": [
    {
      "title": "文章標題",
      "date": "發布日期（YYYY-MM-DD）",
      "author": "作者",
      "summary": "內容摘要（50字以內）",
      "tags": ["標籤1", "標籤2"]
    }
  ],
  "totalArticles": 文章總數
}`;

  const newsData = await extractWithAI(newsPage, "提取所有新聞文章的標題、日期、作者和摘要", newsSchema);
  console.log("提取結果：");
  console.log(JSON.stringify(newsData.data, null, 2));

  // ===== 示範二：從模擬商品頁面提取產品資訊 =====
  console.log("\n\n📌 示範二：提取商品資訊\n");

  const productPage: ScrapedPage = {
    url: "https://example.com/products",
    title: "電子產品",
    rawContent: MOCK_PAGES.products,
    fetchTime: 0,
    contentLength: MOCK_PAGES.products.length,
  };

  const productSchema = `{
  "products": [
    {
      "name": "商品名稱",
      "price": 價格數字,
      "currency": "幣別",
      "rating": 評分數字,
      "reviewCount": 評價數量,
      "description": "商品描述",
      "inStock": 是否有庫存(boolean)
    }
  ],
  "totalProducts": 商品總數,
  "priceRange": {"min": 最低價, "max": 最高價}
}`;

  const productData = await extractWithAI(productPage, "提取所有商品的名稱、價格、評分和庫存狀態", productSchema);
  console.log("提取結果：");
  console.log(JSON.stringify(productData.data, null, 2));

  // ===== 示範三：AI 內容分析 =====
  console.log("\n\n📌 示範三：AI 內容智慧分析\n");

  const analysisContent = `
最新調查顯示，台灣電商市場2023年總交易額達到新台幣8,500億元，
年成長率約12%。其中行動購物占比達到65%，較去年成長5個百分點。
消費者最常購買的類別為：食品（28%）、服裝（22%）、3C電子（18%）、
美妝保養（15%）、家居用品（12%）、其他（5%）。
`;

  console.log("分析結果：");
  await analyzeContent(analysisContent, "市場趨勢分析，提取關鍵數據和洞察");

  // ===== 示範四：嘗試真實網頁抓取（可能因網路問題失敗）=====
  console.log("\n\n📌 示範四：真實網頁抓取（範例）");
  console.log("注意：此功能需要網路連線，以下為錯誤處理示範\n");

  try {
    console.log("嘗試抓取 example.com...");
    const page = await fetchPage("https://example.com");
    console.log(`✅ 成功抓取：${page.title} (${page.fetchTime}ms)`);

    const schema = `{
  "pageTitle": "頁面標題",
  "mainContent": "主要內容摘要",
  "links": ["連結1", "連結2"]
}`;

    const extracted = await extractWithAI(page, "提取頁面基本資訊", schema);
    console.log("提取結果：");
    console.log(JSON.stringify(extracted.data, null, 2));
  } catch (error) {
    console.log(`⚠️  網頁抓取失敗：${error instanceof Error ? error.message : String(error)}`);
    console.log("這在受限環境中是正常的，請在有網路連線的環境中測試");
  }

  console.log("\n\n✅ AI 輔助網頁資料解析示範完成！");
  console.log("\n📝 使用說明：");
  console.log("  1. 使用 fetchPage() 抓取網頁");
  console.log("  2. 使用 extractWithAI() 以 AI 提取結構化資料");
  console.log("  3. 使用 analyzeContent() 進行內容分析");
}

main().catch(console.error);
