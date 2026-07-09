import { NodeTypes, type RootNode, type TemplateChildNode } from "@vue/compiler-dom";
import type { IR, VueEmbeddedCode, VueLanguagePlugin } from "@vue/language-core";
import type { Node, SourceFile } from "typescript";

const DEFINE_FORWARD_REF = "defineForwardRef";
const VUE_REFX_MODULE = "vue-refx";

const SCRIPT_SERVICE_RE = /^script_(?:js|jsx|ts|tsx)$/;
const TEMPLATE_REF_COMPLETION_TYPE = "__VLS_RefxTemplateRefs";
const COMPLETION_FEATURE = { completion: true };

const VueRefxVolar: VueLanguagePlugin = ({ modules: { typescript: ts } }) => ({
  version: 2.2,
  name: "vue-refx-volar",
  order: 1,
  resolveEmbeddedCode(_fileName: string, ir: IR, embeddedFile: VueEmbeddedCode): void {
    if (!SCRIPT_SERVICE_RE.test(embeddedFile.id) || !ir.scriptSetup) {
      return;
    }

    const templateRefs = collectTemplateRefs(ir.template?.ast);
    const defineForwardRefArgs = collectDefineForwardRefArgs(
      ts,
      ir.scriptSetup.ast,
      ir.scriptSetup.content,
    );

    if (!templateRefs.size || !defineForwardRefArgs.length) {
      return;
    }

    embeddedFile.content.push("\n;type ", TEMPLATE_REF_COMPLETION_TYPE, " = {");

    for (const name of templateRefs) {
      embeddedFile.content.push("\n", JSON.stringify(name), ": unknown;");
    }

    embeddedFile.content.push("\n};\n");

    for (const arg of defineForwardRefArgs) {
      embeddedFile.content.push(
        "({} as ",
        TEMPLATE_REF_COMPLETION_TYPE,
        ")[",
        [arg.text, ir.scriptSetup.name, arg.start, COMPLETION_FEATURE],
        "];\n",
      );
    }
  },
});

export default VueRefxVolar;

interface DefineForwardRefArg {
  text: string;
  start: number;
}

function collectDefineForwardRefArgs(
  ts: typeof import("typescript"),
  sourceFile: SourceFile,
  content: string,
): DefineForwardRefArg[] {
  const locals = collectDefineForwardRefLocals(ts, sourceFile);
  const args: DefineForwardRefArg[] = [];

  if (!locals.size) {
    return args;
  }

  visit(sourceFile);
  return args;

  function visit(node: Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      locals.has(node.expression.text)
    ) {
      const firstArg = node.arguments[0];

      if (firstArg && ts.isStringLiteral(firstArg)) {
        const start = firstArg.getStart(sourceFile);
        args.push({
          text: content.slice(start, firstArg.getEnd()),
          start,
        });
      }
    }

    if (node !== sourceFile && ts.isFunctionLike(node)) {
      return;
    }

    ts.forEachChild(node, visit);
  }
}

function collectDefineForwardRefLocals(
  ts: typeof import("typescript"),
  sourceFile: SourceFile,
): Set<string> {
  const locals = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !statement.importClause ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== VUE_REFX_MODULE
    ) {
      continue;
    }

    const namedBindings = statement.importClause.namedBindings;

    if (!namedBindings || !ts.isNamedImports(namedBindings)) {
      continue;
    }

    for (const specifier of namedBindings.elements) {
      const imported = specifier.propertyName?.text ?? specifier.name.text;

      if (imported === DEFINE_FORWARD_REF) {
        locals.add(specifier.name.text);
      }
    }
  }

  return locals;
}

function collectTemplateRefs(root: RootNode | undefined): Set<string> {
  const refs = new Set<string>();

  if (root) {
    visit(root);
  }

  return refs;

  function visit(node: RootNode | TemplateChildNode): void {
    if (node.type === NodeTypes.ELEMENT) {
      for (const prop of node.props) {
        if (prop.type === NodeTypes.ATTRIBUTE && prop.name === "ref" && prop.value?.content) {
          refs.add(prop.value.content);
        }
      }
    }

    if (node.type === NodeTypes.IF) {
      for (const branch of node.branches) {
        for (const child of branch.children) {
          visit(child);
        }
      }

      return;
    }

    if (
      node.type === NodeTypes.ROOT ||
      node.type === NodeTypes.ELEMENT ||
      node.type === NodeTypes.FOR
    ) {
      for (const child of node.children) {
        visit(child);
      }
    }
  }
}
