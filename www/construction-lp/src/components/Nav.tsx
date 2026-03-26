import { useState, useEffect } from 'react'

const links = [
  { href: '#services', label: '事業内容' },
  { href: '#works', label: '施工実績' },
  { href: '#strengths', label: '強み' },
  { href: '#process', label: 'ご依頼の流れ' },
  { href: '#about', label: '会社概要' },
]

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const close = () => setMenuOpen(false)

  return (
    <>
      <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-inner">
          <a href="#" className="logo" onClick={close}>
            <span className="logo-jp">株式会社サンプル</span>
            <span className="logo-en">Sample Construction Co., Ltd.</span>
          </a>
          <div className="nav-links">
            {links.map(l => (
              <a key={l.href} href={l.href}>{l.label}</a>
            ))}
            <a href="#contact" className="nav-cta-btn">お問い合わせ</a>
          </div>
          <button
            className={`hamburger ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="メニュー"
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>
      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
        {links.map(l => (
          <a key={l.href} href={l.href} onClick={close}>{l.label}</a>
        ))}
        <a href="#contact" className="nav-cta-btn" onClick={close}>お問い合わせ</a>
      </div>
    </>
  )
}
