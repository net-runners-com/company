const strengths = [
  { icon: '\u{1F3C5}', title: '確かな施工品質', desc: '一級建築士を含む熟練職人チームが担当。品質管理を徹底し、長持ちする建物をつくります。' },
  { icon: '\u{1F4AC}', title: '丁寧なヒアリング', desc: 'お客様の要望を細かく伺い、予算・スケジュール・デザインを一緒に考えます。' },
  { icon: '\u{1F4CD}', title: '地域密着20年', desc: '地元を知り尽くしたスタッフが対応。緊急の修繕にもスピーディーに駆けつけます。' },
  { icon: '\u{1F527}', title: 'アフターフォロー', desc: '引き渡し後10年保証。定期点検・メンテナンスで施工後の不安を残しません。' },
]

export default function Strengths() {
  return (
    <section id="strengths" className="strengths">
      <div className="container">
        <div className="sec-header">
          <div className="sec-label">Our Strengths</div>
          <h2 className="sec-title">選ばれる理由</h2>
          <div className="sec-bar" />
          <p className="sec-desc">お客様から長く信頼いただける理由があります。</p>
        </div>
        <div className="strength-grid">
          {strengths.map((s, i) => (
            <div key={i} className="strength-item">
              <div className="strength-icon">{s.icon}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
