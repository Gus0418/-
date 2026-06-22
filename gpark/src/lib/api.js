const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

// Streaming chat — model: 'claude' | 'gpt4o'
export async function* chatStream(messages, context, model = 'claude') {
  const endpoint = model === 'gpt4o' ? '/api/chat-gpt' : '/api/chat'
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context }),
  })
  if (!res.ok) throw new Error('Chat request failed')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6)
      if (raw === '[DONE]') return
      const json = JSON.parse(raw)
      if (json.text) yield json.text
      if (json.error) throw new Error(json.error)
    }
  }
}

// GPT-4o Vision 圖片分析
export async function analyzeImage(imageFile, prompt) {
  const form = new FormData()
  form.append('image', imageFile)
  if (prompt) form.append('prompt', prompt)
  const res = await fetch(`${BASE}/api/analyze-image`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Image analysis failed')
  }
  return (await res.json()).result
}

// Whisper 語音轉文字 — audioBlob: Blob (webm/ogg/mp4)
export async function transcribeAudio(audioBlob) {
  const form = new FormData()
  form.append('audio', audioBlob, 'recording.webm')
  const res = await fetch(`${BASE}/api/transcribe`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Transcription failed')
  }
  const data = await res.json()
  return data.text
}
