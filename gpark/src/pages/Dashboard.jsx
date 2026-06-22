import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Webhook, GitBranch, KeyRound, ArrowRight, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useRealtimeNotifications, useRealtimeWebhooks } from '../lib/realtime'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recentNotifications, setRecentNotifications] = useState([])
  const [recentWebhooks, setRecentWebhooks] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    const [
      { count: unreadNotif },
      { count: totalWebhooks },
      { count: pendingEvents },
      { count: activeTokens },
      { data: notifications },
      { data: webhooks },
    ] = await Promise.all([
      supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('status', 'unread'),
      supabase.from('webhook_logs').select('*', { count: 'exact', head: true }),
      supabase.from('integration_events').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('api_tokens').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('webhook_logs').select('*').order('created_at', { ascending: false }).limit(5),
    ])

    setStats({ unreadNotif, totalWebhooks, pendingEvents, activeTokens })
    setRecentNotifications(notifications || [])
    setRecentWebhooks(webhooks || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  // 即時更新：新通知 / 新 webhook 進來自動刷新
  useRealtimeNotifications(() => fetchData())
  useRealtimeWebhooks(() => fetchData())

  const STAT_ITEMS = [
    { icon: Bell, label: '未讀通知', value: stats?.unreadNotif, sub: '待查看的通知', accent: true },
    { icon: Webhook, label: 'Webhook 日誌', value: stats?.totalWebhooks, sub: '累計接收次數' },
    { icon: GitBranch, label: '待處理事件', value: stats?.pendingEvents, sub: '整合事件' },
    { icon: KeyRound, label: '活躍 API 金鑰', value: stats?.activeTokens, sub: '已設定的服務' },
  ]

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gpark-text">儀表板</h1>
          <p className="text-sm text-gpark-muted mt-0.5">Supabase · Latenode · Notion 整合概覽</p>
        </div>
        <button onClick={fetchData} disabled={loading} className="gpark-btn-ghost flex items-center gap-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          重新整理
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STAT_ITEMS.map(item => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Notifications */}
        <div className="gpark-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gpark-text">最新通知</h2>
            <Link to="/notifications" className="text-xs text-gpark-muted hover:text-gpark-green flex items-center gap-1 transition-colors">
              查看全部 <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <LoadingSkeleton rows={4} />
          ) : recentNotifications.length === 0 ? (
            <EmptyState label="尚無通知" />
          ) : (
            <ul className="space-y-2.5">
              {recentNotifications.map(n => (
                <li key={n.id} className="flex items-start gap-3 py-2 border-b border-gpark-border/50 last:border-0">
                  <div className="mt-0.5">
                    <StatusBadge status={n.status} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gpark-text font-medium truncate">{n.title}</p>
                    {n.message && <p className="text-xs text-gpark-muted truncate">{n.message}</p>}
                  </div>
                  <span className="text-xs text-gpark-muted shrink-0">{fmtTime(n.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Webhooks */}
        <div className="gpark-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gpark-text">最新 Webhook</h2>
            <Link to="/webhook-logs" className="text-xs text-gpark-muted hover:text-gpark-green flex items-center gap-1 transition-colors">
              查看全部 <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <LoadingSkeleton rows={4} />
          ) : recentWebhooks.length === 0 ? (
            <EmptyState label="尚無 Webhook 記錄" />
          ) : (
            <ul className="space-y-2.5">
              {recentWebhooks.map(w => (
                <li key={w.id} className="flex items-start gap-3 py-2 border-b border-gpark-border/50 last:border-0">
                  <StatusBadge status={w.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gpark-text font-medium truncate">{w.event_type || 'unknown'}</p>
                    <p className="text-xs text-gpark-muted">來源：{w.source}</p>
                  </div>
                  <span className="text-xs text-gpark-muted shrink-0">{fmtTime(w.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Webhook Endpoint Info */}
      <div className="mt-6 gpark-card">
        <h2 className="text-sm font-medium text-gpark-text mb-3">Webhook 端點設定</h2>
        <div className="space-y-2">
          <InfoRow label="Endpoint" value="https://iixxaaeurdcyuvouqzlz.supabase.co/functions/v1/latenode-webhook" mono />
          <InfoRow label="認證方式" value="X-Webhook-Secret header 或 Authorization Bearer" />
          <InfoRow label="支援方法" value="POST" />
          <InfoRow label="Supabase 區域" value="ap-southeast-1（新加坡）" />
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="text-gpark-muted w-28 shrink-0">{label}</span>
      <span className={`text-gpark-text break-all ${mono ? 'font-mono text-xs text-gpark-green' : ''}`}>{value}</span>
    </div>
  )
}

function EmptyState({ label }) {
  return <p className="text-center text-gpark-muted text-sm py-6">{label}</p>
}

function LoadingSkeleton({ rows }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-8 bg-gpark-border/30 rounded animate-pulse" />
      ))}
    </div>
  )
}

function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diff = now - d
  if (diff < 60_000) return '剛剛'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分鐘前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小時前`
  return d.toLocaleDateString('zh-TW')
}
