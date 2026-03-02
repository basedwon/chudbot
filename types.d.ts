declare module 'chudbot' {
  export type Role = 'system' | 'user' | 'assistant' | string

  export interface ChatBlock {
    role: Role
    content: string
  }

  export interface ChatMessage {
    role: Role
    content: string
  }

  export interface ChatParsed {
    frontMatter?: Record<string, string>
    blocks: ChatBlock[]
    messages: ChatMessage[]
  }

  export interface ChatParserOptions {
    eol?: string
    headerRe?: RegExp
    allowedRoles?: Record<string, boolean>
  }

  export class ChatParser {
    constructor(opts?: ChatParserOptions)
    parse(raw: string, opts?: { allowUnknown?: boolean }): ChatParsed
    parseFile(filePath: string, opts?: { allowUnknown?: boolean }): ChatParsed
    isRunnable(parsed: ChatParsed, opts?: { minLen?: number }): boolean
    getLastBlock(parsed: ChatParsed): ChatBlock | null
    formatAppendAssistant(text: string, opts?: { trim?: boolean }): string
    formatAppendUser(opts?: {}): string
  }

  export interface ResolvePathsResult {
    cwd: string
    userRoot: string
    chudRoot: string
    envPath: string
    chatPath: string
    rootMemoryPath: string
    localMemoryPath: string
  }

  export interface ContextResolverOptions {
    userRoot?: string
    chudRoot?: string
    envPath?: string
    defaultChatName?: string
    defaultMemoryName?: string
  }

  export class ContextResolver {
    constructor(opts?: ContextResolverOptions)
    resolvePaths(opts?: {
      cwd?: string
      chat?: string
      memory?: string
      frontMatter?: Record<string, string>
    }): ResolvePathsResult
    readText(filePath: string, opts?: { required?: boolean }): string
    loadChat(opts?: { cwd?: string; chat?: string }): {
      chatPath: string
      raw: string
      paths: ResolvePathsResult
    }
    loadMemory(opts?: {
      cwd?: string
      memory?: string
      frontMatter?: Record<string, string>
    }): {
      raw: string
      paths: ResolvePathsResult
      over: boolean
    }
    buildMessages(
      parsed: ChatParsed,
      memoryRaw: string,
      opts?: { memoryRole?: Role }
    ): ChatMessage[]
  }

  export interface EnvLoaderOptions {
    userRoot?: string
    chudRoot?: string
    envPath?: string
  }

  export class EnvLoader {
    constructor(opts?: EnvLoaderOptions)
    load(opts?: {
      envPath?: string
      override?: boolean
      required?: boolean
    }): { ok: boolean; envPath: string; loaded: boolean }
  }

  export interface InitializerOptions {
    userRoot?: string
    chudRoot?: string
    envPath?: string
    defaultChatName?: string
  }

  export class Initializer {
    constructor(opts?: InitializerOptions)
    initRoot(opts?: { makeEnv?: boolean }): {
      ok: boolean
      chudRoot: string
      envPath: string
      didWriteEnv: boolean
    }
    initChat(opts?: {
      cwd?: string
      chat?: string
      force?: boolean
      system?: string
    }): { ok: boolean; chatPath: string; didWriteChat: boolean }
    init(opts?: {
      cwd?: string
      chat?: string
      force?: boolean
      system?: string
      makeEnv?: boolean
    }): {
      ok: boolean
      chudRoot: string
      envPath: string
      chatPath: string
      didWriteEnv: boolean
      didWriteChat: boolean
    }
    defaultChat(opts?: { system?: string }): string
    defaultEnv(opts?: {}): string
    writeIfMissing(
      filePath: string,
      content: string,
      opts?: { force?: boolean }
    ): { didWrite: boolean }
  }

  export interface OpenRouterProviderOptions {
    baseUrl?: string
    apiKey?: string
    model?: string
    timeoutMs?: number
    headers?: Record<string, string>
  }

  export class OpenRouterProvider {
    constructor(opts?: OpenRouterProviderOptions)
    send(
      messages: ChatMessage[],
      opts?: {
        model?: string
        temperature?: number
        maxTokens?: number
        headers?: Record<string, string>
      }
    ): Promise<any>
    complete(
      messages: ChatMessage[],
      opts?: {
        model?: string
        temperature?: number
        maxTokens?: number
        headers?: Record<string, string>
      }
    ): Promise<string>
    extractContent(json: any): string
  }

  export interface RunnerOptions {
    parser: ChatParser
    resolver: ContextResolver
    provider: OpenRouterProvider
  }

  export class Runner {
    constructor(opts: RunnerOptions)
    runOnce(opts?: {
      cwd?: string
      chat?: string
      memory?: string
      model?: string
    }): Promise<{ ok: boolean; didRun: boolean; chatPath?: string; error?: any }>
    shouldRun(parsed: ChatParsed, opts?: { minLen?: number }): boolean
    buildAppend(raw: string, assistantText: string, opts?: {}): string
    writeAll(filePath: string, rawNext: string, opts?: {}): void
  }

  export interface WatcherOptions {
    runner: Runner
    debounceMs?: number
  }

  export class Watcher {
    constructor(opts: WatcherOptions)
    start(opts?: {
      cwd?: string
      chat?: string
      memory?: string
      model?: string
      debounceMs?: number
    }): { ok: boolean; watching: boolean; chatPath?: string }
    stop(): Promise<{ ok: boolean; watching: boolean }>
    onChange(filePath: string, opts?: any): void
  }

  export interface ChudbotOptions {
    userRoot?: string
    chudRoot?: string
    envPath?: string
    debounceMs?: number
  }

  export class Chudbot {
    constructor(opts?: ChudbotOptions)
    init(opts?: {
      cwd?: string
      chat?: string
      force?: boolean
      system?: string
    }): { ok: boolean; chatPath: string; didWriteChat: boolean }
    run(opts?: {
      cwd?: string
      chat?: string
      memory?: string
      model?: string
    }): Promise<{ ok: boolean; didRun: boolean; chatPath?: string; error?: any }>
    watch(opts?: {
      cwd?: string
      chat?: string
      memory?: string
      model?: string
      debounceMs?: number
    }): { ok: boolean; watching: boolean; chatPath?: string }
    stop(): Promise<{ ok: boolean; watching: boolean }>
  }
}
