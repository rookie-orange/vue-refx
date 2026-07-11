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

## 转发 ref 并扩展句柄

组件可以把下游组件或 DOM 的 ref 收进本地变量，再把一个扩展后的句柄转发给父组件。

```vue
<script setup lang="ts">
import { defineForwardRef } from "vue-refx";

interface BaseInputHandle {
  focus(): void;
  blur(): void;
}

interface InputHandle extends BaseInputHandle {
  input(value: string): void;
}

const input = defineForwardRef<BaseInputHandle, InputHandle>("input", (input) => ({
  focus() {
    input.value?.focus();
  },
  blur() {
    input.value?.blur();
  },
  input(value) {
    input.value?.focus();
    // 在这里更新本地状态，或继续委托给下游组件
  },
}));
</script>

<template>
  <BaseInput ref="input" />
</template>
```

父组件的 `ref` 会收到 `{ focus, blur, input }`，而组件内部的 `input` 仍然是
`Ref<BaseInputHandle | null>`。

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
