export {
  analyzeVueSfc,
  descriptorUsesDefineForwardRef,
  scriptUsesDefineForwardRef,
} from "./analyze";
export {
  collectVueComponentImports,
  collectVueComponentImportsFromDescriptor,
} from "./componentImports";
export { transformScriptSetup } from "./script";
export { transformTemplate } from "./template";
export { getVueComponentImports, transformVueSfc } from "./transform";
export type { AnalyzeResult, ComponentImport, TransformResult, TransformVueOptions } from "./types";
