import Sidebar from './Sidebar'

export default function Layout({ children, session }) {
  return (
    <div className="flex min-h-screen bg-gpark-bg">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
