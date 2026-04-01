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

# ============================================
# browser-use (SNS自動化)
# ============================================
RUN pip install --no-cache-dir browser-use

# Playwright browsers (Chromium) — Python版
RUN pip install --no-cache-dir playwright \
    && playwright install --with-deps chromium

# Playwright browsers (Chromium) — Node.js版 (MCP server用)
RUN npx -y @anthropic-ai/mcp-server-playwright --help 2>/dev/null || true \
    && npx -y playwright install --with-deps chromium

# ============================================
# Python deps
# ============================================
COPY requirements.txt .
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
COPY project-context/.claude /workspace/.claude
COPY project-context/company /workspace/company
COPY project-context/features /workspace/features
COPY project-context/SPEC.md /workspace/SPEC.md
COPY project-context/HANDOFF.md /workspace/HANDOFF.md
COPY project-context/.mcp.json /workspace/.mcp.json
COPY project-context/.mcp.json /root/.claude/.mcp.json
COPY project-context/package.json /workspace/package.json
COPY connector-plugins /app/connector-plugins

# ============================================
# Copy app
# ============================================
COPY . .

# Claude Agent SDK (for employee chat streaming)
RUN cd /app && npm init -y --silent 2>/dev/null; npm install @anthropic-ai/claude-agent-sdk


EXPOSE 8000

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
