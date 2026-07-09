# Vite 插件

Vite 插件从 `vue-refx/vite` 导入：

```ts
import VueRefx from "vue-refx/vite";
```

## 基础配置

```ts
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import VueRefx from "vue-refx/vite";

export default defineConfig({
  plugins: [vue(), VueRefx()],
});
```

插件只处理 `.vue` 文件，并会在 Vue SFC 编译之前运行。

## 选项

```ts
interface ForwardRefOptions {
  include?: RegExp | string | Array<RegExp | string>;
  exclude?: RegExp | string | Array<RegExp | string>;
  sourcemap?: boolean;
}
```

### include

控制哪些 `.vue` 文件会进入转换流程。默认值等价于：

```ts
VueRefx({
  include: /\.vue$/,
});
```

字符串匹配使用 `id.includes(value)`。

### exclude

排除不需要转换的文件。

```ts
VueRefx({
  exclude: /legacy/,
});
```

### sourcemap

控制转换结果是否生成 sourcemap。Vite 插件默认开启：

```ts
VueRefx({
  sourcemap: true,
});
```

## 父组件转换

插件会分析父组件中导入的 `.vue` 组件。如果被导入组件使用了 `defineForwardRef()`，父组件上的 `ref` 会被改写成内部转发 prop。

转换前：

```vue
<MyInput ref="input" />
```

转换后等价于：

```vue
<MyInput :__forwarded_ref__="(value) => (input = value)" />
```

普通 DOM ref 和未使用 `defineForwardRef()` 的组件不会被改写。

## HMR

开发服务器中，插件会缓存组件分析结果。当一个子组件新增或移除 `defineForwardRef()` 时，它会让相关父组件失效并重新转换，从而保持热更新行为一致。
