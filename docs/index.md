---
layout: home

hero:
  name: vue-refx
  text: 面向 Vue 的编译期 ref 转发
  tagline: 用一个宏完成透明 ref 转发与命令式暴露，不修改 Vue 运行时。
  image:
    src: /logo.svg
    alt: vue-refx
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 查看 API
      link: /api/define-forward-ref

features:
  - title: 透明转发
    details: 父组件的 ref 可以穿过包装组件，最终指向真实 DOM 或下游组件句柄。
  - title: 编译期实现
    details: 宏调用会在 SFC 编译前被移除，项目运行时不需要额外补丁。
  - title: 类型友好
    details: 返回值是带类型的 Vue Ref，Volar 插件还能补全模板 ref 名称。
  - title: 一个 API
    details: 同一个 defineForwardRef 覆盖转发、暴露方法以及二者组合。
---
