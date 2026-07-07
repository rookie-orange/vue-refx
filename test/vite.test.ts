import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { afterEach, describe, expect, it } from "vitest"
import RefProp from "../packages/vite/src"

const tempDirs: string[] = []

describe("vite plugin", () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
  })

  it("injects template ref props only for imported components that use the macro", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vue-ref-prop-"))
    tempDirs.push(dir)

    const child = path.join(dir, "MyInput.vue")
    const parent = path.join(dir, "Parent.vue")
    const plain = path.join(dir, "Plain.vue")

    await fs.writeFile(
      child,
      `<script setup lang="ts">
const ref = useRefProp<HTMLInputElement>()
</script>
<template><input :ref="ref" /></template>
`
    )
    await fs.writeFile(plain, `<template><section /></template>`)

    const parentCode = `<script setup lang="ts">
import MyInput from "./MyInput.vue"
import Plain from "./Plain.vue"
</script>
<template>
  <MyInput ref="input" />
  <Plain ref="plain" />
  <div ref="el" />
</template>
`
    await fs.writeFile(parent, parentCode)

    const pluginOrPlugins = RefProp()
    const plugin = Array.isArray(pluginOrPlugins) ? pluginOrPlugins[0] : pluginOrPlugins
    const transform = plugin.transform
    const result = await callTransform(transform, parentCode, parent)

    expect(result?.code).toContain(`MyInput ref="input"  :__ref_prop__="input"`)
    expect(result?.code).toContain(`<Plain ref="plain" />`)
    expect(result?.code).toContain(`<div ref="el" />`)
  })
})

async function callTransform(
  transform: unknown,
  code: string,
  id: string
): Promise<{ code: string } | null | undefined> {
  const context = {
    async resolve(source: string, importer?: string) {
      if (!importer || !source.startsWith(".")) {
        return null
      }

      const resolved = path.resolve(path.dirname(importer), source)
      return { id: resolved }
    },
    addWatchFile() {}
  }

  if (typeof transform === "function") {
    return await transform.call(context, code, id)
  }

  if (transform && typeof transform === "object" && "handler" in transform) {
    const handler = transform.handler

    if (typeof handler === "function") {
      return await handler.call(context, code, id)
    }
  }

  throw new Error("Missing transform hook.")
}
