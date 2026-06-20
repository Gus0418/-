import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const app = express()
const PORT = process.env.PORT || 3001

// --- Clients ---
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// --- Middleware ---
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000' }))
app.use(express.json())

// --- Health ---
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'gpark-backend', ts: new Date().toISOString() })
})

// --- AI Chat (streaming) ---
// POST /api/chat
// body: { messages: [{role, content}], context?: string }
app.post('/api/chat', async (req, res) => {
  const { messages = [], context } = req.body

  if (!messages.length) {
    return res.status(400).json({ error: '需要提供 messages' })
  }

  // Build system prompt with Gpark context
  const systemPrompt = [
    '你是 Gpark 的 AI 助理，一個個人整合中心儀表板。',
    '你可以協助使用者分析 webhook 日誌、整合事件、通知，以及管理 Supabase + Latenode + Notion 的整合流程。',
    '回覆請使用繁體中文，語氣簡潔清晰。',
    context ? `\n目前上下文：\n${context}` : '',
  ].filter(Boolean).join('\n')

  // Streaming SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`)
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('Chat error:', err.message)
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    res.end()
  }
})

// --- Supabase Stats proxy (service role) ---
// GET /api/stats
app.get('/api/stats', async (_req, res) => {
  try {
    const [notifRes, webhookRes, eventsRes, tokensRes] = await Promise.all([
      supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('status', 'unread'),
      supabase.from('webhook_logs').select('*', { count: 'exact', head: true }),
      supabase.from('integration_events').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('api_tokens').select('*', { count: 'exact', head: true }).eq('is_active', true),
    ])
    res.json({
      unread_notifications: notifRes.count,
      total_webhooks: webhookRes.count,
      pending_events: eventsRes.count,
      active_tokens: tokensRes.count,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// --- Supabase data proxy endpoints (bypass RLS using service role) ---
app.get('/api/notifications', async (req, res) => {
  const status = req.query.status
  let q = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100)
  if (status && status !== '全部') q = q.eq('status', status)
  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.patch('/api/notifications/:id', async (req, res) => {
  const { id } = req.params
  const updates = req.body
  const { data, error } = await supabase.from('notifications').update(updates).eq('id', id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.get('/api/webhook-logs', async (req, res) => {
  const { status, page = 0 } = req.query
  const PAGE = 20
  let q = supabase.from('webhook_logs').select('*').order('created_at', { ascending: false }).range(page * PAGE, (page + 1) * PAGE - 1)
  if (status && status !== '全部') q = q.eq('status', status)
  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.get('/api/integration-events', async (req, res) => {
  const { status } = req.query
  let q = supabase.from('integration_events').select('*').order('created_at', { ascending: false }).limit(50)
  if (status && status !== '全部') q = q.eq('status', status)
  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.get('/api/api-tokens', async (_req, res) => {
  const { data, error } = await supabase.from('api_tokens').select('*').order('service_name')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.patch('/api/api-tokens/:id', async (req, res) => {
  const { id } = req.params
  const { data, error } = await supabase.from('api_tokens').update(req.body).eq('id', id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.post('/api/api-tokens', async (req, res) => {
  const { data, error } = await supabase.from('api_tokens').insert(req.body).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// --- Start ---
app.listen(PORT, () => {
  console.log(`🚀 Gpark backend running on http://localhost:${PORT}`)
  console.log(`   Claude AI: ${process.env.ANTHROPIC_API_KEY ? '✓ 已設定' : '✗ 未設定 (ANTHROPIC_API_KEY)'}`)
  console.log(`   Supabase:  ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ 已設定' : '✗ 未設定 (SUPABASE_SERVICE_ROLE_KEY)'}`)
})
