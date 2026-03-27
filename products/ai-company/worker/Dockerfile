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
    && rm -rf /var/lib/apt/lists/*

# ============================================
# Node.js 22 (for Claude Code CLI, gws, gemini)
# ============================================
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ============================================
# Claude Code CLI
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

# Playwright browsers (Chromium)
RUN pip install --no-cache-dir playwright \
    && playwright install --with-deps chromium

# ============================================
# Python deps
# ============================================
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ============================================
# Tool config directories
# ============================================
RUN mkdir -p /root/.gemini \
    && echo '{}' > /root/.gemini/projects.json

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
COPY project-context/package.json /workspace/package.json

# ============================================
# Copy app
# ============================================
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
