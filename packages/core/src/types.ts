import type { SourceMap } from "magic-string";

export interface ComponentImport {
  local: string;
  source: string;
}

export interface TransformVueOptions {
  forwardedRefComponents?: Set<string> | string[];
  filename?: string;
  sourceMap?: boolean;
}

export interface TransformResult {
  code: string;
  map: SourceMap | null;
  hasChanged: boolean;
  hasDefineForwardRef: boolean;
}

export interface AnalyzeResult {
  hasDefineForwardRef: boolean;
  imports: ComponentImport[];
}
