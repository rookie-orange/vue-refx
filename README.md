# vue-refx

[中文](./README.zh-CN.md) | English

Compiler-only forwarded refs for Vue, centered on one macro:

```ts
defineForwardRef();
```

- Zero runtime
- No Vue runtime patch
- Compiler transform only
- TypeScript support
- Works with Vue's existing `ref`

## Installation

```bash
pnpm add vue-refx
```

```ts
import vue from "@vitejs/plugin-vue";
import VueRefx from "vue-refx/vite";

export default defineConfig({
  plugins: [vue(), VueRefx()],
});
```

## Forward Only

```vue
<script setup lang="ts">
import { defineForwardRef } from "vue-refx";

defineForwardRef("input");
</script>

<template>
  <input ref="input" />
</template>
```

A parent can use the component like a native input:

```vue
<script setup lang="ts">
import { ref } from "vue";
import MyInput from "./MyInput.vue";

const input = ref<HTMLInputElement | null>(null);
</script>

<template>
  <MyInput ref="input" />
  <button type="button" @click="input?.focus()">Focus</button>
</template>
```

## Expose Only

Use the same macro when you only need an imperative component API.

```vue
<script setup lang="ts">
import { defineForwardRef } from "vue-refx";

function focus() {}
function blur() {}

defineForwardRef(() => ({
  focus,
  blur,
}));
</script>
```

This compiles to a single `defineExpose()` call. In most components,
`defineForwardRef()` replaces `defineExpose()` so you do not need to mix APIs.

## Forward + Expose

```vue
<script setup lang="ts">
import { defineForwardRef } from "vue-refx";

const input = defineForwardRef<HTMLInputElement>("input", () => ({
  focus,
  blur,
}));

function focus() {
  input.value?.focus();
}

function blur() {
  input.value?.blur();
}
</script>

<template>
  <input ref="input" />
</template>
```

The template ref is forwarded to the parent, and the factory object is merged
into `defineExpose()`.

## Return Value

When assigned, the macro returns a typed Vue ref:

```ts
const input = defineForwardRef<HTMLInputElement>("input");
// Ref<HTMLInputElement | null>
```

When the return value is ignored, no local variable is generated.

## Template Validation

The compiler verifies every forwarded template ref name:

```ts
defineForwardRef("input");
```

must match:

```vue
<input ref="input" />
```

Otherwise compilation fails with:

```text
Cannot find template ref "input".
```

## Runtime

`defineForwardRef()` exists in the runtime package only for TypeScript, IDEs,
and auto import. Every macro call is erased by the compiler transform.
