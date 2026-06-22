@echo off
REM Gpark 一鍵啟動腳本（Windows）
echo 🚀 Gpark 啟動中...

REM 確認 backend\.env 存在
if not exist backend\.env (
    echo ⚠️  backend\.env 不存在，正在複製 .env.example...
    copy backend\.env.example backend\.env
    echo ✏️  請用記事本填入 backend\.env 中的 API 金鑰：
    echo     notepad backend\.env
    echo 填入後重新執行此腳本。
    pause
    exit /b 1
)

echo 📡 啟動 Backend (port 3001)...
start "Gpark Backend" cmd /k "cd backend && npm start"

echo 🌐 啟動 Frontend (port 3000)...
start "Gpark Frontend" cmd /k "npm run dev"

echo.
echo ✅ Gpark 已在兩個視窗中啟動！
echo    前端: http://localhost:3000
echo    後端: http://localhost:3001
pause
