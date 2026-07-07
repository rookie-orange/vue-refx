import type { Ref } from "vue";

export function useForwardedRef<T = any>(_factory?: () => unknown): Ref<T | null> {
  throw new Error("useForwardedRef() must be compiled away by vue-refx.");
}
