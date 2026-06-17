#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║          Claude Master System — 一鍵完整安裝腳本             ║
# ╚══════════════════════════════════════════════════════════════╝
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
step() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║       Claude Master System — Full Installer          ║"
echo "║       整合所有 AI × 全自動工具 × 完整框架            ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── 0. 環境檢查 ───────────────────────────────────────────────
step "環境檢查"
command -v node >/dev/null 2>&1 || err "需要 Node.js 18+，請先安裝"
command -v npm  >/dev/null 2>&1 || err "需要 npm"
command -v python3 >/dev/null 2>&1 && HAS_PYTHON=true || HAS_PYTHON=false
NODE_VER=$(node -e "process.stdout.write(process.versions.node)")
log "Node.js $NODE_VER"
$HAS_PYTHON && log "Python3 可用" || warn "Python3 未安裝，略過 Python 套件"

# ── 1. 建立目錄結構 ───────────────────────────────────────────
step "建立目錄結構"
mkdir -p generated .cache logs .data
chmod +x scripts/setup.sh 2>/dev/null || true
log "目錄建立完成"

# ── 2. 環境變數 ───────────────────────────────────────────────
step "環境變數設定"
if [ ! -f .env ]; then
  cp .env.example .env
  warn ".env 已建立，請填入 API Keys："
  warn "  ANTHROPIC_API_KEY=sk-ant-..."
  warn "  OPENAI_API_KEY=sk-..."
  warn "  GOOGLE_GENERATIVE_AI_API_KEY=..."
  warn "  GROQ_API_KEY=..."
else
  log ".env 已存在"
fi

# ── 3. Node.js 全域套件 ───────────────────────────────────────
step "安裝 Node.js 全域套件"
GLOBAL_PKGS=(
  # Anthropic 官方全套
  "@anthropic-ai/claude-code"
  "@anthropic-ai/claude-agent-sdk"
  "@anthropic-ai/sdk"
  "@anthropic-ai/bedrock-sdk"
  "@anthropic-ai/vertex-sdk"
  "@anthropic-ai/tokenizer"
  # AI SDK（所有供應商）
  "ai"
  "@ai-sdk/anthropic"
  "@ai-sdk/openai"
  "@ai-sdk/google"
  "@ai-sdk/mistral"
  "@ai-sdk/cohere"
  "@ai-sdk/groq"
  "@ai-sdk/xai"
  "@ai-sdk/amazon-bedrock"
  "@ai-sdk/azure"
  # 各家原廠 SDK
  "openai"
  "@google/generative-ai"
  "groq-sdk"
  "@mistralai/mistralai"
  "cohere-ai"
  "@huggingface/inference"
  "@azure/openai"
  # LangChain
  "langchain"
  "@langchain/anthropic"
  "@langchain/openai"
  "@langchain/google-genai"
  "@langchain/mistralai"
  "@langchain/cohere"
  "@langchain/groq"
  # MCP
  "@modelcontextprotocol/sdk"
  "@modelcontextprotocol/server-filesystem"
  "@modelcontextprotocol/server-memory"
  "@modelcontextprotocol/server-sequential-thinking"
  "@modelcontextprotocol/server-everything"
  "@modelcontextprotocol/inspector"
  # 開發工具
  "tsx"
  "typescript"
  "dotenv-cli"
  "nodemon"
  "vitest"
  "zod"
)
echo "安裝 ${#GLOBAL_PKGS[@]} 個全域套件..."
npm install -g "${GLOBAL_PKGS[@]}" --loglevel=error
log "全域套件安裝完成"

# ── 4. 專案本地依賴 ───────────────────────────────────────────
step "安裝專案依賴"
npm install --loglevel=error
log "本地依賴安裝完成"

# ── 5. Python 套件 ────────────────────────────────────────────
if $HAS_PYTHON; then
  step "安裝 Python AI 套件"
  pip install -q --upgrade \
    anthropic \
    openai \
    google-generativeai \
    groq \
    mistralai \
    cohere \
    huggingface-hub \
    boto3 \
    azure-ai-inference \
    litellm \
    langchain-anthropic \
    mcp 2>/dev/null || warn "部分 Python 套件安裝失敗（可繼續）"
  log "Python 套件安裝完成"
fi

# ── 6. 驗證安裝 ───────────────────────────────────────────────
step "驗證安裝"
node -e "require('@anthropic-ai/sdk')" 2>/dev/null && log "@anthropic-ai/sdk ✓" || warn "@anthropic-ai/sdk 未找到"
node -e "require('openai')"             2>/dev/null && log "openai ✓"             || warn "openai 未找到"
node -e "require('ai')"                 2>/dev/null && log "ai SDK ✓"             || warn "ai SDK 未找到"
node -e "require('@modelcontextprotocol/sdk')" 2>/dev/null && log "MCP SDK ✓"    || warn "MCP SDK 未找到"
claude --version 2>/dev/null && log "Claude Code CLI: $(claude --version)"       || warn "Claude Code CLI 未安裝"

# ── 7. 完成 ──────────────────────────────────────────────────
echo -e "\n${GREEN}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║                  安裝完成！                          ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo "快速開始："
echo "  npm run preview        # 驗證 Claude 連線"
echo "  npm run master         # 互動對話（所有 AI）"
echo "  npm run web            # Web 介面 → http://localhost:3000"
echo "  npm run auto-code      # 全自動生成程式碼"
echo "  npm run master:race    # 所有 AI 競賽"
echo "  npm run benchmark      # 效能基準測試"
echo ""
echo "⚠️  記得在 .env 填入 API Keys 才能正常使用"
