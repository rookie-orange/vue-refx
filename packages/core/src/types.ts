import type { SourceMap } from "magic-string"

export interface ComponentImport {
  local: string
  source: string
}

export interface TransformVueOptions {
  refPropComponents?: Set<string> | string[]
  filename?: string
  sourceMap?: boolean
}

export interface TransformResult {
  code: string
  map: SourceMap | null
  hasChanged: boolean
  hasUseRefProp: boolean
}

export interface AnalyzeResult {
  hasUseRefProp: boolean
  imports: ComponentImport[]
}
