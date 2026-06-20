#!/bin/bash
# Gpark 一鍵啟動腳本（Mac/Linux）
echo "🚀 Gpark 啟動中..."

# 確認 .env 存在
if [ ! -f backend/.env ]; then
  echo "⚠️  backend/.env 不存在，正在複製 .env.example..."
  cp backend/.env.example backend/.env
  echo "✏️  請填入 backend/.env 中的 API 金鑰，然後重新執行此腳本。"
  exit 1
fi

# 啟動 backend（背景）
echo "📡 啟動 Backend (port 3001)..."
cd backend && npm start &
BACKEND_PID=$!
cd ..

# 等一秒
sleep 1

# 啟動 frontend
echo "🌐 啟動 Frontend (port 3000)..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Gpark 已啟動！"
echo "   前端: http://localhost:3000"
echo "   後端: http://localhost:3001"
echo "   按 Ctrl+C 停止"

wait
