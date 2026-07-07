import type { VNodeRef } from "vue";

export type ForwardedRef<T = any> = VNodeRef & {
  readonly __forwardedRefTarget?: T;
};

export function useForwardedRef<T = any>(_factory?: () => unknown): ForwardedRef<T> | undefined {
  throw new Error("useForwardedRef() must be compiled away by vue-refx.");
}
