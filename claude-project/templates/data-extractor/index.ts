/**
 * 結構化資料擷取範本
 * 功能：從非結構化文字中擷取 JSON 結構化資料
 * 使用方式：ts-node data-extractor/index.ts
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// ===== 資料 Schema 定義 =====

/**
 * 聯絡人資訊
 */
interface ContactInfo {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  address?: string;
}

/**
 * 發票資訊
 */
interface InvoiceInfo {
  invoiceNumber: string;
  date: string;
  vendor: string;
  customer?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  tax?: number;
  totalAmount: number;
  currency: string;
}

/**
 * 新聞文章資訊
 */
interface NewsArticle {
  title: string;
  publishDate?: string;
  author?: string;
  category?: string;
  summary: string;
  keyPeople?: string[];
  keyOrganizations?: string[];
  sentiment: "positive" | "negative" | "neutral";
  keywords: string[];
}

/**
 * 使用 Claude 從文字中擷取結構化資料
 * @param text 原始文字
 * @param schemaDescription JSON Schema 描述
 * @param schemaExample 範例結構（JSON 字串）
 */
async function extractStructuredData<T>(
  text: string,
  schemaDescription: string,
  schemaExample: string
): Promise<T> {
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    system: `你是一個專業的資料擷取助手，擅長從非結構化文字中提取結構化資訊。

請嚴格按照以下 JSON Schema 格式輸出，不要包含任何額外文字或說明：
${schemaDescription}

Schema 範例：
${schemaExample}

重要原則：
1. 只輸出純 JSON，不包含 markdown 格式或其他文字
2. 如果某個欄位在文字中找不到，使用 null 或省略（非必填欄位）
3. 確保數字類型欄位輸出數字而非字串
4. 日期格式統一使用 YYYY-MM-DD`,
    messages: [
      {
        role: "user",
        content: `請從以下文字中擷取結構化資料：\n\n${text}`,
      },
    ],
  });

  const responseText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  // 嘗試解析 JSON
  try {
    // 移除可能的 markdown 程式碼區塊標記
    const cleanJson = responseText
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
    return JSON.parse(cleanJson) as T;
  } catch {
    // 嘗試提取 JSON 區塊
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    throw new Error(`無法解析 JSON：${responseText}`);
  }
}

/**
 * 擷取聯絡人資訊
 */
async function extractContactInfo(text: string): Promise<ContactInfo> {
  const schema = `{
  "name": "姓名（字串，必填）",
  "email": "電子郵件（字串，可選）",
  "phone": "電話號碼（字串，可選）",
  "company": "公司名稱（字串，可選）",
  "jobTitle": "職稱（字串，可選）",
  "address": "地址（字串，可選）"
}`;

  const example = `{
  "name": "王小明",
  "email": "wang@example.com",
  "phone": "0912-345-678",
  "company": "台灣科技公司",
  "jobTitle": "軟體工程師",
  "address": "台北市信義區"
}`;

  return extractStructuredData<ContactInfo>(text, schema, example);
}

/**
 * 擷取發票資訊
 */
async function extractInvoiceInfo(text: string): Promise<InvoiceInfo> {
  const schema = `{
  "invoiceNumber": "發票號碼（字串，必填）",
  "date": "開立日期（YYYY-MM-DD，必填）",
  "vendor": "賣方名稱（字串，必填）",
  "customer": "買方名稱（字串，可選）",
  "items": [{
    "description": "品項描述",
    "quantity": 數量（數字）,
    "unitPrice": 單價（數字）,
    "total": 小計（數字）
  }],
  "subtotal": 未稅金額（數字，必填）,
  "tax": 稅額（數字，可選）,
  "totalAmount": 總金額（數字，必填）,
  "currency": "幣別（字串，必填）"
}`;

  const example = `{
  "invoiceNumber": "INV-2024-001",
  "date": "2024-01-15",
  "vendor": "科技供應商",
  "customer": "客戶公司",
  "items": [{"description": "筆記型電腦", "quantity": 2, "unitPrice": 30000, "total": 60000}],
  "subtotal": 60000,
  "tax": 3000,
  "totalAmount": 63000,
  "currency": "TWD"
}`;

  return extractStructuredData<InvoiceInfo>(text, schema, example);
}

