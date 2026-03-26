import http from "node:http";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync, appendFileSync, mkdirSync } from "node:fs";
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
mkdirSync(INBOX_DIR, { recursive: true });

function verifySignature(body, signature) {
  const hash = crypto
    .createHmac("SHA256", CHANNEL_SECRET)
    .update(body)
    .digest("base64");
  return hash === signature;
}

async function handleEvent(event) {
  console.log(`[${new Date().toISOString()}] Event: ${event.type}`, JSON.stringify(event).slice(0, 200));

  if (event.type === "message" && event.message.type === "text") {
    const userMessage = event.message.text;
    const replyToken = event.replyToken;
    const userId = event.source?.userId || "unknown";
    const timestamp = new Date().toISOString();

    console.log(`  Message from ${userId}: ${userMessage}`);

    // inboxに保存
    const entry = JSON.stringify({ timestamp, userId, replyToken, message: userMessage }) + "\n";
    appendFileSync(resolve(INBOX_DIR, "messages.jsonl"), entry);

    // 最新メッセージを別ファイルにも保存
    appendFileSync(resolve(INBOX_DIR, "latest.txt"), `[${timestamp}] ${userMessage}\n`);

    // 未処理キューに追加（Claude Codeが監視→処理→返信）
    const queueEntry = JSON.stringify({ timestamp, userId, message: userMessage }) + "\n";
    appendFileSync(resolve(INBOX_DIR, "queue.jsonl"), queueEntry);
    console.log(`  📩 Queued for Claude Code`);
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
