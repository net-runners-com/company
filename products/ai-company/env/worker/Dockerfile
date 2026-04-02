FROM python:3.12-slim

WORKDIR /app

# ============================================
# System dependencies
# ============================================
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    gnupg \
    ca-certificates \
    procps \
    xvfb \
    ffmpeg \
    fluxbox \
    && rm -rf /var/lib/apt/lists/*

# ============================================
# Node.js 22 (for Claude Code CLI, gws, gemini)
# ============================================
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ============================================
# Claude Code CLI + SDK
# ============================================
RUN npm install -g @anthropic-ai/claude-code

# ============================================
# Google Workspace CLI (gws)
# ============================================
RUN npm install -g @googleworkspace/cli

# ============================================
# Gemini CLI (画像生成)
# ============================================
RUN npm install -g @google/gemini-cli

# Playwright (Python CLI + Chromium)
RUN pip install playwright \
    && python3 -m playwright install --with-deps chromium

# ============================================
# Python deps
# ============================================
COPY env/worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ============================================
# Tool config directories
# ============================================
RUN mkdir -p /root/.gemini \
    && echo '{}' > /root/.gemini/projects.json \
    && mkdir -p /root/.claude

# ============================================
# Project context (products/ 以外のプロジェクトファイル)
# ビルド前に ./sync-context.sh を実行すること
# ============================================
COPY worker/project-context/.claude /workspace/.claude
COPY worker/project-context/company /workspace/company
COPY worker/project-context/features /workspace/features
COPY worker/project-context/.mcp.json /workspace/.mcp.json
COPY worker/project-context/.mcp.json /root/.claude/.mcp.json
COPY worker/connector-plugins /app/connector-plugins

# ============================================
# Copy app
# ============================================
COPY worker/app /app/app

# Claude Agent SDK (for employee chat streaming)
RUN cd /app && npm init -y --silent 2>/dev/null; npm install @anthropic-ai/claude-agent-sdk

EXPOSE 8000

COPY worker/start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
