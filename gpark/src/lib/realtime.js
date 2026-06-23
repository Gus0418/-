import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * 訂閱 Supabase Realtime channel，在 notifications 有新資料時觸發 onInsert
 * 回傳 { unread } — 最新未讀數（初始從 props 帶入，後續即時更新）
 */
export function useRealtimeNotifications(onInsert) {
  const channelRef = useRef(null)

  useEffect(() => {
    try {
      channelRef.current = supabase
        .channel('notifications-rt-' + Date.now())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
          onInsert?.(payload.new)
        })
        .subscribe()
    } catch {}

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current).catch?.(() => {})
    }
  }, [])
}

/**
 * 訂閱 webhook_logs INSERT
 */
export function useRealtimeWebhooks(onInsert) {
  useEffect(() => {
    let ch
    try {
      ch = supabase
        .channel('webhooks-rt-' + Date.now())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'webhook_logs' }, payload => {
          onInsert?.(payload.new)
        })
        .subscribe()
    } catch {}
    return () => { if (ch) supabase.removeChannel(ch).catch?.(() => {}) }
  }, [])
}
