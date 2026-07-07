import type { CallExpression } from "@babel/types"
import { parse, type SFCDescriptor } from "@vue/compiler-sfc"
import { parseScript } from "./ast"
import { traverse } from "./babelTraverse"
import { collectVueComponentImportsFromDescriptor } from "./componentImports"
import { USE_REF_PROP } from "./constants"
import type { AnalyzeResult } from "./types"

export function analyzeVueSfc(source: string): AnalyzeResult {
  const descriptor = parse(source).descriptor

  return {
    hasUseRefProp: descriptorUsesRefProp(descriptor),
    imports: collectVueComponentImportsFromDescriptor(source, descriptor)
  }
}

export function descriptorUsesRefProp(descriptor: SFCDescriptor): boolean {
  const setup = descriptor.scriptSetup

  if (!setup?.content || !setup.content.includes(USE_REF_PROP)) {
    return false
  }

  return scriptUsesRefProp(setup.content)
}

export function scriptUsesRefProp(code: string): boolean {
  let found = false
  const ast = parseScript(code)

  traverse(ast, {
    CallExpression(path) {
      if (isUseRefPropCall(path.node)) {
        found = true
        path.stop()
      }
    }
  })

  return found
}

export function isUseRefPropCall(node: CallExpression): boolean {
  return node.callee.type === "Identifier" && node.callee.name === USE_REF_PROP
}
