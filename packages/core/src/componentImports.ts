import type { ImportDeclaration } from "@babel/types"
import { parse, type SFCDescriptor } from "@vue/compiler-sfc"
import { importDeclarationSource, parseScript } from "./ast"
import { traverse } from "./babelTraverse"
import type { ComponentImport } from "./types"

const VUE_FILE_RE = /\.vue($|\?)/

export function collectVueComponentImports(source: string): ComponentImport[] {
  const descriptor = parse(source).descriptor
  return collectVueComponentImportsFromDescriptor(source, descriptor)
}

export function collectVueComponentImportsFromDescriptor(
  source: string,
  descriptor: SFCDescriptor
): ComponentImport[] {
  const scripts = [descriptor.script, descriptor.scriptSetup].filter(Boolean)
  const imports: ComponentImport[] = []

  for (const block of scripts) {
    if (!block?.content || !block.content.includes("import")) {
      continue
    }

    const ast = parseScript(block.content)
    traverse(ast, {
      ImportDeclaration(path) {
        const node = path.node as ImportDeclaration
        const importSource = importDeclarationSource(node)

        if (!VUE_FILE_RE.test(importSource) && !isLikelyRelativeVueComponent(importSource)) {
          return
        }

        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportDefaultSpecifier" || specifier.type === "ImportSpecifier") {
            imports.push({
              local: specifier.local.name,
              source: importSource
            })
          }
        }
      }
    })
  }

  return dedupeImports(imports)
}

function isLikelyRelativeVueComponent(source: string): boolean {
  return source.startsWith(".") && !source.endsWith(".css")
}

function dedupeImports(imports: ComponentImport[]): ComponentImport[] {
  const seen = new Set<string>()
  const result: ComponentImport[] = []

  for (const item of imports) {
    const key = `${item.local}\0${item.source}`

    if (!seen.has(key)) {
      seen.add(key)
      result.push(item)
    }
  }

  return result
}
