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
