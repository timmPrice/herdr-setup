// PHOSPHOR palette: gruvbox dark hard + phosphor. Each colour has ONE meaning.
// Canonical copy: lib/palette.js (tools/sync-lib.sh copies it into every mods/ph-*/lib/).
// Pure: no imports, so node tests can load it.

export const P = {
  void: "#0b0a07",     // chrome background
  pane: "#12110e",     // pane / terminal background
  panel: "#1a1916",
  panel2: "#211f1b",
  line: "#3c3836",
  grey: "#504945",
  dim: "#7c6f64",      // idle
  dim2: "#a89984",     // plain shell
  fg: "#ebdbb2",       // chrome text
  fgTerm: "#e6d3a8",   // terminal text
  amber: "#fabd2f",    // focus / selection / you are here (ONLY)
  aqua: "#8ec07c",     // working
  red: "#fb4934",      // blocked, needs you
  green: "#b8bb26",    // done
  orange: "#fe8019",   // "thinking" label only
};

// Font family names (fc-scan family, not file names). Files live in mods/ph-kit/fonts/.
export const FONT_UI = "Share Tech Mono";   // chrome labels (layout ui_font)
export const FONT_NUM = "VT323";            // numeric readouts; renders small, use ~1.4x px
export const FONT_MARK = "PH Wordmark";     // wordmark only: Orbitron Black, ASCII subset, renamed (OFL Reserved Font Name)
export const FONT_JP = "Kosugi Maru";       // kanji accents (subset: see README)
export const FONT_TERM = "JetBrains Mono";  // terminals + glyphs Share Tech lacks: ↑↓▲■█ and status tags

// The display state of a pane/agent. Herdr's Status plus "shell" for a plain terminal (status null).
// rank: sidebar order WAIT > OK > RUN > IDLE > SH.
export const STATES = {
  blocked: { key: "blocked", tag: "[WAIT]", short: "WAIT", kanji: "要求", color: P.red, rank: 0 },
  done: { key: "done", tag: "[ OK ]", short: "OK", kanji: "完了", color: P.green, rank: 1 },
  working: { key: "working", tag: "[ RUN ]", short: "RUN", kanji: "稼働", color: P.aqua, rank: 2 },
  idle: { key: "idle", tag: "[IDLE]", short: "IDLE", kanji: "待機", color: P.dim, rank: 3 },
  shell: { key: "shell", tag: "[ SH ]", short: "SH", kanji: "端末", color: P.dim2, rank: 4 },
};

// Section labels (kanji accents).
export const KANJI = {
  nodes: "節点", daemons: "常駐", events: "記録", telemetry: "計測", boot: "起動",
  working: "稼働", blocked: "要求", done: "完了", idle: "待機", shell: "端末",
};

/** Status (or null/undefined/unknown) → a STATES entry. null = plain shell. */
export function stateOf(status) {
  return STATES[status] ?? STATES.shell;
}
export const statusColor = (status) => stateOf(status).color;
export const statusTag = (status) => stateOf(status).tag;
export const statusKanji = (status) => stateOf(status).kanji;

/** Sort comparator: most urgent first (WAIT > OK > RUN > IDLE > SH), then by `seq` (oldest first). */
export function byUrgency(a, b) {
  const r = stateOf(a?.status).rank - stateOf(b?.status).rank;
  return r !== 0 ? r : (a?.seq ?? 0) - (b?.seq ?? 0);
}

/** "#rrggbb" + alpha 0..1 (or 0..255 int when > 1) → "#rrggbbaa". */
export function alpha(hex, a) {
  const v = a > 1 ? Math.round(a) : Math.round(a * 255);
  const n = Math.max(0, Math.min(255, v));
  return hex.slice(0, 7) + n.toString(16).padStart(2, "0");
}
