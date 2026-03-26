const services = [
  {
    num: '01',
    title: '新築工事',
    desc: '注文住宅・店舗・オフィスビルなど、ゼロから理想の建物をお客様と共に設計・建築します。構造計算から内装仕上げまで一貫対応。',
  },
  {
    num: '02',
    title: 'リフォーム・改修',
    desc: '既存建物の価値を最大化するリノベーション。内装・外装・耐震補強・バリアフリー化など、暮らしの質を高めます。',
  },
  {
    num: '03',
    title: '外構・エクステリア',
    desc: '駐車場・フェンス・庭・アプローチなど、建物の外まわりを美しく機能的にデザイン・施工します。',
  },
  {
    num: '04',
    title: 'アフターサポート',
    desc: '施工後の定期点検・メンテナンス・修繕まで長期的にお付き合い。建てた後も安心をお届けします。',
  },
]

export default function Services() {
  return (
    <section id="services" className="services">
      <div className="container">
        <div className="sec-header">
          <div className="sec-label">Services</div>
          <h2 className="sec-title">事業内容</h2>
          <div className="sec-bar" />
          <p className="sec-desc">新築から改修まで、建築に関わるあらゆるニーズにお応えします。</p>
        </div>
        <div className="service-grid">
          {services.map(s => (
            <div key={s.num} className="service-card">
              <div className="service-num">{s.num}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
