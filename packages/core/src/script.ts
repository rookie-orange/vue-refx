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
  DEFINE_FORWARD_REF,
  FORWARDED_REF_IMPORT_SOURCES,
  FORWARDED_REF_PROP_NAME,
} from "./constants";

export interface TransformScriptSetupOptions {
  offset: number;
}

export interface LocalForwardedRef {
  name: string;
  binding: string | null;
}

interface DefineForwardRefBinding {
  call: CallExpression;
  statementStart: number;
  statementEnd: number;
  templateRef: string | null;
  bindingIdentifier: string | null;
  targetTypeSource: string | null;
  handleTypeSource: string | null;
  factorySource: string | null;
  exposeProperties: string[];
  isVariableInitializer: boolean;
  isExpressionStatement: boolean;
}

interface DefinePropsCall {
  call: CallExpression;
  propsIdentifier: string | null;
  declarationStart: number | null;
}

interface ScriptScope {
  bindings: Set<string>;
  customRefIdentifier: string | null;
  defineForwardRefLocals: Set<string>;
  refTypeIdentifier: string | null;
  removableDefineForwardRefImports: ImportDeclaration[];
  removableDefineForwardRefSpecifiers: Array<{
    declaration: ImportDeclaration;
    specifierStart: number;
    specifierEnd: number;
  }>;
}

export interface ScriptTransformMeta {
  hasDefineForwardRef: boolean;
  templateRefs: LocalForwardedRef[];
  propsIdentifier: string | null;
}

export function transformScriptSetup(
  code: string,
  s: MagicString,
  options: TransformScriptSetupOptions,
): ScriptTransformMeta {
  if (!code.includes(DEFINE_FORWARD_REF)) {
    return emptyMeta();
  }

  const ast = parseScript(code);
  const scope = collectScriptScope(ast);
  const bindings = collectDefineForwardRefBindings(code, ast, scope);

  if (bindings.length === 0) {
    return emptyMeta();
  }

  const forwardingBindings = bindings.filter((binding) => binding.templateRef);
  const localForwardingBindings = forwardingBindings.filter((binding) => binding.bindingIdentifier);
  const exposedProperties = bindings
    .filter((binding) => !binding.templateRef)
    .flatMap((binding) => binding.exposeProperties);
  const defineProps = collectDefineProps(ast)[0] ?? null;
  const defineExpose = collectDefineExpose(ast)[0] ?? null;
  const propsIdentifier = defineProps?.propsIdentifier ?? choosePropsIdentifier(scope.bindings);
  const customRefIdentifier =
    scope.customRefIdentifier ?? chooseCustomRefIdentifier(scope.bindings);
  const refTypeIdentifier = scope.refTypeIdentifier ?? chooseRefTypeIdentifier(scope.bindings);
  const insertionPoint = Math.min(...bindings.map((binding) => binding.statementStart));
  const insertions: string[] = [];

  removeDefineForwardRefImports(s, options.offset, scope);

  if (forwardingBindings.length > 0) {
    const propShape = `{ ${FORWARDED_REF_PROP_NAME}?: ${buildForwardedRefPropType(forwardingBindings, refTypeIdentifier)} | ((value: any) => void) }`;

    if (!scope.refTypeIdentifier) {
      s.prependLeft(
        options.offset,
        `\nimport type { Ref${refTypeIdentifier === "Ref" ? "" : ` as ${refTypeIdentifier}`} } from "vue"\n`,
      );
    }

    if (localForwardingBindings.length > 0 && !scope.customRefIdentifier) {
      s.prependLeft(
        options.offset,
        `\nimport { customRef${customRefIdentifier === "customRef" ? "" : ` as ${customRefIdentifier}`} } from "vue"\n`,
      );
    }

    if (defineProps) {
      mergeDefinePropsType(code, s, options.offset, defineProps.call, propShape);
    } else {
      insertions.push(`const ${propsIdentifier} = defineProps<${propShape}>()`);
    }
  }

  const exposeReplacementBinding =
    exposedProperties.length > 0 && !defineExpose
      ? (bindings.find((binding) => !binding.templateRef && binding.isExpressionStatement) ?? null)
      : null;

  if (exposedProperties.length > 0) {
    if (defineExpose) {
      mergeDefineExpose(code, s, options.offset, defineExpose.call, exposedProperties);
    } else if (!exposeReplacementBinding) {
      insertions.push(`defineExpose(${buildExposeObjectSource(exposedProperties)})`);
    }
  }

  if (insertions.length > 0) {
    s.prependLeft(options.offset + insertionPoint, `${insertions.join("\n\n")}\n\n`);
  }

  for (const binding of bindings) {
    if (binding.templateRef) {
      const source = buildForwardedRefSource(
        binding,
        propsIdentifier,
        customRefIdentifier,
        refTypeIdentifier,
      );

      if (binding.isVariableInitializer) {
        s.overwrite(
          options.offset + assertPosition(binding.call.start),
          options.offset + assertPosition(binding.call.end),
          source,
        );
      } else if (binding === exposeReplacementBinding) {
        s.overwrite(
          options.offset + assertPosition(binding.call.start),
          options.offset + assertPosition(binding.call.end),
          `defineExpose(${buildExposeObjectSource(exposedProperties)})`,
        );
      } else if (binding.factorySource && binding.bindingIdentifier) {
        s.overwrite(
          options.offset + binding.statementStart,
          options.offset + binding.statementEnd,
          `const ${binding.bindingIdentifier} = ${source}`,
        );
      } else if (binding.isExpressionStatement) {
        s.remove(options.offset + binding.statementStart, options.offset + binding.statementEnd);
      } else {
        s.overwrite(
          options.offset + assertPosition(binding.call.start),
          options.offset + assertPosition(binding.call.end),
          "undefined",
        );
      }
      continue;
    }

    if (binding === exposeReplacementBinding) {
      s.overwrite(
        options.offset + assertPosition(binding.call.start),
        options.offset + assertPosition(binding.call.end),
        `defineExpose(${buildExposeObjectSource(exposedProperties)})`,
      );
      continue;
    }

    if (binding.isExpressionStatement) {
      s.remove(options.offset + binding.statementStart, options.offset + binding.statementEnd);
      continue;
    }

    s.overwrite(
      options.offset + assertPosition(binding.call.start),
      options.offset + assertPosition(binding.call.end),
      "undefined",
    );
  }

  return {
    hasDefineForwardRef: forwardingBindings.length > 0,
    propsIdentifier: forwardingBindings.length > 0 ? propsIdentifier : null,
    templateRefs: forwardingBindings.map((binding) => ({
      name: binding.templateRef ?? "",
      binding: binding.bindingIdentifier,
    })),
  };
}

