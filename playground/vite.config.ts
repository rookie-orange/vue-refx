import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import VueRefx from "vue-refx/vite";

export default defineConfig({
  plugins: [vue(), VueRefx()],
});
