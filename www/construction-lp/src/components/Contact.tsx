export default function Contact() {
  return (
    <section id="contact" className="contact">
      <div className="container">
        <div className="sec-header" style={{ textAlign: 'center' }}>
          <div className="sec-label">Contact</div>
          <h2 className="sec-title">お問い合わせ</h2>
          <div className="sec-bar" style={{ margin: '1rem auto' }} />
        </div>
        <div className="contact-box">
          <h3>まずはお気軽にご相談ください</h3>
          <p>お見積り・ご相談は無料です。お電話またはメールにてお問い合わせください。</p>
          <div className="contact-grid">
            <div className="contact-item">
              <div className="label">TEL</div>
              <div className="value">00-0000-0000</div>
            </div>
            <div className="contact-item">
              <div className="label">EMAIL</div>
              <div className="value">info@example.com</div>
            </div>
            <div className="contact-item">
              <div className="label">受付時間</div>
              <div className="value">平日 9:00〜18:00</div>
            </div>
          </div>
          <a href="mailto:info@example.com" className="btn btn-primary" style={{ position: 'relative' }}>
            メールで問い合わせる
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        </div>
      </div>
    </section>
  )
}
