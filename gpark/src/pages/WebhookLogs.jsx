import { useEffect, useState } from 'react'
import { Webhook, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import StatusBadge from '../components/StatusBadge'
import PageHeader from '../components/PageHeader'

const STATUS_FILTERS = ['全部', 'received', 'processed', 'error']
const FILTER_LABELS = { '全部': '全部', received: '已接收', processed: '已處理', error: '錯誤' }

export default function WebhookLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('全部')
  const [expanded, setExpanded] = useState(null)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20

  const fetch = async (p = page) => {
    setLoading(true)
    let q = supabase
      .from('webhook_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1)
    if (filter !== '全部') q = q.eq('status', filter)
    const { data } = await q
    setLogs(data || [])
    setLoading(false)
  }

  useEffect(() => { setPage(0); fetch(0) }, [filter])
  useEffect(() => { fetch() }, [page])

  const toggleExpand = (id) => setExpanded(expanded === id ? null : id)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Webhook 日誌"
        description="所有來自 Latenode 的 Webhook 請求記錄"
        actions={
          <button onClick={() => fetch()} disabled={loading} className="gpark-btn-ghost flex items-center gap-2">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {STATUS_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              filter === f
                ? 'bg-gpark-green/10 border-gpark-green text-gpark-green'
                : 'border-gpark-border text-gpark-muted hover:border-gpark-green/50'
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonTable />
      ) : logs.length === 0 ? (
        <Empty icon={Webhook} label="尚無 Webhook 記錄" />
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <div key={log.id} className="gpark-card">
              <button
                onClick={() => toggleExpand(log.id)}
                className="w-full flex items-center gap-3 text-left"
              >
                <StatusBadge status={log.status} />
                <span className="text-sm text-gpark-text font-medium flex-1 truncate">
                  {log.event_type || 'unknown_event'}
                </span>
                <span className="text-xs text-gpark-muted shrink-0">{log.source}</span>
                <span className="text-xs text-gpark-muted shrink-0">{fmtDate(log.created_at)}</span>
                {expanded === log.id ? <ChevronUp size={14} className="text-gpark-muted" /> : <ChevronDown size={14} className="text-gpark-muted" />}
              </button>

              {expanded === log.id && (
                <div className="mt-3 pt-3 border-t border-gpark-border space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <Field label="Log ID" value={log.id} mono />
                    <Field label="來源" value={log.source} />
                    <Field label="狀態" value={log.status} />
                    {log.processed_at && <Field label="處理時間" value={fmtDate(log.processed_at)} />}
                    {log.error_message && <Field label="錯誤訊息" value={log.error_message} className="col-span-2 text-red-400" />}
                  </div>
                  {log.payload && (
                    <div>
                      <p className="text-xs text-gpark-muted mb-1.5">Payload</p>
                      <pre className="bg-gpark-bg rounded-lg p-3 text-xs text-gpark-subtle overflow-x-auto">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && logs.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="gpark-btn-ghost disabled:opacity-40"
          >
            ← 上一頁
          </button>
          <span className="text-xs text-gpark-muted">第 {page + 1} 頁</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={logs.length < PAGE_SIZE}
            className="gpark-btn-ghost disabled:opacity-40"
          >
            下一頁 →
          </button>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, mono, className }) {
  return (
    <div>
      <p className="text-gpark-muted mb-0.5">{label}</p>
      <p className={`text-gpark-text break-all ${mono ? 'font-mono' : ''} ${className || ''}`}>{value}</p>
    </div>
  )
}

function Empty({ icon: Icon, label }) {
  return (
    <div className="gpark-card flex flex-col items-center gap-3 py-12">
      <Icon size={32} className="text-gpark-border" />
      <p className="text-gpark-muted text-sm">{label}</p>
    </div>
  )
}

function SkeletonTable() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 5].map(i => (
        <div key={i} className="gpark-card h-12 animate-pulse bg-gpark-border/20" />
      ))}
    </div>
  )
}

function fmtDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
