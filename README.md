# vue-refs

React-style forwarded refs for Vue.

Forward refs through components just like React 19 — without modifying Vue runtime.

- ⚡ Zero runtime
- ⚡ Zero Vue runtime patch
- ⚡ Compiler transform only
- ⚡ Fully compatible with existing `ref`
- ⚡ TypeScript support

---

## Why?

Vue already provides `defineExpose()`, which is great for exposing component methods.

However, Vue does not provide **transparent ref forwarding**.

Consider the following component hierarchy:

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

With Vue today, every intermediate component must manually expose its internal instance or methods.

With **vue-refs**, refs can be forwarded naturally through component boundaries, making deeply wrapped components behave like native elements.

---

## Installation

```bash
pnpm add vue-refs
```

```ts
import vue from "@vitejs/plugin-vue"
import VueRefs from "vue-refs/vite"

export default defineConfig({
  plugins: [vue(), VueRefs()],
})
```

---

## Basic Usage

### Child component

```vue
<script setup lang="ts">
import { useForwardedRef } from "vue-refs"

const ref = useForwardedRef<HTMLInputElement>()
</script>

<template>
  <input :ref="ref" />
</template>
```

### Parent component

```vue
<script setup lang="ts">
import { ref } from "vue"
import MyInput from "./MyInput.vue"

const input = ref<HTMLInputElement | null>(null)

function focus() {
  input.value?.focus()
}
</script>

<template>
  <MyInput ref="input" />
</template>
```

The forwarded ref automatically points to the native `<input>`.

---

## Forward refs through multiple components

Refs can be forwarded through any number of wrapper components.

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

MyInput.vue

```vue
<script setup lang="ts">
import { useForwardedRef } from "vue-refs"

const ref = useForwardedRef<HTMLInputElement>()
</script>

<template>
  <BaseInput :ref="ref" />
</template>
```

BaseInput.vue

```vue
<script setup lang="ts">
import { useForwardedRef } from "vue-refs"

const ref = useForwardedRef<HTMLInputElement>()
</script>

<template>
  <InputWrapper :ref="ref" />
</template>
```

InputWrapper.vue

```vue
<script setup lang="ts">
import { useForwardedRef } from "vue-refs"

const ref = useForwardedRef<HTMLInputElement>()
</script>

<template>
  <input :ref="ref" />
</template>
```

The parent still receives the final native input element.

No manual `defineExpose()` chaining is required.

---

## Custom imperative handle

Sometimes you don't want to expose the underlying element.

Instead, expose a custom API.

```vue
<script setup lang="ts">
import { useForwardedRef } from "vue-refs"

const input = ref<HTMLInputElement>()

function focus() {
  input.value?.focus()
}

function blur() {
  input.value?.blur()
}

useForwardedRef(() => ({
  focus,
  blur,
}))
</script>

<template>
  <input ref="input" />
</template>
```

The parent now receives:

```ts
input.value.focus()
input.value.blur()
```

This is conceptually similar to React's `useImperativeHandle()`.

---

## How it works

vue-refs is **compiler-only**.

Before compilation:

```vue
<MyInput ref="input" />
```

After transformation:

```vue
<MyInput ref="input" :__forwarded_ref__="input" />
```

Inside the child component:

```ts
const ref = useForwardedRef()
```

is compiled into something equivalent to:

```ts
const props = defineProps<{
  __forwarded_ref__?: Ref<any>
}>()

const ref = props.__forwarded_ref__
```

When a factory is provided:

```ts
useForwardedRef(() => ({
  focus,
  blur,
}))
```

the compiler generates the equivalent `defineExpose()` automatically.

All of this happens during compilation.

Nothing is executed at runtime.

---

## Comparison

| Feature                                  | Vue `defineExpose()` | vue-refs |
| ---------------------------------------- | -------------------- | -------- |
| Expose component methods                 | ✅                   | ✅       |
| Forward refs through multiple components | ❌                   | ✅       |
| Zero runtime                             | ✅                   | ✅       |
| Runtime patch required                   | ❌                   | ❌       |
| React-style forwarded ref API            | ❌                   | ✅       |

---

## FAQ

### Does this replace Vue's `ref`?

No.

Vue's native `ref` behavior is unchanged.

vue-refs only forwards existing refs through components.

---

### Does this modify Vue runtime?

No.

vue-refs is implemented entirely as a compiler transform.

---

### Does this work with existing components?

Yes.

Components that don't use `useForwardedRef()` continue to behave exactly the same.

---

### Is there any runtime cost?

No.

`useForwardedRef()` is completely erased during compilation.

The generated code is equivalent to writing the transformed Vue code manually.

---

## License

MIT
