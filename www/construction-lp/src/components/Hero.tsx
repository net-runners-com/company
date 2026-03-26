export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-bg" />
      <div className="hero-content">
        <div className="hero-badge">SINCE 2005 — 地域と共に20年</div>
        <h1>
          確かな技術と<br />
          <span className="accent">誠実な仕事</span>で、<br />
          街をつくる。
        </h1>
        <p className="hero-desc">
          地域に根ざした建築会社として、住宅・商業施設・リフォームまで
          幅広い施工に対応。お客様の想いを、確かな技術で形にします。
        </p>
        <div className="hero-btns">
          <a href="#contact" className="btn btn-primary">
            無料相談・お見積り
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
          <a href="#works" className="btn btn-outline">施工実績を見る</a>
        </div>
        <div className="hero-stats">
          <div>
            <div className="hero-stat-num">500<span>+</span></div>
            <div className="hero-stat-label">累計施工実績</div>
          </div>
          <div>
            <div className="hero-stat-num">20<span>年</span></div>
            <div className="hero-stat-label">業界経験</div>
          </div>
          <div>
            <div className="hero-stat-num">98<span>%</span></div>
            <div className="hero-stat-label">顧客満足度</div>
          </div>
          <div>
            <div className="hero-stat-num">24<span>h</span></div>
            <div className="hero-stat-label">緊急対応</div>
          </div>
        </div>
      </div>
    </section>
  )
}
