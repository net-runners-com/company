const works = [
  {
    img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80',
    tag: '新築住宅',
    title: '越谷市 木造2階建て注文住宅',
    desc: '延床面積 132m² / 竣工 2025年',
  },
  {
    img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&q=80',
    tag: '商業施設',
    title: 'さいたま市 店舗兼事務所ビル',
    desc: '延床面積 240m² / 竣工 2024年',
  },
  {
    img: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&q=80',
    tag: 'リフォーム',
    title: '春日部市 築35年戸建てリノベ',
    desc: '全面改修・耐震補強 / 竣工 2025年',
  },
]

export default function Works() {
  return (
    <section id="works" className="works">
      <div className="container">
        <div className="sec-header">
          <div className="sec-label">Works</div>
          <h2 className="sec-title">施工実績</h2>
          <div className="sec-bar" />
          <p className="sec-desc">これまでに手がけた施工の一部をご紹介します。</p>
        </div>
        <div className="works-grid">
          {works.map((w, i) => (
            <div key={i} className="work-card">
              <div className="work-img">
                <img src={w.img} alt={w.title} loading="lazy" />
                <div className="work-img-overlay" />
              </div>
              <div className="work-body">
                <span className="work-tag">{w.tag}</span>
                <h4>{w.title}</h4>
                <p>{w.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
