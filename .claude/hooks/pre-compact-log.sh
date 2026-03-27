#!/bin/bash
mkdir -p .claude/logs
echo "[$(date -Iseconds)] Auto-compaction triggered. Consider running /handoff soon." >> .claude/logs/compaction.log
