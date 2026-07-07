import MagicString from "magic-string"
import {
  type AttributeNode,
  type DirectiveNode,
  ElementTypes,
  NodeTypes,
  parse,
  type RootNode,
  type TemplateChildNode
} from "@vue/compiler-dom"
import { REF_PROP_NAME } from "./constants"

export interface TransformTemplateOptions {
  offset: number
  refPropComponents: Set<string>
}

export function transformTemplate(
  code: string,
  s: MagicString,
  options: TransformTemplateOptions
): void {
  if (!code.includes("ref=") && !code.includes(":ref") && !code.includes("v-bind:ref")) {
    return
  }

  const ast = parse(code, { comments: true })

  walk(ast.children, (node) => {
    if (node.type !== NodeTypes.ELEMENT) {
      return
    }

    if (!shouldInjectRefProp(node.tag, node.tagType, options.refPropComponents)) {
      return
    }

    const refExpression = getRefExpression(node.props)

    if (!refExpression || hasRefPropBinding(node.props)) {
      return
    }

    const insertAt = findOpenTagInsertionPoint(code, node.loc.start.offset)

    if (insertAt == null) {
      return
    }

    s.appendLeft(options.offset + insertAt, ` :${REF_PROP_NAME}="${escapeAttribute(refExpression)}"`)
  })
}

function walk(nodes: TemplateChildNode[], visitor: (node: TemplateChildNode) => void): void {
  for (const node of nodes) {
    visitor(node)

    if (node.type === NodeTypes.ELEMENT) {
      walk(node.children, visitor)
    } else if (node.type === NodeTypes.IF) {
      for (const branch of node.branches) {
        walk(branch.children, visitor)
      }
    } else if (node.type === NodeTypes.FOR) {
      walk(node.children, visitor)
    }
  }
}

function shouldInjectRefProp(
  tag: string,
  tagType: ElementTypes,
  refPropComponents: Set<string>
): boolean {
  if (tagType !== ElementTypes.COMPONENT && !isLikelyComponentTag(tag)) {
    return false
  }

  return getComponentAliases(tag).some((alias) => refPropComponents.has(alias))
}

function getRefExpression(props: Array<AttributeNode | DirectiveNode>): string | null {
  for (const prop of props) {
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === "ref") {
      return prop.value?.content.trim() || null
    }

    if (
      prop.type === NodeTypes.DIRECTIVE &&
      prop.name === "bind" &&
      prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION &&
      prop.arg.content === "ref"
    ) {
      return prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
        ? prop.exp.content.trim() || null
        : null
    }
  }

  return null
}

function hasRefPropBinding(props: Array<AttributeNode | DirectiveNode>): boolean {
  for (const prop of props) {
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === REF_PROP_NAME) {
      return true
    }

    if (
      prop.type === NodeTypes.DIRECTIVE &&
      prop.name === "bind" &&
      prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION &&
      prop.arg.content === REF_PROP_NAME
    ) {
      return true
    }
  }

  return false
}

function findOpenTagInsertionPoint(code: string, start: number): number | null {
  let quote: string | null = null

  for (let index = start; index < code.length; index += 1) {
    const char = code[index]

    if (quote) {
      if (char === quote) {
        quote = null
      }

      continue
    }

    if (char === "\"" || char === "'") {
      quote = char
      continue
    }

    if (char === ">") {
      let insertion = index

      for (let cursor = index - 1; cursor >= start; cursor -= 1) {
        const current = code[cursor]

        if (/\s/.test(current)) {
          continue
        }

        if (current === "/") {
          insertion = cursor
        }

        break
      }

      return insertion
    }
  }

  return null
}

function getComponentAliases(tag: string): string[] {
  return [tag, camelize(tag), pascalize(tag)]
}

function isLikelyComponentTag(tag: string): boolean {
  return /^[A-Z]/.test(tag) || tag.includes(".")
}

function camelize(value: string): string {
  return value.replace(/-(\w)/g, (_, char: string) => char.toUpperCase())
}

function pascalize(value: string): string {
  const camel = camelize(value)
  return camel.charAt(0).toUpperCase() + camel.slice(1)
}

function escapeAttribute(value: string): string {
  return value.replace(/"/g, "&quot;")
}
