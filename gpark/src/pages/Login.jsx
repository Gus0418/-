import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('signin')
  const [magicSent, setMagicSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({ email })
        if (error) throw error
        setMagicSent(true)
      } else if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setError('確認信已送出，請查看電子郵件。')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gpark-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 bg-gpark-green rounded-xl flex items-center justify-center font-bold text-white text-xl">
            G
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gpark-text leading-none">Gpark</h1>
            <p className="text-gpark-muted text-xs mt-0.5">個人整合中心</p>
          </div>
        </div>

        <div className="gpark-card">
          <h2 className="text-base font-semibold text-gpark-text mb-5">
            {mode === 'signup' ? '建立帳號' : mode === 'magic' ? '無密碼登入' : '登入'}
          </h2>

          {magicSent ? (
            <div className="text-center py-4">
              <p className="text-gpark-green text-sm font-medium">✓ 魔法連結已送出</p>
              <p className="text-gpark-muted text-xs mt-1">請查看 {email} 的信箱</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-gpark-muted mb-1.5">電子郵件</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="gpark-input w-full"
                />
              </div>

              {mode !== 'magic' && (
                <div>
                  <label className="block text-xs text-gpark-muted mb-1.5">密碼</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="gpark-input w-full"
                  />
                </div>
              )}

              {error && (
                <p className={`text-xs px-3 py-2 rounded-lg ${error.startsWith('確認') ? 'text-gpark-green bg-gpark-green/10' : 'text-red-400 bg-red-400/10'}`}>
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading} className="gpark-btn-primary w-full flex justify-center">
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  mode === 'signup' ? '建立帳號' : mode === 'magic' ? '發送連結' : '登入'
                )}
              </button>
            </form>
          )}

          <div className="mt-4 flex flex-col gap-2 pt-4 border-t border-gpark-border">
            {mode !== 'magic' && (
              <button
                onClick={() => { setMode('magic'); setError('') }}
                className="text-xs text-gpark-muted hover:text-gpark-green transition-colors text-left"
              >
                ✉ 使用魔法連結登入（無需密碼）
              </button>
            )}
            {mode !== 'signin' && (
              <button
                onClick={() => { setMode('signin'); setError('') }}
                className="text-xs text-gpark-muted hover:text-gpark-green transition-colors text-left"
              >
                ← 返回登入
              </button>
            )}
            {mode === 'signin' && (
              <button
                onClick={() => { setMode('signup'); setError('') }}
                className="text-xs text-gpark-muted hover:text-gpark-green transition-colors text-left"
              >
                + 建立新帳號
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
