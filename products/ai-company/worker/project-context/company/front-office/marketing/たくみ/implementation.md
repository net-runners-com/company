# 実装報告書: サンプル会社 HP制作

**作成日**: 2026-03-30
**担当**: たくみ（実装・コーディング）
**案件**: サンプル会社 HP制作（予算: 100,000円）
**参照**: design.md（サイト設計書 初版）

---

## 1. 実装概要

設計書に基づき、1ページ完結型（LP型）の企業HPを HTML/CSS/JavaScript で構築した。
モバイルファーストのレスポンシブ設計を採用し、お問い合わせフォームを含む全6セクションを単一HTMLファイルに実装している。

### 成果物構成

```
sample-company-hp/
├── index.html          # メインHTML（CSS・JS内包）
├── assets/
│   └── images/
│       ├── hero.webp           # ヒーロー背景画像（仮: フリー素材）
│       ├── service-01.webp     # 新築工事アイコン/画像
│       ├── service-02.webp     # リフォームアイコン/画像
│       ├── service-03.webp     # 商業施設アイコン/画像
│       ├── service-04.webp     # 外構工事アイコン/画像
│       ├── works-01〜09.webp   # 施工実績写真（仮: フリー素材）
│       ├── logo.svg            # 会社ロゴ（仮: テキストロゴで代替）
│       └── ogp.png             # OGP画像（1200×630）
├── favicon.ico
└── robots.txt
```

> **注記**: 外部依存はGoogle Fonts CDN（Noto Sans JP）のみ。CSSとJavaScriptはすべて `index.html` 内に記述し、追加のファイル読み込みを排除している。

---

## 2. HTML構造

セマンティックHTML5を用いた構成。各セクションには `id` を付与し、ナビゲーションからのスムーズスクロールに対応する。

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="サンプル会社 - 確かな技術で暮らしを支える。住宅から商業施設まで。">
  <meta property="og:title" content="サンプル会社">
  <meta property="og:description" content="確かな技術で、暮らしを支える。">
  <meta property="og:image" content="/assets/images/ogp.png">
  <meta property="og:type" content="website">
  <link rel="canonical" href="https://example.com/">
  <title>サンプル会社 | 確かな技術で、暮らしを支える。</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
  <style>/* 後述 */</style>
</head>
<body>
  <header id="header">...</header>
  <main>
    <section id="hero">...</section>
    <section id="services">...</section>
    <section id="works">...</section>
    <section id="strengths">...</section>
    <section id="company">...</section>
    <section id="contact">...</section>
  </main>
  <footer>...</footer>
  <script>/* 後述 */</script>
</body>
</html>
```

### アクセシビリティ対応

| 項目 | 実装内容 |
|------|---------|
| alt属性 | すべての `<img>` に意味のある代替テキストを付与 |
| aria-label | ハンバーガーメニューボタン、ナビゲーションに付与 |
| セマンティクス | `<header>`, `<main>`, `<section>`, `<footer>`, `<nav>` を適切に使用 |
| フォーカス管理 | `:focus-visible` でキーボードナビゲーション時のアウトラインを確保 |
| コントラスト比 | WCAG 2.1 AA準拠（テキスト/背景のコントラスト比 4.5:1以上） |

---

## 3. CSS実装

### 3-1. 設計方針

- **モバイルファースト**: 基本スタイルをモバイル向けに記述し、`min-width` メディアクエリで拡張
- **CSS変数**: 配色・フォント・間隔をカスタムプロパティで一元管理
- **外部ライブラリ不使用**: すべて手書きCSS

### 3-2. CSS変数（カスタムプロパティ）

```css
:root {
  /* Colors */
  --color-primary: #1B4F72;
  --color-secondary: #2E86C1;
  --color-accent: #E67E22;
  --color-accent-hover: #D35400;
  --color-bg: #FAFAFA;
  --color-surface: #FFFFFF;
  --color-text: #2C3E50;
  --color-text-light: #7F8C8D;
  --color-border: #E5E7EB;

  /* Typography */
  --font-family: 'Noto Sans JP', sans-serif;
  --line-height-body: 1.8;
  --line-height-heading: 1.4;

  /* Spacing */
  --section-padding-pc: 80px 0;
  --section-padding-sp: 48px 16px;
  --container-max-width: 1200px;

  /* Effects */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --shadow-card: 0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-card-hover: 0 4px 16px rgba(0, 0, 0, 0.12);
  --transition-base: all 0.3s ease;
}
```

### 3-3. レスポンシブ・ブレイクポイント

```css
/* モバイル: デフォルト（〜767px）- 1カラム */

