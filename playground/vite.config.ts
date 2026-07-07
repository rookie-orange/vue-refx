import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"
import ForwardRef from "vue-forward-ref/vite"

export default defineConfig({
  plugins: [
    vue(),
    ForwardRef()
  ]
})
