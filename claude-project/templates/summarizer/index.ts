/**
 * 長文摘要系統範本
 * 功能：自動分塊、遞迴摘要、多種摘要格式
 * 使用方式：ts-node summarizer/index.ts
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

/**
 * 摘要選項介面
 */
interface SummaryOptions {
  maxChunkSize: number;   // 每塊最大字元數（約 tokens * 2）
  style: "bullet" | "paragraph" | "executive";  // 摘要風格
  language: string;       // 輸出語言
  maxLength: number;      // 最終摘要最大長度
}

/**
 * 預設摘要選項
 */
const DEFAULT_OPTIONS: SummaryOptions = {
  maxChunkSize: 3000,
  style: "paragraph",
  language: "繁體中文",
  maxLength: 500,
};

/**
 * 示範用長文（模擬一篇技術文章）
 */
const LONG_ARTICLE = `
人工智慧的發展歷程與未來展望

第一章：人工智慧的起源

人工智慧（Artificial Intelligence, AI）的概念最早可以追溯到1950年代。圖靈（Alan Turing）在1950年發表的論文《計算機器與智慧》中提出了著名的圖靈測試，為人工智慧的發展奠定了理論基礎。圖靈的核心問題是：「機器能思考嗎？」這個問題至今仍然引發廣泛討論。

1956年，達特茅斯會議（Dartmouth Conference）正式確立了「人工智慧」這個術語，標誌著這個領域的正式誕生。麥卡錫（John McCarthy）、明斯基（Marvin Minsky）等先驅者在此次會議上提出了一個雄心勃勃的願景：創造出能夠模擬人類智慧的機器。

早期的AI研究主要集中在符號推理和問題求解上。研究者們開發了一系列程式，能夠解決數學問題、下棋和理解自然語言。這些早期成就讓人們對AI的未來充滿期待，但同時也帶來了過於樂觀的預測。

第二章：冬天與復甦

AI領域在其發展過程中經歷了幾次「寒冬」。1970年代，由於早期AI研究未能實現預期目標，研究經費大幅削減，這段時期被稱為「AI寒冬」。許多研究者轉向其他領域，AI的發展陷入停滯。

1980年代，專家系統（Expert Systems）的興起帶來了AI的短暫復甦。這些系統能夠模擬特定領域專家的決策過程，在醫療診斷、金融分析等領域取得了一定成功。然而，專家系統的限制性和高維護成本最終導致了第二次AI寒冬。

第三章：機器學習的革命

進入21世紀，機器學習技術的突破徹底改變了AI的發展軌跡。2006年，辛頓（Geoffrey Hinton）等研究者提出了深度學習（Deep Learning）的概念，利用多層神經網路從大量資料中自動學習特徵表示。

2012年，深度神經網路在ImageNet圖像識別競賽中大幅超越傳統方法，引發了業界的廣泛關注。此後，深度學習在圖像識別、語音辨識、自然語言處理等領域取得了一系列突破性成果。

2016年，谷歌DeepMind開發的AlphaGo以4比1的成績擊敗世界圍棋冠軍李世石，震驚全球。這個里程碑事件標誌著AI在複雜策略性任務上的能力已達到甚至超越人類水準。

第四章：大型語言模型的崛起

2017年，Transformer架構的提出開創了自然語言處理的新紀元。基於這個架構，研究者們開發了一系列大型預訓練語言模型，包括BERT、GPT系列等。

2022年底，OpenAI發布的ChatGPT以其強大的對話能力和廣泛的知識面迅速走紅，短短兩個月內用戶突破一億，成為史上增長最快的消費者應用程式。

Claude、Gemini等競爭者的出現加速了這個領域的發展，各大科技公司紛紛投入鉅資開發自己的大型語言模型。這些模型不僅能進行流暢的自然語言對話，還能撰寫程式碼、創作文章、解答複雜問題。

第五章：AI的倫理與挑戰

隨著AI技術的快速發展，一系列倫理和社會問題也浮出水面。首先是就業市場的衝擊：自動化技術可能取代大量重複性工作，引發社會對失業率上升的擔憂。研究顯示，未來十年可能有數億個工作崗位面臨被AI取代的風險。

其次是偏見與公平性問題。AI系統的訓練資料往往反映了社會中既有的偏見，可能導致對特定群體的歧視。如何確保AI的公平性和無偏見性，是研究者們面臨的重大挑戰。

資料隱私和安全也是重要議題。AI系統需要大量個人資料進行訓練，如何在發揮AI潛力的同時保護用戶隱私，需要技術和法規層面的共同努力。

深偽技術（Deepfake）等AI應用可能被用於製造虛假資訊，威脅信息安全和社會穩定。各國政府和技術公司正在探索識別和應對這些威脅的方法。

第六章：未來展望

展望未來，AI技術將繼續以驚人的速度發展。通用人工智慧（AGI）—能夠執行任何人類智力任務的AI—雖然目前仍是遙遠的目標，但越來越多的研究者認為其實現並非遙不可及。

量子計算與AI的結合可能帶來革命性的突破。量子電腦能夠以指數級速度解決某些類型的問題，與AI演算法的結合可能開創全新的可能性。

AI在科學研究領域的應用前景尤為廣闊。AlphaFold在蛋白質結構預測上的突破已經展示了AI加速科學發現的潛力。未來，AI可能在醫藥研發、材料科學、氣候變化等領域帶來革命性的進展。

教育領域也將因AI而深刻變革。個性化學習系統能夠根據每個學生的學習方式和進度提供客製化的教育體驗，有望顯著提升教育效果。

結語

人工智慧的發展是人類歷史上最深刻的技術變革之一。它既帶來了前所未有的機遇，也帶來了需要認真對待的挑戰。在享受AI帶來的便利和效率的同時，我們需要積極思考如何確保這一技術的發展符合人類的整體利益，建立一個AI與人類和諧共存的未來。
`;

