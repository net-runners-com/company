export interface Env {
  PREVIEWS: KVNamespace;
}

const TTL = 86400; // 24時間

// ─── Markdown → HTML 変換 ───
function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inTable = false;
  let isFirstTableRow = true;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // テーブル行判定
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim());

      // セパレーター行（|---|---|）はスキップ
      if (cells.every(c => /^[-:]+$/.test(c))) continue;

      if (!inTable) {
        out.push('<table>');
        inTable = true;
        isFirstTableRow = true;
      }

      const tag = isFirstTableRow ? 'th' : 'td';
      out.push('<tr>' + cells.map(c => `<${tag}>${inlineFormat(c)}</${tag}>`).join('') + '</tr>');
      isFirstTableRow = false;
      continue;
    }

    // テーブル終了
    if (inTable) {
      out.push('</table>');
      inTable = false;
    }

    // 見出し
    if (line.startsWith('### ')) { out.push(`<h3>${inlineFormat(line.slice(4))}</h3>`); continue; }
    if (line.startsWith('## ')) { out.push(`<h2>${inlineFormat(line.slice(3))}</h2>`); continue; }
    if (line.startsWith('# ')) { out.push(`<h1>${inlineFormat(line.slice(2))}</h1>`); continue; }
    // 引用
    if (line.startsWith('> ')) { out.push(`<blockquote>${inlineFormat(line.slice(2))}</blockquote>`); continue; }
    // リスト
    if (line.startsWith('- ')) { out.push(`<li>${inlineFormat(line.slice(2))}</li>`); continue; }
    // 水平線
    if (/^-{3,}$/.test(line.trim())) { out.push('<hr>'); continue; }
    // ハッシュタグ行
    if (/^#\S/.test(line.trim())) { out.push(`<div class="tags">${line}</div>`); continue; }
    // 空行
    if (line.trim() === '') { out.push('<br>'); continue; }
    // 通常
    out.push(`<p>${inlineFormat(line)}</p>`);
  }
  if (inTable) out.push('</table>');

  // liをulで囲む
  let result = out.join('\n');
  result = result.replace(/(<li>.*?<\/li>\n?)+/g, (m) => '<ul>' + m + '</ul>');
  return result;
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

// ─── note風HTMLテンプレート ───
function renderArticle(title: string, bodyHtml: string, createdAt: string): string {
  return `<!DOCTYPE html>
<html lang="ja"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title} — プレビュー</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans JP',sans-serif;background:#f8f8f6;color:#1a1a2a;line-height:2;-webkit-font-smoothing:antialiased}
.banner{background:#c57d12;color:#fff;text-align:center;padding:8px;font-size:13px;font-weight:700;position:sticky;top:0;z-index:10}
.container{max-width:680px;margin:0 auto;background:#fff;min-height:100vh;padding:40px 28px 60px}
h1.title{font-family:'Noto Serif JP',serif;font-size:26px;font-weight:700;line-height:1.5;margin-bottom:24px}
.meta{color:#888;font-size:13px;margin-bottom:32px;padding-bottom:16px;border-bottom:1px solid #eee}
.body h2{font-family:'Noto Serif JP',serif;font-size:20px;font-weight:700;margin:36px 0 16px;padding-bottom:8px;border-bottom:2px solid #f0f0ec}
.body h3{font-size:17px;font-weight:700;margin:28px 0 12px}
.body p{margin:0 0 16px;font-size:16px}
.body strong{font-weight:700}
.body blockquote{border-left:3px solid #c57d12;padding:8px 16px;margin:20px 0;color:#555;background:#faf8f4;border-radius:0 6px 6px 0}
.body ul{margin:12px 0;padding-left:24px;list-style:disc}
.body li{margin:4px 0;font-size:16px}
.body hr{border:none;border-top:1px solid #eee;margin:32px 0}
.body .tags{color:#c57d12;font-size:14px;margin-top:32px}
.body table{width:100%;border-collapse:collapse;margin:20px 0;font-size:14px}
.body th{background:#1a2540;color:#e8ecf2;padding:10px 12px;text-align:left;font-weight:700;white-space:nowrap}
.body td{padding:10px 12px;border-bottom:1px solid #eee;color:#333}
.body tr:hover td{background:#f8f8f6}
@media(max-width:600px){.container{padding:24px 16px 40px}h1.title{font-size:22px}}
</style></head><body>
<div class="banner">📝 プレビュー（24時間で自動削除）</div>
<div class="container">
  <h1 class="title">${title}</h1>
  <div class="meta">プレビュー作成: ${createdAt}</div>
  <div class="body">${bodyHtml}</div>
</div></body></html>`;
}

