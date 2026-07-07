import type { ShallowUnwrapRef, VNodeRef } from "vue";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { ForwardedRef } from "../packages/runtime/src";
import { analyzeVueSfc, getVueComponentImports, transformVueSfc } from "../packages/core/src";

describe("script setup forwarded ref transform", () => {
  it("injects defineProps and replaces useForwardedRef with generated props access", () => {
    const result = transformVueSfc(`
<script setup lang="ts">
import { useForwardedRef } from "vue-refx"

const ref = useForwardedRef<HTMLInputElement>()
</script>
`);

    expect(result.hasChanged).toBe(true);
    expect(result.hasUseForwardedRef).toBe(true);
    expect(result.code).toContain(`import type { ForwardedRef } from "vue-refx"`);
    expect(result.code).toContain(
      `const props = defineProps<{ __forwarded_ref__?: ForwardedRef<HTMLInputElement> | ((value: any) => void) }>()`,
    );
    expect(result.code).toContain(`const ref = props.__forwarded_ref__`);
    expect(result.code).not.toContain("useForwardedRef<HTMLInputElement>()");
    expect(result.code).not.toContain(`import { useForwardedRef } from "vue-refx"`);
  });

  it("does not transform useForwardedRef without an import", () => {
    const result = transformVueSfc(`
<script setup lang="ts">
const ref = useForwardedRef<HTMLInputElement>()
</script>
`);

    expect(result.hasChanged).toBe(false);
    expect(result.hasUseForwardedRef).toBe(false);
    expect(result.code).toContain("useForwardedRef<HTMLInputElement>()");
  });

  it("merges with an existing defineProps declaration", () => {
    const result = transformVueSfc(`
<script setup lang="ts">
import { useForwardedRef } from "vue-refx"

type Props = { label: string }
const props = defineProps<Props>()
const inputRef = useForwardedRef()
</script>
`);

    expect(result.code).toContain(
      `defineProps<Props & { __forwarded_ref__?: ForwardedRef<any> | ((value: any) => void) }>()`,
    );
    expect(result.code).toContain(`const inputRef = props.__forwarded_ref__`);
    expect((result.code.match(/defineProps/g) ?? []).length).toBe(1);
  });

  it("keeps the local variable name and generic type", () => {
    const result = transformVueSfc(`
<script setup lang="ts">
import { useForwardedRef } from "vue-refx"

const inputRef = useForwardedRef<HTMLDivElement>()
</script>
`);

    expect(result.code).toContain(`const inputRef = props.__forwarded_ref__`);
    expect(result.code).toContain(`ForwardedRef<HTMLDivElement>`);
  });

  it("recognizes import aliases", () => {
    const result = transformVueSfc(`
<script setup lang="ts">
import { useForwardedRef as forwarded } from "vue-refx"

const inputRef = forwarded<HTMLInputElement>()
</script>
`);

    expect(result.code).toContain(`const inputRef = props.__forwarded_ref__`);
    expect(result.code).toContain(`ForwardedRef<HTMLInputElement>`);
    expect(result.code).not.toContain("forwarded<HTMLInputElement>()");
  });

  it("aliases the generated ForwardedRef import when the name is already bound", () => {
    const result = transformVueSfc(`
<script setup lang="ts">
import { useForwardedRef } from "vue-refx"

type ForwardedRef = { local: true }
const inputRef = useForwardedRef<HTMLInputElement>()
</script>
`);

    expect(result.code).toContain(`import type { ForwardedRef as __ForwardedRef } from "vue-refx"`);
    expect(result.code).toContain(`__ForwardedRef<HTMLInputElement>`);
  });

  it("keeps forwarded refs assignable to DOM ref bindings after template unwrapping", () => {
    type TemplateRef = ShallowUnwrapRef<{
      ref: ForwardedRef<HTMLInputElement> | ((value: any) => void) | undefined;
    }>["ref"];

    expectTypeOf<TemplateRef>().toMatchTypeOf<VNodeRef | undefined>();
  });

  it("creates defineExpose from the factory API", () => {
    const result = transformVueSfc(`
<script setup lang="ts">
import { useForwardedRef } from "vue-refx"

function focus() {}
function blur() {}

const ref = useForwardedRef(() => ({
  focus,
  blur
}))
</script>
`);

    expect(result.code).toContain(`defineExpose({\n  focus,\n  blur\n})`);
    expect(result.code).toContain(`const ref = props.__forwarded_ref__`);
    expect(result.code).not.toContain("useForwardedRef(()");
  });

  it("merges factory expose entries into an existing defineExpose object", () => {
    const result = transformVueSfc(`
<script setup lang="ts">
import { useForwardedRef } from "vue-refx"

defineExpose({
  open,
})

const ref = useForwardedRef(() => ({
  close,
}))
</script>
`);

    expect(result.code).toContain(`defineExpose({\n  open,\n  close\n})`);
    expect((result.code.match(/defineExpose/g) ?? []).length).toBe(1);
  });

  it("preserves spread entries when merging defineExpose", () => {
    const result = transformVueSfc(`
<script setup lang="ts">
import { useForwardedRef } from "vue-refx"

defineExpose({
  ...methods,
})

const ref = useForwardedRef(() => ({
  close,
}))
</script>
`);

    expect(result.code).toContain(`defineExpose({\n  ...methods,\n  close\n})`);
    expect((result.code.match(/defineExpose/g) ?? []).length).toBe(1);
  });
});

