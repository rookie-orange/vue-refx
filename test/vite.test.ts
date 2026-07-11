import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import ForwardRef from "../packages/vite/src";

const tempDirs: string[] = [];

interface VitePluginShape {
  transform?: unknown;
  vite?: {
    configureServer?: (server: unknown) => void;
    handleHotUpdate?: (ctx: {
      file: string;
      modules: Array<{ id: string }>;
      read: () => Promise<string>;
    }) => Promise<Array<{ id: string }> | undefined>;
  };
}

describe("vite plugin", () => {
  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    );
  });

  it("injects template ref props only for imported components that use defineForwardRef", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vue-refx-"));
    tempDirs.push(dir);

    const child = path.join(dir, "MyInput.vue");
    const parent = path.join(dir, "Parent.vue");
    const plain = path.join(dir, "Plain.vue");
    const exposeOnly = path.join(dir, "ExposeOnly.vue");

    await fs.writeFile(
      child,
      `<script setup lang="ts">
import { defineForwardRef } from "vue-refx"

defineForwardRef("input")
</script>
<template><input ref="input" /></template>
`,
    );
    await fs.writeFile(plain, `<template><section /></template>`);
    await fs.writeFile(
      exposeOnly,
      `<script setup lang="ts">
import { defineForwardRef } from "vue-refx"

defineForwardRef(() => ({
  focus() {}
}))
</script>
<template><input /></template>
`,
    );

    const parentCode = `<script setup lang="ts">
import MyInput from "./MyInput.vue"
import Plain from "./Plain.vue"
import ExposeOnly from "./ExposeOnly.vue"
</script>
<template>
  <MyInput ref="input" />
  <Plain ref="plain" />
  <ExposeOnly ref="api" />
  <div ref="el" />
</template>
`;
    await fs.writeFile(parent, parentCode);

    const pluginOrPlugins = ForwardRef();
    const plugin = (
      Array.isArray(pluginOrPlugins) ? pluginOrPlugins[0] : pluginOrPlugins
    ) as VitePluginShape;
    const transform = plugin.transform;
    const result = await callTransform(transform, parentCode, parent);

    expect(result?.code).toContain(`MyInput :__forwarded_ref__="(value) => input = value"`);
    expect(result?.code).not.toContain(`MyInput ref="input"`);
    expect(result?.code).toContain(`<Plain ref="plain" />`);
    expect(result?.code).toContain(`<ExposeOnly ref="api" />`);
    expect(result?.code).toContain(`<div ref="el" />`);
  });

  it("returns importer modules during HMR when a forwarded-ref child changes", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vue-refx-hmr-"));
    tempDirs.push(dir);

    const child = path.join(dir, "MyInput.vue");
    const parent = path.join(dir, "Parent.vue");
    const childCode = `<script setup lang="ts">
import { defineForwardRef } from "vue-refx"

defineForwardRef("input")
</script>
<template><input ref="input" /></template>
`;
    const parentCode = `<script setup lang="ts">
import MyInput from "./MyInput.vue"
</script>
<template><MyInput ref="input" /></template>
`;

    await fs.writeFile(child, childCode);
    await fs.writeFile(parent, parentCode);

    const pluginOrPlugins = ForwardRef();
    const plugin = (
      Array.isArray(pluginOrPlugins) ? pluginOrPlugins[0] : pluginOrPlugins
    ) as VitePluginShape;
    const modules = new Map<string, { id: string }>();
    modules.set(parent, { id: parent });

    if (
      plugin.vite &&
      "configureServer" in plugin.vite &&
      typeof plugin.vite.configureServer === "function"
    ) {
      plugin.vite.configureServer({
        moduleGraph: {
          getModuleById(id: string) {
            return modules.get(id);
          },
          invalidateModule() {},
        },
      });
    }

    await callTransform(plugin.transform, parentCode, parent);

    const result = await plugin.vite?.handleHotUpdate?.({
      file: child,
      modules: [{ id: child }],
      read: async () => childCode,
    });

    expect(result?.map((module: { id: string }) => module.id)).toEqual([child, parent]);
  });
});

async function callTransform(
  transform: unknown,
  code: string,
  id: string,
): Promise<{ code: string } | null | undefined> {
  const context = {
    async resolve(source: string, importer?: string) {
      if (!importer || !source.startsWith(".")) {
        return null;
      }

      const resolved = path.resolve(path.dirname(importer), source);
      return { id: resolved };
    },
    addWatchFile() {},
  };

  if (typeof transform === "function") {
    return await transform.call(context, code, id);
  }

  if (transform && typeof transform === "object" && "handler" in transform) {
    const handler = transform.handler;

    if (typeof handler === "function") {
      return await handler.call(context, code, id);
    }
  }

  throw new Error("Missing transform hook.");
}
