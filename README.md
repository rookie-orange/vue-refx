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
- One API for ref forwarding and imperative expose

## Why?

Vue already has `defineExpose()`, which is useful when a component wants to
publish methods to its parent. What Vue does not provide is transparent ref
forwarding through component boundaries.

This becomes visible when a simple DOM element is wrapped by design-system or
headless components:

```text
App
 │
 ▼
<MyInput ref="input" />
 │
 ▼
<BaseInput>
 │
 ▼
<InputWrapper>
 │
 ▼
<input>
```

Without ref forwarding, each layer has to decide what to expose and manually
chain that API. With `vue-refx`, each layer can forward its template ref and
the parent still receives the final native input element.

## Use Cases

`vue-refx` is useful for component libraries that wrap native form controls,
headless UI primitives, visual wrappers around third-party widgets, and any
component that should behave like the element it contains.

It also covers imperative component handles. In most components,
`defineForwardRef()` can replace `defineExpose()`, so a component can choose
one unified API for:

- forwarding a real template ref
- exposing methods only
- forwarding a template ref and exposing methods at the same time

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

Enable the Volar plugin in `tsconfig.json` to get template ref name completion
inside `defineForwardRef("...")`:

```jsonc
{
  "vueCompilerOptions": {
    "plugins": ["vue-refx/volar"],
  },
}
```

## Forward Only

Child component:

```vue
<script setup lang="ts">
import { defineForwardRef } from "vue-refx";

defineForwardRef("input");
</script>

<template>
  <input ref="input" />
</template>
```

Parent component:

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

The parent ref points to the native `<input>`, not the `MyInput` component
instance.

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

This compiles to a single `defineExpose()` call.

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

## Forward Through Multiple Components

Every wrapper can use the same macro.

MyInput.vue

```vue
<script setup lang="ts">
import { defineForwardRef } from "vue-refx";

defineForwardRef("input");
</script>

<template>
  <BaseInput ref="input" />
</template>
```

BaseInput.vue

```vue
<script setup lang="ts">
import { defineForwardRef } from "vue-refx";

defineForwardRef("input");
</script>

<template>
  <InputWrapper ref="input" />
</template>
```

InputWrapper.vue

```vue
<script setup lang="ts">
import { defineForwardRef } from "vue-refx";

defineForwardRef("input");
</script>

<template>
  <input ref="input" />
</template>
```

The parent still receives the final native input element.

## Return Value

When assigned, the macro returns a typed Vue ref:

```ts
const input = defineForwardRef<HTMLInputElement>("input");
// Ref<HTMLInputElement | null>
```

The returned ref is useful when the component also needs to read or call the
forwarded element internally.

When the return value is ignored:

```ts
defineForwardRef("input");
```

no local variable is generated.

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

Invalid names are not ignored silently.

## How It Works

`vue-refx` is compiler-only. It rewrites SFCs before Vue compiles them.

Parent component before transform:

```vue
<MyInput ref="input" />
```

Parent component after transform:

```vue
<MyInput :__forwarded_ref__="(value) => (input = value)" />
```

Child component before transform:

```vue
<script setup lang="ts">
import { defineForwardRef } from "vue-refx";

const input = defineForwardRef<HTMLInputElement>("input");
</script>

<template>
  <input ref="input" />
</template>
```

Child component after transform is equivalent to:

```vue
<script setup lang="ts">
import { customRef } from "vue";
import type { Ref } from "vue";

const props = defineProps<{
  __forwarded_ref__?: Ref<HTMLInputElement | null> | ((value: any) => void);
}>();

const input = customRef<HTMLInputElement | null>((track, trigger) => {
  let value = null as HTMLInputElement | null;

  return {
    get() {
      track();
      return value;
    },
    set(nextValue) {
      value = nextValue;
      trigger();

      const target = props.__forwarded_ref__;

      if (typeof target === "function") {
        target(nextValue);
      } else if (target) {
        target.value = nextValue;
      }
    },
  };
}) as Ref<HTMLInputElement | null>;
</script>

<template>
  <input :ref="(value) => (input = value)" />
</template>
```

Every `defineForwardRef()` call is removed during compilation. The runtime
export exists only for TypeScript, IDEs, and auto import.

## Runtime

The runtime package exposes:

```ts
export function defineForwardRef() {}
```

That function is not meant to execute in a correctly configured project.
