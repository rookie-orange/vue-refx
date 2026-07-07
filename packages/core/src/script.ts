import MagicString from "magic-string";
import type {
  ArrowFunctionExpression,
  CallExpression,
  File,
  FunctionExpression,
  ImportDeclaration,
  ObjectExpression,
  TSTypeParameterInstantiation,
  VariableDeclarator,
} from "@babel/types";
import { getNodeSource, parseScript } from "./ast";
import { traverse, type NodePath } from "./babelTraverse";
import {
  FORWARDED_REF_IMPORT_SOURCES,
  FORWARDED_REF_PROP_NAME,
  USE_FORWARDED_REF,
} from "./constants";

export interface TransformScriptSetupOptions {
  offset: number;
}

interface ForwardedRefBinding {
  local: string;
  call: CallExpression;
  statementStart: number;
  typeSource: string | null;
  exposeProperties: string[];
}

interface DefinePropsCall {
  call: CallExpression;
  propsIdentifier: string | null;
  declarationStart: number | null;
}

interface ScriptScope {
  bindings: Set<string>;
  forwardedRefLocals: Set<string>;
  forwardedRefTypeIdentifier: string | null;
  removableForwardedRefImports: ImportDeclaration[];
  removableForwardedRefSpecifiers: Array<{
    declaration: ImportDeclaration;
    specifierStart: number;
    specifierEnd: number;
  }>;
}

export interface ScriptTransformMeta {
  hasUseForwardedRef: boolean;
}

export function transformScriptSetup(
  code: string,
  s: MagicString,
  options: TransformScriptSetupOptions,
): ScriptTransformMeta {
  if (!code.includes(USE_FORWARDED_REF)) {
    return { hasUseForwardedRef: false };
  }

  const ast = parseScript(code);
  const scope = collectScriptScope(ast);

  if (scope.forwardedRefLocals.size === 0) {
    return { hasUseForwardedRef: false };
  }

  const bindings = collectForwardedRefBindings(code, ast, scope.forwardedRefLocals);

  if (bindings.length === 0) {
    return { hasUseForwardedRef: false };
  }

  const defineProps = collectDefineProps(ast)[0] ?? null;
  const defineExpose = collectDefineExpose(ast)[0] ?? null;
  const propsIdentifier = defineProps?.propsIdentifier ?? choosePropsIdentifier(scope.bindings);
  const forwardedRefTypeIdentifier =
    scope.forwardedRefTypeIdentifier ?? chooseForwardedRefTypeIdentifier(scope.bindings);
  const refType = buildRefType(bindings, forwardedRefTypeIdentifier);
  const propShape = `{ ${FORWARDED_REF_PROP_NAME}?: ${refType} | ((value: any) => void) }`;
  const exposedProperties = bindings.flatMap((binding) => binding.exposeProperties);

  removeForwardedRefImports(s, options.offset, scope);

  if (!scope.forwardedRefTypeIdentifier) {
    s.prependLeft(
      options.offset,
      `\nimport type { ForwardedRef${forwardedRefTypeIdentifier === "ForwardedRef" ? "" : ` as ${forwardedRefTypeIdentifier}`} } from "vue-refx"\n`,
    );
  }

  const insertionPoint = Math.min(...bindings.map((binding) => binding.statementStart));
  const insertions: string[] = [];

  if (defineProps) {
    mergeDefinePropsType(code, s, options.offset, defineProps.call, propShape);
  } else {
    insertions.push(`const ${propsIdentifier} = defineProps<${propShape}>()`);
  }

  if (exposedProperties.length > 0) {
    if (defineExpose) {
      mergeDefineExpose(code, s, options.offset, defineExpose.call, exposedProperties);
    } else {
      insertions.push(`defineExpose(${buildExposeObjectSource(exposedProperties)})`);
    }
  }

  if (insertions.length > 0) {
    s.prependLeft(options.offset + insertionPoint, `${insertions.join("\n\n")}\n\n`);
  }

  for (const binding of bindings) {
    s.overwrite(
      options.offset + assertPosition(binding.call.start),
      options.offset + assertPosition(binding.call.end),
      `${propsIdentifier}.${FORWARDED_REF_PROP_NAME}`,
    );
  }

  return { hasUseForwardedRef: true };
}