function emptyMeta(): ScriptTransformMeta {
  return {
    hasDefineForwardRef: false,
    templateRefs: [],
    propsIdentifier: null,
  };
}

function collectDefineForwardRefBindings(
  code: string,
  ast: File,
  scope: ScriptScope,
): DefineForwardRefBinding[] {
  const bindings: DefineForwardRefBinding[] = [];
  const generatedBindingIdentifiers = new Set<string>();

  traverse(ast, {
    CallExpression(path) {
      const node = path.node;

      if (!isDefineForwardRefCall(path, scope.defineForwardRefLocals)) {
        return;
      }

      const overload = parseDefineForwardRefOverload(code, node);
      const declarator =
        path.parentPath?.isVariableDeclarator() && path.parentPath.node.init === node
          ? (path.parentPath as NodePath<VariableDeclarator>)
          : null;
      const expressionStatement = path.findParent((parent) => parent.isExpressionStatement());
      const statement = declarator?.parentPath?.node ?? expressionStatement?.node ?? node;
      let bindingIdentifier = overload.templateRef
        ? getForwardedRefBindingIdentifier(declarator, Boolean(expressionStatement))
        : null;
      const typeSources = getDefineForwardRefTypeSources(code, node);

      if (overload.templateRef && !bindingIdentifier && overload.factorySource) {
        bindingIdentifier = chooseGeneratedForwardedRefIdentifier(
          scope.bindings,
          generatedBindingIdentifiers,
        );
        generatedBindingIdentifiers.add(bindingIdentifier);
      }

      bindings.push({
        call: node,
        statementStart: assertPosition(statement.start),
        statementEnd: getStatementEnd(code, assertPosition(statement.end)),
        templateRef: overload.templateRef,
        bindingIdentifier,
        targetTypeSource: typeSources.target,
        handleTypeSource: typeSources.handle,
        factorySource: overload.factorySource,
        exposeProperties: overload.exposeProperties,
        isVariableInitializer: Boolean(declarator),
        isExpressionStatement: Boolean(expressionStatement),
      });
    },
  });

  return bindings;
}

