# vue-refs

中文 | [English](./README.md)

面向 Vue 的 React 风格 ref 转发。

像 React 19 一样在组件之间转发 ref，无需修改 Vue 运行时。

- ⚡ 零运行时
- ⚡ 不修改 Vue 运行时
- ⚡ 仅通过编译器转换实现
- ⚡ 完全兼容现有的 `ref`
- ⚡ 支持 TypeScript

---

## 为什么需要它？

Vue 已经提供了 `defineExpose()`，它很适合用来暴露组件方法。

不过，Vue 没有提供**透明的 ref 转发**。

假设有如下组件层级：

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

在今天的 Vue 中，每一层中间组件都需要手动暴露其内部实例或方法。

使用 **vue-refs** 后，ref 可以自然地穿过组件边界，让深层包裹的组件像原生元素一样工作。

---

## 安装

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

## 基础用法

### 子组件

```vue
<script setup lang="ts">
import { useForwardedRef } from "vue-refs"

const ref = useForwardedRef<HTMLInputElement>()
</script>

<template>
  <input :ref="ref" />
</template>
```

### 父组件

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

转发后的 ref 会自动指向原生的 `<input>`。

---

## 穿过多个组件转发 ref

ref 可以穿过任意数量的包裹组件。

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

父组件仍然会收到最终的原生 input 元素。

不再需要手动串联 `defineExpose()`。

---

## 自定义命令式句柄

有时你并不想暴露底层元素。

这时可以暴露一个自定义 API。

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

父组件现在会收到：

```ts
input.value.focus()
input.value.blur()
```

这在概念上类似于 React 的 `useImperativeHandle()`。

---

## 工作原理

vue-refs **只在编译期工作**。

编译前：

```vue
<MyInput ref="input" />
```

转换后：

```vue
<MyInput ref="input" :__forwarded_ref__="input" />
```

在子组件内部：

```ts
const ref = useForwardedRef()
```

会被编译为类似下面的代码：

```ts
const props = defineProps<{
  __forwarded_ref__?: Ref<any>
}>()

const ref = props.__forwarded_ref__
```

当传入工厂函数时：

```ts
useForwardedRef(() => ({
  focus,
  blur,
}))
```

编译器会自动生成等价的 `defineExpose()`。

所有这些都发生在编译阶段。

运行时不会执行任何额外代码。

---

## 对比

| 功能 | Vue `defineExpose()` | vue-refs |
| --- | --- | --- |
| 暴露组件方法 | ✅ | ✅ |
| 穿过多个组件转发 ref | ❌ | ✅ |
| 零运行时 | ✅ | ✅ |
| 需要修改运行时 | ❌ | ❌ |
| React 风格的 forwarded ref API | ❌ | ✅ |

---

## 常见问题

### 这会替代 Vue 的 `ref` 吗？

不会。

Vue 原生的 `ref` 行为不会改变。

vue-refs 只是将已有的 ref 穿过组件继续向下转发。

---

### 这会修改 Vue 运行时吗？

不会。

vue-refs 完全通过编译器转换实现。

---

### 这可以和现有组件一起使用吗？

可以。

没有使用 `useForwardedRef()` 的组件会继续保持完全相同的行为。

---

### 会有运行时成本吗？

不会。

`useForwardedRef()` 会在编译阶段被完全擦除。

生成后的代码等价于手写转换后的 Vue 代码。

---

## 许可证

MIT
