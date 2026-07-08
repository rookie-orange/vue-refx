import type { Ref } from "vue";

export function defineForwardRef<T = any>(_name: string): Ref<T | null>;
export function defineForwardRef<T extends object>(_factory: () => T): void;
export function defineForwardRef<T = any, TExpose extends object = object>(
  _name: string,
  _factory: () => TExpose,
): Ref<T | null>;
export function defineForwardRef(..._args: unknown[]): any {}