function collectForwardedRefBindings(
  code: string,
  ast: File,
  forwardedRefLocals: Set<string>,
): ForwardedRefBinding[] {
  const bindings: ForwardedRefBinding[] = [];

  traverse(ast, {
    VariableDeclarator(path) {
      const node = path.node;

      if (
        !node.init ||
        node.init.type !== "CallExpression" ||
        !isUseForwardedRefCall(node.init, forwardedRefLocals)
      ) {
        return;
      }

      if (node.id.type !== "Identifier") {
        throw new Error("useForwardedRef() must be assigned to an identifier.");
      }

      const declaration = path.findParent((parent) => parent.isVariableDeclaration());
      const statementStart = declaration?.node.start ?? node.start;

      bindings.push({
        local: node.id.name,
        call: node.init,
        statementStart: assertPosition(statementStart),
        typeSource: getUseForwardedRefTypeSource(code, node.init),
        exposeProperties: getFactoryExposeProperties(code, node.init),
      });
    },
  });

  return bindings;
}

function collectDefineProps(ast: File): DefinePropsCall[] {
  const calls: DefinePropsCall[] = [];

  traverse(ast, {
    CallExpression(path) {
      const node = path.node;

      if (node.callee.type !== "Identifier" || node.callee.name !== "defineProps") {
        return;
      }

      const declarator = path.findParent((parent) =>
        parent.isVariableDeclarator(),
      ) as NodePath<VariableDeclarator> | null;
      const id = declarator?.node.id;

      calls.push({
        call: node,
        propsIdentifier: id?.type === "Identifier" ? id.name : null,
        declarationStart: declarator?.parentPath?.node.start ?? declarator?.node.start ?? null,
      });
    },
  });

  return calls;
}

interface DefineExposeCall {
  call: CallExpression;
}

function collectDefineExpose(ast: File): DefineExposeCall[] {
  const calls: DefineExposeCall[] = [];

  traverse(ast, {
    CallExpression(path) {
      const node = path.node;

      if (node.callee.type !== "Identifier" || node.callee.name !== "defineExpose") {
        return;
      }

      calls.push({ call: node });
    },
  });

  return calls;
}

function collectScriptScope(ast: File): ScriptScope {
  const bindings = new Set<string>();
  const forwardedRefLocals = new Set<string>();
  let forwardedRefTypeIdentifier: string | null = null;
  const removableForwardedRefImports: ImportDeclaration[] = [];
  const removableForwardedRefSpecifiers: ScriptScope["removableForwardedRefSpecifiers"] = [];

  traverse(ast, {
    Program(path) {
      Object.keys(path.scope.bindings).forEach((name) => bindings.add(name));
    },
    TSInterfaceDeclaration(path) {
      bindings.add(path.node.id.name);
    },
    TSTypeAliasDeclaration(path) {
      bindings.add(path.node.id.name);
    },
    ImportDeclaration(path) {
      const node = path.node;

      if (isForwardedRefImportSource(node.source.value)) {
        for (const specifier of node.specifiers) {
          if (
            specifier.type === "ImportSpecifier" &&
            specifier.imported.type === "Identifier" &&
            specifier.imported.name === "ForwardedRef" &&
            specifier.local.type === "Identifier"
          ) {
            forwardedRefTypeIdentifier = specifier.local.name;
          }
        }
      }

      if (!isForwardedRefImportSource(node.source.value) || node.importKind === "type") {
        return;
      }

      const forwardedRefSpecifiers = node.specifiers.filter(
        (specifier) =>
          specifier.type === "ImportSpecifier" &&
          specifier.imported.type === "Identifier" &&
          specifier.imported.name === USE_FORWARDED_REF &&
          specifier.importKind !== "type",
      );

      for (const specifier of forwardedRefSpecifiers) {
        forwardedRefLocals.add(specifier.local.name);
      }

      if (forwardedRefSpecifiers.length === 0) {
        return;
      }

      if (forwardedRefSpecifiers.length === node.specifiers.length) {
        removableForwardedRefImports.push(node);
        return;
      }

      for (const specifier of forwardedRefSpecifiers) {
        removableForwardedRefSpecifiers.push({
          declaration: node,
          specifierStart: assertPosition(specifier.start),
          specifierEnd: assertPosition(specifier.end),
        });
      }
    },
  });

  return {
    bindings,
    forwardedRefLocals,
    forwardedRefTypeIdentifier,
    removableForwardedRefImports,
    removableForwardedRefSpecifiers,
  };
}

