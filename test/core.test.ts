import type { Ref } from "vue";
import { describe, expect, expectTypeOf, it } from "vitest";
import { defineForwardRef } from "../packages/runtime/src";
import { analyzeVueSfc, getVueComponentImports, transformVueSfc } from "../packages/core/src";

describe("script setup defineForwardRef transform", () => {
  it("forwards a template ref by name", () => {
    const result = transformVueSfc(`
<script setup lang="ts">
import { defineForwardRef } from "vue-refx"

defineForwardRef("input")
</script>
<template>
  <input ref="input" />
</template>
`);

    expect(result.hasChanged).toBe(true);
    expect(result.hasDefineForwardRef).toBe(true);
    expect(result.code).toContain(`import type { Ref } from "vue"`);
    expect(result.code).toContain(
      `const props = defineProps<{ __forwarded_ref__?: Ref<any | null> | ((value: any) => void) }>()`,
    );
    expect(result.code).toContain(`:ref="props.__forwarded_ref__"`);
    expect(result.code).not.toContain("defineForwardRef");
    expect(result.code).not.toContain(`import { defineForwardRef } from "vue-refx"`);
  });

  it("returns a typed Ref when assigned", () => {
    const result = transformVueSfc(`
<script setup lang="ts">
import { defineForwardRef } from "vue-refx"

const input = defineForwardRef<HTMLInputElement>("input")
</script>
<template>
  <input ref="input" />
</template>
`);

    expect(result.code).toContain(`import type { Ref } from "vue"`);
    expect(result.code).toContain(`import { customRef } from "vue"`);
    expect(result.code).toContain(`const input = customRef<HTMLInputElement | null>`);
    expect(result.code).toContain(`as Ref<HTMLInputElement | null>`);
    expect(result.code).toContain(`:ref="(value) => input = value"`);
    expect(result.code).not.toContain(`defineForwardRef<HTMLInputElement>("input")`);
  });

  it("generates defineExpose for expose-only overload", () => {
    const result = transformVueSfc(`
<script setup lang="ts">
import { defineForwardRef } from "vue-refx"

function focus() {}

defineForwardRef(() => ({
  focus,
}))
</script>
<template>
  <input />
</template>
`);

    expect(result.code).toContain(`defineExpose({\n  focus\n})`);
    expect(result.code).not.toContain("defineForwardRef");
    expect(result.code).not.toContain("__forwarded_ref__");
  });

  it("forwards a factory handle built from a template ref", () => {
    const result = transformVueSfc(`
<script setup lang="ts">
import { defineForwardRef } from "vue-refx"

interface InputHandle {
  focus(): void
  input(value: string): void
}

const input = defineForwardRef<HTMLInputElement, InputHandle>("input", (input) => ({
  focus() {
    input.value?.focus()
  },
  input(value: string) {
    if (input.value) {
      input.value.value = value
    }
  },
}))
</script>
<template>
  <input ref="input" />
</template>
`);

    expect(result.code).toContain(
      `const props = defineProps<{ __forwarded_ref__?: Ref<InputHandle | null> | ((value: any) => void) }>()`,
    );
    expect(result.code).toContain(`const input = customRef<HTMLInputElement | null>`);
    expect(result.code).toContain(`const nextTarget = nextValue == null ? null : ((input) => ({`);
    expect(result.code).toContain(`}))(input)`);
    expect(result.code).toContain(`:ref="(value) => input = value"`);
    expect(result.code).not.toContain("defineExpose");
  });

  it("creates a local template ref for statement factory handles", () => {
    const result = transformVueSfc(`
<script setup lang="ts">
import { defineForwardRef } from "vue-refx"

interface InputHandle {
  focus(): void
}

defineForwardRef<HTMLInputElement, InputHandle>("input", (input) => ({
  focus() {
    input.value?.focus()
  },
}))
</script>
<template>
  <input ref="input" />
</template>
`);

    expect(result.code).toContain(`const __forwardedRef = customRef<HTMLInputElement | null>`);
    expect(result.code).toContain(
      `const props = defineProps<{ __forwarded_ref__?: Ref<InputHandle | null> | ((value: any) => void) }>()`,
    );
    expect(result.code).toContain(`}))(__forwardedRef)`);
    expect(result.code).toContain(`:ref="(value) => __forwardedRef = value"`);
    expect(result.code).not.toContain("defineExpose");
  });

  it("merges expose-only overload into an existing defineExpose object", () => {
    const result = transformVueSfc(`
<script setup lang="ts">
import { defineForwardRef } from "vue-refx"

defineExpose({
  open,
  ...methods,
})

defineForwardRef(() => ({
  close,
}))
</script>
<template>
  <input />
</template>
`);

    expect(result.code).toContain(`defineExpose({\n  open,\n  ...methods,\n  close\n})`);
    expect((result.code.match(/defineExpose/g) ?? []).length).toBe(1);
    expect(result.code).not.toContain("defineForwardRef");
  });

  it("throws when the named template ref cannot be found", () => {
    expect(() =>
      transformVueSfc(`
<script setup lang="ts">
import { defineForwardRef } from "vue-refx"

defineForwardRef("input")
</script>
<template>
  <textarea ref="message" />
</template>
`),
    ).toThrow(`Cannot find template ref "input".`);
  });

  it("throws when a forwarded ref component has no template", () => {
    expect(() =>
      transformVueSfc(`
<script setup lang="ts">
import { defineForwardRef } from "vue-refx"

defineForwardRef("input")
</script>
`),
    ).toThrow(`Cannot find template ref "input".`);
  });

  it("supports generic inference from runtime declarations", () => {
    type Input = ReturnType<typeof defineForwardRef<HTMLInputElement>>;

    expectTypeOf<Input>().toEqualTypeOf<Ref<HTMLInputElement | null>>();
    expectTypeOf<Input["value"]>().toEqualTypeOf<HTMLInputElement | null>();

    defineForwardRef<HTMLInputElement>("input", (input) => {
      expectTypeOf(input).toEqualTypeOf<Ref<HTMLInputElement | null>>();

      return {
        focus() {
          input.value?.focus();
        },
      };
    });
  });
});

