const pptxgen = require("/tmp/pptx-build/node_modules/pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "新規事業開発部";
pres.title = "まるなげAI — AI秘書SaaS 事業計画書";

// Color palette
const C = {
  navy: "1E2761",
  deepBlue: "2A3F7E",
  accent: "4A90D9",
  light: "CADCFC",
  white: "FFFFFF",
  gray: "8892A0",
  darkText: "1A1A2E",
  lightText: "B0BAC9",
  bg: "F4F6FA",
  green: "27AE60",
  orange: "F39C12",
  red: "E74C3C",
  sourceGray: "A0A8B4",
};

const makeShadow = () => ({
  type: "outer",
  blur: 8,
  offset: 3,
  angle: 135,
  color: "000000",
  opacity: 0.12,
});

// 出典テキストのヘルパー
const addSource = (slide, text, y = 4.85) => {
  slide.addText(text, {
    x: 0.5,
    y,
    w: 9,
    h: 0.35,
    fontSize: 7,
    fontFace: "Arial",
    color: C.sourceGray,
    margin: 0,
  });
};

// ===== SLIDE 1: 表紙 =====
{
  const s = pres.addSlide();
  s.background = { color: C.navy };

  s.addShape(pres.shapes.OVAL, {
    x: 7.5,
    y: -1.5,
    w: 4,
    h: 4,
    fill: { color: C.deepBlue },
  });
  s.addShape(pres.shapes.OVAL, {
    x: 8.5,
    y: 3.5,
    w: 3,
    h: 3,
    fill: { color: C.accent, transparency: 80 },
  });

  s.addText("まるなげAI", {
    x: 0.8,
    y: 1.0,
    w: 8,
    h: 1.2,
    fontSize: 48,
    fontFace: "Arial Black",
    color: C.white,
    bold: true,
    margin: 0,
  });
  s.addText("LINEで話しかけるだけのAI秘書SaaS", {
    x: 0.8,
    y: 2.3,
    w: 7,
    h: 0.6,
    fontSize: 22,
    fontFace: "Arial",
    color: C.light,
    margin: 0,
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.8,
    y: 3.1,
    w: 2,
    h: 0.06,
    fill: { color: C.accent },
  });

  s.addText("事業計画書 — 2026年3月", {
    x: 0.8,
    y: 3.5,
    w: 5,
    h: 0.4,
    fontSize: 14,
    fontFace: "Arial",
    color: C.gray,
    margin: 0,
  });

  s.addText(
    "「人を雇うほどじゃないけど、自分一人では回らない」\nフリーランス・個人事業主209万人の業務課題をAIで解決する",
    {
      x: 0.8,
      y: 4.1,
      w: 7,
      h: 0.8,
      fontSize: 12,
      fontFace: "Arial",
      color: C.lightText,
      margin: 0,
    }
  );
}

// ===== SLIDE 2: ビジョン・背景・課題 =====
{
  const s = pres.addSlide();
  s.background = { color: C.bg };

  s.addText("背景：フリーランスの「時間がない」問題", {
    x: 0.8,
    y: 0.3,
    w: 8.5,
    h: 0.7,
    fontSize: 26,
    fontFace: "Arial",
    color: C.navy,
    bold: true,
    margin: 0,
  });

  // カード1: フリーランス人口
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.8,
    y: 1.2,
    w: 2.6,
    h: 2.6,
    fill: { color: C.white },
    shadow: makeShadow(),
  });
  s.addText("209万人", {
    x: 0.8,
    y: 1.3,
    w: 2.6,
    h: 0.8,
    fontSize: 30,
    fontFace: "Arial Black",
    color: C.accent,
    align: "center",
    margin: 0,
  });
  s.addText("本業フリーランス", {
    x: 0.8,
    y: 2.1,
    w: 2.6,
    h: 0.35,
    fontSize: 11,
    fontFace: "Arial",
    color: C.gray,
    align: "center",
    margin: 0,
  });
  s.addText(
    "総務省「就業構造基本調査」\n(2022年)。広義では\n1,303万人（ランサーズ2024）",
    {
      x: 0.9,
      y: 2.5,
      w: 2.4,
      h: 0.9,
      fontSize: 8,
      fontFace: "Arial",
      color: C.sourceGray,
      align: "center",
      margin: 0,
    }
  );

  // カード2: 事務負担
  s.addShape(pres.shapes.RECTANGLE, {
    x: 3.7,
    y: 1.2,
    w: 2.6,
    h: 2.6,
    fill: { color: C.white },
    shadow: makeShadow(),
  });
  s.addText("25%", {
    x: 3.7,
    y: 1.3,
    w: 2.6,
    h: 0.8,
    fontSize: 30,
    fontFace: "Arial Black",
    color: C.orange,
    align: "center",
    margin: 0,
  });
  s.addText("事務作業を負担と回答", {
    x: 3.7,
    y: 2.1,
    w: 2.6,
    h: 0.35,
    fontSize: 11,
    fontFace: "Arial",
    color: C.gray,
    align: "center",
    margin: 0,
  });
  s.addText(
    "フリーランス白書2024\n（フリーランス協会）\n稼働時間の約20%が\nバックオフィス業務",
    {
      x: 3.8,
      y: 2.5,
      w: 2.4,
      h: 0.9,
      fontSize: 8,
      fontFace: "Arial",
      color: C.sourceGray,
      align: "center",
      margin: 0,
    }
  );

  // カード3: 雇用コスト
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.6,
    y: 1.2,
    w: 2.6,
    h: 2.6,
    fill: { color: C.white },
    shadow: makeShadow(),
  });
  s.addText("約2倍", {
    x: 6.6,
    y: 1.3,
    w: 2.6,
    h: 0.8,
    fontSize: 30,
    fontFace: "Arial Black",
    color: C.red,
    align: "center",
    margin: 0,
  });
  s.addText("雇用コスト vs 給与", {
    x: 6.6,
    y: 2.1,
    w: 2.6,
    h: 0.35,
    fontSize: 11,
    fontFace: "Arial",
    color: C.gray,
    align: "center",
    margin: 0,
  });
  s.addText(
    "社保・労災・採用・教育費で\n給与の約2倍のコスト\n（マネーフォワード調べ）\n→ 個人事業主には非現実的",
    {
      x: 6.7,
      y: 2.5,
      w: 2.4,
      h: 0.9,
      fontSize: 8,
      fontFace: "Arial",
      color: C.sourceGray,
      align: "center",
      margin: 0,
    }
  );

  // 収入不安定データ
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.8,
    y: 4.1,
    w: 8.4,
    h: 0.6,
    fill: { color: C.white },
    shadow: makeShadow(),
  });
  s.addText(
    [
      {
        text: "収入0円の月がある: 32.4%",
        options: { bold: true, color: C.navy },
      },
      {
        text: "　|　収入に不満: 40.2%",
        options: { bold: true, color: C.red },
      },
      {
        text: "　— フリーランス白書2025（フリーランス協会）",
        options: { color: C.sourceGray, fontSize: 9 },
      },
    ],
    {
      x: 1.0,
      y: 4.1,
      w: 8.0,
      h: 0.6,
      fontSize: 12,
      fontFace: "Arial",
      valign: "middle",
      margin: 0,
    }
  );
}

