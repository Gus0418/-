import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Webhook-Secret",
};

const ALLOWED_TABLES = ["api_tokens", "webhook_logs", "integration_events", "notifications"];

// ── types ─────────────────────────────────────────────────────────────────────

interface ProjectConfig {
  id: string;
  name: string;
  supabase_url: string | null;
  supabase_service_key: string | null;
  claude_api_key: string | null;
  notion_token: string | null;
  notion_db_ids: Record<string, string>;
}

// ── helpers ───────────────────────────────────────────────────────────────────

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

/** Master Supabase client (this project's service role) */
function masterClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/**
 * Resolve a project config.
 * Priority: projects table row → env var prefix → default env vars.
 */
async function resolveProject(projectId: string): Promise<ProjectConfig | null> {
  const master = masterClient();
  const { data, error } = await master
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("active", true)
    .single();

  if (error || !data) return null;

  // Allow per-project env var overrides: {PROJECT_ID}_SUPABASE_URL etc.
  const envPrefix = projectId.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const cfg: ProjectConfig = {
    id: data.id,
    name: data.name,
    supabase_url: data.supabase_url ?? Deno.env.get(`${envPrefix}_SUPABASE_URL`) ?? Deno.env.get("SUPABASE_URL")!,
    supabase_service_key: data.supabase_service_key ?? Deno.env.get(`${envPrefix}_SUPABASE_KEY`) ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    claude_api_key: data.claude_api_key ?? Deno.env.get(`${envPrefix}_CLAUDE_API_KEY`) ?? Deno.env.get("CLAUDE_API_KEY") ?? null,
    notion_token: data.notion_token ?? Deno.env.get(`${envPrefix}_NOTION_TOKEN`) ?? Deno.env.get("NOTION_TOKEN") ?? null,
    notion_db_ids: data.notion_db_ids ?? {},
  };
  return cfg;
}

/** Supabase client scoped to a specific project */
function projectClient(cfg: ProjectConfig): SupabaseClient {
  return createClient(cfg.supabase_url!, cfg.supabase_service_key!);
}

// ── action handlers ───────────────────────────────────────────────────────────

async function handleAiChat(cfg: ProjectConfig, payload: Record<string, unknown>) {
  if (!cfg.claude_api_key) return { success: false, error: "claude_api_key not configured for this project" };

  const messages = (payload.messages as Array<{ role: string; content: string }>) || [];
  const model = (payload.model as string) || "claude-sonnet-4-6";
  const maxTokens = (payload.max_tokens as number) || 1024;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.claude_api_key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
  });

  if (!res.ok) return { success: false, error: `Claude API error: ${await res.text()}` };
  const data = await res.json();
  return { success: true, reply: data.content?.[0]?.text ?? "", usage: data.usage, model: data.model };
}

