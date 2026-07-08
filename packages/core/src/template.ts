import MagicString from "magic-string";
import {
  type AttributeNode,
  type DirectiveNode,
  ElementTypes,
  type ElementNode,
  NodeTypes,
  parse,
  type TemplateChildNode,
} from "@vue/compiler-dom";
import { FORWARDED_REF_PROP_NAME } from "./constants";
import type { LocalForwardedRef } from "./script";

export interface TransformTemplateOptions {
  offset: number;
  forwardedRefComponents: Set<string>;
  localForwardedRefs?: LocalForwardedRef[];
  propsIdentifier?: string | null;
}

export function transformTemplate(
  code: string,
  s: MagicString,
  options: TransformTemplateOptions,
): void {
  const hasRefBinding =
    code.includes("ref=") || code.includes(":ref") || code.includes("v-bind:ref");

  if (!hasRefBinding) {
    validateLocalForwardedRefs([], options.localForwardedRefs ?? []);
    return;
  }

  const ast = parse(code, { comments: true });
  const localForwardedRefs = options.localForwardedRefs ?? [];
  const localForwardedRefByName = new Map(localForwardedRefs.map((ref) => [ref.name, ref]));
  const foundLocalForwardedRefs = new Set<string>();

  walk(ast.children, (node) => {
    if (node.type !== NodeTypes.ELEMENT) {
      return;
    }

    transformLocalForwardedRef(
      node,
      s,
      options.offset,
      localForwardedRefByName,
      foundLocalForwardedRefs,
      options.propsIdentifier ?? null,
    );

    if (!shouldInjectForwardedRef(node.tag, node.tagType, options.forwardedRefComponents)) {
      return;
    }

    const refBinding = getRefBinding(node.props);

    if (!refBinding || hasForwardedRefBinding(node.props)) {
      return;
    }

    s.overwrite(
      options.offset + refBinding.start,
      options.offset + refBinding.end,
      `:${FORWARDED_REF_PROP_NAME}="${escapeAttribute(buildForwardedRefExpression(refBinding.expression, refBinding.kind))}"`,
    );
  });

  validateLocalForwardedRefs([...foundLocalForwardedRefs], localForwardedRefs);
}

function walk(nodes: TemplateChildNode[], visitor: (node: TemplateChildNode) => void): void {
  for (const node of nodes) {
    visitor(node);

    if (node.type === NodeTypes.ELEMENT) {
      walk(node.children, visitor);
    } else if (node.type === NodeTypes.IF) {
      for (const branch of node.branches) {
        walk(branch.children, visitor);
      }
    } else if (node.type === NodeTypes.FOR) {
      walk(node.children, visitor);
    }
  }
}

function shouldInjectForwardedRef(
  tag: string,
  tagType: ElementTypes,
  forwardedRefComponents: Set<string>,
): boolean {
  if (tagType !== ElementTypes.COMPONENT && !isLikelyComponentTag(tag)) {
    return false;
  }

  return getComponentAliases(tag).some((alias) => forwardedRefComponents.has(alias));
}

function transformLocalForwardedRef(
  node: ElementNode,
  s: MagicString,
  offset: number,
  localForwardedRefByName: Map<string, LocalForwardedRef>,
  foundLocalForwardedRefs: Set<string>,
  propsIdentifier: string | null,
): void {
  const refBinding = getRefBinding(node.props);

  if (!refBinding || refBinding.kind !== "static") {
    return;
  }

  const forwardedRef = localForwardedRefByName.get(refBinding.expression);

  if (!forwardedRef) {
    return;
  }

  foundLocalForwardedRefs.add(forwardedRef.name);

  const target = forwardedRef.binding
    ? `(value) => ${forwardedRef.binding} = value`
    : propsIdentifier
      ? `${propsIdentifier}.${FORWARDED_REF_PROP_NAME}`
      : null;

  if (!target) {
    return;
  }

  s.overwrite(
    offset + refBinding.start,
    offset + refBinding.end,
    `:ref="${escapeAttribute(target)}"`,
  );
}

function validateLocalForwardedRefs(
  found: string[],
  localForwardedRefs: LocalForwardedRef[],
): void {
  const foundRefs = new Set(found);

  for (const forwardedRef of localForwardedRefs) {
    if (!foundRefs.has(forwardedRef.name)) {
      throw new Error(`Cannot find template ref "${forwardedRef.name}".`);
    }
  }
}

interface RefBinding {
  expression: string;
  kind: "static" | "dynamic";
  start: number;
  end: number;
}

function getRefBinding(props: Array<AttributeNode | DirectiveNode>): RefBinding | null {
  for (const prop of props) {
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === "ref") {
      const expression = prop.value?.content.trim();
      return expression
        ? {
            expression,
            kind: "static",
            start: prop.loc.start.offset,
            end: prop.loc.end.offset,
          }
        : null;
    }

    if (
      prop.type === NodeTypes.DIRECTIVE &&
      prop.name === "bind" &&
      prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION &&
      prop.arg.content === "ref"
    ) {
      const expression =
        prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION ? prop.exp.content.trim() : null;

      return expression
        ? {
            expression,
            kind: "dynamic",
            start: prop.loc.start.offset,
            end: prop.loc.end.offset,
          }
        : null;
    }
  }

  return null;
}

function hasForwardedRefBinding(props: Array<AttributeNode | DirectiveNode>): boolean {
  for (const prop of props) {
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === FORWARDED_REF_PROP_NAME) {
      return true;
    }

    if (
      prop.type === NodeTypes.DIRECTIVE &&
      prop.name === "bind" &&
      prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION &&
      prop.arg.content === FORWARDED_REF_PROP_NAME
    ) {
      return true;
    }
  }

  return false;
}

function buildForwardedRefExpression(expression: string, _kind: RefBinding["kind"]): string {
  if (isFunctionRefExpression(expression) || !isAssignableExpression(expression)) {
    return expression;
  }

  if (_kind === "static") {
    return `(value) => ${expression} = value`;
  }

  return `(value) => typeof ${expression} === "function" ? ${expression}(value) : (${expression} = value)`;
}

function isFunctionRefExpression(expression: string): boolean {
  return expression.includes("=>") || /^function\b/.test(expression.trim());
}

function isAssignableExpression(expression: string): boolean {
  return /^[A-Za-z_$][\w$]*(?:\s*(?:\.[A-Za-z_$][\w$]*|\[[^\]]+\]))*$/.test(expression.trim());
}

function getComponentAliases(tag: string): string[] {
  return [tag, camelize(tag), pascalize(tag)];
}

function isLikelyComponentTag(tag: string): boolean {
  return /^[A-Z]/.test(tag) || tag.includes(".");
}

function camelize(value: string): string {
  return value.replace(/-(\w)/g, (_, char: string) => char.toUpperCase());
}

function pascalize(value: string): string {
  const camel = camelize(value);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function escapeAttribute(value: string): string {
  return value.replace(/"/g, "&quot;");
}
