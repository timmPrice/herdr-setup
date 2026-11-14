// Pure helpers for ph-tabs (no imports: node-testable).

/** "1:build". Unnamed tabs show their agent's program (else "sh"), as the shipped tabs mod does. */
export function tabLabel(tab, program) {
  const name = tab?.named ? tab.name : program || "sh";
  return `${tab?.index ?? "?"}:${name}`;
}

/** First-frame width guess before on_size_change measures the tab (Share Tech Mono 13px ≈ 7px/char). */
export function estWidth(label, tab) {
  let w = 20 + Math.min(220, String(label).length * 7);
  if (tab?.zoomed) w += 28;
  if (tab?.status && tab.status !== "idle") w += 13;
  if (tab?.active) w += 13;
  return Math.round(w);
}
