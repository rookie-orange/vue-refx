import MagicString from "magic-string"
import { parse } from "@vue/compiler-sfc"
import { descriptorUsesForwardedRef } from "./analyze"
import { collectVueComponentImportsFromDescriptor } from "./componentImports"
import { transformScriptSetup } from "./script"
import { transformTemplate } from "./template"
import type { TransformResult, TransformVueOptions } from "./types"

export function transformVueSfc(source: string, options: TransformVueOptions = {}): TransformResult {
  const { descriptor } = parse(source, {
    filename: options.filename,
    sourceMap: false
  })
  const s = new MagicString(source)
  const scriptSetup = descriptor.scriptSetup
  const template = descriptor.template
  const forwardedRefComponents = new Set(options.forwardedRefComponents ?? [])
  let hasUseForwardedRef = descriptorUsesForwardedRef(descriptor)

  if (scriptSetup) {
    const meta = transformScriptSetup(scriptSetup.content, s, {
      offset: scriptSetup.loc.start.offset
    })
    hasUseForwardedRef = meta.hasUseForwardedRef
  }

  if (template && forwardedRefComponents.size > 0) {
    transformTemplate(template.content, s, {
      offset: template.loc.start.offset,
      forwardedRefComponents
    })
  }

  const hasChanged = s.hasChanged()

  return {
    code: hasChanged ? s.toString() : source,
    map: hasChanged && options.sourceMap
      ? s.generateMap({
          source: options.filename,
          includeContent: true,
          hires: true
        })
      : null,
    hasChanged,
    hasUseForwardedRef
  }
}

export function getVueComponentImports(source: string) {
  const { descriptor } = parse(source)
  return collectVueComponentImportsFromDescriptor(source, descriptor)
}
