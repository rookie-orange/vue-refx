import type { Ref } from "vue"

export function useRefProp<T = any>(): Ref<T | null> {
  throw new Error("Compiler Macro")
}
