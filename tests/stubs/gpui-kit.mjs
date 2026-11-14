// Records builder calls so tests can inspect what a helper produced.
const el = () => new Proxy({ calls: [] }, { get: (t, k) => k in t ? t[k] : (...a) => { t.calls.push([k, ...a]); return el.self(t); } });
el.self = (t) => new Proxy(t, { get: (o, k) => k in o ? o[k] : (...a) => { o.calls.push([k, ...a]); return el.self(o); } });
export const div = () => el();
export const PathBuilder = { fill: () => el(), stroke: () => el() };
export const Background = { pattern_slash: (...a) => ({ pattern_slash: a }) };
