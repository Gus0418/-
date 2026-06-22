import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * 訂閱 Supabase Realtime channel，在 notifications 有新資料時觸發 onInsert
 * 回傳 { unread } — 最新未讀數（初始從 props 帶入，後續即時更新）
 */
export function useRealtimeNotifications(onInsert) {
  const channelRef = useRef(null)

  useEffect(() => {
    channelRef.current = supabase
      .channel('notifications-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
        onInsert?.(payload.new)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channelRef.current)
    }
  }, [])
}

/**
 * 訂閱 webhook_logs INSERT
 */
export function useRealtimeWebhooks(onInsert) {
  useEffect(() => {
    const ch = supabase
      .channel('webhooks-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'webhook_logs' }, payload => {
        onInsert?.(payload.new)
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])
}
