// node --import ./tests/stubs/register.mjs: maps the host modules ("herdr", "gpui-kit", "gpui-base")
// to tiny stubs so lib/ modules that import them can be unit-tested in node.
import { register } from "node:module";
register(new URL("./hooks.mjs", import.meta.url));
