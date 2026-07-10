import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import PackageManagerTabs from "./components/PackageManagerTabs.vue";
import "./custom.css";

const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("PackageManagerTabs", PackageManagerTabs);
  },
};

export default theme;
