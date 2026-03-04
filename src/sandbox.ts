/**
 * Sandboxed Script Execution Module
 *
 * Implements the propose-review-approve-execute pipeline for agent-authored
 * scripts (Python and JavaScript). Scripts run in restricted child processes
 * with resource limits, deny-listed API access, and captured I/O.
 *
 * @module sandbox
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { platform } from "node:os";
import { getStoragePaths } from "./storage.ts";

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScriptLanguage = "python" | "javascript";
export type ScriptApprovalScope = "one-time" | "session";
export type ScriptVerdict = "approved" | "rejected";

export interface ScriptRequest {
  /** Kebab-case identifier (e.g. "latency-analysis") */
  purposeSlug: string;
  /** Script language */
  language: ScriptLanguage;
  /** Raw script source code */
  source: string;
  /** One-line purpose description (from docstring) */
  purpose: string;
  /** Requesting agent identity */
  requestedBy: string;
}

export interface ScriptReviewResult {
  verdict: ScriptVerdict;
  /** Human-readable reason for approval or rejection */
  reason: string;
  /** Specific violations found during static analysis */
  violations: string[];
}

export interface ScriptExecutionResult {
  success: boolean;
  /** Captured stdout (up to 64 KB) */
  stdout: string;
  /** Captured stderr */
  stderr: string;
  /** Exit code of the child process */
  exitCode: number | null;
  /** Whether the process was terminated due to timeout */
  timedOut: boolean;
  /** Execution time in milliseconds */
  durationMs: number;
}

