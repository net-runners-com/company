export default function Message() {
  return (
    <section className="message">
      <div className="container">
        <div className="sec-header">
          <div className="sec-label">Message</div>
          <h2 className="sec-title">代表メッセージ</h2>
          <div className="sec-bar" />
        </div>
        <div className="message-inner">
          <div className="message-img">
            <img
              src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=500&q=80"
              alt="代表者"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <div className="message-text">
            <blockquote>
              建物は、そこに暮らす人の<br />
              人生そのものです。
            </blockquote>
            <p>
              私たちは創業以来、「丁寧な仕事」を何よりも大切にしてきました。
              お客様一人ひとりの想いに耳を傾け、確かな技術と経験で
              期待を超える建物をお届けすること。それが私たちの使命です。
            </p>
            <p>
              地域に根ざした建築会社として、施工後のアフターフォローまで
              責任を持って対応します。どんな小さなお悩みでも、
              お気軽にご相談ください。
            </p>
            <div className="message-sign">
              〇〇 〇〇
              <span>代表取締役</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
