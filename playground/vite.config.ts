import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import VueRefs from "vue-refx/vite";

export default defineConfig({
  plugins: [vue(), VueRefs()],
});
