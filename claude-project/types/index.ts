/** 全域型別定義 */

export type ModelId =
  | "claude-opus-4-8"
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5-20251001"
  | "gpt-4o" | "gpt-4o-mini" | "o1" | "o3-mini"
  | "gemini-2.0-flash" | "gemini-1.5-pro"
  | "llama-3.3-70b-versatile" | "mixtral-8x7b-32768"
  | "mistral-large-latest" | "mistral-small-latest"
  | "command-r-plus" | "command-r";

export type Provider = "anthropic" | "openai" | "google" | "groq" | "mistral" | "cohere";
export type TaskType = "quick" | "balanced" | "complex" | "code" | "analysis" | "creative" | "fast" | "vision";
export type TextFormat = "json" | "markdown" | "csv" | "yaml" | "code" | "plain";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface CallOptions {
  model?: ModelId;
  taskType?: TaskType;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  onStream?: (chunk: string) => void;
  useCache?: boolean;
  timeout?: number;
}

export interface CallResult {
  text: string;
  model: ModelId;
  provider: Provider;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  latencyMs: number;
  cached: boolean;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string }>;
  required: string[];
  execute: (input: Record<string, string>) => Promise<string>;
}

export interface AgentState {
  task: string;
  step: number;
  messages: Message[];
  toolCalls: { tool: string; input: unknown; result: string }[];
  completed: boolean;
  result?: string;
}

export interface ChunkOptions {
  maxTokens?: number;
  strategy?: "auto" | "sentences" | "paragraphs" | "lines" | "json" | "code";
}

export interface UsageRecord {
  model: ModelId;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: number;
  task?: string;
}

export interface ModelInfo {
  contextWindow: number;
  outputLimit: number;
  costPer1MIn: number;
  costPer1MOut: number;
  provider: Provider;
  strengths: string[];
}
