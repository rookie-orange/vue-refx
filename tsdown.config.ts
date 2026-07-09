import { defineConfig, type UserConfig } from "tsdown";

const shared: UserConfig = {
  dts: true,
  format: ["esm", "cjs"],
  sourcemap: true,
  target: "es2022",
  fixedExtension: false,
  hash: false,
  deps: {
    neverBundle: ["vite", "vue", "@vue/language-core"],
    dts: {
      neverBundle: ["vite", "vue", "@vue/language-core"],
    },
  },
  outputOptions: {
    exports: "auto",
  },
  outExtensions({ format }) {
    return {
      js: format === "cjs" ? ".cjs" : ".js",
      dts: format === "cjs" ? ".d.cts" : ".d.ts",
    };
  },
};

export default defineConfig([
  {
    ...shared,
    entry: {
      vite: "packages/vite/src/index.ts",
      runtime: "packages/runtime/src/index.ts",
    },
    clean: true,
    outputOptions: {
      exports: "named",
    },
  },
  {
    ...shared,
    entry: {
      volar: "packages/volar/src/index.ts",
    },
    clean: false,
    outputOptions: {
      exports: "auto",
    },
  },
]);
