import type { Ref } from "vue"

declare global {
  const useRefProp: <T = any>() => Ref<T | null>
}

export {}
