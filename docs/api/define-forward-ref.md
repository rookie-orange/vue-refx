# defineForwardRef

`defineForwardRef()` 是 `vue-refx` 的核心宏。它只应该在经过 Vite 插件处理的 Vue SFC 中使用。

```ts
import { defineForwardRef } from "vue-refx";
```

## 类型签名

```ts
import type { Ref } from "vue";

export function defineForwardRef<T = any>(name: string): Ref<T | null>;
export function defineForwardRef<T extends object>(factory: () => T): void;
export function defineForwardRef<T = any, TExpose extends object = object>(
  name: string,
  factory: (ref: Ref<T | null>) => TExpose,
): Ref<T | null>;
```

## `defineForwardRef(name)`

转发一个模板 ref。

```vue
<script setup lang="ts">
import { defineForwardRef } from "vue-refx";

defineForwardRef("input");
</script>

<template>
  <input ref="input" />
</template>
```

如果没有接收返回值，转换后不会生成本地 ref 变量。模板中的 `ref="input"` 会直接绑定到父组件传入的转发 ref。

## `defineForwardRef<T>(name)`

需要在组件内部访问同一个元素时，接收返回值。

```ts
const input = defineForwardRef<HTMLInputElement>("input");
```

返回值类型是 `Ref<HTMLInputElement | null>`。

## `defineForwardRef(factory)`

仅暴露命令式方法。

```ts
defineForwardRef(() => ({
  focus,
  blur,
}));
```

工厂函数返回的对象会合并进 `defineExpose()`。如果组件里已经存在 `defineExpose({ ... })`，属性会被追加进去。

## `defineForwardRef(name, factory)`

基于模板 ref 生成父组件收到的命令式句柄。

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

模板 ref 会先写入组件本地的 `Ref<T | null>`。当内部 ref 挂载时，父组件的 ref 会收到
`factory(localRef)` 的返回值；当内部 ref 卸载时，父组件的 ref 会收到 `null`。

第二个泛型参数 `TExpose` 可用于声明父组件 ref 收到的句柄类型。如果省略，内部转发 prop
会退回到 `any`。

## 参数规则

- `name` 必须是字符串字面量。
- `name` 必须对应模板中的静态 `ref="name"`。
- `factory` 必须是函数表达式或箭头函数。
- `defineForwardRef(factory)` 会把工厂返回对象的属性合并到 `defineExpose()`。
- `defineForwardRef(name, factory)` 会把工厂返回值写入父组件传入的转发 ref。

## 编译行为

所有宏调用都会在编译阶段被删除。运行时包里的函数声明用于 TypeScript、IDE 和自动导入；在正确配置的项目里，它不会被实际执行。