// ===== SLIDE 3: 市場分析 =====
{
  const s = pres.addSlide();
  s.background = { color: C.bg };

  s.addText("市場分析", {
    x: 0.8,
    y: 0.3,
    w: 8.5,
    h: 0.7,
    fontSize: 26,
    fontFace: "Arial",
    color: C.navy,
    bold: true,
    margin: 0,
  });

  // TAM SAM SOM — 同心円
  s.addShape(pres.shapes.OVAL, {
    x: 0.8,
    y: 1.2,
    w: 4.0,
    h: 3.6,
    fill: { color: C.light, transparency: 50 },
  });
  s.addShape(pres.shapes.OVAL, {
    x: 1.5,
    y: 1.7,
    w: 2.8,
    h: 2.6,
    fill: { color: C.accent, transparency: 60 },
  });
  s.addShape(pres.shapes.OVAL, {
    x: 2.1,
    y: 2.1,
    w: 1.6,
    h: 1.6,
    fill: { color: C.navy },
  });

  s.addText("SOM", {
    x: 2.1,
    y: 2.3,
    w: 1.6,
    h: 0.5,
    fontSize: 11,
    color: C.white,
    align: "center",
    bold: true,
    margin: 0,
  });
  s.addText("500人", {
    x: 2.1,
    y: 2.7,
    w: 1.6,
    h: 0.4,
    fontSize: 10,
    color: C.light,
    align: "center",
    margin: 0,
  });

  // TAM
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.3,
    y: 1.2,
    w: 4.2,
    h: 1.0,
    fill: { color: C.white },
    shadow: makeShadow(),
  });
  s.addText(
    [
      {
        text: "TAM: 約250億円/年",
        options: { bold: true, fontSize: 14, color: C.navy },
      },
      {
        text: "\n本業フリーランス209万人 × 年間約1.2万円（月1,000円のSaaS支出中央値）",
        options: { fontSize: 9, color: C.gray },
      },
      {
        text: "\n出典: 総務省 就業構造基本調査2022 / フリマド SaaS利用調査2023",
        options: { fontSize: 7, color: C.sourceGray },
      },
    ],
    { x: 5.5, y: 1.2, w: 3.8, h: 1.0, fontFace: "Arial", margin: 0 }
  );

  // SAM
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.3,
    y: 2.4,
    w: 4.2,
    h: 1.0,
    fill: { color: C.white },
    shadow: makeShadow(),
  });
  s.addText(
    [
      {
        text: "SAM: 約30億円/年",
        options: { bold: true, fontSize: 14, color: C.accent },
      },
      {
        text: "\nSaaS利用率77% × 有料契約45% × 月額1万円以上支払い意向20% → 約14万人",
        options: { fontSize: 9, color: C.gray },
      },
      {
        text: "\n出典: フリマド「フリーランスのSaaS利用に関するアンケート調査」2023",
        options: { fontSize: 7, color: C.sourceGray },
      },
    ],
    { x: 5.5, y: 2.4, w: 3.8, h: 1.0, fontFace: "Arial", margin: 0 }
  );

  // SOM
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.3,
    y: 3.6,
    w: 4.2,
    h: 1.0,
    fill: { color: C.white },
    shadow: makeShadow(),
  });
  s.addText(
    [
      {
        text: "SOM: 約7,200万円/年（初年度）",
        options: { bold: true, fontSize: 14, color: C.navy },
      },
      {
        text: "\n初年度獲得目標500人 × 平均月額12,000円 × 12ヶ月",
        options: { fontSize: 9, color: C.gray },
      },
      {
        text: "\n※ 500人 = SAM 14万人の0.36%。β版テスト+口コミベースの保守的推計",
        options: { fontSize: 7, color: C.sourceGray },
      },
    ],
    { x: 5.5, y: 3.6, w: 3.8, h: 1.0, fontFace: "Arial", margin: 0 }
  );
}

