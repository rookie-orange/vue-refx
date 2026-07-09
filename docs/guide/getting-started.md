# 快速开始

## 安装

```bash
pnpm add vue-refx
```

如果你使用 npm 或 yarn，也可以安装同一个包：

```bash
npm install vue-refx
```

```bash
yarn add vue-refx
```

## 配置 Vite

在 Vite 配置中加入 `vue-refx/vite` 插件：

```ts
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import VueRefx from "vue-refx/vite";

export default defineConfig({
  plugins: [vue(), VueRefx()],
});
```

`vue-refx` 会检查项目里是否启用了 `@vitejs/plugin-vue`。它只处理 `.vue` 文件，并在 Vue SFC 编译之前运行。

## 配置 Volar

在 `tsconfig.json` 中启用 Volar 插件后，`defineForwardRef("...")` 的字符串参数可以获得模板 ref 名称补全。

```jsonc
{
  "vueCompilerOptions": {
    "plugins": ["vue-refx/volar"]
  }
}
```

## 写第一个转发组件

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

父组件里的 `input` 指向原生 `<input>`，而不是 `MyInput` 的组件实例。

::: tip
`defineForwardRef()` 是编译期宏。正确配置后，它不会在运行时执行。
:::
