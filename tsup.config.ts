import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node18",
  clean: true,
  minify: false,
  dts: false,
  // src/cli.ts starts with a shebang, which tsup preserves on the output.
});
