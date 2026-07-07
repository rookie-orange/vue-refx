import fs from "node:fs/promises"
import path from "node:path"
import { createUnplugin } from "unplugin"
import type { ModuleNode, ViteDevServer } from "vite"
import {
  analyzeVueSfc,
  getVueComponentImports,
  transformVueSfc,
  type ComponentImport
} from "../../core/src"

export interface ForwardRefOptions {
  include?: FilterPattern
  exclude?: FilterPattern
  sourcemap?: boolean
}

const VUE_RE = /\.vue$/
type FilterPattern = RegExp | string | Array<RegExp | string>

interface CachedAnalysis {
  mtimeMs: number
  hasUseForwardedRef: boolean
}

export const unplugin = createUnplugin<ForwardRefOptions | undefined>((options = {}) => {
  const filter = createIdFilter(options.include ?? /\.vue$/, options.exclude)
  const analysisCache = new Map<string, CachedAnalysis>()
  const importerByChild = new Map<string, Set<string>>()
  let server: ViteDevServer | null = null

  async function analyzeFile(filename: string, fallbackCode?: string): Promise<boolean> {
    const normalized = normalizePath(filename)

    try {
      const stat = await fs.stat(normalized)
      const cached = analysisCache.get(normalized)

      if (cached && cached.mtimeMs === stat.mtimeMs) {
        return cached.hasUseForwardedRef
      }

      const code = fallbackCode ?? await fs.readFile(normalized, "utf8")
      const hasUseForwardedRef = analyzeVueSfc(code).hasUseForwardedRef
      analysisCache.set(normalized, {
        mtimeMs: stat.mtimeMs,
        hasUseForwardedRef
      })

      return hasUseForwardedRef
    } catch {
      if (fallbackCode == null) {
        return false
      }

      return analyzeVueSfc(fallbackCode).hasUseForwardedRef
    }
  }

  async function resolveForwardedRefComponents(
    code: string,
    id: string,
    context: {
      resolve?: (source: string, importer?: string, options?: { skipSelf?: boolean }) => Promise<{ id: string } | null>
      addWatchFile?: (id: string) => void
    }
  ): Promise<Set<string>> {
    const componentImports = getVueComponentImports(code)
    const result = new Set<string>()

    await Promise.all(
      componentImports.map(async (componentImport) => {
        const resolved = await resolveVueImport(componentImport, id, context)

        if (!resolved) {
          return
        }

        context.addWatchFile?.(resolved)
        rememberImporter(resolved, id)

        if (await analyzeFile(resolved)) {
          result.add(componentImport.local)
          result.add(kebabCase(componentImport.local))
        }
      })
    )

    return result
  }

  function rememberImporter(child: string, importer: string): void {
    const normalizedChild = normalizePath(child)
    const importers = importerByChild.get(normalizedChild) ?? new Set<string>()
    importers.add(normalizePath(importer))
    importerByChild.set(normalizedChild, importers)
  }

  function invalidateImporters(filename: string): ModuleNode[] {
    if (!server) {
      return []
    }

    const normalized = normalizePath(filename)
    const importers = importerByChild.get(normalized)

    if (!importers) {
      return []
    }

    const modules: ModuleNode[] = []

    for (const importer of importers) {
      const module = server.moduleGraph.getModuleById(importer)

      if (module) {
        server.moduleGraph.invalidateModule(module)
        modules.push(module)
      }
    }

    return modules
  }

  return {
    name: "vue-forward-ref",
    enforce: "pre",
    vite: {
      configResolved(config) {
        const hasVuePlugin = config.plugins.some((plugin) => plugin.name === "vite:vue")

        if (!hasVuePlugin) {
          config.logger.warn("vue-forward-ref should be used with @vitejs/plugin-vue.")
        }
      },
      configureServer(viteServer) {
        server = viteServer
      },
      async handleHotUpdate(ctx) {
        if (!VUE_RE.test(ctx.file)) {
          return
        }

        analysisCache.delete(normalizePath(ctx.file))
        await analyzeFile(ctx.file, await ctx.read())

        const importerModules = invalidateImporters(ctx.file)
        return importerModules.length > 0 ? [...ctx.modules, ...importerModules] : undefined
      }
    },
    async transform(code, id) {
      const cleanId = stripQuery(id)

      if (!VUE_RE.test(cleanId) || !filter(cleanId)) {
        return null
      }

      const forwardedRefComponents = await resolveForwardedRefComponents(code, cleanId, this)
      const result = transformVueSfc(code, {
        filename: cleanId,
        forwardedRefComponents,
        sourceMap: options.sourcemap ?? true
      })

      analysisCache.set(normalizePath(cleanId), {
        mtimeMs: await getMtime(cleanId),
        hasUseForwardedRef: result.hasUseForwardedRef
      })

      if (!result.hasChanged) {
        return null
      }

      return {
        code: result.code,
        map: result.map ?? undefined
      }
    }
  }
})

function createIdFilter(include: FilterPattern, exclude?: FilterPattern): (id: string) => boolean {
  return (id) => matchesPattern(id, include) && !matchesPattern(id, exclude)
}

function matchesPattern(id: string, pattern?: FilterPattern): boolean {
  if (pattern == null) {
    return false
  }

  const patterns = Array.isArray(pattern) ? pattern : [pattern]

  return patterns.some((item) => {
    if (typeof item === "string") {
      return id.includes(item)
    }

    return item.test(id)
  })
}

async function resolveVueImport(
  componentImport: ComponentImport,
  importer: string,
  context: {
    resolve?: (source: string, importer?: string, options?: { skipSelf?: boolean }) => Promise<{ id: string } | null>
  }
): Promise<string | null> {
  const resolved = await context.resolve?.(componentImport.source, importer, { skipSelf: true })

  if (resolved?.id) {
    const clean = stripQuery(resolved.id)
    return VUE_RE.test(clean) ? clean : await tryVueFile(clean)
  }

  if (!componentImport.source.startsWith(".")) {
    return null
  }

  const absolute = path.resolve(path.dirname(importer), componentImport.source)
  return await tryVueFile(absolute)
}

async function tryVueFile(filename: string): Promise<string | null> {
  const candidates = VUE_RE.test(filename) ? [filename] : [`${filename}.vue`, path.join(filename, "index.vue")]

  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate)

      if (stat.isFile()) {
        return normalizePath(candidate)
      }
    } catch {
      // Continue trying candidates.
    }
  }

  return null
}

async function getMtime(filename: string): Promise<number> {
  try {
    return (await fs.stat(filename)).mtimeMs
  } catch {
    return Date.now()
  }
}

function stripQuery(id: string): string {
  return id.split("?", 1)[0]
}

function normalizePath(filename: string): string {
  return filename.replace(/\\/g, "/")
}

function kebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase()
}

export const vite = unplugin.vite
export default vite
