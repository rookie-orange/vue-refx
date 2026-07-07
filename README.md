# vue-forward-ref

React-style Forwarded Ref for Vue.

Zero Runtime.

Zero Vue Runtime Patch.

Compiler Transform Only.

```ts
import vue from "@vitejs/plugin-vue"
import ForwardRef from "vue-forward-ref/vite"

export default defineConfig({
  plugins: [vue(), ForwardRef()]
})
```

Child component:

```vue
<script setup lang="ts">
import { useForwardedRef } from "vue-forward-ref"

const ref = useForwardedRef<HTMLInputElement>()
</script>

<template>
  <input :ref="ref" />
</template>
```

Parent component:

```vue
<script setup lang="ts">
import { ref } from "vue"
import MyInput from "./MyInput.vue"

const input = ref<HTMLInputElement | null>(null)
</script>

<template>
  <MyInput ref="input" />
</template>
```

Expose methods from the child ref:

```vue
<script setup lang="ts">
import { useForwardedRef } from "vue-forward-ref"

function focus() {}
function blur() {}

const ref = useForwardedRef<HTMLInputElement>(() => ({
  focus,
  blur
}))
</script>
```

The `useForwardedRef()` call is erased before Vue compiles the SFC.