function parseDefineForwardRefOverload(
  code: string,
  call: CallExpression,
): {
  templateRef: string | null;
  factorySource: string | null;
  exposeProperties: string[];
} {
  const first = call.arguments[0];

  if (!first) {
    throw new Error("defineForwardRef() requires a template ref name or expose factory.");
  }

  if (first.type === "StringLiteral") {
    const factorySource = getFactorySource(code, call.arguments[1]);

    return {
      templateRef: first.value,
      factorySource,
      exposeProperties: [],
    };
  }

  if (first.type === "ArrowFunctionExpression" || first.type === "FunctionExpression") {
    return {
      templateRef: null,
      factorySource: null,
      exposeProperties: getFactoryExposeProperties(code, first),
    };
  }

  throw new Error("defineForwardRef() expects a string literal or expose factory.");
}

function getForwardedRefBindingIdentifier(
  declarator: NodePath<VariableDeclarator> | null,
  isExpressionStatement: boolean,
): string | null {
  if (declarator) {
    const id = declarator.node.id;

    if (id.type !== "Identifier") {
      throw new Error("defineForwardRef() must be assigned to an identifier.");
    }

    return id.name;
  }

  if (isExpressionStatement) {
    return null;
  }

  throw new Error("defineForwardRef() must be assigned to an identifier or used as a statement.");
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
  let customRefIdentifier: string | null = null;
  const defineForwardRefLocals = new Set<string>();
  let refTypeIdentifier: string | null = null;
  const removableDefineForwardRefImports: ImportDeclaration[] = [];
  const removableDefineForwardRefSpecifiers: ScriptScope["removableDefineForwardRefSpecifiers"] =
    [];

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

      if (node.source.value === "vue") {
        for (const specifier of node.specifiers) {
          if (
            specifier.type === "ImportSpecifier" &&
            specifier.imported.type === "Identifier" &&
            specifier.local.type === "Identifier"
          ) {
            if (
              node.importKind !== "type" &&
              specifier.imported.name === "customRef" &&
              specifier.importKind !== "type"
            ) {
              customRefIdentifier = specifier.local.name;
            }

            if (specifier.imported.name === "Ref") {
              refTypeIdentifier = specifier.local.name;
            }
          }
        }
      }

      if (!isForwardedRefImportSource(node.source.value) || node.importKind === "type") {
        return;
      }

      const defineForwardRefSpecifiers = node.specifiers.filter(
        (specifier) =>
          specifier.type === "ImportSpecifier" &&
          specifier.imported.type === "Identifier" &&
          specifier.imported.name === DEFINE_FORWARD_REF &&
          specifier.importKind !== "type",
      );

      for (const specifier of defineForwardRefSpecifiers) {
        defineForwardRefLocals.add(specifier.local.name);
      }

      if (defineForwardRefSpecifiers.length === 0) {
        return;
      }

      if (defineForwardRefSpecifiers.length === node.specifiers.length) {
        removableDefineForwardRefImports.push(node);
        return;
      }

      for (const specifier of defineForwardRefSpecifiers) {
        removableDefineForwardRefSpecifiers.push({
          declaration: node,
          specifierStart: assertPosition(specifier.start),
          specifierEnd: assertPosition(specifier.end),
        });
      }
    },
  });

  return {
    bindings,
    customRefIdentifier,
    defineForwardRefLocals,
    refTypeIdentifier,
    removableDefineForwardRefImports,
    removableDefineForwardRefSpecifiers,
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
  if (properties.length === 0) {
    return;
  }

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
  if (properties.length === 0) {
    return "{}";
  }

  return `{\n  ${properties.join(",\n  ")}\n}`;
}

function getLineIndent(code: string, position: number): string {
  const lineStart = code.lastIndexOf("\n", position) + 1;
  const line = code.slice(lineStart, position);
  return line.match(/^\s*/)?.[0] ?? "  ";
}

