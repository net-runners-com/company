/**
 * PPTX → SVGスライド変換 → Cloudflare Workers KVにアップロード
 * Usage: npx tsx convert-pptx.ts <pptx-file>
 * 出力: プレビューURL
 */
import { readFileSync } from "fs";
import { convertPptxToSvg } from "pptx-glimpse";

const WORKER_URL = process.env.PREVIEW_WORKER_URL || "https://article-preview.hirotodev-line-crm.workers.dev";

async function main() {
  const pptxPath = process.argv[2];
  if (!pptxPath) {
    console.error("Usage: npx tsx convert-pptx.ts <pptx-file>");
    process.exit(1);
  }

  const pptxBuffer = readFileSync(pptxPath);
  const filename = pptxPath.split("/").pop() || "presentation.pptx";

  console.error(`Converting ${filename}...`);
  const fontDir = new URL("./fonts", import.meta.url).pathname;
  const NOTO = "Noto Sans CJK JP";
  const svgResults = await convertPptxToSvg(pptxBuffer, {
    fontDirs: [
      fontDir,
      "/System/Library/Fonts",
      "/System/Library/Fonts/Supplemental",
      "/Library/Fonts",
    ],
    fontMapping: {
      "Arial": NOTO,
      "Arial Black": NOTO,
      "Calibri": NOTO,
      "Calibri Light": NOTO,
      "Yu Gothic": NOTO,
      "Yu Gothic Light": NOTO,
      "游ゴシック": NOTO,
      "游ゴシック Light": NOTO,
      "MS PGothic": NOTO,
      "MS Pゴシック": NOTO,
      "ＭＳ Ｐゴシック": NOTO,
      "Meiryo": NOTO,
      "メイリオ": NOTO,
      "Segoe UI": NOTO,
      "Times New Roman": NOTO,
      "Noto Sans JP": NOTO,
    },
  });

  // スライドをHTMLにまとめる
  const slidesHtml = svgResults
    .sort((a, b) => a.slideNumber - b.slideNumber)
    .map(
      (s) =>
        `<div class="slide"><div class="slide-num">${s.slideNumber} / ${svgResults.length}</div>${s.svg}</div>`
    )
    .join("\n");

  const title = filename.replace(/\.pptx?$/i, "");
  const markdown = `__PPTX_HTML__${slidesHtml}`;

  // Workers API に POST（markdownフィールドにHTMLを詰める）
  const res = await fetch(`${WORKER_URL}/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, markdown }),
  });

  const data = (await res.json()) as { url?: string };
  if (data.url) {
    // URLにpptxクエリを付けてWorker側でスライドビューアを返す
    console.log(`${data.url}?type=pptx`);
  } else {
    console.error("Failed:", data);
    process.exit(1);
  }
}

main();