// ===== SLIDE 4: 追い風となる市場トレンド =====
{
  const s = pres.addSlide();
  s.background = { color: C.navy };

  s.addText("追い風となる市場トレンド", {
    x: 0.8,
    y: 0.3,
    w: 8.5,
    h: 0.7,
    fontSize: 26,
    fontFace: "Arial",
    color: C.white,
    bold: true,
    margin: 0,
  });

  // トレンド1: AI市場
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5,
    y: 1.2,
    w: 4.3,
    h: 1.5,
    fill: { color: C.deepBlue },
    shadow: makeShadow(),
  });
  s.addText(
    [
      {
        text: "国内AI市場 CAGR 25.6%",
        options: { bold: true, fontSize: 16, color: C.accent, breakLine: true },
      },
      {
        text: "2024年 1.3兆円 → 2029年 4.2兆円（予測）",
        options: { fontSize: 12, color: C.light, breakLine: true },
      },
      {
        text: "出典: IDC Japan 2024年国内AIシステム市場予測",
        options: { fontSize: 7, color: C.sourceGray },
      },
    ],
    { x: 0.7, y: 1.3, w: 3.9, h: 1.3, fontFace: "Arial", margin: 0 }
  );

  // トレンド2: LINE普及
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.2,
    y: 1.2,
    w: 4.3,
    h: 1.5,
    fill: { color: C.deepBlue },
    shadow: makeShadow(),
  });
  s.addText(
    [
      {
        text: "LINE MAU 1億人超",
        options: { bold: true, fontSize: 16, color: C.accent, breakLine: true },
      },
      {
        text: "人口カバー率96%。60代以上も約70%が利用",
        options: { fontSize: 12, color: C.light, breakLine: true },
      },
      {
        text: "出典: LINEヤフー プレスリリース 2026年1月",
        options: { fontSize: 7, color: C.sourceGray },
      },
    ],
    { x: 5.4, y: 1.3, w: 3.9, h: 1.3, fontFace: "Arial", margin: 0 }
  );

  // トレンド3: オンラインアシスタント浸透率
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5,
    y: 3.0,
    w: 4.3,
    h: 1.5,
    fill: { color: C.deepBlue },
    shadow: makeShadow(),
  });
  s.addText(
    [
      {
        text: "オンラインアシスタント利用率 わずか3%",
        options: { bold: true, fontSize: 14, color: C.orange, breakLine: true },
      },
      {
        text: "米国は約70%。巨大な成長余地が存在",
        options: { fontSize: 12, color: C.light, breakLine: true },
      },
      {
        text: "出典: BPOテクノロジー（PR TIMES）2023年",
        options: { fontSize: 7, color: C.sourceGray },
      },
    ],
    { x: 0.7, y: 3.1, w: 3.9, h: 1.3, fontFace: "Arial", margin: 0 }
  );

  // トレンド4: チャットボット市場
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.2,
    y: 3.0,
    w: 4.3,
    h: 1.5,
    fill: { color: C.deepBlue },
    shadow: makeShadow(),
  });
  s.addText(
    [
      {
        text: "チャットボット市場 CAGR 22.9%",
        options: {
          bold: true,
          fontSize: 14,
          color: C.orange,
          breakLine: true,
        },
      },
      {
        text: "2023年 112億円 → 2029年 445億円（予測）",
        options: { fontSize: 12, color: C.light, breakLine: true },
      },
      {
        text: "出典: 矢野経済研究所「対話型AIシステム市場調査」",
        options: { fontSize: 7, color: C.sourceGray },
      },
    ],
    { x: 5.4, y: 3.1, w: 3.9, h: 1.3, fontFace: "Arial", margin: 0 }
  );

  addSource(
    s,
    "企業とのチャット問い合わせ希望: 全年代6割超、20-30代は7割 — モビルス「LINE公式アカウント利用実態調査2025」",
    4.75
  );
}

