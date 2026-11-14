// Neo-Kyoto palette (gruvbox). Each nk mod carries its own copy: Herdr mods can't import
// from another mod's folder. Keep the copies identical.

export const P = {
  bg: "#0f0f0f",
  fg: "#ebdbb2",
  pink: "#d3869b",
  deep: "#b16286",
  aqua: "#8ec07c",
  orange: "#fe8019",
  yellow: "#fabd2f",
  red: "#fb4934",
  grey: "#928374",
};

// Family name inside mods/nk-pane/fonts/DotGothic16-nk.ttf (registered app-wide).
export const JP = "DotGothic16";

export const KANJI = {
  working: "稼働",
  idle: "待機",
  blocked: "警告",
  done: "完了",
  unknown: "不明",
};

const COLORS = { working: P.aqua, idle: P.grey, blocked: P.orange, done: P.pink };

export function statusColor(st) {
  return COLORS[st] ?? P.grey;
}

export function kanji(st) {
  return KANJI[st] ?? KANJI.unknown;
}
