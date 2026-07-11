# TypeScript 与 IDE

## 宏类型

`defineForwardRef` 从 `vue-refx` 导入：

```ts
import { defineForwardRef } from "vue-refx";
```

把宏调用赋值给变量时，它的返回值是 Vue 的 `Ref<T | null>`。

```ts
const input = defineForwardRef<HTMLInputElement>("input");
// Ref<HTMLInputElement | null>
```

`null` 表示模板 ref 尚未挂载，类型上与 Vue 原生模板 ref 保持一致。

当同时传入模板 ref 名称和工厂函数时，第一个泛型是内部模板 ref 的类型，第二个泛型是父组件
ref 收到的句柄类型。

```ts
interface InputHandle {
  focus(): void;
  input(value: string): void;
}

const input = defineForwardRef<HTMLInputElement, InputHandle>("input", (input) => ({
  focus() {
    input.value?.focus();
  },
  input(value) {
    if (input.value) {
      input.value.value = value;
    }
  },
}));
```

## 自动补全模板 ref 名称

Volar 插件会收集模板中的静态 `ref` 名称，然后给 `defineForwardRef("...")` 的字符串参数提供补全锚点。

```jsonc
{
  "vueCompilerOptions": {
    "plugins": ["vue-refx/volar"],
  },
}
```

插件支持普通导入和别名导入：

```ts
import { defineForwardRef as forward } from "vue-refx";

forward("input");
```

## 组件句柄类型

当你使用工厂函数暴露方法时，父组件可以声明自己的句柄类型。

```vue
<script setup lang="ts">
import { ref } from "vue";
import AdvancedField from "./AdvancedField.vue";

interface AdvancedFieldHandle {
  focus(): void;
  clear(): void;
  getValue(): string;
}

const field = ref<AdvancedFieldHandle | null>(null);
</script>

<template>
  <AdvancedField ref="field" />
  <button type="button" @click="field?.focus()">Focus</button>
</template>
```

## 需要注意的边界

- 转发模板 ref 时，第一个参数必须是字符串字面量。
- 目前转换发生在 `<script setup>` 中。
- 宏可以从 `vue-refx` 或 `vue-refx/runtime` 导入。
- 如果字符串名称找不到对应模板 ref，构建会失败。