// ===== SLIDE 5: ソリューション =====
{
  const s = pres.addSlide();
  s.background = { color: C.navy };

  s.addText("ソリューション: LINE × AI で業務を丸投げ", {
    x: 0.8,
    y: 0.3,
    w: 8.5,
    h: 0.7,
    fontSize: 24,
    fontFace: "Arial",
    color: C.white,
    bold: true,
    margin: 0,
  });

  s.addText(
    "LINEに話しかけるだけで、AIが秘書・SNS担当・経理アシスタントを兼任",
    {
      x: 0.8,
      y: 1.0,
      w: 8.5,
      h: 0.4,
      fontSize: 14,
      fontFace: "Arial",
      color: C.light,
      margin: 0,
    }
  );

  // フロー図
  const boxes = [
    { label: "LINE\nメッセージ", x: 0.8 },
    { label: "AI秘書が\n理解・判断", x: 3.3 },
    { label: "自動実行\n＆返信", x: 5.8 },
    { label: "業務完了\n報告", x: 8.3 },
  ];
  boxes.forEach((b, i) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: b.x,
      y: 1.8,
      w: 1.8,
      h: 1.2,
      fill: { color: C.deepBlue },
      shadow: makeShadow(),
    });
    s.addText(b.label, {
      x: b.x,
      y: 1.8,
      w: 1.8,
      h: 1.2,
      fontSize: 13,
      fontFace: "Arial",
      color: C.white,
      align: "center",
      valign: "middle",
      margin: 0,
    });
    if (i < boxes.length - 1) {
      s.addShape(pres.shapes.LINE, {
        x: b.x + 1.9,
        y: 2.4,
        w: 1.2,
        h: 0,
        line: { color: C.accent, width: 2 },
      });
    }
  });

  // 機能カード
  const features = [
    {
      title: "スケジュール管理",
      desc: "Googleカレンダー連携\n予定の確認・追加・リマインド",
    },
    {
      title: "SNS自動投稿",
      desc: "note.com, Threads, Xに\nAIが記事生成・自動投稿",
    },
    {
      title: "経理リマインド",
      desc: "請求書発行タイミング通知\n経費記録・月次レポート",
    },
    {
      title: "顧客対応",
      desc: "問い合わせ一次対応\nFAQ自動回答・履歴管理",
    },
  ];

  features.forEach((f, i) => {
    const x = 0.5 + i * 2.4;
    s.addShape(pres.shapes.RECTANGLE, {
      x,
      y: 3.4,
      w: 2.2,
      h: 1.5,
      fill: { color: C.deepBlue },
      shadow: makeShadow(),
    });
    s.addText(f.title, {
      x,
      y: 3.45,
      w: 2.2,
      h: 0.4,
      fontSize: 12,
      fontFace: "Arial",
      color: C.accent,
      bold: true,
      align: "center",
      margin: 0,
    });
    s.addText(f.desc, {
      x: x + 0.1,
      y: 3.85,
      w: 2.0,
      h: 0.9,
      fontSize: 9,
      fontFace: "Arial",
      color: C.lightText,
      align: "center",
      margin: 0,
    });
  });
}

// ===== SLIDE 6: UX（顧客体験） =====
{
  const s = pres.addSlide();
  s.background = { color: C.bg };

  s.addText("UX: なぜLINEなのか", {
    x: 0.8,
    y: 0.3,
    w: 8.5,
    h: 0.7,
    fontSize: 26,
    fontFace: "Arial",
    color: C.navy,
    bold: true,
    margin: 0,
  });

  // LINEチャット風UI（左半分）
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.8,
    y: 1.2,
    w: 3.8,
    h: 3.5,
    fill: { color: "E8F5E9" },
    shadow: makeShadow(),
  });
  s.addText("LINE", {
    x: 0.8,
    y: 1.2,
    w: 3.8,
    h: 0.4,
    fontSize: 12,
    fontFace: "Arial",
    color: C.white,
    align: "center",
    fill: { color: "06C755" },
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 2.6,
    y: 1.8,
    w: 1.8,
    h: 0.35,
    fill: { color: "06C755" },
  });
  s.addText("明日の予定は？", {
    x: 2.6,
    y: 1.8,
    w: 1.8,
    h: 0.35,
    fontSize: 10,
    color: C.white,
    align: "center",
    valign: "middle",
    margin: 0,
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 1.0,
    y: 2.3,
    w: 2.8,
    h: 0.65,
    fill: { color: C.white },
  });
  s.addText("明日（3/27）の予定:\n11:00-12:00 草分さん打合せ\n他に予定はありません", {
    x: 1.0,
    y: 2.3,
    w: 2.8,
    h: 0.65,
    fontSize: 9,
    color: C.darkText,
    valign: "middle",
    margin: 3,
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 2.3,
    y: 3.1,
    w: 2.1,
    h: 0.35,
    fill: { color: "06C755" },
  });
  s.addText("noteに記事書いて", {
    x: 2.3,
    y: 3.1,
    w: 2.1,
    h: 0.35,
    fontSize: 10,
    color: C.white,
    align: "center",
    valign: "middle",
    margin: 0,
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 1.0,
    y: 3.6,
    w: 2.8,
    h: 0.5,
    fill: { color: C.white },
  });
  s.addText("記事を生成して下書き保存しました!\n「ADHDグレーの僕が...」", {
    x: 1.0,
    y: 3.6,
    w: 2.8,
    h: 0.5,
    fontSize: 9,
    color: C.darkText,
    valign: "middle",
    margin: 3,
  });

  // 右半分: UXの3つの設計思想
  s.addText(
    [
      {
        text: "1. ゼロ学習コスト",
        options: { bold: true, fontSize: 15, color: C.navy, breakLine: true },
      },
      {
        text: "新しいアプリ不要。LINE友だち追加だけで即利用。",
        options: {
          fontSize: 11,
          color: C.gray,
          breakLine: true,
        },
      },
      {
        text: "LINEは全年代利用率90%超（総務省2025年調査）",
        options: { fontSize: 8, color: C.sourceGray, breakLine: true },
      },
      {
        text: "",
        options: { breakLine: true, fontSize: 6 },
      },
      {
        text: "2. 自然言語で完結",
        options: { bold: true, fontSize: 15, color: C.navy, breakLine: true },
      },
      {
        text: "マニュアル不要。友達にLINEする感覚で業務依頼。",
        options: {
          fontSize: 11,
          color: C.gray,
          breakLine: true,
        },
      },
      {
        text: "LINE公式アカウント「便利」回答率8割（モビルス2025）",
        options: { fontSize: 8, color: C.sourceGray, breakLine: true },
      },
      {
        text: "",
        options: { breakLine: true, fontSize: 6 },
      },
      {
        text: "3. 24時間対応 × 学習する秘書",
        options: { bold: true, fontSize: 15, color: C.navy, breakLine: true },
      },
      {
        text: "深夜のメモも早朝の確認もAIが即対応。\n使うほどあなたの仕事スタイルを理解。",
        options: { fontSize: 11, color: C.gray },
      },
    ],
    { x: 5.2, y: 1.2, w: 4.3, h: 3.8, fontFace: "Arial", margin: 0 }
  );
}

