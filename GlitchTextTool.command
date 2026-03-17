#!/bin/bash
# Glitch Text Tool (v2.1) 起動スクリプト
# ダブルクリックで開発サーバーを起動し、ブラウザを開きます

cd "$(dirname "$0")"

echo "==============================================="
echo "  ⚡️ GlitchTextTool を起動しています..."
echo "==============================================="
echo ""

# node_modules が無ければ自動インストール
if [ ! -d "node_modules" ]; then
  echo "📦 依存パッケージをインストール中..."
  npm install
  echo ""
fi

# ログファイルで起動を検知
LOGFILE=$(mktemp /tmp/vite-log.XXXXXX)

echo "🚀 開発サーバーを起動中... (このウィンドウを閉じると停止します)"
echo ""

# Vite をバックグラウンドで起動し、出力をログとターミナルの両方に流す
npx vite --port 0 2>&1 | tee "$LOGFILE" &
VITE_PID=$!

# Vite の出力から実際のURLを検出してブラウザを開く
(
  for i in $(seq 1 30); do
    URL=$(grep -oE 'http://localhost:[0-9]+' "$LOGFILE" 2>/dev/null | head -1)
    if [ -n "$URL" ]; then
      sleep 1
      open "$URL"
      break
    fi
    sleep 1
  done
  rm -f "$LOGFILE"
) &

# Ctrl+C またはウィンドウ閉じで Vite を停止
trap "kill $VITE_PID 2>/dev/null; rm -f '$LOGFILE'; exit" INT TERM
wait $VITE_PID
