import { useEffect, useState } from 'react'
import { GitBranch, RefreshCw, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import StatusBadge from '../components/StatusBadge'
import PageHeader from '../components/PageHeader'

const STATUS_FILTERS = ['全部', 'pending', 'success', 'failed']
const FILTER_LABELS = { '全部': '全部', pending: '待處理', success: '成功', failed: '失敗' }

export default function IntegrationEvents() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('全部')

  const fetch = async () => {
    setLoading(true)
    let q = supabase.from('integration_events').select('*').order('created_at', { ascending: false }).limit(50)
    if (filter !== '全部') q = q.eq('status', filter)
    const { data } = await q
    setEvents(data || [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [filter])

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="整合事件"
        description="跨服務的事件流程追蹤"
        actions={
          <button onClick={fetch} disabled={loading} className="gpark-btn-ghost flex items-center gap-2">
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
        <SkeletonList />
      ) : events.length === 0 ? (
        <Empty icon={GitBranch} label="尚無整合事件" />
      ) : (
        <div className="space-y-2">
          {events.map(ev => (
            <div key={ev.id} className="gpark-card">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <StatusBadge status={ev.status} />
                    <span className="text-xs text-gpark-muted">{fmtDate(ev.created_at)}</span>
                  </div>
                  <p className="text-sm font-medium text-gpark-text">{ev.event_name}</p>
                  {/* Service flow */}
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <ServiceChip name={ev.service_from} />
                    <ArrowRight size={12} className="text-gpark-muted" />
                    <ServiceChip name={ev.service_to} />
                  </div>
                  {ev.notion_page_id && (
                    <p className="text-xs text-gpark-muted mt-1.5">
                      Notion Page: <span className="font-mono text-gpark-subtle">{ev.notion_page_id}</span>
                    </p>
                  )}
                </div>
                {ev.completed_at && (
                  <div className="text-right text-xs text-gpark-muted shrink-0">
                    <p>完成</p>
                    <p>{fmtDate(ev.completed_at)}</p>
                  </div>
                )}
              </div>

              {ev.data && Object.keys(ev.data).length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs text-gpark-muted cursor-pointer hover:text-gpark-subtle">查看資料</summary>
                  <pre className="mt-2 bg-gpark-bg rounded-lg p-3 text-xs text-gpark-subtle overflow-x-auto">
                    {JSON.stringify(ev.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ServiceChip({ name }) {
  if (!name) return <span className="text-gpark-muted italic">未知</span>
  const colors = {
    latenode: 'text-purple-400',
    notion: 'text-blue-400',
    supabase: 'text-gpark-green',
    claude: 'text-orange-400',
  }
  const color = colors[name.toLowerCase()] || 'text-gpark-subtle'
  return <span className={`font-medium ${color}`}>{name}</span>
}

function Empty({ icon: Icon, label }) {
  return (
    <div className="gpark-card flex flex-col items-center gap-3 py-12">
      <Icon size={32} className="text-gpark-border" />
      <p className="text-gpark-muted text-sm">{label}</p>
    </div>
  )
}

function SkeletonList() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="gpark-card h-24 animate-pulse bg-gpark-border/20" />
      ))}
    </div>
  )
}

function fmtDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
