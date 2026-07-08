import MagicString from "magic-string";
import { parse } from "@vue/compiler-sfc";
import { descriptorUsesDefineForwardRef } from "./analyze";
import { collectVueComponentImportsFromDescriptor } from "./componentImports";
import { transformScriptSetup, type ScriptTransformMeta } from "./script";
import { transformTemplate } from "./template";
import type { TransformResult, TransformVueOptions } from "./types";

export function transformVueSfc(
  source: string,
  options: TransformVueOptions = {},
): TransformResult {
  const { descriptor } = parse(source, {
    filename: options.filename,
    sourceMap: false,
  });
  const s = new MagicString(source);
  const scriptSetup = descriptor.scriptSetup;
  const template = descriptor.template;
  const forwardedRefComponents = new Set(options.forwardedRefComponents ?? []);
  let scriptMeta: ScriptTransformMeta = {
    hasDefineForwardRef: descriptorUsesDefineForwardRef(descriptor),
    templateRefs: [],
    propsIdentifier: null,
  };

  if (scriptSetup) {
    scriptMeta = transformScriptSetup(scriptSetup.content, s, {
      offset: scriptSetup.loc.start.offset,
    });
  }

  if (template && (forwardedRefComponents.size > 0 || scriptMeta.templateRefs.length > 0)) {
    transformTemplate(template.content, s, {
      offset: template.loc.start.offset,
      forwardedRefComponents,
      localForwardedRefs: scriptMeta.templateRefs,
      propsIdentifier: scriptMeta.propsIdentifier,
    });
  } else if (!template && scriptMeta.templateRefs.length > 0) {
    throw new Error(`Cannot find template ref "${scriptMeta.templateRefs[0]?.name}".`);
  }

  const hasChanged = s.hasChanged();

  return {
    code: hasChanged ? s.toString() : source,
    map:
      hasChanged && options.sourceMap
        ? s.generateMap({
            source: options.filename,
            includeContent: true,
            hires: true,
          })
        : null,
    hasChanged,
    hasDefineForwardRef: scriptMeta.hasDefineForwardRef,
  };
}

export function getVueComponentImports(source: string) {
  const { descriptor } = parse(source);
  return collectVueComponentImportsFromDescriptor(source, descriptor);
}
