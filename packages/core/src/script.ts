import MagicString from "magic-string"
import type {
  CallExpression,
  File,
  ImportDeclaration,
  TSTypeParameterInstantiation,
  VariableDeclarator
} from "@babel/types"
import { parseScript } from "./ast"
import { traverse, type NodePath } from "./babelTraverse"
import { REF_PROP_NAME, USE_REF_PROP } from "./constants"

export interface TransformScriptSetupOptions {
  offset: number
}

interface MacroBinding {
  local: string
  call: CallExpression
  statementStart: number
  typeSource: string | null
}

interface DefinePropsCall {
  call: CallExpression
  propsIdentifier: string | null
  declarationStart: number | null
}

interface ScriptScope {
  bindings: Set<string>
  hasVueRefType: boolean
  removableUseRefPropImports: ImportDeclaration[]
  removableUseRefPropSpecifiers: Array<{
    declaration: ImportDeclaration
    specifierStart: number
    specifierEnd: number
  }>
}

export interface ScriptTransformMeta {
  hasUseRefProp: boolean
}

export function transformScriptSetup(
  code: string,
  s: MagicString,
  options: TransformScriptSetupOptions
): ScriptTransformMeta {
  if (!code.includes(USE_REF_PROP)) {
    return { hasUseRefProp: false }
  }

  const ast = parseScript(code)
  const macros = collectMacroBindings(code, ast)

  if (macros.length === 0) {
    return { hasUseRefProp: false }
  }

  const scope = collectScriptScope(ast)
  const defineProps = collectDefineProps(ast)[0] ?? null
  const propsIdentifier = defineProps?.propsIdentifier ?? choosePropsIdentifier(scope.bindings)
  const refType = buildRefType(macros)
  const propShape = `{ ${REF_PROP_NAME}?: ${refType} }`

  removeUseRefPropImports(s, options.offset, scope)

  if (!scope.hasVueRefType) {
    s.prependLeft(options.offset, `import type { Ref } from "vue"\n`)
  }

  if (defineProps) {
    mergeDefinePropsType(code, s, options.offset, defineProps.call, propShape)
  } else {
    const insertionPoint = Math.min(...macros.map((macro) => macro.statementStart))
    s.prependLeft(
      options.offset + insertionPoint,
      `const ${propsIdentifier} = defineProps<${propShape}>()\n\n`
    )
  }

  for (const macro of macros) {
    s.overwrite(
      options.offset + assertPosition(macro.call.start),
      options.offset + assertPosition(macro.call.end),
      `${propsIdentifier}.${REF_PROP_NAME}`
    )
  }

  return { hasUseRefProp: true }
}

function collectMacroBindings(code: string, ast: File): MacroBinding[] {
  const macros: MacroBinding[] = []

  traverse(ast, {
    VariableDeclarator(path) {
      const node = path.node

      if (!node.init || node.init.type !== "CallExpression" || !isUseRefPropCall(node.init)) {
        return
      }

      if (node.id.type !== "Identifier") {
        throw new Error("useRefProp() macro must be assigned to an identifier.")
      }

      const declaration = path.findParent((parent) => parent.isVariableDeclaration())
      const statementStart = declaration?.node.start ?? node.start

      macros.push({
        local: node.id.name,
        call: node.init,
        statementStart: assertPosition(statementStart),
        typeSource: getUseRefPropTypeSource(code, node.init)
      })
    }
  })

  return macros
}

function collectDefineProps(ast: File): DefinePropsCall[] {
  const calls: DefinePropsCall[] = []

  traverse(ast, {
    CallExpression(path) {
      const node = path.node

      if (node.callee.type !== "Identifier" || node.callee.name !== "defineProps") {
        return
      }

      const declarator = path.findParent((parent) => parent.isVariableDeclarator()) as
        | NodePath<VariableDeclarator>
        | null
      const id = declarator?.node.id

      calls.push({
        call: node,
        propsIdentifier: id?.type === "Identifier" ? id.name : null,
        declarationStart: declarator?.parentPath?.node.start ?? declarator?.node.start ?? null
      })
    }
  })

  return calls
}

