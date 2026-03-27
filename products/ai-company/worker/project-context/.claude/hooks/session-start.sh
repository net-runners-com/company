#!/bin/bash
rm -f .claude/hooks/.context-warned

HANDOFF="HANDOFF.md"
if [ -f "$HANDOFF" ]; then
  echo "## Previous Session Handoff"
  echo ""
  cat "$HANDOFF"
fi
