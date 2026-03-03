import { randomBytes } from "node:crypto";
import { existsSync, unlinkSync, writeFileSync, renameSync } from "node:fs";
import { rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export interface StoragePaths {
  rootDir: string;
  storageDir: string;
  configPath: string;
  resourcesPath: string;
  sessionsPath: string;
  systemDir: string;
  secureDir: string;
  systemStatePath: string;
  orchestratorDir: string;
  orchestratorGeneratedDir: string;
  orchestratorMemoryDir: string;
  orchestratorMemoryIndexPath: string;
  orchestratorMemorySummaryPath: string;
  directivesPath: string;
  roadmapPath: string;
  focusTodoPath: string;
  changelogPath: string;
  deviceInventoryPath: string;
  agentWorkflowPath: string;
  telemetryDir: string;
  auditLogPath: string;
  telemetrySummaryPath: string;
  agentsDir: string;
  agentsIndexPath: string;
  dailyWorkPath: string;
}

export function getStoragePaths(rootDir = process.cwd()): StoragePaths {
  const resolvedRoot = resolve(rootDir);
  const storageDir = resolveStorageDir(resolvedRoot);
  const systemDir = join(storageDir, "system");
  const secureDir = join(systemDir, "secure");
  const orchestratorDir = join(secureDir, "orchestrator");
  const orchestratorGeneratedDir = join(orchestratorDir, "generated");
  const orchestratorMemoryDir = join(orchestratorDir, "memory");
  const telemetryDir = join(orchestratorDir, "telemetry");
  const agentsDir = join(secureDir, "agents");

  return {
    rootDir: resolvedRoot,
    storageDir,
    configPath: join(storageDir, "config.json"),
    resourcesPath: join(storageDir, "resources.json"),
    sessionsPath: join(storageDir, "sessions.json"),
    systemDir,
    secureDir,
    systemStatePath: join(systemDir, "state.json"),
    orchestratorDir,
    orchestratorGeneratedDir,
    orchestratorMemoryDir,
    orchestratorMemoryIndexPath: join(orchestratorMemoryDir, "index.json"),
    orchestratorMemorySummaryPath: join(orchestratorMemoryDir, "summary.md"),
    directivesPath: join(orchestratorDir, "directives.md"),
    roadmapPath: join(orchestratorDir, "roadmap.md"),
    focusTodoPath: join(orchestratorDir, "focus-todo.md"),
    changelogPath: join(orchestratorDir, "changelog.md"),
    deviceInventoryPath: join(orchestratorDir, "device-inventory.md"),
    agentWorkflowPath: join(orchestratorDir, "agent-new-workflow.md"),
    telemetryDir,
    auditLogPath: join(telemetryDir, "audit-log.jsonl"),
    telemetrySummaryPath: join(telemetryDir, "summary.json"),
    agentsDir,
    agentsIndexPath: join(agentsDir, "index.json"),
    dailyWorkPath: join(orchestratorDir, "daily-work.md"),
  };
}

function resolveStorageDir(resolvedRoot: string): string {
  const localCrewDir = join(resolvedRoot, ".localcrew");
  const legacyDir = join(resolvedRoot, `.${"c"}rusty`);
  if (existsSync(localCrewDir)) {
    return localCrewDir;
  }
  if (existsSync(legacyDir)) {
    return legacyDir;
  }
  return localCrewDir;
}

/**
 * Atomically write a file by writing to a temporary file first, then renaming.
 * Rename is atomic on most filesystems, preventing corruption on crash/disk-full.
 */
export async function atomicWriteFile(
  filePath: string,
  content: string,
  encoding: BufferEncoding = "utf8"
): Promise<void> {
  const dir = dirname(filePath);
  const tmpPath = join(dir, `.tmp-${randomBytes(8).toString("hex")}`);
  try {
    await writeFile(tmpPath, content, encoding);
    await rename(tmpPath, filePath);
  } catch (error) {
    await rm(tmpPath, { force: true }).catch(() => {});
    throw error;
  }
}

/**
 * Synchronous atomic write — write to temp file, then rename.
 */
export function atomicWriteFileSync(
  filePath: string,
  content: string,
  encoding: BufferEncoding = "utf8"
): void {
  const dir = dirname(filePath);
  const tmpPath = join(dir, `.tmp-${randomBytes(8).toString("hex")}`);
  try {
    writeFileSync(tmpPath, content, encoding);
    renameSync(tmpPath, filePath);
  } catch (error) {
    try { unlinkSync(tmpPath); } catch { /* already gone */ }
    throw error;
  }
}

/**
 * In-process file-level lock to prevent concurrent reads-then-writes
 * from racing on the same file. Callers that do load→mutate→save
 * should wrap the entire sequence in withFileLock().
 */
const fileLocks = new Map<string, Promise<void>>();

export async function withFileLock<T>(
  filePath: string,
  fn: () => Promise<T>
): Promise<T> {
  const key = resolve(filePath);
  while (fileLocks.has(key)) {
    await fileLocks.get(key);
  }
  let releaseLock: () => void;
  const lockPromise = new Promise<void>((r) => {
    releaseLock = r;
  });
  fileLocks.set(key, lockPromise);
  try {
    return await fn();
  } finally {
    fileLocks.delete(key);
    releaseLock!();
  }
}
