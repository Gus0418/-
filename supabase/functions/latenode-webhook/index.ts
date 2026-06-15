import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Webhook-Secret",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  // Validate via X-Webhook-Secret or Authorization Bearer
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (webhookSecret) {
    const headerSecret = req.headers.get("X-Webhook-Secret");
    const bearer = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (headerSecret !== webhookSecret && bearer !== webhookSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }
  }

  let payload: Record<string, unknown> = {};
  let eventType = "latenode_event";

  try {
    payload = await req.json();
    eventType = (payload.event_type as string) || (payload.type as string) || "latenode_event";
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Log incoming webhook
  const { data: logEntry, error: logError } = await supabase
    .from("webhook_logs")
    .insert({ source: "latenode", event_type: eventType, payload, status: "received" })
    .select("id")
    .single();

  if (logError) console.error("Log insert error:", logError.message);
  const logId = logEntry?.id;

  try {
    // Store as integration event
    await supabase.from("integration_events").insert({
      event_name: eventType,
      service_from: "latenode",
      service_to: (payload.target_service as string) || "notion",
      data: payload,
      status: "success",
      completed_at: new Date().toISOString(),
    });

    // Handle notification events
    if (eventType === "notification" || payload.notify) {
      await supabase.from("notifications").insert({
        title: (payload.title as string) || "Latenode 通知",
        message: (payload.message as string) || JSON.stringify(payload),
        source: "latenode",
        status: "unread",
        metadata: payload,
      });
    }

    if (logId) {
      await supabase
        .from("webhook_logs")
        .update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify({ success: true, log_id: logId, event_type: eventType }),
      { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  } catch (err) {
    if (logId) {
      await supabase
        .from("webhook_logs")
        .update({ status: "error", error_message: String(err), processed_at: new Date().toISOString() })
        .eq("id", logId);
    }
    return new Response(
      JSON.stringify({ error: "Processing failed", detail: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }
});
