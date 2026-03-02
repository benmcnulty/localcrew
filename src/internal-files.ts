import { readFile, readdir, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import { getLocalExternalMemoryDir } from "./external-memory.ts";
import { getStoragePaths } from "./storage.ts";

export interface InternalFileTree {
  rootPath: string;
  lines: string[];
}

export interface InternalFileDetail {
  path: string;
  relativePath: string;
  size: number;
  modifiedAt: string;
}

export interface InternalSearchMatch {
  /** Absolute path to the file */
  path: string;
  /** Path relative to its allowed root */
  relativePath: string;
  /** 1-based line number of the match */
  line: number;
  /** The full text of the matching line (trimmed) */
  text: string;
}

export interface InternalSearchResult {
  query: string;
  matches: InternalSearchMatch[];
  truncated: boolean;
}

function sortEntries(
  entries: Array<{ name: string; isDirectory(): boolean }>
): Array<{ name: string; isDirectory(): boolean }> {
  return [...entries].sort((left, right) => {
    if (left.isDirectory() !== right.isDirectory()) {
      return left.isDirectory() ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

async function renderTreeLines(
  currentPath: string,
  prefix: string,
  lines: string[]
): Promise<void> {
  const entries = sortEntries(await readdir(currentPath, { withFileTypes: true }));

  for (const [index, entry] of entries.entries()) {
    const isLast = index === entries.length - 1;
    const branch = isLast ? "\\-- " : "|-- ";
    const childPath = resolve(currentPath, entry.name);
    lines.push(`${prefix}${branch}${entry.name}${entry.isDirectory() ? "/" : ""}`);

    if (entry.isDirectory()) {
      await renderTreeLines(childPath, `${prefix}${isLast ? "    " : "|   "}`, lines);
    }
  }
}

export async function getInternalFileTree(rootDir = process.cwd()): Promise<InternalFileTree> {
  const systemRoot = getStoragePaths(rootDir).systemDir;
  const externalRoot = resolve(getLocalExternalMemoryDir(rootDir));
  const lines = [systemRoot];
  await renderTreeLines(systemRoot, "", lines);
  lines.push("");
  lines.push(externalRoot);
  await renderTreeLines(externalRoot, "", lines);
  return {
    rootPath: systemRoot,
    lines
  };
}

export async function readInternalFile(
  requestedPath: string,
  rootDir = process.cwd()
): Promise<InternalFileDetail & { content: string }> {
  const allowedRoots = [
    resolve(getStoragePaths(rootDir).systemDir),
    resolve(getLocalExternalMemoryDir(rootDir))
  ];
  const resolvedPath = resolve(requestedPath.trim());
  const matchedRoot = allowedRoots.find((rootPath) => {
    const relativePath = relative(rootPath, resolvedPath);
    return !(
      relativePath === "" ||
      relativePath.startsWith(`..${sep}`) ||
      relativePath === ".." ||
      relativePath.startsWith("../")
    );
  });

  if (!matchedRoot) {
    throw new Error(`Path must stay inside ${allowedRoots.join(" or ")}.`);
  }

  const fileStat = await stat(resolvedPath);
  if (!fileStat.isFile()) {
    throw new Error(`Path is not a file: ${resolvedPath}`);
  }

  const content = await readFile(resolvedPath, "utf8");

  return {
    path: resolvedPath,
    relativePath: relative(matchedRoot, resolvedPath),
    content,
    size: fileStat.size,
    modifiedAt: fileStat.mtime.toISOString()
  };
}

export async function getInternalFileDetails(
  rootDir = process.cwd()
): Promise<Record<string, InternalFileDetail>> {
  const paths = getStoragePaths(rootDir);
  const entries: Record<string, string> = {
    directives: paths.directivesPath,
    roadmap: paths.roadmapPath,
    focusTodo: paths.focusTodoPath,
    changelog: paths.changelogPath,
    inventory: paths.deviceInventoryPath,
    telemetrySummary: paths.telemetrySummaryPath,
    auditLog: paths.auditLogPath,
    orchestratorSummary: paths.orchestratorMemorySummaryPath,
    agentsIndex: paths.agentsIndexPath,
    systemState: paths.systemStatePath
  };

  const details = await Promise.all(
    Object.entries(entries).map(async ([key, filePath]) => {
      const fileStat = await stat(filePath);
      return [
        key,
        {
          path: filePath,
          relativePath: relative(paths.systemDir, filePath),
          size: fileStat.size,
          modifiedAt: fileStat.mtime.toISOString()
        }
      ] as const;
    })
  );

  return Object.fromEntries(details);
}

const MAX_SEARCH_MATCHES = 100;
const MAX_FILE_SIZE_BYTES = 512 * 1024; // Skip files > 512 KB

async function collectTextFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(current: string): Promise<void> {
    let entries: Awaited<ReturnType<typeof readdir>>;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const child = resolve(current, entry.name);
      if (entry.isDirectory()) {
        await walk(child);
      } else if (entry.isFile()) {
        files.push(child);
      }
    }
  }

  await walk(dir);
  return files;
}

/**
 * Case-insensitive text search across `.crusty/system/` and `external-memory/`.
 * Returns up to {@link MAX_SEARCH_MATCHES} matching lines with file paths and line numbers.
 * Binary files and files larger than 512 KB are skipped.
 */
export async function searchInternalFiles(
  query: string,
  rootDir = process.cwd(),
): Promise<InternalSearchResult> {
  if (!query || query.trim().length === 0) {
    return { query, matches: [], truncated: false };
  }

  const systemRoot = resolve(getStoragePaths(rootDir).systemDir);
  const externalRoot = resolve(getLocalExternalMemoryDir(rootDir));
  const roots = [
    { path: systemRoot, label: "system" },
    { path: externalRoot, label: "external-memory" },
  ];

  const needle = query.toLowerCase();
  const matches: InternalSearchMatch[] = [];
  let truncated = false;

  for (const root of roots) {
    if (truncated) break;
    const files = await collectTextFiles(root.path);

    for (const filePath of files) {
      if (truncated) break;
      try {
        const fileStat = await stat(filePath);
        if (fileStat.size > MAX_FILE_SIZE_BYTES) continue;

        const content = await readFile(filePath, "utf8");
        // Skip likely-binary files (contains null bytes in first 8 KB)
        if (content.slice(0, 8192).includes("\0")) continue;

        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(needle)) {
            matches.push({
              path: filePath,
              relativePath: relative(root.path, filePath),
              line: i + 1,
              text: lines[i].trimEnd(),
            });
            if (matches.length >= MAX_SEARCH_MATCHES) {
              truncated = true;
              break;
            }
          }
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  return { query, matches, truncated };
}