export interface ScriptRecord {
  id: string;
  request: ScriptRequest;
  review: ScriptReviewResult;
  execution?: ScriptExecutionResult;
  timestamp: string;
  scope: ScriptApprovalScope;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum script length in lines (excluding comments/blank lines) */
export const MAX_SCRIPT_LINES = 200;

/** Maximum execution time in milliseconds */
export const MAX_EXECUTION_MS = 30_000;

/** Maximum stdout capture in bytes */
export const MAX_STDOUT_BYTES = 65_536;

/** Maximum memory in bytes (256 MB) */
export const MAX_MEMORY_BYTES = 268_435_456;

// ─── Python deny lists ────────────────────────────────────────────────────────

const PYTHON_ALLOWED_MODULES = new Set([
  "json", "csv", "math", "statistics", "re", "datetime", "collections",
  "itertools", "functools", "textwrap", "pathlib", "urllib.parse", "hashlib",
  "base64", "decimal", "fractions", "operator", "string", "difflib", "pprint",
  "dataclasses", "typing", "enum", "abc", "copy", "io", "argparse", "random",
  "sys", "os.path",
]);

const PYTHON_FORBIDDEN_MODULES = [
  "subprocess", "socket", "http.client", "http.server", "urllib.request",
  "requests", "httpx", "aiohttp", "shutil", "signal", "pty", "ctypes",
  "multiprocessing", "threading",
];

const PYTHON_FORBIDDEN_BUILTINS = [
  "eval", "exec", "compile", "__import__", "breakpoint", "open",
];

const PYTHON_FORBIDDEN_PATTERNS = [
  /os\.system\s*\(/,
  /os\.popen\s*\(/,
  /os\.exec/,
  /os\.spawn/,
  /os\.environ/,
  /os\.getenv\s*\(/,
  /os\.makedirs\s*\(/,
  /os\.mkdir\s*\(/,
  /os\.remove\s*\(/,
  /os\.unlink\s*\(/,
  /os\.rmdir\s*\(/,
  /sys\.path/,
  /sys\.modules/,
  /open\s*\([^)]*['"][wa]/,
];

// ─── JavaScript deny lists ────────────────────────────────────────────────────

const JS_FORBIDDEN_GLOBALS = [
  "require", "import", "fetch", "XMLHttpRequest", "WebSocket",
  "Worker", "SharedWorker", "Blob", "URL",
];

const JS_FORBIDDEN_NODE_MODULES = [
  "child_process", "cluster", "dgram", "dns", "http", "https", "http2",
  "net", "tls", "fs", "fs/promises", "worker_threads", "vm", "v8",
  "perf_hooks", "async_hooks", "trace_events", "wasi",
];

const JS_FORBIDDEN_PATTERNS = [
  /process\.exit/,
  /process\.kill/,
  /process\.env/,
  /process\.chdir/,
  /process\.binding/,
  /process\.dlopen/,
  /require\s*\(/,
  /import\s*\(/,
  /globalThis\s*\[/,
  /Function\s*\(/,
  /eval\s*\(/,
];

// ─── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Extract SCRIPT_REQUEST blocks from model output text.
 *
 * Format:
 * ```
 * SCRIPT_REQUEST[purpose-slug]
 * #!/usr/bin/env python3  (or #!/usr/bin/env node)
 * """
 * Purpose: <description>
 * """
 * <script body>
 * ENDSCRIPT
 * ```
 */
export function parseScriptRequests(text: string): ScriptRequest[] {
  const pattern =
    /(?:^|\n)SCRIPT_REQUEST\[([a-z0-9-]+)\]\n([\s\S]*?)\nENDSCRIPT(?=\n|$)/gi;
  const results: ScriptRequest[] = [];

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const purposeSlug = match[1];
    const source = match[2].trim();

    const language = detectLanguage(source);
    const purpose = extractPurpose(source, language);

    results.push({
      purposeSlug,
      language,
      source,
      purpose,
      requestedBy: "", // filled by caller
    });
  }

  return results;
}

function detectLanguage(source: string): ScriptLanguage {
  const firstLine = source.split("\n")[0].trim();
  if (firstLine.includes("node") || firstLine.includes("javascript") || firstLine.includes("bun")) {
    return "javascript";
  }
  if (firstLine.includes("python")) {
    return "python";
  }
  // Heuristic: check for language-specific patterns
  if (/^(const |let |var |function |class |import \{|export )/.test(source)) {
    return "javascript";
  }
  if (/^(def |class |import |from |print\()/.test(source)) {
    return "python";
  }
  // Check for console.log vs print
  if (source.includes("console.log")) return "javascript";
  if (source.includes("print(")) return "python";
  // Default to python (original policy default)
  return "python";
}

function extractPurpose(source: string, language: ScriptLanguage): string {
  if (language === "python") {
    const docMatch = source.match(/"""[\s\S]*?Purpose:\s*(.+?)[\n"]/i);
    if (docMatch) return docMatch[1].trim();
  }
  if (language === "javascript") {
    const commentMatch = source.match(/\/\*[\s\S]*?Purpose:\s*(.+?)[\n*]/i);
    if (commentMatch) return commentMatch[1].trim();
    const lineMatch = source.match(/\/\/\s*Purpose:\s*(.+)/i);
    if (lineMatch) return lineMatch[1].trim();
  }
  return "(no purpose stated)";
}

// ─── Static Analysis ──────────────────────────────────────────────────────────

export function staticAnalyze(request: ScriptRequest): ScriptReviewResult {
  const violations: string[] = [];
  const { source, language } = request;

  // Count effective lines (non-comment, non-blank)
  const effectiveLines = source.split("\n").filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (language === "python" && trimmed.startsWith("#")) return false;
    if (language === "javascript" && trimmed.startsWith("//")) return false;
    return true;
  });
  if (effectiveLines.length > MAX_SCRIPT_LINES) {
    violations.push(
      `Script exceeds ${MAX_SCRIPT_LINES}-line limit (${effectiveLines.length} effective lines).`,
    );
  }

  if (language === "python") {
    analyzePython(source, violations);
  } else {
    analyzeJavaScript(source, violations);
  }

  if (violations.length > 0) {
    return {
      verdict: "rejected",
      reason: `Static analysis found ${violations.length} violation(s).`,
      violations,
    };
  }

  return {
    verdict: "approved",
    reason: "Static analysis passed — no forbidden patterns detected.",
    violations: [],
  };
}

function analyzePython(source: string, violations: string[]): void {
  // Check imports
  const importPattern = /^\s*(?:import|from)\s+([\w.]+)/gm;
  let importMatch: RegExpExecArray | null;
  while ((importMatch = importPattern.exec(source)) !== null) {
    const moduleName = importMatch[1];
    const topLevel = moduleName.split(".")[0];
    if (
      PYTHON_FORBIDDEN_MODULES.some((fm) => moduleName.startsWith(fm)) ||
      (!PYTHON_ALLOWED_MODULES.has(moduleName) && !PYTHON_ALLOWED_MODULES.has(topLevel))
    ) {
      violations.push(`Forbidden Python module: ${moduleName}`);
    }
  }

  // Check forbidden builtins
  for (const builtin of PYTHON_FORBIDDEN_BUILTINS) {
    const pattern = new RegExp(`\\b${builtin}\\s*\\(`, "g");
    if (pattern.test(source)) {
      // Allow "open" only for reading (open(..., 'r'))
      if (builtin === "open") {
        const openCalls = source.match(/open\s*\([^)]*\)/g) || [];
        for (const call of openCalls) {
          if (!/['"]r['"]/.test(call) && !call.includes("stdin")) {
            violations.push(`Forbidden builtin: ${builtin}() — only read mode ('r') is allowed.`);
          }
        }
      } else {
        violations.push(`Forbidden builtin: ${builtin}()`);
      }
    }
  }

  // Check forbidden patterns
  for (const pattern of PYTHON_FORBIDDEN_PATTERNS) {
    if (pattern.test(source)) {
      // Use a human-readable version of the pattern (strip regex escapes)
      const readable = pattern.source.replace(/\\(.)/g, "$1").replace(/\\s\*/g, " ");
      violations.push(`Forbidden pattern: ${readable}`);
    }
  }
}

function analyzeJavaScript(source: string, violations: string[]): void {
  // Check for require/import of node modules
  const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let reqMatch: RegExpExecArray | null;
  while ((reqMatch = requirePattern.exec(source)) !== null) {
    const mod = reqMatch[1];
    if (
      JS_FORBIDDEN_NODE_MODULES.some((fm) => mod === fm || mod.startsWith(`node:${fm}`))
    ) {
      violations.push(`Forbidden Node.js module: ${mod}`);
    }
    // All requires are forbidden in sandbox
    violations.push(`Dynamic require() is forbidden in sandboxed scripts: ${mod}`);
  }

  // Check for dynamic import()
  const importPattern = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let impMatch: RegExpExecArray | null;
  while ((impMatch = importPattern.exec(source)) !== null) {
    violations.push(`Dynamic import() is forbidden: ${impMatch[1]}`);
  }

  // Check for static import statements (only allowed for sandbox-provided modules)
  const staticImportPattern = /^\s*import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/gm;
  let staticMatch: RegExpExecArray | null;
  while ((staticMatch = staticImportPattern.exec(source)) !== null) {
    violations.push(`Static import is forbidden in sandboxed scripts: ${staticMatch[1]}`);
  }

  // Check forbidden global patterns
  for (const pattern of JS_FORBIDDEN_PATTERNS) {
    if (pattern.test(source)) {
      const readable = pattern.source.replace(/\\(.)/g, "$1").replace(/\\s\*/g, " ");
      violations.push(`Forbidden pattern: ${readable}`);
    }
  }

  // Check for attempts to access forbidden globals
  for (const global of JS_FORBIDDEN_GLOBALS) {
    const pat = new RegExp(`\\b${global}\\b`, "g");
    if (pat.test(source)) {
      // Skip if it's in a string context (rough heuristic)
      if (new RegExp(`['"\`].*\\b${global}\\b.*['"\`]`).test(source)) continue;
      violations.push(`Forbidden global: ${global}`);
    }
  }
}

// ─── Execution ────────────────────────────────────────────────────────────────

/**
 * Execute an approved script in a sandboxed child process.
 *
 * Python: Runs via `python3 -c` with resource limits.
 * JavaScript: Runs via `node --experimental-vm-modules` with a wrapper
 * that restricts access to Node.js APIs.
 */
export async function executeScript(
  request: ScriptRequest,
  rootDir: string,
  inputData?: string,
): Promise<ScriptExecutionResult> {
  const paths = getStoragePaths(rootDir);
  const sandboxDir = join(paths.storageDir, "system", "sandbox");
  await mkdir(sandboxDir, { recursive: true });

  const scriptId = generateId();
  const ext = request.language === "python" ? "py" : "mjs";
  const scriptPath = join(sandboxDir, `${request.purposeSlug}-${scriptId}.${ext}`);

  try {
    if (request.language === "python") {
      return await executePython(request, scriptPath, inputData);
    } else {
      return await executeJavaScript(request, scriptPath, sandboxDir, inputData);
    }
  } finally {
    try { await unlink(scriptPath); } catch { /* ignore */ }
  }
}

async function executePython(
  request: ScriptRequest,
  scriptPath: string,
  inputData?: string,
): Promise<ScriptExecutionResult> {
  // Strip shebang if present
  const source = request.source.replace(/^#!.*\n/, "");
  await writeFile(scriptPath, source, "utf8");

  const isPosix = platform() !== "win32";
  const command = isPosix ? "python3" : "python";

  // Build wrapper that sets resource limits on POSIX (with try/except
  // for macOS where RLIMIT_AS may be unsupported or too restrictive)
  const wrapperArgs: string[] = [];
  if (isPosix) {
    wrapperArgs.push(
      "-c",
      [
        "import sys",
        "try:\n    import resource\n    resource.setrlimit(resource.RLIMIT_CPU, (30, 30))\n    try:\n        resource.setrlimit(resource.RLIMIT_AS, (536870912, 536870912))\n    except (ValueError, OSError):\n        pass\nexcept ImportError:\n    pass",
        `exec(open(sys.argv[1]).read(), {"__builtins__": __builtins__, "__name__": "__main__"})`,
      ].join("\n"),
      scriptPath,
    );
  } else {
    wrapperArgs.push(scriptPath);
  }

  return runProcess(command, wrapperArgs, inputData);
}

async function executeJavaScript(
  request: ScriptRequest,
  scriptPath: string,
  sandboxDir: string,
  inputData?: string,
): Promise<ScriptExecutionResult> {
  // Build a sandboxed wrapper that runs the user script in a restricted context
  const wrapperSource = buildJavaScriptWrapper(request.source, inputData);
  const wrapperPath = join(sandboxDir, `wrapper-${generateId()}.mjs`);

  await writeFile(wrapperPath, wrapperSource, "utf8");

  try {
    const args = [
      "--no-warnings",
      "--max-old-space-size=256",
      wrapperPath,
    ];

    return await runProcess("node", args, inputData);
  } finally {
    try { await unlink(wrapperPath); } catch { /* ignore */ }
  }
}

function buildJavaScriptWrapper(userScript: string, inputData?: string): string {
  // The wrapper creates a minimal global context and uses the vm module
  // to run the script with restricted access
  const escapedScript = userScript.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
  const escapedInput = inputData
    ? inputData.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$")
    : "";

  return `
import { createContext, runInNewContext } from "node:vm";

const TIMEOUT_MS = ${MAX_EXECUTION_MS};
const MAX_OUTPUT = ${MAX_STDOUT_BYTES};

// Capture output
let stdoutBuffer = "";
const sandboxConsole = {
  log: (...args) => {
    const line = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ") + "\\n";
    if (stdoutBuffer.length + line.length <= MAX_OUTPUT) stdoutBuffer += line;
  },
  error: (...args) => {
    const line = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ") + "\\n";
    process.stderr.write(line);
  },
  warn: (...args) => sandboxConsole.error(...args),
  info: (...args) => sandboxConsole.log(...args),
};

// Minimal safe globals
const sandbox = {
  console: sandboxConsole,
  JSON,
  Math,
  Date,
  RegExp,
  String,
  Number,
  Boolean,
  Array,
  Object,
  Map,
  Set,
  WeakMap,
  WeakSet,
  Promise,
  Symbol,
  Error,
  TypeError,
  RangeError,
  SyntaxError,
  ReferenceError,
  URIError,
  EvalError,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  encodeURIComponent,
  decodeURIComponent,
  encodeURI,
  decodeURI,
  undefined,
  NaN,
  Infinity,
  structuredClone: typeof structuredClone !== "undefined" ? structuredClone : undefined,
  atob: typeof atob !== "undefined" ? atob : undefined,
  btoa: typeof btoa !== "undefined" ? btoa : undefined,
  queueMicrotask,
  // Input data (if any)
  __INPUT__: \`${escapedInput}\`,
};

const userCode = \`${escapedScript}\`;

try {
  runInNewContext(userCode, sandbox, {
    timeout: TIMEOUT_MS,
    filename: "sandbox-script.js",
    breakOnSigint: true,
  });
} catch (err) {
  if (err.code === "ERR_SCRIPT_EXECUTION_TIMEOUT") {
    process.stderr.write("Script timed out after " + TIMEOUT_MS + "ms\\n");
    process.exit(124);
  }
  process.stderr.write(String(err.message || err) + "\\n");
  process.exit(1);
}

process.stdout.write(stdoutBuffer);
`;
}

function runProcess(
  command: string,
  args: string[],
  inputData?: string,
): Promise<ScriptExecutionResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdoutBuf = "";
    let stderrBuf = "";
    let timedOut = false;

    // Use `as any` for Bun type compatibility — Bun's child_process types
    // lack stdout/stderr/stdin/kill on the spawn return type
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        // Minimal env — no user env vars leak in
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        LANG: process.env.LANG || "en_US.UTF-8",
      },
    } as any) as any;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, MAX_EXECUTION_MS + 1000); // +1s grace for wrapper overhead

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (stdoutBuf.length + text.length <= MAX_STDOUT_BYTES) {
        stdoutBuf += text;
      } else if (stdoutBuf.length < MAX_STDOUT_BYTES) {
        stdoutBuf += text.slice(0, MAX_STDOUT_BYTES - stdoutBuf.length);
      }
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (stderrBuf.length < MAX_STDOUT_BYTES) {
        stderrBuf += text.slice(0, MAX_STDOUT_BYTES - stderrBuf.length);
      }
    });

    if (inputData && child.stdin) {
      child.stdin.write(inputData);
      child.stdin.end();
    } else {
      child.stdin?.end();
    }

    child.on("close", (code: number | null) => {
      clearTimeout(timer);
      resolve({
        success: code === 0 && !timedOut,
        stdout: stdoutBuf,
        stderr: stderrBuf,
        exitCode: code,
        timedOut,
        durationMs: Date.now() - startTime,
      });
    });

    child.on("error", (err: Error) => {
      clearTimeout(timer);
      resolve({
        success: false,
        stdout: stdoutBuf,
        stderr: `Process error: ${err.message}`,
        exitCode: null,
        timedOut: false,
        durationMs: Date.now() - startTime,
      });
    });
  });
}

// ─── Session Tracking ─────────────────────────────────────────────────────────

/**
 * Tracks script approval/rejection within a session for rate limiting.
 * Purpose-slugs rejected >= 2 times are blocked for the session.
 */
export class ScriptSessionTracker {
  private rejectionCounts = new Map<string, number>();
  private sessionApprovals = new Set<string>();

  /** Max rejections before a purpose-slug is blocked for the session */
  readonly maxRejectionsPerSlug = 2;

  isBlocked(purposeSlug: string): boolean {
    return (this.rejectionCounts.get(purposeSlug) ?? 0) >= this.maxRejectionsPerSlug;
  }

  recordRejection(purposeSlug: string): void {
    const count = this.rejectionCounts.get(purposeSlug) ?? 0;
    this.rejectionCounts.set(purposeSlug, count + 1);
  }

  recordSessionApproval(purposeSlug: string): void {
    this.sessionApprovals.add(purposeSlug);
  }

  hasSessionApproval(purposeSlug: string): boolean {
    return this.sessionApprovals.has(purposeSlug);
  }

  reset(): void {
    this.rejectionCounts.clear();
    this.sessionApprovals.clear();
  }
}
