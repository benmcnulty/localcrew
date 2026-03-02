import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";

import { getLocalExternalMemoryDir } from "./external-memory.ts";
import { withFileLock } from "./storage.ts";

export type DropboxStage = "inbox" | "active" | "outbox";

export interface DropboxPaths {
  rootDir: string;
  externalMemoryDir: string;
  inboxDir: string;
  activeDir: string;
  outboxDir: string;
}

export interface DropboxEntry {
  stage: DropboxStage;
  name: string;
  path: string;
  relativePath: string;
  size: number;
  modifiedAt: string;
  statusTag?: string;
}

export interface DropboxSnapshot {
  inbox: DropboxEntry[];
  active: DropboxEntry[];
  outbox: DropboxEntry[];
}

export interface IngestedDropboxDocument {
  sourceStage: "inbox";
  stage: "active";
  name: string;
  relativePath: string;
  sourcePath: string;
  path: string;
  statusTag: "active";
  content: string;
}

export interface DropboxWrite {
  stage: Extract<DropboxStage, "active" | "outbox">;
  filename: string;
  path: string;
}

const STATUS_TAG_PREFIX = "Crusty-Status:";
const STAGE_ORDER: DropboxStage[] = ["inbox", "active", "outbox"];

function sortEntries(entries: DropboxEntry[]): DropboxEntry[] {
  return [...entries].sort((left, right) => {
    if (left.modifiedAt !== right.modifiedAt) {
      return left.modifiedAt.localeCompare(right.modifiedAt);
    }

    return left.relativePath.localeCompare(right.relativePath);
  });
}

function ensureSafeRelativePath(value: string): string {
  const trimmed = value.replaceAll("\\", "/").trim().replace(/^\/+/, "");
  if (!trimmed) {
    throw new Error("A relative path is required.");
  }

  const segments = trimmed.split("/").filter(Boolean);
  if (segments.length === 0) {
    throw new Error("A relative path is required.");
  }

  for (const segment of segments) {
    if (segment === "." || segment === "..") {
      throw new Error("Relative paths may not escape the dropbox.");
    }

    if (segment.startsWith(".")) {
      throw new Error("Hidden file names are reserved.");
    }
  }

  return segments.join("/");
}

function stageDir(paths: DropboxPaths, stage: DropboxStage): string {
  return stage === "inbox" ? paths.inboxDir : stage === "active" ? paths.activeDir : paths.outboxDir;
}

