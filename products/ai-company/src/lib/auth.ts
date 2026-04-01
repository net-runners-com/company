import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";

// DB接続ヘルパー
export async function query(sql: string, params: unknown[] = []) {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query(sql, params);
    return result.rows;
  } finally {
    await pool.end();
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "openid email profile",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        name: { label: "Name", type: "text" },
        action: { label: "Action", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const { email, password, name, action } = credentials;

        if (action === "signup") {
          const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
          if (existing.length > 0) return null;
          const hash = await bcrypt.hash(password, 10);
          const rows = await query(
            "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name",
            [email, hash, name || ""]
          );
          if (rows.length === 0) return null;
          return { id: rows[0].id, email: rows[0].email, name: rows[0].name };
        }

        const rows = await query("SELECT id, email, name, password_hash FROM users WHERE email = $1", [email]);
        if (rows.length === 0) return null;
        const user = rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account, credentials }) {
      // 新規ユーザー作成後、秘書エージェントを自動登録
      const isNewUser = (credentials as Record<string, string> | undefined)?.action === "signup"
        || (account?.provider === "google");

      if (account?.provider === "google") {
        const email = user.email;
        if (!email) return false;

        const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
        let userId: string;
        if (existing.length > 0) {
          userId = existing[0].id;
        } else {
          const rows = await query(
            "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id",
            [email, "__google_oauth__", user.name || ""]
          );
          userId = rows[0].id;
        }
        user.id = userId;
      }

      // 新規ユーザーの場合、初期社員を自動登録
      if (isNewUser && user.id) {
        const workerUrl = process.env.WORKER_URL || "http://localhost:8000";
        const initialEmployees = [
          { id: "emp-1", name: "さくら", role: "秘書", department: "総務部", tone: "やさしい敬語", skills: ["スケジュール管理", "メモ整理", "相談相手"] },
          { id: "emp-2", name: "りく", role: "営業", department: "営業部", tone: "元気で前向き", skills: ["メール作成", "提案書", "フォローアップ"] },
          { id: "emp-3", name: "あおい", role: "経理", department: "経理部", tone: "丁寧で正確", skills: ["経費処理", "仕訳入力", "請求書発行"] },
        ];
        for (const emp of initialEmployees) {
          try {
            await fetch(`${workerUrl}/employees`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(emp),
            });
          } catch {
            // Worker未起動でも認証は通す
          }
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET || "dev-secret-change-in-production",
};
