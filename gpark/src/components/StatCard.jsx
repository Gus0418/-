export default function StatCard({ icon: Icon, label, value, sub, accent = false }) {
  return (
    <div className="gpark-card flex flex-col gap-3 animate-slide-up">
      <div className="flex items-center justify-between">
        <span className="text-gpark-muted text-sm">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent ? 'bg-gpark-green/10 text-gpark-green' : 'bg-gpark-border/50 text-gpark-subtle'}`}>
          <Icon size={16} />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold text-gpark-text tabular-nums">{value ?? '—'}</p>
        {sub && <p className="text-xs text-gpark-muted mt-1">{sub}</p>}
      </div>
    </div>
  )
}