function withStatusTag(content: string, stage: DropboxStage): string {
  const normalized = content.replaceAll("\r\n", "\n");
  const lines = normalized.split("\n");

  if (lines[0]?.startsWith(STATUS_TAG_PREFIX)) {
    lines[0] = `${STATUS_TAG_PREFIX} ${stage}`;
  } else {
    lines.unshift(`${STATUS_TAG_PREFIX} ${stage}`, "");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function readStatusTag(content: string): string | undefined {
  const firstLine = content.replaceAll("\r\n", "\n").split("\n", 1)[0]?.trim();
  if (!firstLine?.startsWith(STATUS_TAG_PREFIX)) {
    return undefined;
  }

  return firstLine.slice(STATUS_TAG_PREFIX.length).trim() || undefined;
}

async function ensureDirectory(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
  const ignorePath = join(dirPath, ".gitignore");
  if (!existsSync(ignorePath)) {
    await writeFile(ignorePath, "*\n!.gitignore\n", "utf8");
  }
}

async function ensureRootDirectory(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

async function walkStage(stage: DropboxStage, dirPath: string): Promise<DropboxEntry[]> {
  const entries: DropboxEntry[] = [];

  async function walk(currentPath: string): Promise<void> {
    const dirEntries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of dirEntries) {
      if (entry.name === ".gitignore") {
        continue;
      }

      const childPath = join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(childPath);
        continue;
      }

      const fileStat = await stat(childPath);
      const content = await readFile(childPath, "utf8").catch(() => "");
      entries.push({
        stage,
        name: entry.name,
        path: childPath,
        relativePath: relative(dirPath, childPath).replaceAll("\\", "/"),
        size: fileStat.size,
        modifiedAt: fileStat.mtime.toISOString(),
        ...(content ? { statusTag: readStatusTag(content) } : {})
      });
    }
  }

  await walk(dirPath);
  return sortEntries(entries);
}

async function getUniqueStagePath(stageRoot: string, relativePath: string): Promise<string> {
  const safeRelativePath = ensureSafeRelativePath(relativePath);
  const resolvedTarget = resolve(stageRoot, safeRelativePath);
  if (!existsSync(resolvedTarget)) {
    return resolvedTarget;
  }

  const extension = extname(safeRelativePath);
  const base = extension ? safeRelativePath.slice(0, -extension.length) : safeRelativePath;
  let index = 2;
  while (true) {
    const candidate = resolve(stageRoot, `${base}-${index}${extension}`);
    if (!existsSync(candidate)) {
      return candidate;
    }
    index += 1;
  }
}

export function getDropboxPaths(rootDir = process.cwd()): DropboxPaths {
  const externalMemoryDir = resolve(getLocalExternalMemoryDir(rootDir));
  return {
    rootDir: resolve(rootDir),
    externalMemoryDir,
    inboxDir: join(externalMemoryDir, "inbox"),
    activeDir: join(externalMemoryDir, "active"),
    outboxDir: join(externalMemoryDir, "outbox")
  };
}

export async function ensureDropboxLayout(rootDir = process.cwd()): Promise<DropboxPaths> {
  const paths = getDropboxPaths(rootDir);
  await ensureRootDirectory(paths.externalMemoryDir);
  await Promise.all(STAGE_ORDER.map((stage) => ensureDirectory(stageDir(paths, stage))));
  return paths;
}

export async function getDropboxSnapshot(rootDir = process.cwd()): Promise<DropboxSnapshot> {
  const paths = await ensureDropboxLayout(rootDir);
  const [inbox, active, outbox] = await Promise.all([
    walkStage("inbox", paths.inboxDir),
    walkStage("active", paths.activeDir),
    walkStage("outbox", paths.outboxDir)
  ]);

  return { inbox, active, outbox };
}

export async function clearDropboxState(rootDir = process.cwd()): Promise<void> {
  const paths = await ensureDropboxLayout(rootDir);
  for (const stage of STAGE_ORDER) {
    const stageRoot = stageDir(paths, stage);
    const entries = await readdir(stageRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".gitignore") {
        continue;
      }
      await rm(join(stageRoot, entry.name), { recursive: true, force: true });
    }
  }
}

export async function writeInboxDocument(
  filename: string,
  content: string,
  rootDir = process.cwd()
): Promise<DropboxEntry> {
  const paths = await ensureDropboxLayout(rootDir);
  const targetPath = await getUniqueStagePath(paths.inboxDir, filename);
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, withStatusTag(content, "inbox"), "utf8");
  const fileStat = await stat(targetPath);

  return {
    stage: "inbox",
    name: targetPath.split("/").at(-1) ?? filename,
    path: targetPath,
    relativePath: relative(paths.inboxDir, targetPath).replaceAll("\\", "/"),
    size: fileStat.size,
    modifiedAt: fileStat.mtime.toISOString(),
    statusTag: "inbox"
  };
}

export async function ingestNextInboxDocument(
  rootDir = process.cwd()
): Promise<IngestedDropboxDocument | null> {
  const paths = await ensureDropboxLayout(rootDir);
  const lockPath = join(paths.inboxDir, ".gitignore");

  return withFileLock(lockPath, async () => {
    const [nextEntry] = await walkStage("inbox", paths.inboxDir);
    if (!nextEntry) {
      return null;
    }

    const sourceContent = await readFile(nextEntry.path, "utf8");
    const targetPath = await getUniqueStagePath(paths.activeDir, nextEntry.relativePath);
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, withStatusTag(sourceContent, "active"), "utf8");
    await rm(nextEntry.path, { force: true });

    return {
      sourceStage: "inbox",
      stage: "active",
      name: targetPath.split("/").at(-1) ?? nextEntry.name,
      relativePath: relative(paths.activeDir, targetPath).replaceAll("\\", "/"),
      sourcePath: nextEntry.path,
      path: targetPath,
      statusTag: "active",
      content: withStatusTag(sourceContent, "active"),
    };
  });
}

