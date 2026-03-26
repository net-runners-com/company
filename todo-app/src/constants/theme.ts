export const C = {
  bg: "#0c1222",
  surface: "#1a2540",
  surfaceLight: "#222f4a",
  border: "#2a3a5c",
  text: "#e8ecf2",
  textMuted: "#8b9bb5",
  textDim: "#5a6a8a",
  amber: "#c57d12",
  amberLight: "#e8a030",
  amberGlow: "#f5c462",
  blue: "#4A90D9",
  green: "#27AE60",
  greenLight: "#2ecc71",
  orange: "#E8960F",
  red: "#E74C3C",
  purple: "#9B59B6",
  white: "#ffffff",
} as const;

export const CATEGORY_COLORS = {
  仕事: C.blue,
  プライベート: C.green,
  買い物: C.orange,
  アイデア: C.purple,
} as const;

export type Category = keyof typeof CATEGORY_COLORS;
export const CATEGORIES = Object.keys(CATEGORY_COLORS) as Category[];