/**
 * 擷取新聞文章資訊
 */
async function extractNewsInfo(text: string): Promise<NewsArticle> {
  const schema = `{
  "title": "文章標題（字串，必填）",
  "publishDate": "發布日期（YYYY-MM-DD，可選）",
  "author": "作者（字串，可選）",
  "category": "分類（字串，可選）",
  "summary": "內容摘要（100字以內，必填）",
  "keyPeople": ["提到的重要人物"],
  "keyOrganizations": ["提到的重要組織"],
  "sentiment": "情緒分析（positive/negative/neutral，必填）",
  "keywords": ["關鍵字1", "關鍵字2"]
}`;

  const example = `{
  "title": "科技公司發布新產品",
  "publishDate": "2024-01-15",
  "author": "記者王明",
  "category": "科技",
  "summary": "某科技公司發布了革命性的新產品...",
  "keyPeople": ["執行長李大衛"],
  "keyOrganizations": ["某科技公司"],
  "sentiment": "positive",
  "keywords": ["科技", "創新", "產品發布"]
}`;

  return extractStructuredData<NewsArticle>(text, schema, example);
}

/**
 * 主程式
 */
async function main(): Promise<void> {
  console.log("=".repeat(55));
  console.log("  結構化資料擷取系統");
  console.log("=".repeat(55));

  // ===== 示範一：擷取聯絡人資訊 =====
  console.log("\n📌 示範一：從名片文字擷取聯絡人資訊\n");

  const businessCardText = `
陳大偉
資深全端工程師
電話：0923-456-789
Email：david.chen@techstartup.com.tw
公司：未來科技股份有限公司
地址：台北市內湖區瑞光路 100 號 8 樓
`;

  console.log("原始文字：");
  console.log(businessCardText);
  console.log("擷取結果：");

  const contactInfo = await extractContactInfo(businessCardText);
  console.log(JSON.stringify(contactInfo, null, 2));

  // ===== 示範二：擷取發票資訊 =====
  console.log("\n\n📌 示範二：從發票文字擷取結構化資料\n");

  const invoiceText = `
發票號碼：INV-2024-00789
開立日期：民國113年3月15日

賣方：台北電腦批發商
買方：小型企業有限公司

品項明細：
1. 桌上型電腦 x 3 台，單價 NT$25,000，小計 NT$75,000
2. 24吋螢幕 x 3 台，單價 NT$8,000，小計 NT$24,000
3. 無線鍵盤滑鼠組 x 3 套，單價 NT$1,500，小計 NT$4,500

未稅金額：NT$103,500
稅額（5%）：NT$5,175
總計：NT$108,675（新台幣）
`;

  console.log("原始文字：");
  console.log(invoiceText);
  console.log("擷取結果：");

  const invoiceInfo = await extractInvoiceInfo(invoiceText);
  console.log(JSON.stringify(invoiceInfo, null, 2));

  // ===== 示範三：擷取新聞文章資訊 =====
  console.log("\n\n📌 示範三：從新聞文章擷取關鍵資訊\n");

  const newsText = `
台積電宣布與蘋果公司擴大合作，將在台南科學園區新建先進晶片廠

2024年3月20日，台灣積體電路製造股份有限公司（台積電）董事長魏哲家今日宣布，
將與科技巨頭蘋果公司（Apple Inc.）進一步深化合作關係。此次合作將在台南科學園區
新建一座採用3奈米製程技術的先進晶片製造廠，預計投資金額達1,200億新台幣。

台積電執行長魏哲家表示，這次合作將創造逾5,000個高薪就業機會，預計2026年正式量產。
蘋果公司供應鏈副總裁張俊傑也出席記者會，對此次合作表示高度期待。

此消息一出，台積電股價當日上漲3.2%，市場反應正面。分析師普遍認為此舉將進一步
鞏固台灣在全球半導體產業中的核心地位。
`;

  console.log("原始文字：");
  console.log(newsText);
  console.log("擷取結果：");

  const newsInfo = await extractNewsInfo(newsText);
  console.log(JSON.stringify(newsInfo, null, 2));

  console.log("\n\n✅ 資料擷取示範完成！");
}

main().catch(console.error);