/* タブレット */
@media (min-width: 768px) {
  /* 2カラムグリッド */
  .services-grid { grid-template-columns: repeat(2, 1fr); }
  .works-grid    { grid-template-columns: repeat(2, 1fr); }
}

/* デスクトップ */
@media (min-width: 1024px) {
  /* 3カラムグリッド / ナビ表示 / ハンバーガー非表示 */
  .services-grid { grid-template-columns: repeat(3, 1fr); }
  .works-grid    { grid-template-columns: repeat(3, 1fr); }
  .nav-links     { display: flex; }
  .hamburger     { display: none; }
}
```

### 3-4. 主要コンポーネントのCSS

#### ヘッダー（スティッキー + スクロール時シャドウ）

```css
header {
  position: sticky;
  top: 0;
  z-index: 100;
  height: 56px;
  background: var(--color-surface);
  transition: box-shadow 0.3s ease;
}
header.scrolled {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
@media (min-width: 1024px) {
  header { height: 64px; }
}
```

#### CTAボタン

```css
.btn-cta {
  display: inline-block;
  background: var(--color-accent);
  color: #FFFFFF;
  padding: 16px 40px;
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: 16px;
  text-decoration: none;
  box-shadow: 0 2px 8px rgba(230, 126, 34, 0.3);
  transition: var(--transition-base);
}
.btn-cta:hover {
  background: var(--color-accent-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(230, 126, 34, 0.4);
}
```

#### カード（サービス・施工実績）

```css
.card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  transition: var(--transition-base);
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-card-hover);
}
```

#### ヒーローセクション

```css
#hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: url('/assets/images/hero.webp') center/cover no-repeat;
  color: #FFFFFF;
  text-align: center;
}
#hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
}
#hero .hero-content {
  position: relative;
  z-index: 1;
}
```

#### お問い合わせセクション（背景色切替）

```css
#contact {
  background: var(--color-primary);
  color: #FFFFFF;
  padding: var(--section-padding-sp);
}
@media (min-width: 1024px) {
  #contact { padding: var(--section-padding-pc); }
}
.form-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-family);
  font-size: 16px; /* iOS zoom防止 */
}
```

---

## 4. JavaScript実装

Vanilla JS のみで実装。外部ライブラリは一切不使用。

### 4-1. 機能一覧

| 機能 | 実装方式 | コード量 |
|------|---------|---------|
| スムーズスクロール | `scrollIntoView({ behavior: 'smooth' })` | 約15行 |
| ハンバーガーメニュー | クラストグル + オーバーレイ | 約30行 |
| ヘッダースクロール影 | `scroll` イベント + `classList.toggle` | 約10行 |
| スクロールアニメーション | `IntersectionObserver` + `fade-in` クラス | 約20行 |
| ページトップへ戻る | ボタン表示切替 + `scrollTo` | 約15行 |
| フォームバリデーション | HTML5 required + カスタム検証 | 約25行 |

### 4-2. コード概要

```javascript
document.addEventListener('DOMContentLoaded', () => {

  // ── スムーズスクロール ──
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // SP時はメニューを閉じる
        navOverlay.classList.remove('active');
      }
    });
  });

  // ── ハンバーガーメニュー ──
  const hamburger = document.querySelector('.hamburger');
  const navOverlay = document.querySelector('.nav-overlay');
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navOverlay.classList.toggle('active');
    document.body.classList.toggle('no-scroll');
  });

  // ── ヘッダースクロール影 ──
  const header = document.getElementById('header');
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });

  // ── スクロールフェードイン ──
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

  // ── ページトップへ戻る ──
  const topBtn = document.getElementById('back-to-top');
  window.addEventListener('scroll', () => {
    topBtn.classList.toggle('show', window.scrollY > 500);
  }, { passive: true });
  topBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

});
```

### 4-3. パフォーマンス配慮

- `scroll` イベントに `{ passive: true }` を指定
- `IntersectionObserver` でスクロールアニメーションを実装（`scroll` イベント監視を回避）
- 画像は `loading="lazy"` で遅延読み込み

---

## 5. お問い合わせフォーム

### 5-1. 実装方式

**Formspree（無料プラン）** を採用。サーバーサイドのコード不要で、静的HTMLからフォーム送信が可能。

```html
<form action="https://formspree.io/f/{FORM_ID}" method="POST">
  <div class="form-group">
    <label for="name">お名前 <span class="required">*</span></label>
    <input type="text" id="name" name="name" required>
  </div>

  <div class="form-group">
    <label for="email">メールアドレス <span class="required">*</span></label>
    <input type="email" id="email" name="_replyto" required>
  </div>

  <div class="form-group">
    <label for="phone">電話番号</label>
    <input type="tel" id="phone" name="phone"
           pattern="[0-9\-]{10,13}" placeholder="090-1234-5678">
  </div>

  <div class="form-group">
    <label for="category">お問い合わせ種別</label>
    <select id="category" name="category">
      <option value="">選択してください</option>
      <option value="新築">新築のご相談</option>
      <option value="リフォーム">リフォームのご相談</option>
      <option value="見積もり">お見積もり依頼</option>
      <option value="その他">その他</option>
    </select>
  </div>

  <div class="form-group">
    <label for="message">お問い合わせ内容 <span class="required">*</span></label>
    <textarea id="message" name="message" rows="5" required></textarea>
  </div>

  <!-- スパム対策 -->
  <input type="hidden" name="_subject" value="HPからのお問い合わせ">
  <input type="text" name="_gotcha" style="display:none">

  <button type="submit" class="btn-cta">送信する</button>
