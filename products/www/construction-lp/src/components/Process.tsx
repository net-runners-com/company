const steps = [
  { num: '01', title: 'お問い合わせ', desc: 'お電話・メール・LINEでお気軽にご連絡ください。' },
  { num: '02', title: '現地調査・ヒアリング', desc: '現場を確認し、ご要望を詳しくお伺いします。' },
  { num: '03', title: 'お見積り・ご提案', desc: '最適なプランと明朗な見積書をご提示します。' },
  { num: '04', title: '着工・施工', desc: '安全管理を徹底し、丁寧に施工を進めます。' },
  { num: '05', title: 'お引き渡し', desc: '完了検査後、お客様に引き渡し。保証書を発行します。' },
]

export default function Process() {
  return (
    <section id="process" className="process">
      <div className="container">
        <div className="sec-header">
          <div className="sec-label">Flow</div>
          <h2 className="sec-title">ご依頼の流れ</h2>
          <div className="sec-bar" />
          <p className="sec-desc">お問い合わせからお引き渡しまで、丁寧にサポートします。</p>
        </div>
        <div className="process-steps">
          {steps.map((s, i) => (
            <div key={i} className="process-step">
              <div className="process-step-num">{s.num}</div>
              <h4>{s.title}</h4>
              <p>{s.desc}</p>
              {i < steps.length - 1 && (
                <span className="process-step-arrow">&#x25B6;</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