async function handleDataQuery(db: SupabaseClient, payload: Record<string, unknown>) {
  const table = payload.table as string;
  if (!ALLOWED_TABLES.includes(table)) return { success: false, error: `Table "${table}" not allowed` };

  let q = db.from(table).select((payload.select as string) || "*");
  if (payload.filter && typeof payload.filter === "object") {
    for (const [col, val] of Object.entries(payload.filter as Record<string, unknown>)) {
      q = q.eq(col, val);
    }
  }
  if (payload.limit) q = q.limit(payload.limit as number);
  if (payload.order) q = q.order(payload.order as string, { ascending: payload.ascending !== false });

  const { data, error } = await q;
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function handleDataInsert(db: SupabaseClient, payload: Record<string, unknown>) {
  const table = payload.table as string;
  if (!ALLOWED_TABLES.includes(table)) return { success: false, error: `Table "${table}" not allowed` };
  const { data, error } = await db.from(table).insert(payload.data).select();
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function handleDataUpdate(db: SupabaseClient, payload: Record<string, unknown>) {
  const table = payload.table as string;
  if (!ALLOWED_TABLES.includes(table)) return { success: false, error: `Table "${table}" not allowed` };
  if (!payload.id) return { success: false, error: "id required" };
  const { data, error } = await db.from(table).update(payload.data).eq("id", payload.id).select();
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function handleDataDelete(db: SupabaseClient, payload: Record<string, unknown>) {
  const table = payload.table as string;
  if (!ALLOWED_TABLES.includes(table)) return { success: false, error: `Table "${table}" not allowed` };
  if (!payload.id) return { success: false, error: "id required" };
  const { error } = await db.from(table).delete().eq("id", payload.id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

async function handleNotify(cfg: ProjectConfig, db: SupabaseClient, payload: Record<string, unknown>) {
  const row = {
    title: (payload.title as string) || "通知",
    message: (payload.message as string) || "",
    source: (payload.source as string) || `universal-api:${cfg.id}`,
    status: "unread",
    metadata: payload.metadata ?? {},
  };
  const { data, error } = await db.from("notifications").insert(row).select("id").single();
  if (error) return { success: false, error: error.message };

  if (payload.notion_sync) {
    const notionResult = await pushToNotion(cfg, "notifications", { title: row.title, message: row.message, source: row.source });
    return { success: true, notification_id: data?.id, notion: notionResult };
  }
  return { success: true, notification_id: data?.id };
}

async function handleNotionSync(cfg: ProjectConfig, db: SupabaseClient, payload: Record<string, unknown>) {
  const limit = (payload.limit as number) || 10;
  const { data: events, error } = await db
    .from("integration_events")
    .select("*")
    .eq("status", "success")
    .is("notion_page_id", null)
    .limit(limit);
  if (error) return { success: false, error: error.message };
  if (!events?.length) return { success: true, synced: 0 };

  const results = await Promise.all(events.map(async (ev) => {
    const page = await pushToNotion(cfg, "integration_events", {
      event_name: ev.event_name,
      service_from: ev.service_from,
      service_to: ev.service_to,
    });
    if (page?.id) await db.from("integration_events").update({ notion_page_id: page.id }).eq("id", ev.id);
    return { event_id: ev.id, notion_page_id: page?.id };
  }));
  return { success: true, synced: results.length, results };
}

async function handleWebhookForward(cfg: ProjectConfig, payload: Record<string, unknown>) {
  const url = `${cfg.supabase_url}/functions/v1/latenode-webhook`;
  const secret = Deno.env.get("WEBHOOK_SECRET") || "";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Webhook-Secret": secret },
    body: JSON.stringify(payload),
  });
  return { success: res.ok, status: res.status, result: await res.json() };
}

/** List all active projects (id + name only, no credentials) */
async function handleProjectsList() {
  const master = masterClient();
  const { data, error } = await master.from("projects").select("id, name, active, created_at").eq("active", true);
  if (error) return { success: false, error: error.message };
  return { success: true, projects: data };
}

// ── Notion helper ─────────────────────────────────────────────────────────────

async function pushToNotion(
  cfg: ProjectConfig,
  dbKey: string,
  fields: Record<string, string>,
): Promise<{ id?: string; error?: string }> {
  if (!cfg.notion_token) return { error: "notion_token not configured for this project" };

  const databaseId = cfg.notion_db_ids[dbKey];
  if (!databaseId) return { error: `No Notion database configured for "${dbKey}" in project "${cfg.id}"` };

  const title = fields.title || fields.event_name || Object.values(fields)[0] || "Entry";
  const properties: Record<string, unknown> = {
    Name: { title: [{ text: { content: title } }] },
  };
  for (const [k, v] of Object.entries(fields)) {
    if (k === "title" || k === "event_name") continue;
    properties[k] = { rich_text: [{ text: { content: String(v) } }] };
  }

  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${cfg.notion_token}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({ parent: { database_id: databaseId }, properties }),
  });

  if (!res.ok) return { error: `Notion API error: ${await res.text()}` };
  const page = await res.json();
  return { id: page.id };
}

// ── main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!validateAuth(req)) return json({ error: "Unauthorized" }, 401);

  let body: { project_id?: string; action?: string; payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const action = body.action;
  const payload = body.payload ?? {};

  if (!action) return json({ error: "action is required" }, 400);

  // Special action that doesn't require a project
  if (action === "projects/list") {
    return json({ action, ...(await handleProjectsList()) });
  }

  // Resolve project — fallback to "default" if not specified
  const projectId = body.project_id ?? "default";
  const cfg = await resolveProject(projectId);
  if (!cfg) return json({ error: `Project "${projectId}" not found or inactive` }, 404);

  const db = projectClient(cfg);

  // Log the request in master project's integration_events
  await masterClient().from("integration_events").insert({
    event_name: action,
    service_from: `project:${cfg.id}`,
    service_to: action.split("/")[0],
    data: { project_id: cfg.id, ...payload },
    status: "pending",
  });

  let result: Record<string, unknown>;
  try {
    switch (action) {
      case "ai/chat":          result = await handleAiChat(cfg, payload); break;
      case "data/query":       result = await handleDataQuery(db, payload); break;
      case "data/insert":      result = await handleDataInsert(db, payload); break;
      case "data/update":      result = await handleDataUpdate(db, payload); break;
      case "data/delete":      result = await handleDataDelete(db, payload); break;
      case "notify":           result = await handleNotify(cfg, db, payload); break;
      case "notion/sync":      result = await handleNotionSync(cfg, db, payload); break;
      case "webhook/forward":  result = await handleWebhookForward(cfg, payload); break;
      default:                 result = { success: false, error: `Unknown action: ${action}` };
    }
  } catch (err) {
    result = { success: false, error: String(err) };
  }

  return json({ action, project_id: cfg.id, ...result });
});
