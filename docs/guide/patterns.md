# 常见模式

## 仅转发模板 ref

当组件只是包了一层 DOM 或下游组件时，直接传入模板 ref 名称。

```vue
<script setup lang="ts">
import { defineForwardRef } from "vue-refx";

defineForwardRef("input");
</script>

<template>
  <input ref="input" />
</template>
```

## 在组件内部使用同一个 ref

如果组件内部也需要访问被转发的元素，把宏调用赋值给一个变量。返回值会被转换成 `Ref<T | null>`。

```vue
<script setup lang="ts">
import { defineForwardRef } from "vue-refx";

const input = defineForwardRef<HTMLInputElement>("input");

function focus() {
  input.value?.focus();
}
</script>

<template>
  <input ref="input" />
</template>
```

## 仅暴露方法

只需要命令式组件 API 时，也可以用同一个宏替代 `defineExpose()`。

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

## 转发 ref 并暴露方法

组件既可以把内部元素转发出去，也可以暴露一个更高层的命令式句柄。

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

## 穿过多层组件

每一层包装组件都使用同一个宏即可。

```vue
<!-- MyInput.vue -->
<script setup lang="ts">
import { defineForwardRef } from "vue-refx";

defineForwardRef("input");
</script>

<template>
  <BaseInput ref="input" />
</template>
```

```vue
<!-- BaseInput.vue -->
<script setup lang="ts">
import { defineForwardRef } from "vue-refx";

defineForwardRef("input");
</script>

<template>
  <InputWrapper ref="input" />
</template>
```

```vue
<!-- InputWrapper.vue -->
<script setup lang="ts">
import { defineForwardRef } from "vue-refx";

defineForwardRef("input");
</script>

<template>
  <input ref="input" />
</template>
```

父组件仍然会收到最底层的原生 input 元素。

## 函数 ref

父组件也可以继续使用 Vue 的函数 ref 写法。`vue-refx` 会保留函数调用语义。

```vue
<script setup lang="ts">
import MyInput from "./MyInput.vue";

function setInput(value: HTMLInputElement | null) {
  console.log(value);
}
</script>

<template>
  <MyInput :ref="setInput" />
</template>
```