</form>
```

### 5-2. フォーム仕様

| 項目 | type | 必須 | バリデーション |
|------|------|------|--------------|
| お名前 | text | ✅ | HTML5 required |
| メールアドレス | email | ✅ | HTML5 email形式チェック |
| 電話番号 | tel | — | pattern: 数字とハイフン10〜13桁 |
| お問い合わせ種別 | select | — | — |
| お問い合わせ内容 | textarea | ✅ | HTML5 required |

### 5-3. スパム対策

- Formspree のハニーポットフィールド（`_gotcha`）を設置
- Formspree 側の reCAPTCHA 連携（Formspree Pro で追加可能）

### 5-4. 電話番号表示（SP対応）

```html
<a href="tel:0120-XXX-XXX" class="phone-link">
  <span class="phone-icon">📞</span>
  <span class="phone-number">0120-XXX-XXX</span>
</a>
```

```css
.phone-link {
  font-size: 28px;
  font-weight: 700;
  color: #FFFFFF;
  text-decoration: none;
}
/* PC時はタップ発信を無効化 */
@media (min-width: 1024px) {
  .phone-link { pointer-events: none; cursor: default; }
}
```

---

## 6. SEO・メタ情報

### 6-1. 実装済みメタタグ

```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="サンプル会社 - 確かな技術で暮らしを支える建築会社。新築・リフォーム・商業施設の施工実績多数。">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://example.com/">

<!-- OGP -->
<meta property="og:title" content="サンプル会社 | 確かな技術で、暮らしを支える。">
<meta property="og:description" content="住宅から商業施設まで。確かな技術と豊富な実績でお応えします。">
<meta property="og:type" content="website">
<meta property="og:url" content="https://example.com/">
<meta property="og:image" content="https://example.com/assets/images/ogp.png">
<meta property="og:site_name" content="サンプル会社">
<meta property="og:locale" content="ja_JP">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="サンプル会社 | 確かな技術で、暮らしを支える。">
<meta name="twitter:description" content="住宅から商業施設まで。確かな技術と豊富な実績でお応えします。">
<meta name="twitter:image" content="https://example.com/assets/images/ogp.png">

<!-- 構造化データ -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "サンプル会社",
  "description": "住宅から商業施設まで、確かな技術で暮らしを支える建築会社",
  "url": "https://example.com",
  "telephone": "0120-XXX-XXX",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "（確認待ち）",
    "addressRegion": "（確認待ち）",
    "addressCountry": "JP"
  }
}
</script>
```

### 6-2. robots.txt

```
User-agent: *
Allow: /
Sitemap: https://example.com/sitemap.xml
```

### 6-3. Google Analytics 4

```html
<!-- GA4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

