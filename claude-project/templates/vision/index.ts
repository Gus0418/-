/**
 * 多模態視覺理解範本
 * 功能：圖片分析、URL 圖片、base64 圖片、多圖比較
 * 使用方式：ts-node vision/index.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";

const client = new Anthropic();

/**
 * 從 URL 下載圖片並轉換為 base64
 * @param url 圖片 URL
 */
async function downloadImageAsBase64(
  url: string
): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    protocol.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const contentType = res.headers["content-type"] || "image/jpeg";
        const mediaType = contentType.split(";")[0] as Anthropic.Base64ImageSource["media_type"];
        resolve({
          data: buffer.toString("base64"),
          mediaType: mediaType || "image/jpeg",
        });
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

/**
 * 從本地檔案讀取圖片並轉換為 base64
 * @param filePath 圖片檔案路徑
 */
function readLocalImageAsBase64(
  filePath: string
): { data: string; mediaType: string } {
  const absolutePath = path.resolve(filePath);
  const buffer = fs.readFileSync(absolutePath);
  const ext = path.extname(filePath).toLowerCase().slice(1);

  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
  };

  return {
    data: buffer.toString("base64"),
    mediaType: mimeTypes[ext] || "image/jpeg",
  };
}

/**
 * 示範一：使用 URL 分析圖片
 */
async function analyzeImageFromURL(): Promise<void> {
  console.log("\n🖼️  示範一：透過 URL 分析圖片");
  console.log("-".repeat(40));

  // 使用公開的示範圖片（NASA 地球圖片）
  const imageUrl =
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/The_Earth_seen_from_Apollo_17.jpg/240px-The_Earth_seen_from_Apollo_17.jpg";

  console.log(`圖片 URL：${imageUrl}\n`);
  console.log("AI 分析結果：\n");

  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "url",
              url: imageUrl,
            },
          },
          {
            type: "text",
            text: "請詳細描述這張圖片的內容，包含主要元素、顏色、氛圍等。請用繁體中文回答。",
          },
        ],
      },
    ],
  });

  stream.on("text", (text) => process.stdout.write(text));
  await stream.finalMessage();
  console.log("\n");
}

/**
 * 示範二：使用 base64 分析圖片（從下載的圖片轉換）
 */
async function analyzeImageFromBase64(): Promise<void> {
  console.log("\n🖼️  示範二：透過 base64 分析圖片");
  console.log("-".repeat(40));

  // 下載示範圖片並轉換為 base64
  const imageUrl =
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/240px-Camponotus_flavomarginatus_ant.jpg";

  console.log("正在下載圖片...");

  try {
    const { data, mediaType } = await downloadImageAsBase64(imageUrl);
    console.log(`圖片已下載，類型：${mediaType}，大小：${data.length} bytes (base64)\n`);
    console.log("AI 分析結果：\n");

    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as Anthropic.Base64ImageSource["media_type"],
                data,
              },
            },
            {
              type: "text",
              text: "請識別圖片中的主體，並說明其特徵。請用繁體中文回答。",
            },
          ],
        },
      ],
    });

    stream.on("text", (text) => process.stdout.write(text));
    await stream.finalMessage();
    console.log("\n");
  } catch (error) {
    console.log(`⚠️  圖片下載失敗（可能是網路問題）：${error instanceof Error ? error.message : String(error)}`);
    console.log("跳過此示範\n");
  }
}

/**
 * 示範三：多圖比較分析
 */
async function compareMultipleImages(): Promise<void> {
  console.log("\n🖼️  示範三：多圖比較分析");
  console.log("-".repeat(40));

  // 使用兩張不同的示範圖片
  const images = [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/24701-nature-natural-beauty.jpg/240px-24701-nature-natural-beauty.jpg",
      label: "圖片 A",
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Biharwe_landscape.jpg/240px-Biharwe_landscape.jpg",
      label: "圖片 B",
    },
  ];

  const contentBlocks: Anthropic.ContentBlockParam[] = [];

  // 加入兩張圖片
  for (const image of images) {
    contentBlocks.push(
      {
        type: "text",
        text: `${image.label}：`,
      },
      {
        type: "image",
        source: {
          type: "url",
          url: image.url,
        },
      }
    );
  }

  // 加入比較問題
  contentBlocks.push({
    type: "text",
    text: "請比較這兩張圖片，分析它們的相似點和差異點。請用繁體中文回答。",
  });

  console.log("正在分析兩張圖片...\n");
  console.log("AI 比較分析：\n");

  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: contentBlocks,
        },
      ],
    });

    stream.on("text", (text) => process.stdout.write(text));
    await stream.finalMessage();
    console.log("\n");
  } catch (error) {
    console.log(`⚠️  多圖分析失敗：${error instanceof Error ? error.message : String(error)}\n`);
  }
}

/**
 * 示範四：OCR 文字辨識（使用 URL 圖片）
 */
async function ocrFromImage(): Promise<void> {
  console.log("\n🖼️  示範四：圖片文字辨識（OCR）");
  console.log("-".repeat(40));

  // 使用含有文字的圖片
  const imageUrl =
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/240px-PNG_transparency_demonstration_1.png";

  console.log("正在辨識圖片中的文字...\n");

  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "url",
                url: imageUrl,
              },
            },
            {
              type: "text",
              text: "請描述這張圖片的視覺內容，如果有文字請辨識並列出。請用繁體中文回答。",
            },
          ],
        },
      ],
    });

    console.log("辨識結果：\n");
    stream.on("text", (text) => process.stdout.write(text));
    await stream.finalMessage();
    console.log("\n");
  } catch (error) {
    console.log(`⚠️  OCR 辨識失敗：${error instanceof Error ? error.message : String(error)}\n`);
  }
}

/**
 * 主程式
 */
async function main(): Promise<void> {
  console.log("=".repeat(50));
  console.log("  多模態視覺理解完整示範");
  console.log("=".repeat(50));

  await analyzeImageFromURL();
  await analyzeImageFromBase64();
  await compareMultipleImages();
  await ocrFromImage();

  console.log("✅ 所有視覺分析示範完成！");
  console.log("\n📝 支援的圖片格式：JPEG、PNG、GIF、WebP");
  console.log("📝 圖片來源方式：URL、base64、本地檔案");
}

main().catch(console.error);
