import { useState } from 'react'
import { FlaskConical, Send, CheckCircle2, XCircle, Copy } from 'lucide-react'
import PageHeader from '../components/PageHeader'

const ENDPOINT = 'https://iixxaaeurdcyuvouqzlz.supabase.co/functions/v1/latenode-webhook'

const TEMPLATES = {
  notification: {
    event_type: 'notification',
    title: '測試通知',
    message: '這是一則來自 Webhook 測試工具的測試通知',
    notify: true,
    source: 'gpark-tester',
  },
  integration_event: {
    event_type: 'integration_sync',
    target_service: 'notion',
    source: 'latenode',
    data: { task: 'sync_records', count: 5 },
  },
  custom: {
    event_type: 'custom_event',
    payload: 'hello from Gpark',
  },
}

export default function WebhookTester() {
  const [secret, setSecret] = useState('')
  const [body, setBody] = useState(JSON.stringify(TEMPLATES.notification, null, 2))
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const send = async () => {
    setLoading(true)
    setResult(null)
    const start = Date.now()
    try {
      const parsed = JSON.parse(body)
      const headers = { 'Content-Type': 'application/json' }
      if (secret) headers['X-Webhook-Secret'] = secret
      const res = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(parsed) })
      const data = await res.json()
      setResult({ ok: res.ok, status: res.status, data, ms: Date.now() - start })
    } catch (err) {
      setResult({ ok: false, status: 0, data: { error: err.message }, ms: Date.now() - start })
    } finally {
      setLoading(false)
    }
  }

  const copyEndpoint = () => {
    navigator.clipboard.writeText(ENDPOINT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isValidJson = (() => { try { JSON.parse(body); return true } catch { return false } })()

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Webhook 測試工具"
        description="直接對 Latenode Webhook 端點發送測試請求"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左：設定 */}
        <div className="space-y-4">
          {/* Endpoint */}
          <div className="gpark-card">
            <p className="text-xs text-gpark-muted mb-1.5">端點 URL</p>
            <div className="flex items-center gap-2">
              <code className="text-xs text-gpark-green font-mono flex-1 break-all">{ENDPOINT}</code>
              <button onClick={copyEndpoint} className="shrink-0 text-gpark-muted hover:text-gpark-green transition-colors">
                {copied ? <CheckCircle2 size={14} className="text-gpark-green" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Webhook Secret */}
          <div className="gpark-card">
            <label className="block text-xs text-gpark-muted mb-1.5">X-Webhook-Secret（選填）</label>
            <input
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder="留空則不驗證"
              className="gpark-input w-full"
            />
          </div>

          {/* Templates */}
          <div className="gpark-card">
            <p className="text-xs text-gpark-muted mb-2">快速範本</p>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(TEMPLATES).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => setBody(JSON.stringify(val, null, 2))}
                  className="px-3 py-1.5 rounded-lg text-xs border border-gpark-border text-gpark-subtle hover:border-gpark-green hover:text-gpark-green transition-all"
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="gpark-card">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-gpark-muted">Request Body (JSON)</label>
              {!isValidJson && <span className="text-xs text-red-400">JSON 格式錯誤</span>}
            </div>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={12}
              className={`gpark-input w-full resize-none font-mono text-xs ${!isValidJson ? 'border-red-500/50' : ''}`}
            />
          </div>

          <button
            onClick={send}
            disabled={loading || !isValidJson}
            className="gpark-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {loading
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Send size={14} />
            }
            {loading ? '發送中…' : '發送 Webhook'}
          </button>
        </div>

        {/* 右：結果 */}
        <div className="space-y-4">
          <div className="gpark-card h-full min-h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-gpark-text">回應結果</p>
              {result && (
                <div className="flex items-center gap-2">
                  {result.ok
                    ? <CheckCircle2 size={16} className="text-gpark-green" />
                    : <XCircle size={16} className="text-red-400" />
                  }
                  <span className={`text-xs font-mono font-bold ${result.ok ? 'text-gpark-green' : 'text-red-400'}`}>
                    {result.status}
                  </span>
                  <span className="text-xs text-gpark-muted">{result.ms}ms</span>
                </div>
              )}
            </div>

            {!result ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <FlaskConical size={32} className="text-gpark-border" />
                <p className="text-gpark-muted text-sm">尚未發送請求</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className={`px-3 py-2 rounded-lg text-xs font-medium ${
                  result.ok ? 'bg-gpark-green/10 text-gpark-green' : 'bg-red-500/10 text-red-400'
                }`}>
                  {result.ok ? '✓ 請求成功' : '✗ 請求失敗'}
                </div>
                <pre className="bg-gpark-bg rounded-lg p-4 text-xs text-gpark-subtle overflow-auto max-h-72 font-mono">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
                {result.ok && (
                  <p className="text-xs text-gpark-muted">
                    ✓ 資料已寫入 Supabase，前往「Webhook 日誌」頁面查看
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
