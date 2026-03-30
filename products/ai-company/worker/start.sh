#!/bin/bash
# Worker起動スクリプト: FastAPI + VNC + LINE Webhook + LINE Agent

echo "[start] Starting worker services..."

# ============================================
# 1. Virtual Display + VNC (for Playwright browser monitoring)
# ============================================
export DISPLAY=:99

echo "[start] Starting Xvfb on :99 (1280x720)..."
Xvfb :99 -screen 0 1280x720x24 -ac &
sleep 1

echo "[start] Starting fluxbox window manager..."
fluxbox &
sleep 1

echo "[start] Starting x11vnc on port 5900..."
x11vnc -display :99 -nopw -forever -shared -rfbport 5900 -bg -o /tmp/x11vnc.log
sleep 1

echo "[start] Starting noVNC on port 6080..."
websockify --web /opt/noVNC 6080 localhost:5900 &
NOVNC_PID=$!
echo "[start] noVNC PID: $NOVNC_PID (http://localhost:6080)"

# ============================================
# 2. Connector Plugins (copy to data volume if not exists)
# ============================================
if [ -d /app/connector-plugins ]; then
  mkdir -p /workspace/data/connector-plugins
  cp -rn /app/connector-plugins/* /workspace/data/connector-plugins/ 2>/dev/null || true
  echo "[start] Connector plugins synced"
fi

# ============================================
# 3. FastAPI (main app, port 8000)
# ============================================
echo "[start] Starting FastAPI on port 8000..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