function removeDefineForwardRefImports(s: MagicString, offset: number, scope: ScriptScope): void {
  for (const declaration of scope.removableDefineForwardRefImports) {
    s.remove(offset + assertPosition(declaration.start), offset + assertPosition(declaration.end));
  }

  for (const specifier of scope.removableDefineForwardRefSpecifiers) {
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

function getDefineForwardRefTypeSources(
  code: string,
  call: CallExpression,
): {
  target: string | null;
  handle: string | null;
} {
  const typeParameters = call.typeParameters as TSTypeParameterInstantiation | undefined;

  if (!typeParameters) {
    return {
      target: null,
      handle: null,
    };
  }

  return {
    target: getTypeParameterSource(code, typeParameters, 0),
    handle: getTypeParameterSource(code, typeParameters, 1),
  };
}

function getTypeParameterSource(
  code: string,
  typeParameters: TSTypeParameterInstantiation,
  index: number,
): string | null {
  const parameter = typeParameters.params[index];

  if (!parameter) {
    return null;
  }

  return code.slice(assertPosition(parameter.start), assertPosition(parameter.end)).trim();
}

function getFactorySource(
  code: string,
  factory: CallExpression["arguments"][number] | undefined,
): string | null {
  if (
    !factory ||
    (factory.type !== "ArrowFunctionExpression" && factory.type !== "FunctionExpression")
  ) {
    return null;
  }

  return getNodeSource(code, factory).trim();
}

function getFactoryExposeProperties(
  code: string,
  factory: CallExpression["arguments"][number] | undefined,
): string[] {
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

function buildForwardedRefPropType(
  bindings: DefineForwardRefBinding[],
  refTypeIdentifier: string,
): string {
  const typeSources = [
    ...new Set(bindings.map((binding) => getForwardedRefValueType(binding)).filter(Boolean)),
  ];

  if (typeSources.length === 0) {
    return `${refTypeIdentifier}<any | null>`;
  }

  return typeSources.map((type) => `${refTypeIdentifier}<${type} | null>`).join(" | ");
}

function getForwardedRefValueType(binding: DefineForwardRefBinding): string {
  if (binding.factorySource) {
    return binding.handleTypeSource ?? "any";
  }

  return binding.targetTypeSource ?? "any";
}

function buildForwardedRefSource(
  binding: DefineForwardRefBinding,
  propsIdentifier: string,
  customRefIdentifier: string,
  refTypeIdentifier: string,
): string {
  const valueType = `${binding.targetTypeSource ?? "any"} | null`;
  const forwardedRefType = `${refTypeIdentifier}<${valueType}>`;
  const nextTargetSource = buildNextForwardedRefValueSource(binding);

  return `${customRefIdentifier}<${valueType}>((track, trigger) => {
  let value = null as ${valueType}

  return {
    get() {
      track()
      return value
    },
    set(nextValue) {
      value = nextValue
      trigger()
      const target = ${propsIdentifier}.${FORWARDED_REF_PROP_NAME}
      const nextTarget = ${nextTargetSource}

      if (typeof target === "function") {
        target(nextTarget)
      } else if (target) {
        target.value = nextTarget
      }
    }
  }
}) as ${forwardedRefType}`;
}

function buildNextForwardedRefValueSource(binding: DefineForwardRefBinding): string {
  if (!binding.factorySource) {
    return "nextValue";
  }

  if (!binding.bindingIdentifier) {
    throw new Error("defineForwardRef() with a factory requires a local ref binding.");
  }

  return `nextValue == null ? null : (${binding.factorySource})(${binding.bindingIdentifier})`;
}

function chooseCustomRefIdentifier(bindings: Set<string>): string {
  if (!bindings.has("customRef")) {
    return "customRef";
  }

  let index = 1;
  let candidate = "__customRef";

  while (bindings.has(candidate)) {
    candidate = `__customRef${index}`;
    index += 1;
  }

  return candidate;
}

function chooseRefTypeIdentifier(bindings: Set<string>): string {
  if (!bindings.has("Ref")) {
    return "Ref";
  }

  let index = 1;
  let candidate = "__VueRef";

  while (bindings.has(candidate)) {
    candidate = `__VueRef${index}`;
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

function chooseGeneratedForwardedRefIdentifier(
  bindings: Set<string>,
  generatedBindings: Set<string>,
): string {
  let index = 0;
  let candidate = "__forwardedRef";

  while (bindings.has(candidate) || generatedBindings.has(candidate)) {
    index += 1;
    candidate = `__forwardedRef${index}`;
  }

  return candidate;
}

function isDefineForwardRefCall(
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

function isForwardedRefImportSource(source: string): boolean {
  return FORWARDED_REF_IMPORT_SOURCES.has(source);
}

function getStatementEnd(code: string, end: number): number {
  return code[end] === ";" ? end + 1 : end;
}

function assertPosition(value: number | null | undefined): number {
  if (typeof value !== "number") {
    throw new Error("AST node is missing source location.");
  }

  return value;
}
