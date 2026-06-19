/**
 * 多語言翻譯系統範本
 * 功能：支援所有語言互譯、語境感知、術語一致性、批次翻譯
 * 使用方式：ts-node translator/index.ts
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

/**
 * 翻譯選項介面
 */
interface TranslationOptions {
  sourceLang?: string;         // 來源語言（可自動偵測）
  targetLang: string;          // 目標語言
  style?: "formal" | "casual" | "technical" | "literary";  // 翻譯風格
  domain?: string;             // 領域（如：醫療、法律、技術）
  preserveFormatting?: boolean; // 保留原文格式
  glossary?: Record<string, string>; // 自訂術語表
}

/**
 * 翻譯結果介面
 */
interface TranslationResult {
  originalText: string;
  translatedText: string;
  detectedSourceLang?: string;
  targetLang: string;
  confidence?: string;
  notes?: string;
}

/**
 * 語言代碼映射
 */
const LANGUAGE_NAMES: Record<string, string> = {
  "zh-TW": "繁體中文",
  "zh-CN": "簡體中文",
  "en": "English",
  "ja": "日本語",
  "ko": "한국어",
  "fr": "Français",
  "de": "Deutsch",
  "es": "Español",
  "pt": "Português",
  "it": "Italiano",
  "ru": "Русский",
  "ar": "العربية",
  "th": "ภาษาไทย",
  "vi": "Tiếng Việt",
};

/**
 * 自動偵測語言並翻譯
 * @param text 待翻譯文字
 * @param options 翻譯選項
 */
async function translate(
  text: string,
  options: TranslationOptions
): Promise<TranslationResult> {
  const targetLangName =
    LANGUAGE_NAMES[options.targetLang] || options.targetLang;
  const sourceLangHint = options.sourceLang
    ? `來源語言：${LANGUAGE_NAMES[options.sourceLang] || options.sourceLang}`
    : "請自動偵測來源語言";

  // 建立術語表指示（如果有）
  const glossaryNote =
    options.glossary && Object.keys(options.glossary).length > 0
      ? `\n術語表（請嚴格遵守）：\n${Object.entries(options.glossary)
          .map(([k, v]) => `  "${k}" → "${v}"`)
          .join("\n")}`
      : "";

  // 風格指示
  const styleGuide = {
    formal: "使用正式、專業的語氣",
    casual: "使用輕鬆、口語化的語氣",
    technical: "使用精確的技術術語",
    literary: "注重文學性和韻味",
  }[options.style || "formal"];

  const systemPrompt = `你是一個專業翻譯師，精通世界各地的語言和文化。

翻譯原則：
1. 忠實原文：保留原文的意思和細節
2. 流暢自然：譯文應符合目標語言的表達習慣
3. 文化適應：適當處理文化差異和習慣用語
4. ${styleGuide}
${options.domain ? `5. 領域：${options.domain}，使用相關專業術語` : ""}
${glossaryNote}

請以 JSON 格式回應：
{
  "translatedText": "翻譯結果",
  "detectedSourceLang": "偵測到的來源語言",
  "confidence": "high/medium/low",
  "notes": "翻譯說明（選填）"
}`;

  const userMessage = `${sourceLangHint}
目標語言：${targetLangName}
${options.preserveFormatting ? "請保留原文的換行和格式\n" : ""}
待翻譯文字：
${text}`;

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const responseText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        originalText: text,
        translatedText: parsed.translatedText || responseText,
        detectedSourceLang: parsed.detectedSourceLang,
        targetLang: options.targetLang,
        confidence: parsed.confidence,
        notes: parsed.notes,
      };
    }
  } catch {
    // 解析失敗時返回純文字
  }

  return {
    originalText: text,
    translatedText: responseText,
    targetLang: options.targetLang,
  };
}

/**
 * 批次翻譯（多文字同時翻譯）
 * @param texts 待翻譯文字陣列
 * @param options 翻譯選項
 */