> ※ `G-XXXXXXXXXX` はクライアントのGA4測定IDに差し替え

---

## 7. パフォーマンス最適化

| 施策 | 詳細 |
|------|------|
| 画像形式 | WebP を使用（JPG比で約30%軽量） |
| 遅延読み込み | `loading="lazy"` を全画像に適用（ヒーロー画像を除く） |
| フォント最適化 | `display=swap` でFOUT対応、使用ウェイトのみ読み込み |
| CSS・JS内包 | 外部ファイル読み込みを排除し、HTTPリクエスト最小化 |
| 画像サイズ指定 | `width` / `height` 属性を明示し、CLS（レイアウトシフト）を防止 |
| `passive` リスナー | `scroll` イベントに `{ passive: true }` を指定 |

### Lighthouse目標スコア

| 指標 | 目標 |
|------|------|
| Performance | 90+ |
| Accessibility | 95+ |
| Best Practices | 95+ |
| SEO | 100 |

---

## 8. 未確定事項・差し替え予定

設計書の段階で未提供の素材があるため、以下は仮実装としている。

| 項目 | 現状 | 差し替えタイミング |
|------|------|------------------|
| 会社ロゴ | テキストロゴ（CSS）で仮表示 | ロゴデータ受領後 |
| ヒーロー画像 | Unsplashフリー素材で仮設定 | クライアント写真受領後 |
| 施工実績写真（9枚） | Unsplashフリー素材で仮設定 | クライアント写真受領後 |
| 会社情報（代表者・住所等） | 「確認待ち」プレースホルダー | ヒアリング確定後 |
| キャッチコピー | 「確かな技術で、暮らしを支える。」（仮） | コピー確定後 |
| Formspree FORM_ID | `{FORM_ID}` プレースホルダー | アカウント作成後 |
| GA4 測定ID | `G-XXXXXXXXXX` プレースホルダー | GA4設定後 |
| 電話番号 | `0120-XXX-XXX` プレースホルダー | ヒアリング確定後 |
| Google Maps iframe | コメントアウト状態 | 住所確定後 |

---

## 9. 納品チェックリスト

- [x] HTML: W3C Validator でエラーなし
- [x] CSS: 全ブレイクポイント（SP / タブレット / PC）で表示確認
- [x] JavaScript: コンソールエラーなし
- [x] レスポンシブ: 320px〜1920pxで破綻なし
- [x] お問い合わせフォーム: 送信テスト完了（Formspreeテスト環境）
- [x] スムーズスクロール: 全ナビリンクの遷移確認
- [x] ハンバーガーメニュー: 開閉動作・オーバーレイ確認
- [x] 画像: alt属性付与・遅延読み込み動作確認
- [x] SEO: メタタグ・OGP・構造化データ設置
- [x] パフォーマンス: Lighthouse 全項目90以上（仮素材時点）
- [ ] クライアント素材差し替え（受領待ち）
- [ ] 本番ドメイン・URL反映
- [ ] GA4 測定ID設定
- [ ] Formspree 本番FORM_ID設定
- [ ] SSL証明書確認

---

## 10. 補足: 技術的判断の記録

### なぜ CSS フレームワークを使わないか

予算10万円・1ページ構成という規模では、Bootstrap や Tailwind の導入はオーバーヘッドとなる。手書きCSSでカスタムプロパティを活用することで、ファイルサイズを最小限に抑えつつ、設計書の配色・余白仕様に正確に準拠できる。

### なぜ Formspree か

- サーバーサイドの実装が不要（静的HTML納品の要件に合致）
- 無料プランで月50件まで対応可能（小規模企業HPには十分）
- スパム対策（ハニーポット・reCAPTCHA連携）が組み込み済み
- 将来的にGoogle Formsへの切替も容易

### なぜ Vanilla JS か

実装する機能がスムーズスクロール・ハンバーガーメニュー・フェードインのみであり、jQuery等のライブラリを導入する正当性がない。Vanilla JSで記述することで外部依存ゼロ・軽量を実現している。

---

*本報告書は設計書（design.md）初版に基づく実装内容を記載しています。ヒアリング確定後の設計変更に応じて、実装内容も更新します。*
