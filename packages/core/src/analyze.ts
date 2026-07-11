import type { CallExpression } from "@babel/types";
import { parse, type SFCDescriptor } from "@vue/compiler-sfc";
import { parseScript } from "./ast";
import { traverse, type NodePath } from "./babelTraverse";
import { collectVueComponentImportsFromDescriptor } from "./componentImports";
import { DEFINE_FORWARD_REF, FORWARDED_REF_IMPORT_SOURCES } from "./constants";
import type { AnalyzeResult } from "./types";

export function analyzeVueSfc(source: string): AnalyzeResult {
  const descriptor = parse(source).descriptor;
  const hasDefineForwardRef = descriptorUsesDefineForwardRef(descriptor);

  return {
    hasDefineForwardRef,
    imports: collectVueComponentImportsFromDescriptor(source, descriptor),
  };
}

export function descriptorUsesDefineForwardRef(descriptor: SFCDescriptor): boolean {
  const setup = descriptor.scriptSetup;

  if (!setup?.content || !setup.content.includes(DEFINE_FORWARD_REF)) {
    return false;
  }

  return scriptUsesDefineForwardRef(setup.content);
}

export function scriptUsesDefineForwardRef(code: string): boolean {
  let found = false;
  const ast = parseScript(code);
  const defineForwardRefLocals = new Set<string>();

  traverse(ast, {
    ImportDeclaration(path) {
      const node = path.node;

      if (!FORWARDED_REF_IMPORT_SOURCES.has(node.source.value) || node.importKind === "type") {
        return;
      }

      for (const specifier of node.specifiers) {
        if (
          specifier.type === "ImportSpecifier" &&
          specifier.imported.type === "Identifier" &&
          specifier.imported.name === DEFINE_FORWARD_REF &&
          specifier.importKind !== "type"
        ) {
          defineForwardRefLocals.add(specifier.local.name);
        }
      }
    },
    CallExpression(path) {
      if (isDefineForwardRefCall(path, defineForwardRefLocals) && isForwardingOverload(path.node)) {
        found = true;
        path.stop();
      }
    },
  });

  return found;
}

function isForwardingOverload(call: CallExpression): boolean {
  return call.arguments[0]?.type === "StringLiteral";
}

export function isDefineForwardRefCall(
  path: NodePath<CallExpression>,
  defineForwardRefLocals: Set<string>,
): boolean {
  const callee = path.node.callee;

  if (callee.type !== "Identifier") {
    return false;
  }

  if (defineForwardRefLocals.has(callee.name)) {
    return true;
  }

  return callee.name === DEFINE_FORWARD_REF && !path.scope.hasBinding(DEFINE_FORWARD_REF);
}