/**
 * 將長文分割成塊
 */
function splitIntoChunks(text: string, maxChunkSize: number): string[] {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if (
      currentChunk.length + paragraph.length > maxChunkSize &&
      currentChunk
    ) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * 對單一塊進行摘要
 */
async function summarizeChunk(
  chunk: string,
  chunkIndex: number,
  totalChunks: number,
  options: SummaryOptions
): Promise<string> {
  const styleGuide = {
    bullet: "請使用條列式（bullet points）呈現重點",
    paragraph: "請以流暢的段落文字呈現",
    executive: "請以執行摘要格式，聚焦在關鍵決策點和影響",
  }[options.style];

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system: `你是一個專業的文字摘要助手。
請提取並摘要提供文字的核心內容，保留最重要的資訊。
${styleGuide}。
請用${options.language}輸出。`,
    messages: [
      {
        role: "user",
        content: `這是一篇長文的第 ${chunkIndex + 1}/${totalChunks} 部分，請進行摘要：\n\n${chunk}`,
      },
    ],
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

/**
 * 將多個區塊摘要合併成最終摘要
 */
async function mergeSummaries(
  summaries: string[],
  originalTitle: string,
  options: SummaryOptions
): Promise<string> {
  const combinedSummaries = summaries
    .map((s, i) => `[部分 ${i + 1}]\n${s}`)
    .join("\n\n");

  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: `你是一個專業的文字摘要助手，請將多個部分的摘要整合成一個完整、連貫的最終摘要。
最終摘要應不超過 ${options.maxLength} 個字。
請用${options.language}輸出。`,
    messages: [
      {
        role: "user",
        content: `原文標題：${originalTitle}\n\n以下是分段摘要，請合併成一個完整摘要：\n\n${combinedSummaries}`,
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
 * 主要摘要函式
 * @param text 要摘要的長文
 * @param title 文章標題
 * @param options 摘要選項
 */
async function summarizeLongText(
  text: string,
  title: string,
  options: SummaryOptions = DEFAULT_OPTIONS
): Promise<string> {
  console.log(`\n📄 開始摘要：${title}`);
  console.log(`   文字長度：${text.length} 字元`);
  console.log(`   摘要風格：${options.style}`);
  console.log(`   輸出語言：${options.language}\n`);

  // 如果文字夠短，直接摘要
  if (text.length <= options.maxChunkSize) {
    console.log("📝 文字較短，直接進行摘要...\n");
    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `請摘要以下文章（不超過 ${options.maxLength} 字）：\n\n${text}`,
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

  // 分塊處理
  const chunks = splitIntoChunks(text, options.maxChunkSize);
  console.log(`📦 文字分割成 ${chunks.length} 個區塊\n`);

  // 對每個塊進行摘要
  const chunkSummaries: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    console.log(`⏳ 處理區塊 ${i + 1}/${chunks.length}...`);
    const summary = await summarizeChunk(chunks[i], i, chunks.length, options);
    chunkSummaries.push(summary);
    console.log(`✅ 區塊 ${i + 1} 摘要完成\n`);
  }

  // 合併摘要
  console.log("🔗 正在合併所有區塊摘要...\n");
  console.log("最終摘要：\n");
  const finalSummary = await mergeSummaries(chunkSummaries, title, options);

  return finalSummary;
}

/**
 * 主程式
 */
async function main(): Promise<void> {
  console.log("=".repeat(50));
  console.log("  長文摘要系統");
  console.log("=".repeat(50));

  // 示範一：標準段落式摘要
  await summarizeLongText(LONG_ARTICLE, "人工智慧的發展歷程與未來展望", {
    maxChunkSize: 2000,
    style: "paragraph",
    language: "繁體中文",
    maxLength: 400,
  });

  console.log("\n\n" + "=".repeat(50));

  // 示範二：條列式摘要
  console.log("\n📋 條列式摘要版本：\n");
  await summarizeLongText(LONG_ARTICLE, "人工智慧的發展歷程與未來展望", {
    maxChunkSize: 2000,
    style: "bullet",
    language: "繁體中文",
    maxLength: 300,
  });

  console.log("\n\n✅ 摘要任務完成！");
}

main().catch(console.error);
