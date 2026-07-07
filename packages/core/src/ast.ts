import { parse as babelParse } from "@babel/parser"
import type { File, ImportDeclaration, Node } from "@babel/types"

export function parseScript(code: string): File {
  return babelParse(code, {
    sourceType: "module",
    plugins: [
      "typescript",
      "jsx",
      "decorators-legacy",
      "importAttributes",
      "explicitResourceManagement"
    ]
  })
}

export function getNodeSource(code: string, node: Pick<Node, "start" | "end">): string {
  if (node.start == null || node.end == null) {
    return ""
  }

  return code.slice(node.start, node.end)
}

export function importDeclarationSource(node: ImportDeclaration): string {
  return node.source.value
}
