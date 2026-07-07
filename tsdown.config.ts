import { defineConfig } from "tsdown"

export default defineConfig({
  entry: {
    vite: "packages/vite/src/index.ts",
    runtime: "packages/runtime/src/index.ts"
  },
  clean: true,
  dts: true,
  format: ["esm", "cjs"],
  sourcemap: true,
  target: "es2022",
  fixedExtension: false,
  hash: false,
  deps: {
    neverBundle: ["vite", "vue"]
  },
  outputOptions: {
    exports: "named"
  },
  outExtensions({ format }) {
    return {
      js: format === "cjs" ? ".cjs" : ".js",
      dts: format === "cjs" ? ".d.cts" : ".d.ts"
    }
  }
})