async function batchTranslate(
  texts: string[],
  options: TranslationOptions
): Promise<TranslationResult[]> {
  console.log(`📦 批次翻譯：${texts.length} 個項目\n`);

  // 並行翻譯（可控制並發數以避免 API 限制）
  const BATCH_SIZE = 3; // 每批最多並行請求數
  const results: TranslationResult[] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    console.log(
      `  處理批次 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(texts.length / BATCH_SIZE)}...`
    );

    const batchResults = await Promise.all(
      batch.map((text) => translate(text, options))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * 多目標語言翻譯
 * @param text 待翻譯文字
 * @param targetLangs 目標語言列表
 */
async function multiLanguageTranslate(
  text: string,
  targetLangs: string[]
): Promise<Map<string, string>> {
  console.log(`🌐 同時翻譯成 ${targetLangs.length} 種語言...\n`);

  const translations = await Promise.all(
    targetLangs.map((lang) => translate(text, { targetLang: lang }))
  );

  const result = new Map<string, string>();
  for (let i = 0; i < targetLangs.length; i++) {
    result.set(targetLangs[i], translations[i].translatedText);
  }

  return result;
}

/**
 * 格式化顯示翻譯結果
 */
function displayResult(result: TranslationResult): void {
  const targetName =
    LANGUAGE_NAMES[result.targetLang] || result.targetLang;
  const sourceName = result.detectedSourceLang
    ? ` (偵測語言：${LANGUAGE_NAMES[result.detectedSourceLang] || result.detectedSourceLang})`
    : "";

  console.log(`🔤 原文：${result.originalText.substring(0, 50)}${result.originalText.length > 50 ? "..." : ""}`);
  console.log(`🌐 目標語言：${targetName}${sourceName}`);
  if (result.confidence) {
    console.log(`📊 信心度：${result.confidence}`);
  }
  console.log(`✅ 翻譯結果：`);
  console.log(`   ${result.translatedText}`);
  if (result.notes) {
    console.log(`📝 備注：${result.notes}`);
  }
  console.log();
}

/**
 * 主程式
 */
async function main(): Promise<void> {
  console.log("=".repeat(55));
  console.log("  多語言翻譯系統");
  console.log("=".repeat(55));

  // 示範一：基本翻譯（中翻英）
  console.log("\n📌 示範一：基本翻譯（繁中 → 英文）\n");
  const result1 = await translate(
    "台灣是一個美麗的島嶼，有著豐富的自然景觀和多元文化。夜市文化更是聞名全球。",
    { targetLang: "en", style: "casual" }
  );
  displayResult(result1);

  // 示範二：技術文件翻譯（附術語表）
  console.log("📌 示範二：技術文件翻譯（帶術語表）\n");
  const result2 = await translate(
    "This API endpoint accepts a POST request with a JSON body containing the user's credentials. The response includes an access token and refresh token for authentication.",
    {
      sourceLang: "en",
      targetLang: "zh-TW",
      style: "technical",
      domain: "軟體開發",
      glossary: {
        "API endpoint": "API 端點",
        "JSON body": "JSON 主體",
        "access token": "存取令牌",
        "refresh token": "更新令牌",
        authentication: "身份驗證",
      },
    }
  );
  displayResult(result2);

  // 示範三：多語言同時翻譯
  console.log("📌 示範三：同時翻譯成多種語言\n");
  const greeting = "Hello, welcome to our platform!";
  const multiTranslations = await multiLanguageTranslate(greeting, [
    "zh-TW",
    "ja",
    "ko",
    "fr",
    "de",
  ]);

  console.log(`原文：${greeting}\n`);
  for (const [lang, translation] of multiTranslations) {
    const langName = LANGUAGE_NAMES[lang] || lang;
    console.log(`  ${langName}: ${translation}`);
  }

  // 示範四：批次翻譯
  console.log("\n\n📌 示範四：批次翻譯\n");
  const phrases = [
    "Good morning",
    "Thank you very much",
    "I love programming",
  ];

  const batchResults = await batchTranslate(phrases, { targetLang: "zh-TW" });
  for (const result of batchResults) {
    console.log(`  "${result.originalText}" → "${result.translatedText}"`);
  }

  console.log("\n\n✅ 翻譯示範完成！");
}

main().catch(console.error);