describe("template transform", () => {
  it("moves component refs to __forwarded_ref__ only for known forwarded-ref components", () => {
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
        forwardedRefComponents: ["A", "B"],
      },
    );

    expect(result.code).toContain(
      `<A :__forwarded_ref__="(value) => typeof a === &quot;function&quot; ? a(value) : (a = value)" />`,
    );
    expect(result.code).toContain(
      `<B :__forwarded_ref__="(value) => typeof b === &quot;function&quot; ? b(value) : (b = value)" />`,
    );
    expect(result.code).not.toContain(`ref="a"`);
    expect(result.code).not.toContain(`:ref="b"`);
    expect(result.code).toContain(`<C />`);
    expect(result.code).toContain(`<div ref="el" />`);
  });

  it("does not inject into DOM refs", () => {
    const result = transformVueSfc(
      `
<template>
  <div ref="el" />
</template>
`,
      {
        forwardedRefComponents: ["div"],
      },
    );

    expect(result.hasChanged).toBe(false);
    expect(result.code).not.toContain("__forwarded_ref__");
  });

  it("does not inject when the target component is not marked as a forwarded-ref user", () => {
    const result = transformVueSfc(
      `
<template>
  <MyInput ref="input" />
</template>
`,
      {
        forwardedRefComponents: [],
      },
    );

    expect(result.hasChanged).toBe(false);
    expect(result.code).not.toContain("__forwarded_ref__");
  });

  it("matches kebab-case component tags", () => {
    const result = transformVueSfc(
      `
<template>
  <my-input ref="input" />
</template>
`,
      {
        forwardedRefComponents: ["MyInput"],
      },
    );

    expect(result.code).toContain(
      `:__forwarded_ref__="(value) => typeof input === &quot;function&quot; ? input(value) : (input = value)"`,
    );
    expect(result.code).not.toContain(`ref="input"`);
  });
});

describe("analysis helpers", () => {
  it("detects imported useForwardedRef usage and vue imports", () => {
    const code = `
<script setup lang="ts">
import { useForwardedRef } from "vue-refx"
import MyInput from "./MyInput.vue"

const ref = useForwardedRef<HTMLInputElement>()
</script>
`;

    expect(analyzeVueSfc(code).hasUseForwardedRef).toBe(true);
    expect(getVueComponentImports(code)).toEqual([
      {
        local: "MyInput",
        source: "./MyInput.vue",
      },
    ]);
  });

  it("keeps source maps disabled by default and available when requested", () => {
    const source = `
<script setup lang="ts">
import { useForwardedRef } from "vue-refx"

const ref = useForwardedRef<HTMLInputElement>()
</script>
`;
    const withoutMap = transformVueSfc(source, { filename: "MyInput.vue" });
    const withMap = transformVueSfc(source, {
      filename: "MyInput.vue",
      sourceMap: true,
    });

    expect(withoutMap.map).toBeNull();
    expect(withMap.map).not.toBeNull();
    expect(withMap.map?.sources).toEqual(["MyInput.vue"]);
    expect(withMap.map?.sourcesContent).toEqual([source]);
  });
});
