# 为什么需要 vue-refx

`vue-refx` 是一个面向 Vue 3 的编译期 ref 转发库。它的核心 API 只有一个宏：

```ts
defineForwardRef();
```

Vue 已经提供了 `defineExpose()`，适合让子组件向父组件暴露方法。但当一个原生元素被设计系统组件、headless 组件或业务包装组件层层包住时，父组件常常真正想拿到的是最里层的元素。

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

没有 ref 转发时，每一层都要手动定义和串联 API。使用 `vue-refx` 后，每一层只需要转发自己的模板 ref，父组件最终仍然能拿到内部的原生 `<input>`。

## 适用场景

- 组件库封装原生表单控件。
- headless UI 基元需要把 DOM 能力透传给使用者。
- 第三方 widget 外面套了一层 Vue 组件。
- 组件既要像元素一样被聚焦，又要暴露少量命令式方法。

## 设计取向

`vue-refx` 不修改 Vue 运行时，也不在浏览器中保留宏函数。Vite 插件会在 Vue 编译 SFC 之前完成源码转换：

- 子组件中的 `defineForwardRef()` 会被移除。
- 本地模板 ref 会被替换成可转发的 ref 写入逻辑。
- 父组件指向已知转发组件的 `ref` 会被改写成内部 prop。

这意味着你的组件继续使用 Vue 的 `ref` 语义，额外的工作只发生在构建阶段。
