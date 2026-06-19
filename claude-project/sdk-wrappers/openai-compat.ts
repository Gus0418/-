/**
 * OpenAI 相容層 — 讓使用 OpenAI SDK 的程式碼無縫切換到 Claude
 */
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// 模擬 OpenAI 的 ChatCompletion 介面
export const openaiCompat = {
  chat: {
    completions: {
      async create(params: {
        model: string;
        messages: { role: string; content: string }[];
        max_tokens?: number;
        stream?: boolean;
        temperature?: number;
      }) {
        // 自動映射 OpenAI 模型到 Claude
        const modelMap: Record<string, string> = {
          "gpt-4":       "claude-opus-4-8",
          "gpt-4o":      "claude-sonnet-4-6",
          "gpt-4o-mini": "claude-haiku-4-5-20251001",
          "gpt-3.5-turbo": "claude-haiku-4-5-20251001",
        };
        const claudeModel = modelMap[params.model] ?? "claude-sonnet-4-6";

        const system = params.messages.find(m => m.role === "system")?.content;
        const messages = params.messages
          .filter(m => m.role !== "system")
          .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

        const response = await client.messages.create({
          model: claudeModel,
          max_tokens: params.max_tokens ?? 1024,
          ...(system ? { system } : {}),
          messages,
        });

        // 回傳 OpenAI 格式
        return {
          id: `chatcmpl-${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: claudeModel,
          choices: [{
            index: 0,
            message: {
              role: "assistant",
              content: response.content[0].type === "text" ? response.content[0].text : "",
            },
            finish_reason: "stop",
          }],
          usage: {
            prompt_tokens: response.usage.input_tokens,
            completion_tokens: response.usage.output_tokens,
            total_tokens: response.usage.input_tokens + response.usage.output_tokens,
          },
        };
      },
    },
  },
};

// 直接替換 OpenAI 預設匯出
export default openaiCompat;
