import { defineConfig } from "tsup";

// Emit ESM .js + .d.ts for the three public entry points. Source stays raw .ts
// for in-repo dev (Node type-stripping); this dist/ is what npm ships.
export default defineConfig({
  entry: ["src/index.ts", "src/http-counter.ts", "src/redis-counter.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
});
