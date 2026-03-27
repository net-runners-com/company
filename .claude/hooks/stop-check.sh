#!/bin/bash
cat | node -e "
  const fs = require('fs');
  const FLAG = '.claude/hooks/.context-warned';
  let d = '';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(d);
      const tp = input.transcript_path;
      if (!tp || !fs.existsSync(tp)) process.exit(0);

      const content = fs.readFileSync(tp, 'utf8');

      const boundaryCount =
        (content.match(/\"compact_boundary\"/g) || []).length;

      if (fs.existsSync(FLAG)) {
        const lastWarned =
          parseInt(fs.readFileSync(FLAG, 'utf8').trim());
        if (boundaryCount === lastWarned) process.exit(0);
      }

      const marker = '\"compact_boundary\"';
      const lastIdx = content.lastIndexOf(marker);
      let cycleStart = 0;
      if (lastIdx !== -1) {
        const eol = content.indexOf('\n', lastIdx);
        cycleStart = eol !== -1 ? eol + 1 : content.length;
      }
      const currentKB =
        Buffer.byteLength(content.slice(cycleStart), 'utf8') / 1024;

      if (currentKB < 800) process.exit(0);

      if (fs.existsSync('HANDOFF.md')) {
        const ageMin =
          (Date.now() - fs.statSync('HANDOFF.md').mtimeMs) / 60000;
        if (ageMin <= 10) process.exit(0);
      }

      fs.mkdirSync('.claude/hooks', { recursive: true });
      fs.writeFileSync(FLAG, String(boundaryCount));

      console.log(JSON.stringify({
        decision: 'block',
        reason: 'コンテキストが約80%に達しました（現サイクル: '
          + Math.round(currentKB) + 'KB）。'
          + '/handoff でセッションを引き継いでください。'
      }));
    } catch(e) {}
  });
"
