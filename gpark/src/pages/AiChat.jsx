import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Trash2, Sparkles, Mic, MicOff, Square } from 'lucide-react'
import { chatStream, transcribeAudio } from '../lib/api'
import PageHeader from '../components/PageHeader'

const MODELS = [
  { id: 'claude', label: 'Claude claude-sonnet-4-6', color: 'text-orange-400', badge: 'bg-orange-400/10 border-orange-400/30 text-orange-400' },
  { id: 'gpt4o',  label: 'GPT-4o',      color: 'text-green-400',  badge: 'bg-green-400/10 border-green-400/30 text-green-400' },
]

const SYSTEM_STARTERS = [
  '最新的 Webhook 日誌狀況如何？',
  '幫我分析整合事件的成功率',
  '有哪些通知需要我處理？',
  '如何設定 Latenode 自動化流程？',
]

export default function AiChat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [model, setModel] = useState('claude')
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const mediaRef = useRef(null)
  const chunksRef = useRef([])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const userText = (text ?? input).trim()
    if (!userText || streaming) return
    const userMsg = { role: 'user', content: userText }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setStreaming(true)
    const assistantMsg = { role: 'assistant', content: '', model }
    setMessages([...history, assistantMsg])
    try {
      for await (const chunk of chatStream(
        history.map(({ role, content }) => ({ role, content })),
        'Gpark 個人整合中心 — Supabase, Latenode, Notion',
        model
      )) {
        assistantMsg.content += chunk
        setMessages(prev => {
          const u = [...prev]
          u[u.length - 1] = { ...assistantMsg }
          return u
        })
      }
    } catch (err) {
      assistantMsg.content = `❌ ${err.message}`
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { ...assistantMsg }; return u })
    } finally {
      setStreaming(false)
      inputRef.current?.focus()
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  // --- Voice recording ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setTranscribing(true)
        try {
          const text = await transcribeAudio(blob)
          setInput(prev => (prev ? prev + ' ' + text : text).trim())
          inputRef.current?.focus()
        } catch (err) {
          console.error('Whisper error:', err)
        } finally {
          setTranscribing(false)
        }
      }
      recorder.start()
      mediaRef.current = recorder
      setRecording(true)
    } catch (err) {
      alert('無法存取麥克風：' + err.message)
    }
  }

  const stopRecording = () => {
    mediaRef.current?.stop()
    setRecording(false)
  }

  const activeModel = MODELS.find(m => m.id === model)

  return (
    <div className="animate-fade-in flex flex-col" style={{ height: 'calc(100vh - 5rem)' }}>
      <PageHeader
        title="AI 助理"
        description="語音輸入 (Whisper) · Claude claude-sonnet-4-6 · GPT-4o"
        actions={
          messages.length > 0 && (
            <button onClick={() => setMessages([])} className="gpark-btn-ghost flex items-center gap-2 text-xs">
              <Trash2 size={13} /> 清除
            </button>
          )
        }
      />

      {/* Model selector */}
      <div className="flex gap-2 mb-4">
        {MODELS.map(m => (
          <button
            key={m.id}
            onClick={() => setModel(m.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              model === m.id ? m.badge : 'border-gpark-border text-gpark-muted hover:border-gpark-border/80'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Chat */}
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
        <div className="flex gap-2 items-end">
          {/* Voice button */}
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={streaming || transcribing}
            title={recording ? '停止錄音' : '語音輸入 (Whisper)'}
            className={`px-3 py-2.5 rounded-lg border text-sm flex items-center gap-1.5 transition-all disabled:opacity-40 ${
              recording
                ? 'bg-red-500/15 border-red-500/50 text-red-400 animate-pulse'
                : 'border-gpark-border text-gpark-muted hover:border-gpark-green hover:text-gpark-green'
            }`}
          >
            {transcribing ? (
              <span className="w-4 h-4 border-2 border-gpark-green border-t-transparent rounded-full animate-spin" />
            ) : recording ? (
              <><Square size={13} fill="currentColor" /> 停止</>
            ) : (
              <Mic size={15} />
            )}
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={transcribing ? 'Whisper 轉譯中…' : `輸入訊息，或按麥克風語音輸入… (Enter 送出)`}
            rows={1}
            disabled={streaming || transcribing}
            className="gpark-input flex-1 resize-none min-h-[42px] max-h-32 leading-relaxed disabled:opacity-50"
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
            {streaming
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Send size={15} />
            }
          </button>
        </div>
        <p className="text-xs text-gpark-muted mt-2">
          {recording
            ? '🔴 錄音中… 按停止後 Whisper 自動轉譯'
            : `模型：${activeModel.label} · 語音：OpenAI Whisper`
          }
        </p>
      </div>
    </div>
  )
}

function WelcomeScreen({ onSelect }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 bg-gpark-green/10 rounded-xl flex items-center justify-center">
          <Sparkles size={24} className="text-gpark-green" />
        </div>
        <div className="text-center">
          <h2 className="text-base font-semibold text-gpark-text">Gpark AI 助理</h2>
          <p className="text-sm text-gpark-muted mt-1">支援 Claude · GPT-4o · 語音輸入</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
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
  const modelInfo = MODELS.find(m => m.id === message.model)
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
        {!isUser && modelInfo && (
          <span className={`text-xs font-medium ${modelInfo.color} block mb-1.5`}>{modelInfo.label}</span>
        )}
        {message.content}
        {isLast && !message.content && (
          <span className="inline-flex gap-1 mt-1">
            {[0, 150, 300].map(d => (
              <span key={d} className="w-1.5 h-1.5 bg-gpark-muted rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </span>
        )}
      </div>
    </div>
  )
}