function mergeDefinePropsType(
  code: string,
  s: MagicString,
  offset: number,
  call: CallExpression,
  propShape: string,
): void {
  const typeParameters = call.typeParameters as TSTypeParameterInstantiation | undefined;

  if (!typeParameters || typeParameters.params.length === 0) {
    s.appendLeft(offset + assertPosition(call.callee.end), `<${propShape}>`);
    return;
  }

  const existing = code.slice(
    assertPosition(typeParameters.params[0].start),
    assertPosition(typeParameters.params[typeParameters.params.length - 1].end),
  );

  s.overwrite(
    offset + assertPosition(typeParameters.start),
    offset + assertPosition(typeParameters.end),
    `<${existing} & ${propShape}>`,
  );
}

function mergeDefineExpose(
  code: string,
  s: MagicString,
  offset: number,
  call: CallExpression,
  properties: string[],
): void {
  const argument = call.arguments[0];

  if (!argument) {
    s.appendLeft(offset + assertPosition(call.end) - 1, buildExposeObjectSource(properties));
    return;
  }

  if (argument.type === "ObjectExpression") {
    appendObjectProperties(code, s, offset, argument, properties);
    return;
  }

  if (argument.type === "SpreadElement" || argument.type === "ArgumentPlaceholder") {
    return;
  }

  s.overwrite(
    offset + assertPosition(argument.start),
    offset + assertPosition(argument.end),
    `{ ...${getNodeSource(code, argument)}, ${properties.join(", ")} }`,
  );
}

function appendObjectProperties(
  code: string,
  s: MagicString,
  offset: number,
  object: ObjectExpression,
  properties: string[],
): void {
  const objectStart = assertPosition(object.start);
  const objectEnd = assertPosition(object.end);

  if (object.properties.length === 0) {
    s.appendLeft(offset + objectStart + 1, ` ${properties.join(", ")} `);
    return;
  }

  const lastProperty = object.properties[object.properties.length - 1];
  const lastPropertyEnd = assertPosition(lastProperty.end);
  const trailingSource = code.slice(lastPropertyEnd, objectEnd - 1);
  const commaIndex = trailingSource.indexOf(",");
  const insertionPoint = commaIndex >= 0 ? lastPropertyEnd + commaIndex + 1 : lastPropertyEnd;
  const needsComma = commaIndex < 0;
  const isMultiline = code.slice(objectStart, objectEnd).includes("\n");

  if (isMultiline) {
    const indent = getLineIndent(code, assertPosition(lastProperty.start));
    s.appendLeft(
      offset + insertionPoint,
      `${needsComma ? "," : ""}\n${indent}${properties.join(`,\n${indent}`)}`,
    );
    return;
  }

  s.appendLeft(offset + insertionPoint, `${needsComma ? "," : ""} ${properties.join(", ")}`);
}

function buildExposeObjectSource(properties: string[]): string {
  return `{\n  ${properties.join(",\n  ")}\n}`;
}

function getLineIndent(code: string, position: number): string {
  const lineStart = code.lastIndexOf("\n", position) + 1;
  const line = code.slice(lineStart, position);
  return line.match(/^\s*/)?.[0] ?? "  ";
}

