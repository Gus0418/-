import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Webhook-Secret",
};

const ALLOWED_TABLES = ["api_tokens", "webhook_logs", "integration_events", "notifications"];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function validateAuth(req: Request): boolean {
  const secret = Deno.env.get("WEBHOOK_SECRET");
  if (!secret) return true;
  const headerSecret = req.headers.get("X-Webhook-Secret");
  const bearer = req.headers.get("Authorization")?.replace("Bearer ", "");
  return headerSecret === secret || bearer === secret;
}

// ── action handlers ──────────────────────────────────────────────────────────

async function handleAiChat(payload: Record<string, unknown>) {
  const apiKey = Deno.env.get("CLAUDE_API_KEY");
  if (!apiKey) return { success: false, error: "CLAUDE_API_KEY not configured" };

  const messages = (payload.messages as Array<{ role: string; content: string }>) || [];
  const model = (payload.model as string) || "claude-sonnet-4-6";
  const maxTokens = (payload.max_tokens as number) || 1024;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: `Claude API error: ${err}` };
  }

  const data = await res.json();
  const reply = data.content?.[0]?.text ?? "";
  return { success: true, reply, usage: data.usage, model: data.model };
}

async function handleDataQuery(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
  const table = payload.table as string;
  if (!ALLOWED_TABLES.includes(table)) return { success: false, error: `Table "${table}" not allowed` };

  let query = supabase.from(table).select((payload.select as string) || "*");
  if (payload.filter && typeof payload.filter === "object") {
    for (const [col, val] of Object.entries(payload.filter as Record<string, unknown>)) {
      query = query.eq(col, val);
    }
  }
  if (payload.limit) query = query.limit(payload.limit as number);
  if (payload.order) query = query.order(payload.order as string, { ascending: payload.ascending !== false });

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function handleDataInsert(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
  const table = payload.table as string;
  if (!ALLOWED_TABLES.includes(table)) return { success: false, error: `Table "${table}" not allowed` };

  const { data, error } = await supabase.from(table).insert(payload.data).select();
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function handleDataUpdate(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
  const table = payload.table as string;
  if (!ALLOWED_TABLES.includes(table)) return { success: false, error: `Table "${table}" not allowed` };
  if (!payload.id) return { success: false, error: "id required" };

  const { data, error } = await supabase.from(table).update(payload.data).eq("id", payload.id).select();
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function handleDataDelete(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
  const table = payload.table as string;
  if (!ALLOWED_TABLES.includes(table)) return { success: false, error: `Table "${table}" not allowed` };
  if (!payload.id) return { success: false, error: "id required" };

  const { error } = await supabase.from(table).delete().eq("id", payload.id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

async function handleNotify(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
  const row = {
    title: (payload.title as string) || "通知",
    message: (payload.message as string) || "",
    source: (payload.source as string) || "universal-api",
    status: "unread",
    metadata: payload.metadata ?? {},
  };

  const { data, error } = await supabase.from("notifications").insert(row).select("id").single();
  if (error) return { success: false, error: error.message };

  // Optional Notion sync
  if (payload.notion_sync) {
    const notionResult = await pushToNotion(
      "notifications",
      { title: row.title, message: row.message, source: row.source },
    );
    return { success: true, notification_id: data?.id, notion: notionResult };
  }

  return { success: true, notification_id: data?.id };
}

async function handleNotionSync(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
  const limit = (payload.limit as number) || 10;
  const { data: events, error } = await supabase
    .from("integration_events")
    .select("*")
    .eq("status", "success")
    .is("notion_page_id", null)
    .limit(limit);

  if (error) return { success: false, error: error.message };
  if (!events?.length) return { success: true, synced: 0 };

  const results = await Promise.all(
    events.map(async (ev) => {
      const notionPage = await pushToNotion("integration_events", {
        event_name: ev.event_name,
        service_from: ev.service_from,
        service_to: ev.service_to,
      });
      if (notionPage?.id) {
        await supabase
          .from("integration_events")
          .update({ notion_page_id: notionPage.id })
          .eq("id", ev.id);
      }
      return { event_id: ev.id, notion_page_id: notionPage?.id };
    })
  );

  return { success: true, synced: results.length, results };
}

async function handleWebhookForward(payload: Record<string, unknown>) {
  const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/latenode-webhook`;
  const secret = Deno.env.get("WEBHOOK_SECRET") || "";

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Secret": secret,
    },
    body: JSON.stringify(payload),
  });

  const result = await res.json();
  return { success: res.ok, status: res.status, result };
}

// ── Notion helper ─────────────────────────────────────────────────────────────

async function pushToNotion(
  dbKey: string,
  fields: Record<string, string>,
): Promise<{ id?: string; error?: string }> {
  const notionToken = Deno.env.get("NOTION_TOKEN");
  if (!notionToken) return { error: "NOTION_TOKEN not configured" };

  // Database IDs from config — kept as constants to avoid file I/O in Edge Function
  const DB_IDS: Record<string, string> = {
    notifications: "aef054f7c68744c9ae54f50694e32dd9",
    integration_events: "d748dca2d5334dcb829590009543d818",
    webhook_logs: "496cff39ddef49589ab6de63eb8985fd",
  };

  const databaseId = DB_IDS[dbKey];
  if (!databaseId) return { error: `No Notion database configured for "${dbKey}"` };

  const title = fields.title || fields.event_name || Object.values(fields)[0] || "Entry";
  const properties: Record<string, unknown> = {
    Name: { title: [{ text: { content: title } }] },
  };
  // Add remaining fields as rich_text properties
  for (const [k, v] of Object.entries(fields)) {
    if (k === "title" || k === "event_name") continue;
    properties[k] = { rich_text: [{ text: { content: String(v) } }] };
  }

  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${notionToken}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({ parent: { database_id: databaseId }, properties }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { error: `Notion API error: ${err}` };
  }

  const page = await res.json();
  return { id: page.id };
}

// ── main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!validateAuth(req)) return json({ error: "Unauthorized" }, 401);

  let body: { action?: string; payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const action = body.action;
  const payload = body.payload ?? {};

  if (!action) return json({ error: "action is required" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Log the incoming request
  await supabase.from("integration_events").insert({
    event_name: action,
    service_from: "universal-api-client",
    service_to: action.split("/")[0],
    data: payload,
    status: "pending",
  });

  let result: Record<string, unknown>;
  try {
    switch (action) {
      case "ai/chat":        result = await handleAiChat(payload); break;
      case "data/query":     result = await handleDataQuery(supabase, payload); break;
      case "data/insert":    result = await handleDataInsert(supabase, payload); break;
      case "data/update":    result = await handleDataUpdate(supabase, payload); break;
      case "data/delete":    result = await handleDataDelete(supabase, payload); break;
      case "notify":         result = await handleNotify(supabase, payload); break;
      case "notion/sync":    result = await handleNotionSync(supabase, payload); break;
      case "webhook/forward": result = await handleWebhookForward(payload); break;
      default:               result = { success: false, error: `Unknown action: ${action}` };
    }
  } catch (err) {
    result = { success: false, error: String(err) };
  }

  return json({ action, ...result });
});
