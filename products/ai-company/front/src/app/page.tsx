"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">E</span>
            </div>
            <span className="font-bold text-lg text-gray-900">Eureka</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-4 py-2">
              ログイン
            </Link>
            <Link href="/signup" className="text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 px-5 py-2 rounded-lg transition-colors">
              無料で始める
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-violet-50 text-violet-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse" />
            AI社員があなたの会社を動かす
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight">
            一人で会社を
            <br />
            <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">回せる時代。</span>
          </h1>
          <p className="text-lg text-gray-500 mt-6 max-w-2xl mx-auto leading-relaxed">
            Eurekaは、AI社員を作って指示するだけで、営業・経理・マーケティング・開発まで
            すべて自動で回るバーチャルオフィスです。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-10">
            <Link href="/signup" className="inline-flex items-center justify-center px-8 py-3.5 text-sm font-semibold text-white bg-violet-600 rounded-xl hover:bg-violet-700 transition-all shadow-lg shadow-violet-600/20">
              無料で始める
              <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
            <a href="#features" className="inline-flex items-center justify-center px-8 py-3.5 text-sm font-semibold text-gray-700 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all">
              詳しく見る
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">あなたの会社に、AI社員を。</h2>
            <p className="text-gray-500 mt-3">必要な人材をAIで即座に採用。24時間365日稼働。</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", title: "AI社員を自由に作成", desc: "名前・役職・性格・スキルを設定するだけ。秘書、営業、経理、エンジニア。何人でも。" },
              { icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", title: "チャットで指示するだけ", desc: "「記事書いて」「見積もり作って」「SNS投稿して」。自然言語で指示すれば、あとはAI社員が実行。" },
              { icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", title: "パイプラインで自動化", desc: "案件を入力すれば、見積→要件定義→実装→納品まで自動でパイプラインが組まれて順次実行。" },
              { icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", title: "経理も自動", desc: "請求書アップロード→自動仕訳。見積書・納品書のPDF生成。月次の仕訳帳・経費帳も管理。" },
              { icon: "M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z", title: "SNS自動運用", desc: "note.com、Threads、LINE。競合分析→記事生成→投稿まで全自動。スケジュール投稿も対応。" },
              { icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", title: "安全なクラウド環境", desc: "社員ごとに独立したコンテナ。データはすべて暗号化。あなた以外アクセスできません。" },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg hover:border-violet-100 transition-all duration-300">
                <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={f.icon} /></svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">3ステップで始められる</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "アカウント作成", desc: "メールアドレスで30秒で登録。クレジットカード不要。" },
              { step: "2", title: "AI社員を作る", desc: "秘書・営業・経理から選ぶだけ。名前と性格をカスタマイズ。" },
              { step: "3", title: "指示を出す", desc: "チャットで「これやって」と言うだけ。あとはAIが実行します。" },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 bg-violet-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-lg font-bold">
                  {s.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gradient-to-br from-violet-600 to-indigo-700">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">今すぐ、あなたの会社を始めよう。</h2>
          <p className="text-violet-200 mb-8">無料プランで社員2人まで。クレジットカード不要。</p>
          <Link href="/signup" className="inline-flex items-center justify-center px-8 py-3.5 text-sm font-semibold text-violet-700 bg-white rounded-xl hover:bg-violet-50 transition-all shadow-lg">
            無料で始める
            <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-violet-600 rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-xs">E</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">Eureka</span>
          </div>
          <p className="text-xs text-gray-400">&copy; 2026 Eureka. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
