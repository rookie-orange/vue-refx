import traverseModule from "@babel/traverse"

export const traverse: typeof traverseModule =
  (traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule

export type { NodePath } from "@babel/traverse"
