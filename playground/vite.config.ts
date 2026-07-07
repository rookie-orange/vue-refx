import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"
import RefProp from "unplugin-vue-ref-prop/vite"

export default defineConfig({
  plugins: [
    vue(),
    RefProp()
  ]
})
