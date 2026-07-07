import MagicString from "magic-string"
import {
  type AttributeNode,
  type DirectiveNode,
  ElementTypes,
  NodeTypes,
  parse,
  type TemplateChildNode
} from "@vue/compiler-dom"
import { FORWARDED_REF_PROP_NAME } from "./constants"

export interface TransformTemplateOptions {
  offset: number
  forwardedRefComponents: Set<string>
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

    if (!shouldInjectForwardedRef(node.tag, node.tagType, options.forwardedRefComponents)) {
      return
    }

    const refBinding = getRefBinding(node.props)

    if (!refBinding || hasForwardedRefBinding(node.props)) {
      return
    }

    s.overwrite(
      options.offset + refBinding.start,
      options.offset + refBinding.end,
      `:${FORWARDED_REF_PROP_NAME}="${escapeAttribute(buildForwardedRefExpression(refBinding.expression))}"`
    )
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

function shouldInjectForwardedRef(
  tag: string,
  tagType: ElementTypes,
  forwardedRefComponents: Set<string>
): boolean {
  if (tagType !== ElementTypes.COMPONENT && !isLikelyComponentTag(tag)) {
    return false
  }

  return getComponentAliases(tag).some((alias) => forwardedRefComponents.has(alias))
}

interface RefBinding {
  expression: string
  start: number
  end: number
}

function getRefBinding(props: Array<AttributeNode | DirectiveNode>): RefBinding | null {
  for (const prop of props) {
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === "ref") {
      const expression = prop.value?.content.trim()
      return expression
        ? {
            expression,
            start: prop.loc.start.offset,
            end: prop.loc.end.offset
          }
        : null
    }

    if (
      prop.type === NodeTypes.DIRECTIVE &&
      prop.name === "bind" &&
      prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION &&
      prop.arg.content === "ref"
    ) {
      const expression = prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
        ? prop.exp.content.trim()
        : null

      return expression
        ? {
            expression,
            start: prop.loc.start.offset,
            end: prop.loc.end.offset
          }
        : null
    }
  }

  return null
}

function hasForwardedRefBinding(props: Array<AttributeNode | DirectiveNode>): boolean {
  for (const prop of props) {
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === FORWARDED_REF_PROP_NAME) {
      return true
    }

    if (
      prop.type === NodeTypes.DIRECTIVE &&
      prop.name === "bind" &&
      prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION &&
      prop.arg.content === FORWARDED_REF_PROP_NAME
    ) {
      return true
    }
  }

  return false
}

function buildForwardedRefExpression(expression: string): string {
  if (isFunctionRefExpression(expression) || !isAssignableExpression(expression)) {
    return expression
  }

  return `(value) => typeof ${expression} === "function" ? ${expression}(value) : (${expression} = value)`
}

function isFunctionRefExpression(expression: string): boolean {
  return expression.includes("=>") || /^function\b/.test(expression.trim())
}

function isAssignableExpression(expression: string): boolean {
  return /^[A-Za-z_$][\w$]*(?:\s*(?:\.[A-Za-z_$][\w$]*|\[[^\]]+\]))*$/.test(expression.trim())
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
