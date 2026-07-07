import type { CallExpression } from "@babel/types"
import { parse, type SFCDescriptor } from "@vue/compiler-sfc"
import { parseScript } from "./ast"
import { traverse } from "./babelTraverse"
import { collectVueComponentImportsFromDescriptor } from "./componentImports"
import { FORWARDED_REF_IMPORT_SOURCES, USE_FORWARDED_REF } from "./constants"
import type { AnalyzeResult } from "./types"

export function analyzeVueSfc(source: string): AnalyzeResult {
  const descriptor = parse(source).descriptor

  return {
    hasUseForwardedRef: descriptorUsesForwardedRef(descriptor),
    imports: collectVueComponentImportsFromDescriptor(source, descriptor)
  }
}

export function descriptorUsesForwardedRef(descriptor: SFCDescriptor): boolean {
  const setup = descriptor.scriptSetup

  if (!setup?.content || !setup.content.includes(USE_FORWARDED_REF)) {
    return false
  }

  return scriptUsesForwardedRef(setup.content)
}

export function scriptUsesForwardedRef(code: string): boolean {
  let found = false
  const ast = parseScript(code)
  const forwardedRefLocals = new Set<string>()

  traverse(ast, {
    ImportDeclaration(path) {
      const node = path.node

      if (!FORWARDED_REF_IMPORT_SOURCES.has(node.source.value) || node.importKind === "type") {
        return
      }

      for (const specifier of node.specifiers) {
        if (
          specifier.type === "ImportSpecifier" &&
          specifier.imported.type === "Identifier" &&
          specifier.imported.name === USE_FORWARDED_REF &&
          specifier.importKind !== "type"
        ) {
          forwardedRefLocals.add(specifier.local.name)
        }
      }
    },
    CallExpression(path) {
      if (isUseForwardedRefCall(path.node, forwardedRefLocals)) {
        found = true
        path.stop()
      }
    }
  })

  return found
}

export function isUseForwardedRefCall(
  node: CallExpression,
  forwardedRefLocals: Set<string>
): boolean {
  return node.callee.type === "Identifier" && forwardedRefLocals.has(node.callee.name)
}
