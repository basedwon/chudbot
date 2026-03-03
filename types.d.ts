declare module 'chudbot' {
  export type FrontMatterValue = string | string[]
  export type FrontMatter = Record<string, FrontMatterValue>

  export interface ChatParsed {
    frontMatter: FrontMatter
    blocks: Array<{ role: string; content: string }>
    messages: Array<{ role: string; content: string }>
  }

  export interface ResolverBaseOptions {
    cwd?: string
    chat?: string
    memory?: string
    frontMatter?: FrontMatter
    maxMessages?: number
    maxTokens?: number
    /**
     * List of file paths to include as context.
     *
     * Expected shape:
     * - Array of string paths
     * - Typically relative to `cwd`, but absolute paths also work
     */
    files?: string[]
  }

  export interface ResolvePathsOptions extends ResolverBaseOptions {}
  export interface LoadMemoryOptions extends ResolverBaseOptions {}

  export interface BuildMessagesOptions extends ResolverBaseOptions {
    memoryRole?: string
  }

  export interface ChudbotOptions {
    userRoot?: string
    chudRoot?: string
    envPath?: string
    debounceMs?: number
    maxMessages?: number
    maxTokens?: number
  }

  export interface InitOptions {
    cwd?: string
    chat?: string
    force?: boolean
    system?: string
  }

  export interface RunOptions {
    cwd?: string
    chat?: string
    memory?: string
    model?: string
    maxMessages?: number
    maxTokens?: number
    files?: string[]
  }

  export interface WatchOptions {
    cwd?: string
    chat?: string
    memory?: string
    model?: string
    debounceMs?: number
    maxMessages?: number
    maxTokens?: number
    files?: string[]
  }

  export class Chudbot {
    constructor(opts?: ChudbotOptions)
    init(opts?: InitOptions): {
      ok: boolean
      chatPath: string
      didWriteChat: boolean
    }
    run(opts?: RunOptions): Promise<{
      ok: boolean
      didRun: boolean
      chatPath?: string
      error?: any
    }>
    watch(opts?: WatchOptions): {
      ok: boolean
      watching: boolean
      chatPath?: string
    }
    stop(): Promise<{ ok: boolean; watching: boolean }>
  }

  export class ContextResolver {
    constructor(opts?: ChudbotOptions)
    resolvePaths(opts?: ResolvePathsOptions): {
      cwd: string
      userRoot: string
      chudRoot: string
      envPath: string
      chatPath: string
      rootMemoryPath: string
      localMemoryPath: string
    }
    loadMemory(opts?: LoadMemoryOptions): {
      raw: string
      paths: ReturnType<ContextResolver['resolvePaths']>
      over: boolean
    }
    buildMessages(
      parsed: ChatParsed,
      memoryRaw?: string,
      opts?: BuildMessagesOptions
    ): Array<{ role: string; content: string }>
  }
}