// ===== SLIDE 7: ビジネスモデル & 収益予測 =====
{
  const s = pres.addSlide();
  s.background = { color: C.bg };

  s.addText("ビジネスモデル & 収益予測", {
    x: 0.8,
    y: 0.3,
    w: 8.5,
    h: 0.7,
    fontSize: 26,
    fontFace: "Arial",
    color: C.navy,
    bold: true,
    margin: 0,
  });

  // プラン表
  const plans = [
    {
      name: "ライト",
      price: "9,800",
      color: C.accent,
      features: "スケジュール管理\nTODO管理\n天気・情報検索\nSNS 1アカウント",
    },
    {
      name: "スタンダード",
      price: "19,800",
      color: C.green,
      features:
        "ライト全機能 +\nSNS 3アカウント\n経理リマインド\n顧客対応bot\n部門AI（5部門）",
    },
    {
      name: "プロ",
      price: "39,800",
      color: C.orange,
      features:
        "スタンダード全機能 +\nSNS無制限\n部門AI（全部門）\nカスタム自動化\n優先サポート",
    },
  ];

  plans.forEach((p, i) => {
    const x = 0.5 + i * 3.2;
    s.addShape(pres.shapes.RECTANGLE, {
      x,
      y: 1.1,
      w: 2.9,
      h: 2.5,
      fill: { color: C.white },
      shadow: makeShadow(),
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x,
      y: 1.1,
      w: 2.9,
      h: 0.6,
      fill: { color: p.color },
    });
    s.addText(p.name, {
      x,
      y: 1.1,
      w: 2.9,
      h: 0.6,
      fontSize: 16,
      fontFace: "Arial",
      color: C.white,
      bold: true,
      align: "center",
      valign: "middle",
      margin: 0,
    });
    s.addText(
      [
        {
          text: "¥" + p.price,
          options: { fontSize: 22, bold: true, color: C.darkText },
        },
        { text: " /月", options: { fontSize: 12, color: C.gray } },
      ],
      { x, y: 1.75, w: 2.9, h: 0.5, align: "center", fontFace: "Arial", margin: 0 }
    );
    s.addText(p.features, {
      x: x + 0.2,
      y: 2.3,
      w: 2.5,
      h: 1.2,
      fontSize: 10,
      fontFace: "Arial",
      color: C.gray,
      margin: 0,
    });
  });

  // 収益予測テーブル
  s.addText("収益予測（保守的シナリオ）", {
    x: 0.8,
    y: 3.75,
    w: 8.5,
    h: 0.4,
    fontSize: 14,
    fontFace: "Arial",
    color: C.navy,
    bold: true,
    margin: 0,
  });

  const tableData = [
    [
      { text: "", options: { fill: { color: C.navy }, color: C.white } },
      {
        text: "6ヶ月目",
        options: { fill: { color: C.navy }, color: C.white, bold: true },
      },
      {
        text: "12ヶ月目",
        options: { fill: { color: C.navy }, color: C.white, bold: true },
      },
      {
        text: "24ヶ月目",
        options: { fill: { color: C.navy }, color: C.white, bold: true },
      },
    ],
    ["有料ユーザー数", "50人", "500人", "2,000人"],
    ["月間売上", "60万円", "600万円", "2,400万円"],
    ["月間コスト", "20万円", "150万円", "500万円"],
    ["営業利益", "40万円", "450万円", "1,900万円"],
  ];

  s.addTable(tableData, {
    x: 0.5,
    y: 4.15,
    w: 9,
    fontSize: 10,
    fontFace: "Arial",
    border: { pt: 0.5, color: "DEE2E6" },
    colW: [2.0, 2.3, 2.3, 2.4],
    rowH: [0.3, 0.3, 0.3, 0.3, 0.3],
    autoPage: false,
  });

  addSource(
    s,
    "価格設定根拠: フリーランスの月額SaaS支出は62%が3,000円以下（フリマド2023）。人間VA月額5〜15万円との中間価格帯を狙う。初期ユーザーはβテスト→口コミ獲得を想定。",
    5.0
  );
}