function collectScriptScope(ast: File): ScriptScope {
  const bindings = new Set<string>()
  let hasVueRefType = false
  const removableUseRefPropImports: ImportDeclaration[] = []
  const removableUseRefPropSpecifiers: ScriptScope["removableUseRefPropSpecifiers"] = []

  traverse(ast, {
    Program(path) {
      Object.keys(path.scope.bindings).forEach((name) => bindings.add(name))
    },
    ImportDeclaration(path) {
      const node = path.node

      if (node.source.value === "vue") {
        for (const specifier of node.specifiers) {
          if (
            specifier.local.type === "Identifier" &&
            specifier.local.name === "Ref"
          ) {
            hasVueRefType = true
          }
        }
      }

      if (!isRuntimeImportSource(node.source.value)) {
        return
      }

      const useRefSpecifiers = node.specifiers.filter(
        (specifier) =>
          specifier.type === "ImportSpecifier" &&
          specifier.imported.type === "Identifier" &&
          specifier.imported.name === USE_REF_PROP
      )

      if (useRefSpecifiers.length === 0) {
        return
      }

      if (useRefSpecifiers.length === node.specifiers.length) {
        removableUseRefPropImports.push(node)
        return
      }

      for (const specifier of useRefSpecifiers) {
        removableUseRefPropSpecifiers.push({
          declaration: node,
          specifierStart: assertPosition(specifier.start),
          specifierEnd: assertPosition(specifier.end)
        })
      }
    }
  })

  return {
    bindings,
    hasVueRefType,
    removableUseRefPropImports,
    removableUseRefPropSpecifiers
  }
}

function mergeDefinePropsType(
  code: string,
  s: MagicString,
  offset: number,
  call: CallExpression,
  propShape: string
): void {
  const typeParameters = call.typeParameters as TSTypeParameterInstantiation | undefined

  if (!typeParameters || typeParameters.params.length === 0) {
    s.appendLeft(offset + assertPosition(call.callee.end), `<${propShape}>`)
    return
  }

  const existing = code.slice(
    assertPosition(typeParameters.params[0].start),
    assertPosition(typeParameters.params[typeParameters.params.length - 1].end)
  )

  s.overwrite(
    offset + assertPosition(typeParameters.start),
    offset + assertPosition(typeParameters.end),
    `<${existing} & ${propShape}>`
  )
}

function removeUseRefPropImports(s: MagicString, offset: number, scope: ScriptScope): void {
  for (const declaration of scope.removableUseRefPropImports) {
    s.remove(offset + assertPosition(declaration.start), offset + assertPosition(declaration.end))
  }

  for (const specifier of scope.removableUseRefPropSpecifiers) {
    const specifierStart = specifier.specifierStart
    const specifierEnd = specifier.specifierEnd
    const declaration = specifier.declaration
    const nextSpecifier = declaration.specifiers.find(
      (item) => assertPosition(item.start) > specifierStart
    )
    const previousSpecifier = [...declaration.specifiers]
      .reverse()
      .find((item) => assertPosition(item.end) < specifierStart)

    if (nextSpecifier) {
      s.remove(offset + specifierStart, offset + assertPosition(nextSpecifier.start))
    } else if (previousSpecifier) {
      s.remove(offset + assertPosition(previousSpecifier.end), offset + specifierEnd)
    } else {
      s.remove(offset + specifierStart, offset + specifierEnd)
    }
  }
}

function getUseRefPropTypeSource(code: string, call: CallExpression): string | null {
  const typeParameters = call.typeParameters as TSTypeParameterInstantiation | undefined

  if (!typeParameters || typeParameters.params.length === 0) {
    return null
  }

  return code
    .slice(
      assertPosition(typeParameters.params[0].start),
      assertPosition(typeParameters.params[typeParameters.params.length - 1].end)
    )
    .trim()
}

function buildRefType(macros: MacroBinding[]): string {
  const typeSources = [...new Set(macros.map((macro) => macro.typeSource).filter(Boolean))]

  if (typeSources.length === 0) {
    return "Ref<any>"
  }

  const nullable = typeSources.map((type) => `${type} | null`).join(" | ")
  return `Ref<${nullable}>`
}

function choosePropsIdentifier(bindings: Set<string>): string {
  if (!bindings.has("props")) {
    return "props"
  }

  let index = 1
  let candidate = "__refPropProps"

  while (bindings.has(candidate)) {
    candidate = `__refPropProps${index}`
    index += 1
  }

  return candidate
}

function isUseRefPropCall(node: CallExpression): boolean {
  return node.callee.type === "Identifier" && node.callee.name === USE_REF_PROP
}

function isRuntimeImportSource(source: string): boolean {
  return source === "unplugin-vue-ref-prop/runtime" || source === "unplugin-vue-ref-prop"
}

function assertPosition(value: number | null | undefined): number {
  if (typeof value !== "number") {
    throw new Error("AST node is missing source location.")
  }

  return value
}