// ─── ファイルダウンロードページ ───
function renderFilePage(filename: string, size: string, createdAt: string, downloadUrl: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const icon: Record<string, string> = {
    pdf: '📄', pptx: '📊', xlsx: '📈', docx: '📝', png: '🖼️', jpg: '🖼️', zip: '📦',
  };
  const emoji = icon[ext] || '📎';

  return `<!DOCTYPE html>
<html lang="ja"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${filename} — プレビュー</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans JP',sans-serif;background:#0c1222;color:#e8ecf2;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center}
.banner{background:#c57d12;color:#fff;text-align:center;padding:8px;font-size:13px;font-weight:700;position:fixed;top:0;left:0;right:0;z-index:10}
.card{background:#1a2540;border:1px solid #2a3a5c;border-radius:16px;padding:40px;max-width:420px;width:90%;text-align:center}
.emoji{font-size:64px;margin-bottom:16px}
.filename{font-size:20px;font-weight:700;margin-bottom:8px;word-break:break-all}
.info{color:#8b9bb5;font-size:13px;margin-bottom:24px}
.dl-btn{display:inline-block;background:#c57d12;color:#fff;padding:14px 32px;border-radius:10px;font-size:16px;font-weight:700;text-decoration:none;transition:background 0.2s}
.dl-btn:hover{background:#e8a030}
</style></head><body>
<div class="banner">📎 ファイルプレビュー（24時間で自動削除）</div>
<div class="card">
  <div class="emoji">${emoji}</div>
  <div class="filename">${filename}</div>
  <div class="info">${size} ・ ${createdAt}</div>
  <a href="${downloadUrl}" class="dl-btn">ダウンロード</a>
</div></body></html>`;
}

// ─── Office Viewer ページ ───
function renderOfficePage(filename: string, size: string, viewerUrl: string, downloadUrl: string): string {
  return `<!DOCTYPE html>
<html lang="ja"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${filename} — プレビュー</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0c1222;font-family:sans-serif;display:flex;flex-direction:column;height:100vh}
.bar{background:#1a2540;padding:8px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #2a3a5c}
.bar-left{display:flex;align-items:center;gap:10px}
.bar-title{color:#e8ecf2;font-size:14px;font-weight:700}
.bar-size{color:#8b9bb5;font-size:12px}
.bar-badge{background:#c57d12;color:#fff;font-size:11px;padding:2px 8px;border-radius:4px;font-weight:700}
.dl-btn{background:#2a3a5c;color:#e8ecf2;border:none;padding:6px 14px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none}
.dl-btn:hover{background:#3a4f6f}
iframe{flex:1;border:none;width:100%}
</style></head><body>
<div class="bar">
  <div class="bar-left">
    <span class="bar-badge">プレビュー</span>
    <span class="bar-title">${filename}</span>
    <span class="bar-size">${size}</span>
  </div>
  <a href="${downloadUrl}" class="dl-btn">⬇ ダウンロード</a>
</div>
<iframe src="${viewerUrl}"></iframe>
</body></html>`;
}

// ─── スライドビューア ───
function renderSlidesPage(title: string, slidesHtml: string): string {
  return `<!DOCTYPE html>
<html lang="ja"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title} — スライドプレビュー</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0c1222;font-family:sans-serif;color:#e8ecf2}
.banner{background:#c57d12;color:#fff;text-align:center;padding:8px;font-size:13px;font-weight:700;position:sticky;top:0;z-index:10}
.title{text-align:center;padding:20px;font-size:20px;font-weight:700}
.slides{max-width:960px;margin:0 auto;padding:0 16px 40px;display:flex;flex-direction:column;gap:20px}
.slide{background:#1a2540;border-radius:12px;padding:16px;position:relative}
.slide svg{width:100%;height:auto;display:block;border-radius:8px}
.slide-num{position:absolute;top:8px;right:12px;background:rgba(0,0,0,0.6);color:#fff;font-size:11px;padding:2px 8px;border-radius:4px;font-weight:700}
</style></head><body>
<div class="banner">📊 スライドプレビュー（24時間で自動削除）</div>
<div class="title">${title}</div>
<div class="slides">${slidesHtml}</div>
</body></html>`;
}

