const STYLES = {
  received:  'bg-blue-500/15 text-blue-400 border-blue-500/30',
  processed: 'bg-green-500/15 text-green-400 border-green-500/30',
  error:     'bg-red-500/15 text-red-400 border-red-500/30',
  pending:   'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  success:   'bg-green-500/15 text-green-400 border-green-500/30',
  failed:    'bg-red-500/15 text-red-400 border-red-500/30',
  unread:    'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  read:      'bg-gray-500/15 text-gray-400 border-gray-500/30',
  archived:  'bg-gray-500/10 text-gray-500 border-gray-500/20',
}

const LABELS = {
  received:  '已接收',
  processed: '已處理',
  error:     '錯誤',
  pending:   '待處理',
  success:   '成功',
  failed:    '失敗',
  unread:    '未讀',
  read:      '已讀',
  archived:  '已封存',
}

export default function StatusBadge({ status }) {
  const style = STYLES[status] || 'bg-gray-500/15 text-gray-400 border-gray-500/30'
  const label = LABELS[status] || status
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${style}`}>
      {label}
    </span>
  )
}
