#!/bin/bash
# 一鍵設定腳本
set -e
echo "🚀 Claude Master System 設定中..."

# 複製環境變數
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  請編輯 .env 填入 API Keys"
fi

# 建立必要目錄
mkdir -p generated .cache logs

# 安裝依賴
echo "📦 安裝依賴..."
npm install

echo "✅ 設定完成！"
echo ""
echo "使用方式："
echo "  npm run master        # 互動對話"
echo "  npm run web           # Web 介面 (localhost:3000)"
echo "  npm run agent         # 自動 Agent"
echo "  npm run auto-code     # 全自動生成程式碼"
echo "  npm run master:race   # 所有 AI 競賽"