export async function moveActiveDocumentToOutbox(
  relativePath: string,
  rootDir = process.cwd()
): Promise<DropboxEntry> {
  const paths = await ensureDropboxLayout(rootDir);
  const safeRelativePath = ensureSafeRelativePath(relativePath);
  const sourcePath = resolve(paths.activeDir, safeRelativePath);
  const targetPath = await getUniqueStagePath(paths.outboxDir, safeRelativePath);
  const content = await readFile(sourcePath, "utf8");
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, withStatusTag(content, "outbox"), "utf8");
  await rm(sourcePath, { force: true });
  const fileStat = await stat(targetPath);

  return {
    stage: "outbox",
    name: targetPath.split("/").at(-1) ?? safeRelativePath.split("/").at(-1) ?? safeRelativePath,
    path: targetPath,
    relativePath: relative(paths.outboxDir, targetPath).replaceAll("\\", "/"),
    size: fileStat.size,
    modifiedAt: fileStat.mtime.toISOString(),
    statusTag: "outbox"
  };
}

export async function readActiveDropboxDocument(
  relativePath: string,
  rootDir = process.cwd()
): Promise<{ path: string; relativePath: string; content: string }> {
  const paths = await ensureDropboxLayout(rootDir);
  const safeRelativePath = ensureSafeRelativePath(relativePath);
  const path = resolve(paths.activeDir, safeRelativePath);
  const content = await readFile(path, "utf8");
  return {
    path,
    relativePath: safeRelativePath,
    content
  };
}

export async function writeGeneratedDropboxDocument(
  stage: Extract<DropboxStage, "active" | "outbox">,
  filename: string,
  content: string,
  rootDir = process.cwd()
): Promise<DropboxEntry> {
  const paths = await ensureDropboxLayout(rootDir);
  const targetRoot = stageDir(paths, stage);
  const targetPath = await getUniqueStagePath(targetRoot, filename);
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, withStatusTag(content, stage), "utf8");
  const fileStat = await stat(targetPath);
  return {
    stage,
    name: targetPath.split("/").at(-1) ?? filename,
    path: targetPath,
    relativePath: relative(targetRoot, targetPath).replaceAll("\\", "/"),
    size: fileStat.size,
    modifiedAt: fileStat.mtime.toISOString(),
    statusTag: stage
  };
}

export async function moveInboxDocumentToStage(
  relativePath: string,
  stage: Extract<DropboxStage, "active" | "outbox">,
  rootDir = process.cwd()
): Promise<DropboxEntry> {
  const paths = await ensureDropboxLayout(rootDir);
  const safeRelativePath = ensureSafeRelativePath(relativePath);
  const sourcePath = resolve(paths.inboxDir, safeRelativePath);
  const targetRoot = stageDir(paths, stage);
  const targetPath = await getUniqueStagePath(targetRoot, safeRelativePath);
  await mkdir(dirname(targetPath), { recursive: true });
  const content = await readFile(sourcePath, "utf8");
  await writeFile(targetPath, withStatusTag(content, stage), "utf8");
  await rm(sourcePath, { force: true });
  const fileStat = await stat(targetPath);
  return {
    stage,
    name: targetPath.split("/").at(-1) ?? safeRelativePath.split("/").at(-1) ?? safeRelativePath,
    path: targetPath,
    relativePath: relative(targetRoot, targetPath).replaceAll("\\", "/"),
    size: fileStat.size,
    modifiedAt: fileStat.mtime.toISOString(),
    statusTag: stage
  };
}
