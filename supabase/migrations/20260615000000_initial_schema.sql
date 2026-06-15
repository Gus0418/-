-- 修復安全漏洞：撤銷 rls_auto_enable 的公開執行權限
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;

-- api_tokens：追蹤各服務金鑰狀態（不儲存實際金鑰值）
CREATE TABLE IF NOT EXISTS public.api_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name TEXT NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'api_key',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- webhook_logs：記錄所有來自 Latenode 的 webhook 呼叫
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'latenode',
  event_type TEXT,
  payload JSONB,
  status TEXT DEFAULT 'received' CHECK (status IN ('received', 'processed', 'error')),
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- integration_events：追蹤跨服務事件流程
CREATE TABLE IF NOT EXISTS public.integration_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name TEXT NOT NULL,
  service_from TEXT,
  service_to TEXT,
  data JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  notion_page_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- notifications：統一通知中心（取代已停用的「通知」專案）
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT,
  source TEXT DEFAULT 'latenode',
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
  metadata JSONB,
  notion_page_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- 啟用 RLS
ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_api_tokens_updated_at
  BEFORE UPDATE ON public.api_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 索引
CREATE INDEX IF NOT EXISTS idx_webhook_logs_source ON public.webhook_logs(source);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON public.webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_events_status ON public.integration_events(status);
CREATE INDEX IF NOT EXISTS idx_integration_events_created_at ON public.integration_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- 初始化 api_tokens 服務清單
INSERT INTO public.api_tokens (service_name, token_type, description, is_active) VALUES
  ('notion', 'api_key', 'Notion Integration Token', true),
  ('claude', 'api_key', 'Anthropic Claude API Key', true),
  ('latenode', 'webhook_secret', 'Latenode Webhook Secret', true)
ON CONFLICT DO NOTHING;
