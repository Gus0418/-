import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Notifications from './pages/Notifications'
import WebhookLogs from './pages/WebhookLogs'
import IntegrationEvents from './pages/IntegrationEvents'
import ApiTokens from './pages/ApiTokens'
import AiChat from './pages/AiChat'

function ProtectedRoute({ session, children }) {
  if (!session) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gpark-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-gpark-green border-t-transparent rounded-full animate-spin" />
          <span className="text-gpark-muted text-sm">載入中…</span>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute session={session}>
              <Layout session={session}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/webhook-logs" element={<WebhookLogs />} />
                  <Route path="/integration-events" element={<IntegrationEvents />} />
                  <Route path="/api-tokens" element={<ApiTokens />} />
                  <Route path="/ai-chat" element={<AiChat />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
