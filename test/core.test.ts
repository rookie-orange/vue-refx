import { describe, expect, it } from "vitest"
import { analyzeVueSfc, getVueComponentImports, transformVueSfc } from "../packages/core/src"

describe("script setup macro transform", () => {
  it("injects defineProps and replaces useRefProp with the generated props access", () => {
    const result = transformVueSfc(`
<script setup lang="ts">
const ref = useRefProp<HTMLInputElement>()
</script>
`)

    expect(result.hasChanged).toBe(true)
    expect(result.code).toContain(`import type { Ref } from "vue"`)
    expect(result.code).toContain(`const props = defineProps<{ __ref_prop__?: Ref<HTMLInputElement | null> }>()`)
    expect(result.code).toContain(`const ref = props.__ref_prop__`)
    expect(result.code).not.toContain("useRefProp<HTMLInputElement>()")
  })

  it("merges with an existing defineProps declaration", () => {
    const result = transformVueSfc(`
<script setup lang="ts">
type Props = { label: string }
const props = defineProps<Props>()
const inputRef = useRefProp()
</script>
`)

    expect(result.code).toContain(`defineProps<Props & { __ref_prop__?: Ref<any> }>()`)
    expect(result.code).toContain(`const inputRef = props.__ref_prop__`)
    expect((result.code.match(/defineProps/g) ?? []).length).toBe(1)
  })

  it("keeps the local variable name", () => {
    const result = transformVueSfc(`
<script setup lang="ts">
const inputRef = useRefProp<HTMLDivElement>()
</script>
`)

    expect(result.code).toContain(`const inputRef = props.__ref_prop__`)
    expect(result.code).toContain(`Ref<HTMLDivElement | null>`)
  })
})

describe("template transform", () => {
  it("adds __ref_prop__ only to known ref-prop components", () => {
    const result = transformVueSfc(
      `
<script setup lang="ts">
import A from "./A.vue"
import B from "./B.vue"
import C from "./C.vue"
</script>
<template>
  <A ref="a" />
  <B :ref="b" />
  <C />
  <div ref="el" />
</template>
`,
      {
        refPropComponents: ["A", "B"]
      }
    )

    expect(result.code).toContain(`<A ref="a"  :__ref_prop__="a"/>`)
    expect(result.code).toContain(`<B :ref="b"  :__ref_prop__="b"/>`)
    expect(result.code).toContain(`<C />`)
    expect(result.code).toContain(`<div ref="el" />`)
  })

  it("does not inject when the target component is not marked as a macro user", () => {
    const result = transformVueSfc(
      `
<template>
  <MyInput ref="input" />
</template>
`,
      {
        refPropComponents: []
      }
    )

    expect(result.hasChanged).toBe(false)
    expect(result.code).not.toContain("__ref_prop__")
  })

  it("matches kebab-case component tags", () => {
    const result = transformVueSfc(
      `
<template>
  <my-input ref="input" />
</template>
`,
      {
        refPropComponents: ["MyInput"]
      }
    )

    expect(result.code).toContain(`:__ref_prop__="input"`)
  })
})

describe("analysis helpers", () => {
  it("detects macro usage and vue imports", () => {
    const code = `
<script setup lang="ts">
import MyInput from "./MyInput.vue"
const ref = useRefProp<HTMLInputElement>()
</script>
`

    expect(analyzeVueSfc(code).hasUseRefProp).toBe(true)
    expect(getVueComponentImports(code)).toEqual([
      {
        local: "MyInput",
        source: "./MyInput.vue"
      }
    ])
  })
})