function removeForwardedRefImports(s: MagicString, offset: number, scope: ScriptScope): void {
  for (const declaration of scope.removableForwardedRefImports) {
    s.remove(offset + assertPosition(declaration.start), offset + assertPosition(declaration.end));
  }

  for (const specifier of scope.removableForwardedRefSpecifiers) {
    const specifierStart = specifier.specifierStart;
    const specifierEnd = specifier.specifierEnd;
    const declaration = specifier.declaration;
    const nextSpecifier = declaration.specifiers.find(
      (item) => assertPosition(item.start) > specifierStart,
    );
    const previousSpecifier = [...declaration.specifiers]
      .reverse()
      .find((item) => assertPosition(item.end) < specifierStart);

    if (nextSpecifier) {
      s.remove(offset + specifierStart, offset + assertPosition(nextSpecifier.start));
    } else if (previousSpecifier) {
      s.remove(offset + assertPosition(previousSpecifier.end), offset + specifierEnd);
    } else {
      s.remove(offset + specifierStart, offset + specifierEnd);
    }
  }
}

function getUseForwardedRefTypeSource(code: string, call: CallExpression): string | null {
  const typeParameters = call.typeParameters as TSTypeParameterInstantiation | undefined;

  if (!typeParameters || typeParameters.params.length === 0) {
    return null;
  }

  return code
    .slice(
      assertPosition(typeParameters.params[0].start),
      assertPosition(typeParameters.params[typeParameters.params.length - 1].end),
    )
    .trim();
}

function getFactoryExposeProperties(code: string, call: CallExpression): string[] {
  const factory = call.arguments[0];

  if (
    !factory ||
    (factory.type !== "ArrowFunctionExpression" && factory.type !== "FunctionExpression")
  ) {
    return [];
  }

  const object = getFactoryObjectExpression(factory);

  if (!object) {
    return [];
  }

  return object.properties.map((property) => getNodeSource(code, property).trim()).filter(Boolean);
}

function getFactoryObjectExpression(
  factory: ArrowFunctionExpression | FunctionExpression,
): ObjectExpression | null {
  if (factory.body.type === "ObjectExpression") {
    return factory.body;
  }

  if (factory.body.type !== "BlockStatement") {
    return null;
  }

  for (const statement of factory.body.body) {
    if (statement.type === "ReturnStatement" && statement.argument?.type === "ObjectExpression") {
      return statement.argument;
    }
  }

  return null;
}

function buildRefType(bindings: ForwardedRefBinding[], forwardedRefTypeIdentifier: string): string {
  const typeSources = [...new Set(bindings.map((binding) => binding.typeSource).filter(Boolean))];

  if (typeSources.length === 0) {
    return `${forwardedRefTypeIdentifier}<any>`;
  }

  return typeSources.map((type) => `${forwardedRefTypeIdentifier}<${type}>`).join(" | ");
}

function chooseForwardedRefTypeIdentifier(bindings: Set<string>): string {
  if (!bindings.has("ForwardedRef")) {
    return "ForwardedRef";
  }

  let index = 1;
  let candidate = "__ForwardedRef";

  while (bindings.has(candidate)) {
    candidate = `__ForwardedRef${index}`;
    index += 1;
  }

  return candidate;
}

function choosePropsIdentifier(bindings: Set<string>): string {
  if (!bindings.has("props")) {
    return "props";
  }

  let index = 1;
  let candidate = "__forwardedRefProps";

  while (bindings.has(candidate)) {
    candidate = `__forwardedRefProps${index}`;
    index += 1;
  }

  return candidate;
}

function isUseForwardedRefCall(node: CallExpression, forwardedRefLocals: Set<string>): boolean {
  return node.callee.type === "Identifier" && forwardedRefLocals.has(node.callee.name);
}

function isForwardedRefImportSource(source: string): boolean {
  return FORWARDED_REF_IMPORT_SOURCES.has(source);
}

function assertPosition(value: number | null | undefined): number {
  if (typeof value !== "number") {
    throw new Error("AST node is missing source location.");
  }

  return value;
}
