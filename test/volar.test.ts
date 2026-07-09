import { parse } from "@vue/compiler-dom";
import * as CompilerDOM from "@vue/compiler-dom";
import {
  getDefaultCompilerOptions,
  type Code,
  type IR,
  type IRScriptSetup,
  type IRTemplate,
  type VueEmbeddedCode,
} from "@vue/language-core";
import * as LanguageCore from "@vue/language-core";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import VueRefxVolar from "../packages/volar/src";

describe("volar plugin", () => {
  it("adds template ref name completion anchors for generic defineForwardRef calls", () => {
    const source = [
      `import { defineForwardRef } from "vue-refx";`,
      `const input = defineForwardRef<HTMLInputElement>("", () => ({}));`,
    ].join("\n");
    const content = runPlugin(source, ["input", "wrapper"]);

    expect(stringifyContent(content)).toContain("type __VLS_RefxTemplateRefs");
    expect(stringifyContent(content)).toContain(`"input": unknown;`);
    expect(stringifyContent(content)).toContain(`"wrapper": unknown;`);
    expect(findMappedString(content)).toEqual([
      `""`,
      "scriptSetup",
      source.indexOf(`""`),
      { completion: true },
    ]);
  });

  it("supports aliased defineForwardRef imports", () => {
    const source = [`import { defineForwardRef as forward } from "vue-refx";`, `forward("");`].join(
      "\n",
    );
    const content = runPlugin(source, ["input"]);

    expect(findMappedString(content)).toEqual([
      `""`,
      "scriptSetup",
      source.indexOf(`""`),
      { completion: true },
    ]);
  });

  it("skips expose-only defineForwardRef calls", () => {
    const source = [
      `import { defineForwardRef } from "vue-refx";`,
      `defineForwardRef(() => ({ focus() {} }));`,
    ].join("\n");

    expect(runPlugin(source, ["input"])).toEqual([]);
  });

  it("does not match local functions without a vue-refx import", () => {
    const source = [`function defineForwardRef(_name: string) {}`, `defineForwardRef("");`].join(
      "\n",
    );

    expect(runPlugin(source, ["input"])).toEqual([]);
  });
});

function runPlugin(source: string, refs: string[]): Code[] {
  const pluginResult = VueRefxVolar({
    modules: {
      typescript: ts,
      "@vue/compiler-dom": CompilerDOM,
      "@vue/language-core": LanguageCore,
    },
    compilerOptions: {},
    vueCompilerOptions: getDefaultCompilerOptions(),
    config: {},
  });
  const plugin = Array.isArray(pluginResult) ? pluginResult[0] : pluginResult;
  const embeddedFile: VueEmbeddedCode = {
    id: "script_ts",
    lang: "ts",
    content: [],
    linkedCodeMappings: [],
    embeddedCodes: [],
  };

  plugin.resolveEmbeddedCode?.("Component.vue", createIr(source, refs), embeddedFile);

  return embeddedFile.content;
}

function createIr(source: string, refs: string[]): IR {
  const templateContent = refs.map((ref) => `<input ref="${ref}" />`).join("\n");

  return {
    content: "",
    comments: [],
    template: createTemplateBlock(templateContent),
    script: undefined,
    scriptSetup: createScriptSetupBlock(source),
    styles: [],
    customBlocks: [],
  };
}

function createScriptSetupBlock(source: string): IRScriptSetup {
  return {
    name: "scriptSetup",
    start: 0,
    end: source.length,
    startTagEnd: 0,
    endTagStart: source.length,
    lang: "ts",
    content: source,
    attrs: {},
    generic: undefined,
    ast: ts.createSourceFile("Component.vue.ts", source, ts.ScriptTarget.Latest, true),
  };
}

function createTemplateBlock(content: string): IRTemplate {
  return {
    name: "template",
    start: 0,
    end: content.length,
    startTagEnd: 0,
    endTagStart: content.length,
    lang: "html",
    content,
    attrs: {},
    ast: parse(content),
    errors: [],
    warnings: [],
  };
}

function stringifyContent(content: Code[]): string {
  return content.map((item) => (Array.isArray(item) ? item[0] : item)).join("");
}

function findMappedString(content: Code[]): Code | undefined {
  return content.find((item) => Array.isArray(item) && item[0] === `""`);
}
