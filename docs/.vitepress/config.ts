import { defineConfig } from "vitepress";

export default defineConfig({
  title: "vue-refx",
  description: "面向 Vue 的编译期 ref 转发库",
  lang: "zh-CN",
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }],
    ["meta", { name: "theme-color", content: "#42b883" }],
  ],
  markdown: {
    lineNumbers: true,
  },
  themeConfig: {
    logo: "/logo.svg",
    search: {
      provider: "local",
    },
    nav: [
      { text: "指南", link: "/guide/", activeMatch: "/guide/" },
      { text: "API", link: "/api/define-forward-ref", activeMatch: "/api/" },
      { text: "内部原理", link: "/internals/how-it-works", activeMatch: "/internals/" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "指南",
          items: [
            { text: "为什么需要", link: "/guide/" },
            { text: "快速开始", link: "/guide/getting-started" },
            { text: "常见模式", link: "/guide/patterns" },
            { text: "TypeScript 与 IDE", link: "/guide/typescript" },
            { text: "排错", link: "/guide/troubleshooting" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API",
          items: [
            { text: "defineForwardRef", link: "/api/define-forward-ref" },
            { text: "Vite 插件", link: "/api/vite-plugin" },
            { text: "Volar 插件", link: "/api/volar-plugin" },
          ],
        },
      ],
      "/internals/": [
        {
          text: "内部原理",
          items: [{ text: "编译转换", link: "/internals/how-it-works" }],
        },
      ],
    },
    outline: {
      level: [2, 3],
      label: "本页目录",
    },
    docFooter: {
      prev: "上一页",
      next: "下一页",
    },
    lastUpdated: {
      text: "最后更新",
      formatOptions: {
        dateStyle: "medium",
        timeStyle: "short",
      },
    },
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © vue-refx contributors",
    },
  },
});
