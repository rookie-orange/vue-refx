# 排错

## Cannot find template ref

当宏里的名称没有匹配到静态模板 ref 时，编译器会抛出错误：

```text
Cannot find template ref "input".
```

检查两处名称是否一致：

```vue
<script setup lang="ts">
defineForwardRef("input");
</script>

<template>
  <input ref="input" />
</template>
```

动态 `:ref` 不会作为本地转发目标被校验。转发目标需要写成静态 `ref="name"`。

## 父组件 ref 仍然指向组件实例

确认子组件已经调用了 `defineForwardRef()`，并且父组件是通过导入的组件来使用它。

```vue
<script setup lang="ts">
import MyInput from "./MyInput.vue";
</script>

<template>
  <MyInput ref="input" />
</template>
```

Vite 插件会分析父组件导入的 `.vue` 文件，只有当被导入组件使用了
`defineForwardRef("name")` 或 `defineForwardRef("name", factory)` 时，父组件上的 `ref`
才会被改写。

## Vite 提示缺少 Vue 插件

`vue-refx` 应与 `@vitejs/plugin-vue` 一起使用：

```ts
import vue from "@vitejs/plugin-vue";
import VueRefx from "vue-refx/vite";

export default defineConfig({
  plugins: [vue(), VueRefx()],
});
```

## IDE 没有补全

确认 `tsconfig.json` 中有 `vueCompilerOptions.plugins`：

```jsonc
{
  "vueCompilerOptions": {
    "plugins": ["vue-refx/volar"],
  },
}
```

如果你改动了 `tsconfig.json`，重启 TypeScript/Volar 服务通常可以让编辑器重新加载插件。
