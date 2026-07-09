# Volar 插件

Volar 插件从 `vue-refx/volar` 加载，用于增强编辑器里的模板 ref 名称补全。

## 配置

在 `tsconfig.json` 中添加：

```jsonc
{
  "vueCompilerOptions": {
    "plugins": ["vue-refx/volar"]
  }
}
```

## 工作方式

插件会在 Vue 语言服务的嵌入式代码中加入补全锚点：

- 收集模板里的静态 `ref` 名称。
- 找到从 `vue-refx` 导入的 `defineForwardRef` 调用。
- 只为字符串参数提供补全。
- 跳过只暴露方法的 `defineForwardRef(() => ...)` 调用。

## 支持别名导入

```ts
import { defineForwardRef as forward } from "vue-refx";

forward("input");
```

## 限制

- 只补全静态模板 ref 名称。
- 只匹配从 `vue-refx` 导入的宏。
- 本地同名函数不会被当作宏处理。