// ===== SLIDE 8: 競合分析 =====
{
  const s = pres.addSlide();
  s.background = { color: C.bg };

  s.addText("競合分析", {
    x: 0.8,
    y: 0.3,
    w: 8.5,
    h: 0.7,
    fontSize: 26,
    fontFace: "Arial",
    color: C.navy,
    bold: true,
    margin: 0,
  });

  const tableData = [
    [
      { text: "", options: { fill: { color: C.navy }, color: C.white } },
      {
        text: "人間VA\n(フジ子さん等)",
        options: { fill: { color: C.navy }, color: C.white, bold: true },
      },
      {
        text: "汎用AI\n(ChatGPT等)",
        options: { fill: { color: C.navy }, color: C.white, bold: true },
      },
      {
        text: "まるなげAI",
        options: { fill: { color: C.accent }, color: C.white, bold: true },
      },
    ],
    [
      "月額コスト",
      "6.3〜13.2万円",
      "約3,000円〜",
      "9,800円〜",
    ],
    ["業務実行", "○ 人が対応", "× 提案のみ", "○ 自動実行"],
    ["24時間対応", "× 稼働時間限定", "○", "○"],
    ["SNS投稿", "△ 手動依頼", "× 投稿不可", "○ 自動投稿"],
    ["カレンダー連携", "○", "△ 手動コピペ", "○ 双方向"],
    ["導入の手軽さ", "× 面接・契約", "○ 即利用", "○ LINE追加のみ"],
    ["品質の安定性", "△ 人による", "○ 安定", "○ 安定"],
  ];

  s.addTable(tableData, {
    x: 0.5,
    y: 1.1,
    w: 9,
    fontSize: 10,
    fontFace: "Arial",
    border: { pt: 0.5, color: "DEE2E6" },
    colW: [1.8, 2.2, 2.2, 2.8],
    rowH: [0.45, 0.38, 0.38, 0.38, 0.38, 0.38, 0.38, 0.38],
    autoPage: false,
  });

  // 差別化ポイント
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5,
    y: 4.3,
    w: 9,
    h: 0.8,
    fill: { color: C.white },
    shadow: makeShadow(),
  });
  s.addText(
    [
      {
        text: "差別化: ",
        options: { bold: true, color: C.navy },
      },
      {
        text: "「提案するだけのAI」でも「高価な人間VA」でもない、",
        options: { color: C.darkText },
      },
      {
        text: "月1万円で業務を実行できるAI秘書",
        options: { bold: true, color: C.accent },
      },
      {
        text: "。LINEという既存インフラ上で動くため導入障壁ゼロ。",
        options: { color: C.darkText },
      },
    ],
    {
      x: 0.7,
      y: 4.3,
      w: 8.6,
      h: 0.8,
      fontSize: 12,
      fontFace: "Arial",
      valign: "middle",
      margin: 0,
    }
  );

  addSource(
    s,
    "人間VA料金: HELP YOU「オンライン秘書サービス比較15選」2025年。ChatGPT Plus: $20/月。Notion AI: $10/月。",
    5.2
  );
}

// ===== SLIDE 9: リスク分析 =====
{
  const s = pres.addSlide();
  s.background = { color: C.bg };

  s.addText("リスク分析と対策", {
    x: 0.8,
    y: 0.3,
    w: 8.5,
    h: 0.7,
    fontSize: 26,
    fontFace: "Arial",
    color: C.navy,
    bold: true,
    margin: 0,
  });

  const risks = [
    {
      risk: "市場リスク",
      detail: "フリーランスのSaaS支出は62%が月3,000円以下。\n月9,800円は高い価格帯。",
      mitigation:
        "無料トライアル→成果実感→有料転換の導線設計。\n人間VA（月6万円〜）との比較で価値訴求。",
      color: C.red,
    },
    {
      risk: "技術リスク",
      detail:
        "AI API費用が利用量に比例して増加。\nLLMの精度・幻覚問題。",
      mitigation:
        "プラン別の利用上限設定でコスト管理。\n重要操作は確認ステップを挟む安全設計。",
      color: C.orange,
    },
    {
      risk: "競合リスク",
      detail: "大手（LINE/OpenAI等）が類似機能を\n標準搭載する可能性。",
      mitigation:
        "業務特化・日本のフリーランス文化への\n深い適応で差別化。先行者利益の確保。",
      color: C.orange,
    },
    {
      risk: "採用リスク",
      detail: "AI活用に興味なしが約5割。\n中小企業AI導入率は14.9%。",
      mitigation:
        "「AI」を前面に出さず「LINE秘書」として訴求。\nITリテラシー高層から段階的に拡大。",
      color: C.accent,
    },
  ];

  risks.forEach((r, i) => {
    const y = 1.1 + i * 0.95;
    // リスクラベル
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5,
      y,
      w: 1.5,
      h: 0.8,
      fill: { color: r.color },
    });
    s.addText(r.risk, {
      x: 0.5,
      y,
      w: 1.5,
      h: 0.8,
      fontSize: 11,
      fontFace: "Arial",
      color: C.white,
      bold: true,
      align: "center",
      valign: "middle",
      margin: 0,
    });
    // リスク内容
    s.addShape(pres.shapes.RECTANGLE, {
      x: 2.1,
      y,
      w: 3.5,
      h: 0.8,
      fill: { color: C.white },
    });
    s.addText(r.detail, {
      x: 2.2,
      y,
      w: 3.3,
      h: 0.8,
      fontSize: 9,
      fontFace: "Arial",
      color: C.darkText,
      valign: "middle",
      margin: 0,
    });
    // 対策
    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.7,
      y,
      w: 3.8,
      h: 0.8,
      fill: { color: C.white },
    });
    s.addText(r.mitigation, {
      x: 5.8,
      y,
      w: 3.6,
      h: 0.8,
      fontSize: 9,
      fontFace: "Arial",
      color: C.green,
      valign: "middle",
      margin: 0,
    });
  });

  // ヘッダーラベル
  s.addText("リスク", {
    x: 2.1,
    y: 0.85,
    w: 3.5,
    h: 0.25,
    fontSize: 8,
    color: C.gray,
    bold: true,
    margin: 0,
  });
  s.addText("対策", {
    x: 5.7,
    y: 0.85,
    w: 3.8,
    h: 0.25,
    fontSize: 8,
    color: C.gray,
    bold: true,
    margin: 0,
  });

  addSource(
    s,
    "出典: ランサーズ「フリーランス実態調査2024」（AI興味なし約5割）/ 野村総合研究所2025（中小企業AI導入率14.9%）/ フリマド2023（SaaS支出）",
    4.95
  );
}

