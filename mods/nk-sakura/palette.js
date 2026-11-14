// Neo-Kyoto palette (gruvbox). Mods can't import across folders, so each nk mod carries a copy.

// Font for the kanji labels; used only if fonts() lists it, else the default UI font.
export const FONT_JP = "Kosugi Maru";

export const P = {
  bg: "#0f0f0f",
  bg1: "#1d2021",
  fg: "#ebdbb2",
  fg4: "#a89984",
  pink: "#d3869b",
  deep: "#b16286",
  aqua: "#8ec07c",
  orange: "#fe8019",
  yellow: "#fabd2f",
  red: "#fb4934",
  grey: "#928374",
  bark: "#504945",
  barkLight: "#7c6f64",
};

export const KANJI = { working: "稼働", idle: "待機", blocked: "警告", done: "完了", unknown: "不明" };

export const STATUS_COLOR = {
  working: P.aqua,
  idle: P.grey,
  blocked: P.orange,
  done: P.pink,
  unknown: P.grey,
};

export const statusColor = (s) => STATUS_COLOR[s] ?? STATUS_COLOR.unknown;
export const kanji = (s) => KANJI[s] ?? KANJI.unknown;
