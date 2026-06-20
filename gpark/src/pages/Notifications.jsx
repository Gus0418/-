import { useEffect, useState } from 'react'
import { Bell, CheckCheck, Archive, RefreshCw, Filter } from 'lucide-react'
import { supabase } from '../lib/supabase'
import StatusBadge from '../components/StatusBadge'
import PageHeader from '../components/PageHeader'

const FILTERS = ['全部', 'unread', 'read', 'archived']
const FILTER_LABELS = { '全部': '全部', unread: '未讀', read: '已讀', archived: '已封存' }

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('全部')
  const [actionId, setActionId] = useState(null)

  const fetch = async () => {
    setLoading(true)
    let q = supabase.from('notifications').select('*').order('created_at', { ascending: false })
    if (filter !== '全部') q = q.eq('status', filter)
    const { data } = await q
    setNotifications(data || [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [filter])

  const updateStatus = async (id, status) => {
    setActionId(id)
    await supabase.from('notifications').update({
      status,
      ...(status === 'read' ? { read_at: new Date().toISOString() } : {}),
    }).eq('id', id)
    await fetch()
    setActionId(null)
  }

  const markAllRead = async () => {
    await supabase.from('notifications').update({ status: 'read', read_at: new Date().toISOString() }).eq('status', 'unread')
    await fetch()
  }

  const unreadCount = notifications.filter(n => n.status === 'unread').length

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="通知"
        description={`共 ${notifications.length} 筆${unreadCount > 0 ? `，${unreadCount} 則未讀` : ''}`}
        actions={
          <>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="gpark-btn-ghost flex items-center gap-2">
                <CheckCheck size={14} />
                全部標為已讀
              </button>
            )}
            <button onClick={fetch} disabled={loading} className="gpark-btn-ghost flex items-center gap-2">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {FILTERS.map(f => (
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
      ) : notifications.length === 0 ? (
        <Empty icon={Bell} label="沒有符合條件的通知" />
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`gpark-card flex gap-4 transition-opacity ${actionId === n.id ? 'opacity-50' : ''} ${n.status === 'unread' ? 'border-gpark-green/30' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={n.status} />
                  <span className="text-xs text-gpark-muted">{n.source}</span>
                </div>
                <p className="text-sm font-medium text-gpark-text">{n.title}</p>
                {n.message && <p className="text-xs text-gpark-muted mt-1">{n.message}</p>}
                <p className="text-xs text-gpark-muted/60 mt-2">{fmtDate(n.created_at)}</p>
              </div>

              <div className="flex flex-col gap-1.5 shrink-0">
                {n.status === 'unread' && (
                  <button
                    onClick={() => updateStatus(n.id, 'read')}
                    className="text-xs text-gpark-muted hover:text-gpark-green transition-colors px-2 py-1 rounded border border-gpark-border hover:border-gpark-green/50"
                  >
                    標為已讀
                  </button>
                )}
                {n.status !== 'archived' && (
                  <button
                    onClick={() => updateStatus(n.id, 'archived')}
                    className="text-xs text-gpark-muted hover:text-gpark-subtle transition-colors px-2 py-1 rounded border border-gpark-border"
                  >
                    封存
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
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

function SkeletonList() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="gpark-card h-20 animate-pulse bg-gpark-border/20" />
      ))}
    </div>
  )
}

function fmtDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