// ===== SLIDE 10: 実行スケジュール =====
{
  const s = pres.addSlide();
  s.background = { color: C.navy };

  s.addText("実行スケジュール", {
    x: 0.8,
    y: 0.3,
    w: 8.5,
    h: 0.7,
    fontSize: 26,
    fontFace: "Arial",
    color: C.white,
    bold: true,
    margin: 0,
  });

  // タイムライン
  s.addShape(pres.shapes.LINE, {
    x: 1.0,
    y: 2.3,
    w: 8,
    h: 0,
    line: { color: C.accent, width: 3 },
  });

  const phases = [
    {
      label: "Month 1-2",
      title: "MVP & β版",
      desc: "コア4機能開発\nβユーザー5名テスト\nフィードバック反映",
      x: 1.0,
      color: C.accent,
    },
    {
      label: "Month 3",
      title: "正式リリース",
      desc: "決済実装\nLP公開・広告開始\n有料プラン開始",
      x: 3.5,
      color: C.green,
    },
    {
      label: "Month 6",
      title: "50ユーザー",
      desc: "機能拡張\nCS体制構築\n月商60万円",
      x: 6.0,
      color: C.orange,
    },
    {
      label: "Month 12",
      title: "500ユーザー",
      desc: "機能拡張・API公開\nパートナー連携\n月商600万円",
      x: 8.5,
      color: C.red,
    },
  ];

  phases.forEach((p) => {
    s.addShape(pres.shapes.OVAL, {
      x: p.x - 0.15,
      y: 2.15,
      w: 0.3,
      h: 0.3,
      fill: { color: p.color },
    });
    s.addText(p.label, {
      x: p.x - 0.7,
      y: 1.4,
      w: 1.4,
      h: 0.35,
      fontSize: 10,
      color: C.gray,
      align: "center",
      margin: 0,
    });
    s.addText(p.title, {
      x: p.x - 0.8,
      y: 1.7,
      w: 1.6,
      h: 0.4,
      fontSize: 14,
      color: C.white,
      bold: true,
      align: "center",
      margin: 0,
    });
    s.addText(p.desc, {
      x: p.x - 0.8,
      y: 2.7,
      w: 1.6,
      h: 1.2,
      fontSize: 10,
      color: C.lightText,
      align: "center",
      margin: 0,
    });
  });

  s.addText(
    "技術基盤（LINE↔Claude連携・SNS自動投稿・カレンダー連携）は既に構築・運用済み",
    {
      x: 0.8,
      y: 4.3,
      w: 8.5,
      h: 0.5,
      fontSize: 13,
      fontFace: "Arial",
      color: C.light,
      align: "center",
      margin: 0,
    }
  );
}

