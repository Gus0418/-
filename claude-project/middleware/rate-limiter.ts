/** 速率限制中介層 — 防止超過 API 限額 */

interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute: number;
}

const LIMITS: Record<string, RateLimitConfig> = {
  "claude-opus-4-8":           { requestsPerMinute: 50,  tokensPerMinute: 20000  },
  "claude-sonnet-4-6":         { requestsPerMinute: 500, tokensPerMinute: 80000  },
  "claude-haiku-4-5-20251001": { requestsPerMinute: 500, tokensPerMinute: 100000 },
  "gpt-4o":                    { requestsPerMinute: 500, tokensPerMinute: 30000  },
  "default":                   { requestsPerMinute: 100, tokensPerMinute: 40000  },
};

const windows: Record<string, { count: number; tokens: number; resetAt: number }> = {};

export function checkRateLimit(model: string, estimatedTokens: number): void {
  const now = Date.now();
  const limit = LIMITS[model] ?? LIMITS.default;

  if (!windows[model] || now > windows[model].resetAt) {
    windows[model] = { count: 0, tokens: 0, resetAt: now + 60000 };
  }

  const w = windows[model];
  if (w.count >= limit.requestsPerMinute) {
    const waitMs = w.resetAt - now;
    throw new RateLimitError(`${model} 達到請求限額，請等待 ${Math.ceil(waitMs / 1000)}s`, waitMs);
  }
  if (w.tokens + estimatedTokens > limit.tokensPerMinute) {
    const waitMs = w.resetAt - now;
    throw new RateLimitError(`${model} 達到 token 限額，請等待 ${Math.ceil(waitMs / 1000)}s`, waitMs);
  }

  w.count++;
  w.tokens += estimatedTokens;
}

export async function withRateLimit<T>(
  model: string,
  estimatedTokens: number,
  fn: () => Promise<T>
): Promise<T> {
  while (true) {
    try {
      checkRateLimit(model, estimatedTokens);
      return await fn();
    } catch (e) {
      if (e instanceof RateLimitError) {
        console.log(`⏳ Rate limit: 等待 ${Math.ceil(e.waitMs / 1000)}s...`);
        await new Promise(r => setTimeout(r, e.waitMs));
      } else throw e;
    }
  }
}

class RateLimitError extends Error {
  constructor(msg: string, public waitMs: number) { super(msg); }
}
