# vue-refx

中文 | [English](./README.md)

面向 Vue 的编译期 ref 转发库，围绕一个宏：

```ts
defineForwardRef();
```

- 零运行时
- 不修改 Vue 运行时
- 仅通过编译器转换实现
- 支持 TypeScript
- 兼容 Vue 现有 `ref`

## 安装

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

## 仅转发模板 ref

```vue
<script setup lang="ts">
import { defineForwardRef } from "vue-refx";

defineForwardRef("input");
</script>

<template>
  <input ref="input" />
</template>
```

父组件可以像使用原生 input 一样使用这个组件：

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

## 仅暴露方法

只需要命令式组件 API 时，也使用同一个宏。

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

这会编译成单个 `defineExpose()` 调用。在大多数组件里，
`defineForwardRef()` 可以替代 `defineExpose()`，避免混用两个 API。

## 转发模板 ref + 暴露方法

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

模板 ref 会转发给父组件，工厂返回的对象会合并进 `defineExpose()`。

## 返回值

赋值使用时，宏返回一个带类型的 Vue ref：

```ts
const input = defineForwardRef<HTMLInputElement>("input");
// Ref<HTMLInputElement | null>
```

忽略返回值时，不会生成本地变量。

## 模板校验

编译器会校验每一个转发的模板 ref 名称：

```ts
defineForwardRef("input");
```

必须匹配：

```vue
<input ref="input" />
```

否则编译失败：

```text
Cannot find template ref "input".
```

## 运行时

`defineForwardRef()` 在运行时包中只用于 TypeScript、IDE 和自动导入。
所有宏调用都会在编译阶段被擦除。
