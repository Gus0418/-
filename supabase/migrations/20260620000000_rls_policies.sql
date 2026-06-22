-- RLS 政策：允許已驗證的使用者讀取所有資料表

-- api_tokens
CREATE POLICY "authenticated can select api_tokens"
  ON public.api_tokens FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can update api_tokens"
  ON public.api_tokens FOR UPDATE TO authenticated USING (true);

CREATE POLICY "authenticated can insert api_tokens"
  ON public.api_tokens FOR INSERT TO authenticated WITH CHECK (true);

-- webhook_logs
CREATE POLICY "authenticated can select webhook_logs"
  ON public.webhook_logs FOR SELECT TO authenticated USING (true);

-- integration_events
CREATE POLICY "authenticated can select integration_events"
  ON public.integration_events FOR SELECT TO authenticated USING (true);

-- notifications
CREATE POLICY "authenticated can select notifications"
  ON public.notifications FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can update notifications"
  ON public.notifications FOR UPDATE TO authenticated USING (true);

-- latenode webhook function: service role 可寫入（不受 RLS 限制）
-- （service role key 不受 RLS 影響，無需額外設定）
