import { useEffect, useState } from 'react'
import { KeyRound, RefreshCw, CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'

const SERVICE_ICONS = {
  notion: '📓',
  claude: '🤖',
  latenode: '⚡',
}

export default function ApiTokens() {
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    setLoading(true)
    const { data } = await supabase.from('api_tokens').select('*').order('service_name')
    setTokens(data || [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const toggleActive = async (id, current) => {
    await supabase.from('api_tokens').update({ is_active: !current }).eq('id', id)
    await fetch()
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="API 金鑰"
        description="各服務的 API 金鑰狀態管理（不儲存實際金鑰值）"
        actions={
          <button onClick={fetch} disabled={loading} className="gpark-btn-ghost flex items-center gap-2">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div className="mb-4 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-xs text-yellow-300">
        ⚠ 此頁面僅顯示金鑰的設定狀態，實際金鑰值存放於各服務的環境變數中。
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="gpark-card h-28 animate-pulse bg-gpark-border/20" />
          ))}
        </div>
      ) : tokens.length === 0 ? (
        <div className="gpark-card flex flex-col items-center gap-3 py-12">
          <KeyRound size={32} className="text-gpark-border" />
          <p className="text-gpark-muted text-sm">尚無 API 金鑰記錄</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {tokens.map(token => (
            <div key={token.id} className="gpark-card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gpark-surface rounded-lg flex items-center justify-center text-xl border border-gpark-border">
                    {SERVICE_ICONS[token.service_name.toLowerCase()] || '🔑'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gpark-text capitalize">{token.service_name}</h3>
                      {token.is_active ? (
                        <CheckCircle2 size={14} className="text-gpark-green" />
                      ) : (
                        <XCircle size={14} className="text-red-400" />
                      )}
                    </div>
                    <p className="text-xs text-gpark-muted mt-0.5">{token.description}</p>
                  </div>
                </div>

                <button
                  onClick={() => toggleActive(token.id, token.is_active)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    token.is_active
                      ? 'border-gpark-green/40 text-gpark-green hover:bg-red-400/10 hover:text-red-400 hover:border-red-400/40'
                      : 'border-red-400/40 text-red-400 hover:bg-gpark-green/10 hover:text-gpark-green hover:border-gpark-green/40'
                  }`}
                >
                  {token.is_active ? '停用' : '啟用'}
                </button>
              </div>

              <div className="mt-3 pt-3 border-t border-gpark-border grid grid-cols-2 gap-3 text-xs">
                <Field label="類型" value={token.token_type} />
                <Field label="狀態" value={token.is_active ? '啟用中' : '已停用'} />
                <Field label="建立時間" value={fmtDate(token.created_at)} />
                <Field label="更新時間" value={fmtDate(token.updated_at)} />
                {token.last_used_at && <Field label="最後使用" value={fmtDate(token.last_used_at)} />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 gpark-card">
        <h3 className="text-sm font-medium text-gpark-text mb-3">如何新增服務金鑰</h3>
        <div className="text-xs text-gpark-muted space-y-1.5">
          <p>1. 在 Supabase Dashboard 的 Edge Function 環境變數中設定實際金鑰</p>
          <p>2. 在下方新增一筆追蹤記錄（不含實際金鑰值）</p>
          <p>3. 透過 Latenode 觸發 Webhook 來測試連線</p>
        </div>
        <AddTokenForm onAdded={fetch} />
      </div>
    </div>
  )
}

function AddTokenForm({ onAdded }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ service_name: '', token_type: 'api_key', description: '' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.service_name) return
    setSaving(true)
    await supabase.from('api_tokens').insert({ ...form, is_active: true })
    setSaving(false)
    setOpen(false)
    setForm({ service_name: '', token_type: 'api_key', description: '' })
    onAdded()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="gpark-btn-ghost mt-4 text-xs">
        + 新增服務金鑰記錄
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gpark-muted mb-1">服務名稱</label>
          <input
            value={form.service_name}
            onChange={e => setForm(f => ({ ...f, service_name: e.target.value }))}
            placeholder="e.g. openai"
            className="gpark-input w-full text-xs"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-gpark-muted mb-1">類型</label>
          <select
            value={form.token_type}
            onChange={e => setForm(f => ({ ...f, token_type: e.target.value }))}
            className="gpark-input w-full text-xs"
          >
            <option value="api_key">api_key</option>
            <option value="webhook_secret">webhook_secret</option>
            <option value="oauth_token">oauth_token</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-gpark-muted mb-1">說明</label>
        <input
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="選填"
          className="gpark-input w-full text-xs"
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="gpark-btn-primary text-xs px-4 py-2">
          {saving ? '儲存中…' : '儲存'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="gpark-btn-ghost text-xs px-4 py-2">
          取消
        </button>
      </div>
    </form>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-gpark-muted">{label}</p>
      <p className="text-gpark-text mt-0.5">{value}</p>
    </div>
  )
}

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