describe("template transform", () => {
  it("moves component refs to __forwarded_ref__ only for known defineForwardRef components", () => {
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

    expect(result.code).toContain(`<A :__forwarded_ref__="(value) => a = value" />`);
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

    expect(result.code).toContain(`:__forwarded_ref__="(value) => input = value"`);
    expect(result.code).not.toContain(`ref="input"`);
  });
});

describe("analysis helpers", () => {
  it("detects imported defineForwardRef usage and vue imports", () => {
    const code = `
<script setup lang="ts">
import { defineForwardRef } from "vue-refx"
import MyInput from "./MyInput.vue"

defineForwardRef("input")
</script>
<template>
  <input ref="input" />
</template>
`;

    expect(analyzeVueSfc(code).hasDefineForwardRef).toBe(true);
    expect(getVueComponentImports(code)).toEqual([
      {
        local: "MyInput",
        source: "./MyInput.vue",
      },
    ]);
  });

  it("does not mark expose-only calls as forwarded-ref components", () => {
    const code = `
<script setup lang="ts">
import { defineForwardRef } from "vue-refx"

defineForwardRef(() => ({
  focus() {}
}))
</script>
<template>
  <input />
</template>
`;

    const result = transformVueSfc(code);

    expect(result.hasChanged).toBe(true);
    expect(result.hasDefineForwardRef).toBe(false);
    expect(analyzeVueSfc(code).hasDefineForwardRef).toBe(false);
  });

  it("keeps source maps disabled by default and available when requested", () => {
    const source = `
<script setup lang="ts">
import { defineForwardRef } from "vue-refx"

const input = defineForwardRef<HTMLInputElement>("input")
</script>
<template>
  <input ref="input" />
</template>
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
