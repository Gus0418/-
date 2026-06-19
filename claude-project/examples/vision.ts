/** 多模態圖片理解範例 */
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as dotenv from "dotenv";
dotenv.config();

const client = new Anthropic();

// 從 URL 分析圖片
async function analyzeImageFromUrl(url: string, question: string) {
  const msg = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "url", url } },
        { type: "text", text: question },
      ],
    }],
  });
  return msg.content[0].type === "text" ? msg.content[0].text : "";
}

// 從本地檔案分析圖片
async function analyzeImageFromFile(filePath: string, question: string) {
  const data = fs.readFileSync(filePath).toString("base64");
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "jpeg";
  const mediaType = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" }[ext] as Anthropic.Base64ImageSource["media_type"] ?? "image/jpeg";

  const msg = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data } },
        { type: "text", text: question },
      ],
    }],
  });
  return msg.content[0].type === "text" ? msg.content[0].text : "";
}

// 示範
async function main() {
  const file = process.argv[2];
  const q = process.argv[3] ?? "描述這張圖片";

  if (file && fs.existsSync(file)) {
    const result = await analyzeImageFromFile(file, q);
    console.log(result);
  } else {
    console.log("用法: tsx vision.ts <圖片路徑> [問題]");
  }
}

main().catch(console.error);
export { analyzeImageFromUrl, analyzeImageFromFile };
