declare type BufferEncoding = string;

declare namespace NodeJS {
  interface ErrnoException extends Error {
    code?: string;
  }

  type Platform = string;
  type Signals = string;

  interface ProcessEnv {
    [key: string]: string | undefined;
  }

  interface ReadStream {
    isTTY?: boolean;
    setRawMode(enabled: boolean): void;
    resume(): void;
    pause(): void;
    on(event: "data", listener: (chunk: string | Buffer) => void): this;
    once(event: "data", listener: (chunk: string | Buffer) => void): this;
    off(event: "data", listener: (chunk: string | Buffer) => void): this;
  }

  interface WriteStream {
    isTTY?: boolean;
    write(chunk: string): boolean;
  }

  interface Process {
    env: ProcessEnv;
    argv: string[];
    platform: Platform;
    exitCode?: number;
    connected?: boolean;
    cwd(): string;
    exit(code?: number): never;
    send?: (message: unknown) => void;
    on?(event: "message", listener: (message: unknown) => void): void;
    on?(event: "disconnect", listener: () => void): void;
  }
}

declare const process: NodeJS.Process;
declare type Buffer = {
  toString(encoding?: BufferEncoding): string;
  includes(value: string | number): boolean;
  equals(other: Buffer): boolean;
  readonly length: number;
  [index: number]: number;
};
declare const Buffer: {
  isBuffer(value: unknown): value is Buffer;
  from(value: string): Buffer;
  from(value: unknown): Buffer;
  concat(list: Buffer[]): Buffer;
};

declare module "node:process" {
  export const stdin: NodeJS.ReadStream;
  export const stdout: NodeJS.WriteStream;
  export const stderr: NodeJS.WriteStream;
}

declare module "node:path" {
  export const sep: string;
  export function dirname(path: string): string;
  export function extname(path: string): string;
  export function join(...parts: string[]): string;
  export function relative(from: string, to: string): string;
  export function resolve(...parts: string[]): string;
}

declare module "node:url" {
  export function fileURLToPath(url: string | URL): string;
  export function pathToFileURL(path: string): URL;
}

declare module "node:os" {
  export function hostname(): string;
  export function platform(): string;
  export function totalmem(): number;
  export function tmpdir(): string;
  export function cpus(): Array<unknown>;
  export function networkInterfaces(): Record<
    string,
    Array<{ address: string; family: string; internal: boolean }> | undefined
  >;
}

declare module "node:crypto" {
  export function randomBytes(size: number): { toString(encoding?: BufferEncoding): string };
}

declare module "node:fs" {
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function readFileSync(path: string, encoding?: BufferEncoding): string;
  export function writeFileSync(path: string, data: string, encoding?: BufferEncoding): void;
  export function renameSync(oldPath: string, newPath: string): void;
  export function unlinkSync(path: string): void;
}

declare module "node:fs/promises" {
  export interface Stats {
    size: number;
    mtimeMs: number;
    mtime: Date;
    isDirectory(): boolean;
    isFile(): boolean;
  }

  export interface Dirent {
    name: string;
    isDirectory(): boolean;
    isFile(): boolean;
  }

  export function appendFile(path: string, data: string, options?: unknown): Promise<void>;
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  export function readFile(path: string, encoding?: BufferEncoding): Promise<string>;
  export function readdir(path: string, options?: { withFileTypes?: false }): Promise<string[]>;
  export function readdir(path: string, options: { withFileTypes: true }): Promise<Dirent[]>;
  export function rename(oldPath: string, newPath: string): Promise<void>;
  export function rm(
    path: string,
    options?: { recursive?: boolean; force?: boolean }
  ): Promise<void>;
  export function stat(path: string): Promise<Stats>;
  export function unlink(path: string): Promise<void>;
  export function writeFile(path: string, data: string, encoding?: BufferEncoding): Promise<void>;
  export function mkdtemp(prefix: string): Promise<string>;
}

declare module "node:http" {
  export interface IncomingMessage {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
    on(event: "data", listener: (chunk: unknown) => void): this;
    on(event: "end" | "close", listener: () => void): this;
    on(event: "error", listener: (error: Error) => void): this;
  }

  export interface ServerResponse<T = IncomingMessage> {
    writeHead(statusCode: number, headers?: Record<string, string>): this;
    end(data?: string): void;
    write(data: string): void;
    flushHeaders?(): void;
  }

  export interface Server {
    listen(port: number, hostname: string, callback?: () => void): this;
    close(callback?: (error?: Error) => void): void;
    closeAllConnections?(): void;
    address(): { port: number } | string | null;
    on(event: "error", listener: (error: Error) => void): this;
    off(event: "error", listener: (error: Error) => void): this;
    off(event: "listening", listener: () => void): this;
    once(event: "error", listener: (error: Error) => void): this;
    once(event: "listening", listener: () => void): this;
  }

  export function createServer(
    listener?: (request: IncomingMessage, response: ServerResponse<IncomingMessage>) => void
  ): Server;
}

declare module "node:readline/promises" {
  export interface Interface {
    question(prompt: string): Promise<string>;
    close(): void;
    pause(): void;
    resume(): void;
    write(data: string): void;
  }

  export function createInterface(options: {
    input: unknown;
    output?: unknown;
    terminal?: boolean;
    completer?: (line: string) => [string[], string];
  }): Interface;
}

declare module "node:child_process" {
  export interface SpawnOptions {
    detached?: boolean;
    stdio?: "ignore" | unknown[];
  }

  export interface ChildProcess {
    connected: boolean;
    killed: boolean;
    send(message: unknown): boolean;
    kill(signal?: string): boolean;
    on(event: "message", listener: (message: any) => void): this;
    on(event: "error", listener: (error: Error) => void): this;
    on(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
    off(event: "message", listener: (message: any) => void): this;
    off(event: "error", listener: (error: Error) => void): this;
    off(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
  }

  export function spawn(
    command: string,
    args?: readonly string[],
    options?: SpawnOptions
  ): {
    on(event: "error", listener: (error: Error) => void): void;
    on(event: "exit", listener: (code: number | null) => void): void;
    unref(): void;
  };

  export function fork(
    modulePath: string,
    args?: string[],
    options?: {
      stdio?: unknown;
      env?: Record<string, string | undefined>;
      cwd?: string;
      execPath?: string;
      serialization?: "json" | "advanced";
    }
  ): ChildProcess;
}

declare module "bun:test" {
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void | Promise<void>, timeout?: number): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export function expect(value: unknown): any;
  export namespace expect {
    function arrayContaining(value: unknown[]): unknown;
    function objectContaining(value: Record<string, unknown>): unknown;
  }
}