-- Multi-tenant project registry
-- Each row holds one project's credentials and config.
-- Accessed only via service role key inside Edge Functions.

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  supabase_url TEXT,
  supabase_service_key TEXT,
  claude_api_key TEXT,
  notion_token TEXT,
  notion_db_ids JSONB DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: no direct client access; service role bypasses this
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Seed the default project so existing setup keeps working
INSERT INTO projects (id, name, notion_db_ids) VALUES (
  'default',
  'Default Project',
  '{
    "notifications":      "aef054f7c68744c9ae54f50694e32dd9",
    "integration_events": "d748dca2d5334dcb829590009543d818",
    "webhook_logs":       "496cff39ddef49589ab6de63eb8985fd"
  }'
) ON CONFLICT (id) DO NOTHING;
