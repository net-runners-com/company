import http from "node:http";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync, appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// .env 読み込み
const envPath = resolve(__dirname, ".env");
try {
  const envText = readFileSync(envPath, "utf-8");
  for (const line of envText.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...rest] = trimmed.split("=");
      process.env[key.trim()] ??= rest.join("=").trim();
    }
  }
} catch {}

const PORT = parseInt(process.env.PORT || "18789");
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const INBOX_DIR = resolve(__dirname, "inbox");
const MEDIA_DIR = resolve(INBOX_DIR, "media");
mkdirSync(INBOX_DIR, { recursive: true });
mkdirSync(MEDIA_DIR, { recursive: true });

function verifySignature(body, signature) {
  const hash = crypto
    .createHmac("SHA256", CHANNEL_SECRET)
    .update(body)
    .digest("base64");
  return hash === signature;
}

async function handleEvent(event) {
  console.log(`[${new Date().toISOString()}] Event: ${event.type}`, JSON.stringify(event).slice(0, 200));

  if (event.type !== "message") return;

  const userId = event.source?.userId || "unknown";
  const timestamp = new Date().toISOString();
  const msgType = event.message.type;

  // === テキストメッセージ ===
  if (msgType === "text") {
    const userMessage = event.message.text;
    console.log(`  Message from ${userId}: ${userMessage}`);

    const entry = JSON.stringify({ timestamp, userId, replyToken: event.replyToken, message: userMessage }) + "\n";
    appendFileSync(resolve(INBOX_DIR, "messages.jsonl"), entry);
    appendFileSync(resolve(INBOX_DIR, "latest.txt"), `[${timestamp}] ${userMessage}\n`);

    const queueEntry = JSON.stringify({ timestamp, userId, message: userMessage }) + "\n";
    appendFileSync(resolve(INBOX_DIR, "queue.jsonl"), queueEntry);
    console.log(`  📩 Queued for Claude Code`);
    return;
  }

  // === 画像メッセージ ===
  if (msgType === "image") {
    console.log(`  📷 Image from ${userId} (messageId: ${event.message.id})`);
    const mediaPath = await downloadContent(event.message.id, "jpg");
    if (mediaPath) {
      const queueEntry = JSON.stringify({
        timestamp, userId, type: "image", mediaPath, message: "[画像]",
      }) + "\n";
      appendFileSync(resolve(INBOX_DIR, "queue.jsonl"), queueEntry);
      appendFileSync(resolve(INBOX_DIR, "latest.txt"), `[${timestamp}] [画像] ${mediaPath}\n`);
      console.log(`  📩 Image queued: ${mediaPath}`);
    }
    return;
  }

  // === ファイルメッセージ ===
  if (msgType === "file") {
    const filename = event.message.fileName || "unknown";
    const ext = filename.split(".").pop() || "bin";
    console.log(`  📎 File from ${userId}: ${filename}`);
    const mediaPath = await downloadContent(event.message.id, ext);
    if (mediaPath) {
      const queueEntry = JSON.stringify({
        timestamp, userId, type: "file", mediaPath, originalFilename: filename, message: `[ファイル] ${filename}`,
      }) + "\n";
      appendFileSync(resolve(INBOX_DIR, "queue.jsonl"), queueEntry);
      appendFileSync(resolve(INBOX_DIR, "latest.txt"), `[${timestamp}] [ファイル] ${filename}\n`);
      console.log(`  📩 File queued: ${mediaPath}`);
    }
    return;
  }
}

// === LINE Content API からメディアをダウンロード ===
async function downloadContent(messageId, ext) {
  try {
    const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
    if (!res.ok) {
      console.error(`  ⚠ Content download failed: ${res.status}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15);
    const filename = `${ts}_${messageId}.${ext}`;
    const filepath = resolve(MEDIA_DIR, filename);
    writeFileSync(filepath, buf);
    console.log(`  💾 Saved: ${filepath} (${buf.length} bytes)`);
    return filepath;
  } catch (err) {
    console.error(`  ⚠ Download error:`, err.message);
    return null;
  }
}

async function pushMessage(userId, text) {
  const body = JSON.stringify({
    to: userId,
    messages: [{ type: "text", text }],
  });

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body,
  });

  if (!res.ok) {
    console.error(`  Push error: ${res.status} ${await res.text()}`);
  } else {
    console.log(`  ✅ Push sent: ${text.slice(0, 50)}`);
  }
}

async function replyMessage(replyToken, text) {
  const body = JSON.stringify({
    replyToken,
    messages: [{ type: "text", text }],
  });

  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body,
  });

  if (!res.ok) {
    console.error(`  Reply error: ${res.status} ${await res.text()}`);
  } else {
    console.log(`  Reply sent: ${text.slice(0, 50)}`);
  }
}

const server = http.createServer((req, res) => {
  // ヘルスチェック
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
    return;
  }

  // LINE Webhook
  if (req.method === "POST" && req.url === "/webhook") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      // 署名検証
      const signature = req.headers["x-line-signature"];
      if (!verifySignature(body, signature)) {
        console.error("Invalid signature");
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      // 200を即返す（LINEの要件）
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));

      // イベント処理
      try {
        const data = JSON.parse(body);
        for (const event of data.events || []) {
          await handleEvent(event);
        }
      } catch (err) {
        console.error("Event handling error:", err);
      }
    });
    return;
  }

  // それ以外
  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`LINE Webhook server running on port ${PORT}`);
  console.log(`Webhook URL: POST /webhook`);
});