// ===== SLIDE 11: チーム & 投資計画 =====
{
  const s = pres.addSlide();
  s.background = { color: C.navy };

  s.addText("チーム & 投資計画", {
    x: 0.8,
    y: 0.3,
    w: 8.5,
    h: 0.7,
    fontSize: 26,
    fontFace: "Arial",
    color: C.white,
    bold: true,
    margin: 0,
  });

  // 技術基盤カード
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5,
    y: 1.1,
    w: 4.3,
    h: 3.0,
    fill: { color: C.deepBlue },
    shadow: makeShadow(),
  });
  s.addText("構築済みの技術基盤", {
    x: 0.7,
    y: 1.2,
    w: 3.9,
    h: 0.45,
    fontSize: 15,
    color: C.white,
    bold: true,
    margin: 0,
  });
  s.addText(
    [
      {
        text: "LINE ↔ Claude Code 双方向連携",
        options: { bullet: true, breakLine: true },
      },
      {
        text: "仮想組織AI（8部門・自律運用中）",
        options: { bullet: true, breakLine: true },
      },
      {
        text: "note.com / Threads 自動投稿",
        options: { bullet: true, breakLine: true },
      },
      {
        text: "Googleカレンダー双方向連携",
        options: { bullet: true, breakLine: true },
      },
      {
        text: "ブラウザ自動操作基盤",
        options: { bullet: true, breakLine: true },
      },
      {
        text: "コマンド体系 & 部門メンション",
        options: { bullet: true },
      },
    ],
    {
      x: 0.7,
      y: 1.7,
      w: 3.9,
      h: 2.2,
      fontSize: 11,
      color: C.light,
      fontFace: "Arial",
      margin: 0,
    }
  );

  // 投資計画カード
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.2,
    y: 1.1,
    w: 4.3,
    h: 3.0,
    fill: { color: C.deepBlue },
    shadow: makeShadow(),
  });
  s.addText("必要投資額", {
    x: 5.4,
    y: 1.2,
    w: 3.9,
    h: 0.45,
    fontSize: 15,
    color: C.white,
    bold: true,
    margin: 0,
  });

  s.addText(
    [
      {
        text: "開発費（3ヶ月）",
        options: { bold: true, breakLine: true, fontSize: 11 },
      },
      {
        text: "¥0（自社リソースで開発）",
        options: { breakLine: true, fontSize: 10, color: C.light },
      },
      { text: "", options: { breakLine: true, fontSize: 5 } },
      {
        text: "マーケティング",
        options: { bold: true, breakLine: true, fontSize: 11 },
      },
      {
        text: "¥300,000（LP制作 + 広告費 3ヶ月分）",
        options: { breakLine: true, fontSize: 10, color: C.light },
      },
      { text: "", options: { breakLine: true, fontSize: 5 } },
      {
        text: "インフラ・API費",
        options: { bold: true, breakLine: true, fontSize: 11 },
      },
      {
        text: "¥50,000/月（Claude API + サーバー）",
        options: { breakLine: true, fontSize: 10, color: C.light },
      },
      { text: "", options: { breakLine: true, fontSize: 5 } },
      {
        text: "合計初期投資: ¥500,000",
        options: { bold: true, fontSize: 14, color: C.accent },
      },
    ],
    {
      x: 5.4,
      y: 1.7,
      w: 3.9,
      h: 2.2,
      fontFace: "Arial",
      color: C.white,
      margin: 0,
    }
  );

  // 投資回収の根拠
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5,
    y: 4.3,
    w: 9,
    h: 0.8,
    fill: { color: C.accent },
  });
  s.addText(
    [
      {
        text: "投資回収シナリオ: ",
        options: { bold: true },
      },
      {
        text: "50人 × 平均月額12,000円 = 月商60万円（6ヶ月目目標）。累計投資50万円を6ヶ月目で回収。",
      },
    ],
    {
      x: 0.7,
      y: 4.3,
      w: 8.6,
      h: 0.8,
      fontSize: 13,
      fontFace: "Arial",
      color: C.white,
      align: "center",
      valign: "middle",
      margin: 0,
    }
  );
}

// ===== SLIDE 12: 出典一覧 =====
{
  const s = pres.addSlide();
  s.background = { color: C.bg };

  s.addText("出典・参考資料", {
    x: 0.8,
    y: 0.3,
    w: 8.5,
    h: 0.6,
    fontSize: 24,
    fontFace: "Arial",
    color: C.navy,
    bold: true,
    margin: 0,
  });

  const sources = [
    "総務省「令和4年 就業構造基本調査」(2022) — フリーランス人口209万人",
    "ランサーズ「フリーランス実態調査2024」 — 広義フリーランス1,303万人、AI興味なし約5割",
    "フリーランス協会「フリーランス白書2024」 — 事務負担25%回答、協働実態",
    "フリーランス協会「フリーランス白書2025」 — 収入0円月32.4%、収入不満40.2%",
    "フリマド「フリーランスのSaaS利用に関するアンケート調査」(2023, n=109) — SaaS利用率77%、月額支出分布",
    "マネーフォワード — 個人事業主の雇用コスト（給与の約2倍）",
    "IDC Japan「2024年 国内AIシステム市場予測」 — 2024年1.3兆円、2029年4.2兆円",
    "矢野経済研究所「対話型AIシステム市場調査」 — チャットボット市場CAGR 22.9%",
    "LINEヤフー プレスリリース (2026年1月) — LINE MAU 1億人超、カバー率96%",
    "モビルス「LINE公式アカウント利用実態調査2025」(n=655) — チャット問い合わせ希望6割超",
    "BPOテクノロジー (2023) — 日本のオンラインアシスタント利用率3%（米国約70%）",
    "HELP YOU「オンライン秘書サービス比較15選」(2025) — 人間VA料金相場",
    "野村総合研究所 (2025, n=6,156) — 中小企業AI導入率14.9%",
  ];

  s.addText(
    sources.map((src, i) => ({
      text: `${i + 1}. ${src}`,
      options: { breakLine: true, fontSize: 8, color: C.darkText },
    })),
    {
      x: 0.5,
      y: 0.95,
      w: 9,
      h: 4.2,
      fontFace: "Arial",
      margin: 0,
      lineSpacingMultiple: 1.4,
    }
  );
}

const outPath =
  "/Users/hirotodev0622i/Desktop/company-test/.company/newbiz/pitches/marunage-ai-deck.pptx";
pres.writeFile({ fileName: outPath }).then(() => {
  console.log("Created: " + outPath);
});
