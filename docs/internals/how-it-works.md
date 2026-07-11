# 编译转换

`vue-refx` 是编译期工具。它在 Vue 编译 SFC 之前重写源码，让组件之间可以用一个内部 prop 传递 ref。

内部 prop 名称是：

```text
__forwarded_ref__
```

## 子组件转换

转换前：

```vue
<script setup lang="ts">
import { defineForwardRef } from "vue-refx";

const input = defineForwardRef<HTMLInputElement>("input");
</script>

<template>
  <input ref="input" />
</template>
```

转换后等价于：

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

## 父组件转换

转换前：

```vue
<MyInput ref="input" />
```

转换后等价于：

```vue
<MyInput :__forwarded_ref__="(value) => (input = value)" />
```

如果父组件使用函数 ref，转换会保留函数调用：

```vue
<MyInput :__forwarded_ref__="setInput" />
```

## 组件识别

Vite 插件会读取父组件的导入声明，解析其中的 `.vue` 组件，并分析这些子组件是否使用了模板 ref 转发。

只有确认使用了转发宏的组件才会触发父组件 ref 改写。这样可以避免误改普通组件或 DOM 元素。

## 与 defineProps 和 defineExpose

如果组件已经声明了 `defineProps<T>()`，插件会把内部 prop 合并到现有类型中。

`defineForwardRef(factory)` 仍然作为 `defineExpose()` 的替代写法。如果组件已经声明了
`defineExpose({ ... })`，工厂函数返回对象的属性会追加到同一个对象里。

```ts
defineExpose({
  open,
  close,
});
```

`defineForwardRef(name, factory)` 的工厂函数不会合并进 `defineExpose()`。它会在本地模板 ref
挂载时运行，并把返回的句柄写入父组件传入的转发 ref。

这让纯命令式 expose 和跨组件 ref 转发保持两条清晰路径，同时仍然可以和现有 Vue 宏并存。
