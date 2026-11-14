const map = { herdr: "herdr.mjs", "gpui-kit": "gpui-kit.mjs", "gpui-base": "gpui-kit.mjs" };
export async function resolve(spec, ctx, next) {
  if (map[spec]) return { url: new URL(map[spec], import.meta.url).href, shortCircuit: true };
  return next(spec, ctx);
}
