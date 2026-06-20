import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Trash2, Sparkles } from 'lucide-react'
import { chatStream } from '../lib/api'
import PageHeader from '../components/PageHeader'

const SYSTEM_STARTERS = [
  '最新的 Webhook 日誌狀況如何？',
  '幫我分析整合事件的成功率',
  '有哪些通知需要我處理？',
  '如何設定 Latenode 自動化流程？',
  '解釋 Supabase RLS 的設定',
]

export default function AiChat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const userText = text || input.trim()
    if (!userText || streaming) return

    const userMsg = { role: 'user', content: userText }
    const newHistory = [...messages, userMsg]
    setMessages(newHistory)
    setInput('')
    setStreaming(true)

    const assistantMsg = { role: 'assistant', content: '' }
    setMessages([...newHistory, assistantMsg])

    try {
      for await (const chunk of chatStream(
        newHistory.map(({ role, content }) => ({ role, content })),
        'Gpark 個人整合中心 — 連接 Supabase, Latenode, Notion'
      )) {
        assistantMsg.content += chunk
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { ...assistantMsg }
          return updated
        })
      }
    } catch (err) {
      assistantMsg.content = `❌ 發生錯誤：${err.message}`
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { ...assistantMsg }
        return updated
      })
    } finally {
      setStreaming(false)
      inputRef.current?.focus()
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-4rem)]">
      <PageHeader
        title="AI 助理"
        description="由 Claude 驅動，協助分析整合數據與自動化流程"
        actions={
          messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="gpark-btn-ghost flex items-center gap-2 text-xs"
            >
              <Trash2 size={13} /> 清除對話
            </button>
          )
        }
      />

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 ? (
          <WelcomeScreen onSelect={sendMessage} />
        ) : (
          messages.map((msg, i) => (
            <ChatBubble key={i} message={msg} isLast={i === messages.length - 1 && streaming} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="pt-4 border-t border-gpark-border">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="輸入訊息… (Enter 送出，Shift+Enter 換行)"
            rows={1}
            disabled={streaming}
            className="gpark-input flex-1 resize-none min-h-[42px] max-h-32 leading-relaxed disabled:opacity-50"
            style={{ height: 'auto' }}
            onInput={e => {
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || streaming}
            className="gpark-btn-primary px-3 py-2.5 flex items-center gap-2 disabled:opacity-40"
          >
            {streaming ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={15} />
            )}
          </button>
        </div>
        <p className="text-xs text-gpark-muted mt-2">由 Claude claude-sonnet-4-6 提供支援</p>
      </div>
    </div>
  )
}

function WelcomeScreen({ onSelect }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 py-12">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 bg-gpark-green/10 rounded-xl flex items-center justify-center">
          <Sparkles size={24} className="text-gpark-green" />
        </div>
        <div className="text-center">
          <h2 className="text-base font-semibold text-gpark-text">Gpark AI 助理</h2>
          <p className="text-sm text-gpark-muted mt-1">詢問任何關於你的整合系統的問題</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
        {SYSTEM_STARTERS.map(s => (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className="text-left px-4 py-3 rounded-lg border border-gpark-border text-xs text-gpark-subtle hover:border-gpark-green hover:text-gpark-text hover:bg-gpark-green/5 transition-all"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function ChatBubble({ message, isLast }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
        isUser ? 'bg-gpark-green text-white' : 'bg-gpark-indigo/20 text-gpark-indigo'
      }`}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? 'bg-gpark-green/15 text-gpark-text border border-gpark-green/20'
          : 'bg-gpark-card border border-gpark-border text-gpark-text'
      }`}>
        {message.content}
        {isLast && !message.content && (
          <span className="inline-flex gap-1">
            <span className="w-1.5 h-1.5 bg-gpark-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-gpark-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-gpark-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        )}
      </div>
    </div>
  )
}
