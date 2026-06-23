import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Bell, Webhook, GitBranch,
  KeyRound, LogOut, Sparkles, FlaskConical,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useRealtimeNotifications } from '../lib/realtime'

export default function Sidebar() {
  const [unread, setUnread] = useState(0)

  // 初始載入未讀數
  useEffect(() => {
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'unread')
      .then(({ count }) => setUnread(count || 0))
  }, [])

  // 即時訂閱：新通知進來 unread +1
  useRealtimeNotifications((newNotif) => {
    if (newNotif.status === 'unread') setUnread(n => n + 1)
  })

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const NAV_ITEMS = [
    { to: '/',                   icon: LayoutDashboard, label: '儀表板',       end: true },
    { to: '/notifications',      icon: Bell,            label: '通知',         badge: unread > 0 ? unread : null },
    { to: '/webhook-logs',       icon: Webhook,         label: 'Webhook 日誌' },
    { to: '/integration-events', icon: GitBranch,       label: '整合事件' },
    { to: '/api-tokens',         icon: KeyRound,        label: 'API 金鑰' },
    { to: '/webhook-tester',     icon: FlaskConical,    label: 'Webhook 測試' },
    { to: '/ai-chat',            icon: Sparkles,        label: 'AI 助理' },
  ]

  return (
    <aside className="w-60 shrink-0 bg-gpark-surface border-r border-gpark-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gpark-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gpark-green rounded-lg flex items-center justify-center font-bold text-white text-base leading-none select-none">
            G
          </div>
          <span className="text-gpark-text font-semibold text-base tracking-tight">Gpark</span>
        </div>
        <p className="text-gpark-muted text-xs mt-1.5">個人整合中心</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="text-gpark-muted text-xs font-medium uppercase tracking-widest px-3 mb-2">主選單</p>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ to, icon: Icon, label, end, badge }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-gpark-green/10 text-gpark-green'
                      : 'text-gpark-subtle hover:bg-gpark-border/50 hover:text-gpark-text'
                  }`
                }
              >
                <Icon size={16} />
                <span className="flex-1">{label}</span>
                {badge != null && (
                  <span className="bg-gpark-green text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="mt-6 pt-4 border-t border-gpark-border">
          <p className="text-gpark-muted text-xs font-medium uppercase tracking-widest px-3 mb-2">服務</p>
          <div className="space-y-1.5 px-3">
            <ServiceDot label="Supabase" status="online" />
            <ServiceDot label="Latenode" status="online" />
            <ServiceDot label="Notion" status="online" />
            <ServiceDot label="OpenAI" status="online" />
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-gpark-border">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gpark-muted hover:text-red-400 hover:bg-red-400/10 transition-all duration-150"
        >
          <LogOut size={16} />
          登出
        </button>
      </div>
    </aside>
  )
}

function ServiceDot({ label, status }) {
  const colors = { online: 'bg-gpark-green', offline: 'bg-red-500', unknown: 'bg-yellow-500' }
  return (
    <div className="flex items-center gap-2 text-xs text-gpark-muted">
      <span className={`w-1.5 h-1.5 rounded-full ${colors[status]} animate-pulse`} />
      {label}
    </div>
  )
}