// ─── ファイルサイズ表示 ───
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ─── Worker ───
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    // ─── POST /preview — Markdown記事 ───
    if (request.method === 'POST' && url.pathname === '/preview') {
      try {
        const { title, markdown } = await request.json() as { title: string; markdown: string };
        if (!title || !markdown) {
          return new Response(JSON.stringify({ error: 'title and markdown required' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...cors },
          });
        }
        const id = crypto.randomUUID();
        await env.PREVIEWS.put(id, JSON.stringify({
          type: 'markdown', title, markdown, createdAt: new Date().toISOString(),
        }), { expirationTtl: TTL });

        return new Response(JSON.stringify({ url: `${url.origin}/${id}`, id }), {
          headers: { 'Content-Type': 'application/json', ...cors },
        });
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...cors },
        });
      }
    }

    // ─── POST /upload — バイナリファイル（PDF, PPTX等） ───
    if (request.method === 'POST' && url.pathname === '/upload') {
      try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        if (!file) {
          return new Response(JSON.stringify({ error: 'file field required' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...cors },
          });
        }

        const id = crypto.randomUUID();
        const arrayBuf = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);

        // メタデータ
        const meta = JSON.stringify({
          type: 'file',
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          size: bytes.length,
          createdAt: new Date().toISOString(),
        });
        await env.PREVIEWS.put(`${id}:meta`, meta, { expirationTtl: TTL });

        // ファイル本体（KV valueの上限25MB）
        await env.PREVIEWS.put(`${id}:data`, arrayBuf, { expirationTtl: TTL });

        return new Response(JSON.stringify({
          url: `${url.origin}/${id}`,
          download: `${url.origin}/${id}/download`,
          filename: file.name,
          size: formatSize(bytes.length),
          id,
        }), {
          headers: { 'Content-Type': 'application/json', ...cors },
        });
      } catch {
        return new Response(JSON.stringify({ error: 'Upload failed' }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...cors },
        });
      }
    }

    // ─── GET /{id}/download — ファイルダウンロード ───
    const downloadMatch = url.pathname.match(/^\/([a-f0-9-]{36})\/download$/);
    if (downloadMatch) {
      const id = downloadMatch[1];
      const metaRaw = await env.PREVIEWS.get(`${id}:meta`);
      if (!metaRaw) {
        return new Response('Not found', { status: 404 });
      }
      const meta = JSON.parse(metaRaw);
      const data = await env.PREVIEWS.get(`${id}:data`, { type: 'arrayBuffer' });
      if (!data) {
        return new Response('Not found', { status: 404 });
      }
      return new Response(data, {
        headers: {
          'Content-Type': meta.contentType,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(meta.filename)}"`,
          ...cors,
        },
      });
    }

    // ─── GET /{id} — プレビュー表示 ───
    const idMatch = url.pathname.match(/^\/([a-f0-9-]{36})$/);
    if (idMatch) {
      const id = idMatch[1];

      // まずMarkdownプレビューを確認
      const mdData = await env.PREVIEWS.get(id);
      if (mdData) {
        const parsed = JSON.parse(mdData);
        if (parsed.type === 'markdown') {
          // PPTX SVGスライド
          if (parsed.markdown.startsWith('__PPTX_HTML__') || url.searchParams.get('type') === 'pptx') {
            const slidesHtml = parsed.markdown.replace('__PPTX_HTML__', '');
            return new Response(renderSlidesPage(parsed.title, slidesHtml), {
              headers: { 'Content-Type': 'text/html;charset=utf-8' },
            });
          }
          const bodyHtml = markdownToHtml(parsed.markdown);
          const date = new Date(parsed.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
          return new Response(renderArticle(parsed.title, bodyHtml, date), {
            headers: { 'Content-Type': 'text/html;charset=utf-8' },
          });
        }
      }

      // ファイルプレビュー
      const metaRaw = await env.PREVIEWS.get(`${id}:meta`);
      if (metaRaw) {
        const meta = JSON.parse(metaRaw);
        const ct = (meta.contentType || '').toLowerCase();

        // PDF・画像はブラウザ内で直接表示
        if (ct === 'application/pdf' || ct.startsWith('image/')) {
          const data = await env.PREVIEWS.get(`${id}:data`, { type: 'arrayBuffer' });
          if (data) {
            return new Response(data, {
              headers: {
                'Content-Type': meta.contentType,
                'Content-Disposition': `inline; filename="${encodeURIComponent(meta.filename)}"`,
                ...cors,
              },
            });
          }
        }

        // その他のファイルはダウンロードページ
        const date = new Date(meta.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
        return new Response(
          renderFilePage(meta.filename, formatSize(meta.size), date, `${url.origin}/${id}/download`),
          { headers: { 'Content-Type': 'text/html;charset=utf-8' } }
        );
      }

      return new Response(
        '<html><body style="font-family:sans-serif;text-align:center;padding:60px;color:#888"><h2>プレビューが見つかりません</h2><p>期限切れか、URLが間違っています。</p></body></html>',
        { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } }
      );
    }

    return new Response('article-preview worker is running', {
      headers: { 'Content-Type': 'text/plain' },
    });
  },
};
