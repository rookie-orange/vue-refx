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
- 用一个 API 同时覆盖 ref 转发和命令式暴露

## 为什么需要它？

Vue 已经有 `defineExpose()`，它适合让组件向父组件暴露方法。不过 Vue
没有提供跨组件边界的透明 ref 转发。

当一个简单 DOM 元素被设计系统组件或 headless 组件层层包裹时，这个问题会很明显：

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

没有 ref 转发时，每一层都要决定暴露什么，并手动串联 API。使用 `vue-refx`
后，每一层都可以转发自己的模板 ref，父组件最终仍然拿到最底层的原生 input 元素。

## 适用场景

`vue-refx` 适合用于封装原生表单控件的组件库、headless UI 基元、第三方
widget 的视觉包装，以及任何希望表现得像内部元素一样的组件。

它也覆盖命令式组件句柄。在大多数组件里，`defineForwardRef()` 可以替代
`defineExpose()`，让组件用一个统一 API 完成：

- 转发真实模板 ref
- 仅暴露方法
- 同时转发模板 ref 并暴露方法

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

在 `tsconfig.json` 中启用 Volar 插件后，`defineForwardRef("...")` 里的模板
ref 名称会获得补全提示：

```jsonc
{
  "vueCompilerOptions": {
    "plugins": ["vue-refx/volar"],
  },
}
```

## 仅转发模板 ref

子组件：

```vue
<script setup lang="ts">
import { defineForwardRef } from "vue-refx";

defineForwardRef("input");
</script>

<template>
  <input ref="input" />
</template>
```

父组件：

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

父组件的 ref 指向原生 `<input>`，而不是 `MyInput` 组件实例。

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

这会编译成单个 `defineExpose()` 调用。

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

## 穿过多个组件转发 ref

每一层包装组件都可以使用同一个宏。

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

父组件仍然会收到最终的原生 input 元素。

## 返回值

赋值使用时，宏返回一个带类型的 Vue ref：

```ts
const input = defineForwardRef<HTMLInputElement>("input");
// Ref<HTMLInputElement | null>
```

组件内部也需要读取或调用被转发元素时，这个返回值很有用。

忽略返回值时：

```ts
defineForwardRef("input");
```

不会生成本地变量。

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

无效名称不会被静默忽略。

## 工作原理

`vue-refx` 只在编译期工作。它会在 Vue 编译 SFC 之前改写源码。

父组件转换前：

```vue
<MyInput ref="input" />
```

父组件转换后：

```vue
<MyInput :__forwarded_ref__="(value) => (input = value)" />
```

子组件转换前：

```vue
<script setup lang="ts">
import { defineForwardRef } from "vue-refx";

const input = defineForwardRef<HTMLInputElement>("input");
</script>

<template>
  <input ref="input" />
</template>
```

子组件转换后等价于：

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

所有 `defineForwardRef()` 调用都会在编译阶段被删除。运行时导出只服务于
TypeScript、IDE 和自动导入。

## 运行时

运行时包暴露：

```ts
export function defineForwardRef() {}
```

在正确配置的项目里，这个函数不会被实际执行。
