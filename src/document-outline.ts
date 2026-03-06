import { mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

import { getLocalExternalMemoryDir } from "./external-memory.ts";
import { atomicWriteFile, getStoragePaths, withFileLock } from "./storage.ts";

export interface MarkdownHeading {
  depth: number;
  text: string;
  line: number;
  raw: string;
  anchor: string;
  trail: string[];
}

export interface DocumentOutlineEntry {
  sourcePath: string;
  relativePath: string;
  root: "system" | "external-memory";
  outlinePath: string;
  title: string;
  size: number;
  modifiedAt: string;
  headings: MarkdownHeading[];
}

export interface DocumentOutlineIndex {
  generatedAt: string;
  documents: DocumentOutlineEntry[];
}

const HEADING_REFERENCE_PREFIX = "HEADING:";

function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toPortablePath(path: string): string {
  return path.replaceAll(sep, "/");
}

function toDisplayPath(path: string, rootDir: string): string {
  const relativePath = relative(rootDir, path);
  if (!relativePath || relativePath === ".." || relativePath.startsWith(`..${sep}`)) {
    return path;
  }
  return toPortablePath(relativePath);
}

export function formatHeadingReference(trail: string[]): string {
  return `${HEADING_REFERENCE_PREFIX} ${trail.join(" > ")}`;
}

export function parseMarkdownHeadings(content: string): MarkdownHeading[] {
  const lines = content.split("\n");
  const headings: MarkdownHeading[] = [];
  const stack: MarkdownHeading[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+(.*?)\s*$/.exec(lines[index]);
    if (!match) {
      continue;
    }

    const depth = match[1].length;
    const text = match[2].trim();
    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }
    const trail = [...stack.map((entry) => entry.text), text];
    const heading: MarkdownHeading = {
      depth,
      text,
      line: index + 1,
      raw: lines[index],
      anchor: slugifyHeading(text),
      trail,
    };
    headings.push(heading);
    stack.push(heading);
  }

  return headings;
}

export function normalizeHeadingSelector(selector: string): string[] {
  const raw = selector.replace(/^HEADING:\s*/i, "").trim();
  if (!raw) {
    throw new Error("Heading selector cannot be empty.");
  }
  return raw
    .split(">")
    .map((part) => part.replace(/^#{1,6}\s*/, "").trim())
    .filter(Boolean);
}

export function isHeadingReference(value: string): boolean {
  return /^HEADING:\s*/i.test(value.trim());
}

export function resolveHeadingReference(content: string, selector: string): MarkdownHeading {
  const targetTrail = normalizeHeadingSelector(selector).map((part) => part.toLowerCase());
  const headings = parseMarkdownHeadings(content);
  const matches = headings.filter((heading) => {
    if (targetTrail.length === 1) {
      return heading.text.toLowerCase() === targetTrail[0];
    }
    if (heading.trail.length < targetTrail.length) {
      return false;
    }
    const trailSuffix = heading.trail.slice(heading.trail.length - targetTrail.length);
    return trailSuffix.every((part, index) => part.toLowerCase() === targetTrail[index]);
  });

  if (matches.length === 0) {
    throw new Error(`Heading not found: ${selector}`);
  }
  if (matches.length > 1) {
    throw new Error(`Heading selector is ambiguous: ${selector}`);
  }
  return matches[0];
}

function lineStartOffsets(content: string): number[] {
  const offsets = [0];
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] === "\n") {
      offsets.push(index + 1);
    }
  }
  return offsets;
}

function getLineStart(content: string, line: number): number {
  const offsets = lineStartOffsets(content);
  return offsets[Math.max(0, line - 1)] ?? content.length;
}

export function getHeadingSectionRange(
  content: string,
  selector: string,
): { start: number; end: number; heading: MarkdownHeading } {
  const heading = resolveHeadingReference(content, selector);
  const headings = parseMarkdownHeadings(content);
  const start = getLineStart(content, heading.line);
  const nextHeading = headings.find(
    (candidate) => candidate.line > heading.line && candidate.depth <= heading.depth,
  );
  const end = nextHeading ? getLineStart(content, nextHeading.line) : content.length;
  return { start, end, heading };
}

function renderHeadingLines(headings: MarkdownHeading[]): string[] {
  if (headings.length === 0) {
    return ["- (no markdown headings detected)"];
  }
  return headings.map((heading) => {
    const indent = "  ".repeat(Math.max(0, heading.depth - 1));
    return `${indent}- ${formatHeadingReference(heading.trail)} (line ${heading.line})`;
  });
}

function buildOutlineMarkdown(entry: DocumentOutlineEntry, rootDir: string): string {
  return [
    `# Outline: ${entry.relativePath}`,
    "",
    `- Source root: ${entry.root}`,
    `- Source path: ${entry.relativePath}`,
    `- Source file: ${toDisplayPath(entry.sourcePath, rootDir)}`,
    `- Outline file: ${toDisplayPath(entry.outlinePath, rootDir)}`,
    `- Updated: ${entry.modifiedAt}`,
    `- Size: ${entry.size} bytes`,
    "",
    "## Heading References",
    "",
    ...renderHeadingLines(entry.headings),
    "",
  ].join("\n");
}

function buildSitemapMarkdown(index: DocumentOutlineIndex, rootDir: string): string {
  const lines = [
    "# Document Sitemap",
    "",
    "This file is generated from markdown headings in `.localcrew/system/` and `external-memory/`.",
    "Use it as the compact navigation layer before opening large documents or issuing targeted markdown updates.",
    `Generated: ${index.generatedAt}`,
    "",
  ];

  const groups: Record<"system" | "external-memory", DocumentOutlineEntry[]> = {
    system: [],
    "external-memory": [],
  };
  for (const document of index.documents) {
    groups[document.root].push(document);
  }

  for (const root of ["system", "external-memory"] as const) {
    lines.push(`## ${root}`);
    lines.push("");
    if (groups[root].length === 0) {
      lines.push("- (no markdown documents indexed)", "");
      continue;
    }
    for (const document of groups[root]) {
      lines.push(`### ${document.relativePath}`);
      lines.push("");
      lines.push(`- Source: ${toDisplayPath(document.sourcePath, rootDir)}`);
      lines.push(`- Outline: ${toDisplayPath(document.outlinePath, rootDir)}`);
      lines.push(...renderHeadingLines(document.headings));
      lines.push("");
    }
  }

  return lines.join("\n");
}

async function collectMarkdownFiles(dir: string, ignoredRoots: string[]): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    let entries: Awaited<ReturnType<typeof readdir>>;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const childPath = resolve(currentDir, entry.name);
      if (
        ignoredRoots.some(
          (ignored) => childPath === ignored || childPath.startsWith(`${ignored}${sep}`),
        )
      ) {
        continue;
      }
      if (entry.isDirectory()) {
        await walk(childPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        files.push(childPath);
      }
    }
  }

  await walk(dir);
  return files.sort((left, right) => left.localeCompare(right));
}

function toOutlineEntry(
  filePath: string,
  root: "system" | "external-memory",
  rootPath: string,
  content: string,
  modifiedAt: string,
  size: number,
  rootDir: string,
): DocumentOutlineEntry {
  const paths = getStoragePaths(rootDir);
  const relativePath = toPortablePath(relative(rootPath, filePath));
  const outlinePath = join(
    paths.navigationOutlinesDir,
    root,
    relativePath.replace(/\.md$/i, ".outline.md"),
  );
  const headings = parseMarkdownHeadings(content);
  const title = headings[0]?.text ?? relativePath.split("/").at(-1) ?? relativePath;
  return {
    sourcePath: filePath,
    relativePath: `${root}/${relativePath}`,
    root,
    outlinePath,
    title,
    size,
    modifiedAt,
    headings,
  };
}

export async function buildDocumentOutlineIndex(
  rootDir = process.cwd(),
): Promise<DocumentOutlineIndex> {
  const paths = getStoragePaths(rootDir);
  const systemRoot = resolve(paths.systemDir);
  const externalRoot = resolve(getLocalExternalMemoryDir(rootDir));
  const ignoredRoots = [resolve(paths.navigationDir)];

  const [systemFiles, externalFiles] = await Promise.all([
    collectMarkdownFiles(systemRoot, ignoredRoots),
    collectMarkdownFiles(externalRoot, ignoredRoots),
  ]);

  const documents: DocumentOutlineEntry[] = [];

  for (const filePath of systemFiles) {
    const [content, fileStat] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
    documents.push(
      toOutlineEntry(
        filePath,
        "system",
        systemRoot,
        content,
        fileStat.mtime.toISOString(),
        fileStat.size,
        rootDir,
      ),
    );
  }

  for (const filePath of externalFiles) {
    const [content, fileStat] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
    documents.push(
      toOutlineEntry(
        filePath,
        "external-memory",
        externalRoot,
        content,
        fileStat.mtime.toISOString(),
        fileStat.size,
        rootDir,
      ),
    );
  }

  documents.sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  return {
    generatedAt: new Date().toISOString(),
    documents,
  };
}

export async function readDocumentOutlineIndex(
  rootDir = process.cwd(),
): Promise<DocumentOutlineIndex> {
  const paths = getStoragePaths(rootDir);
  try {
    const raw = await readFile(paths.documentOutlineIndexPath, "utf8");
    const parsed = JSON.parse(raw) as DocumentOutlineIndex;
    if (!parsed || !Array.isArray(parsed.documents)) {
      throw new Error("Document outline index is malformed.");
    }
    return parsed;
  } catch {
    return buildDocumentOutlineIndex(rootDir);
  }
}

export async function syncDocumentNavigation(rootDir = process.cwd()): Promise<DocumentOutlineIndex> {
  const paths = getStoragePaths(rootDir);

  return withFileLock(paths.documentOutlineIndexPath, async () => {
    const previousIndex = await readDocumentOutlineIndex(rootDir).catch(() => ({
      generatedAt: new Date(0).toISOString(),
      documents: []
    }));
    const index = await buildDocumentOutlineIndex(rootDir);
    const nextOutlinePaths = new Set(index.documents.map((document) => resolve(document.outlinePath)));

    await mkdir(paths.navigationDir, { recursive: true });
    await mkdir(paths.navigationOutlinesDir, { recursive: true });

    for (const document of index.documents) {
      await mkdir(dirname(document.outlinePath), { recursive: true });
      await atomicWriteFile(document.outlinePath, `${buildOutlineMarkdown(document, rootDir).trimEnd()}
`);
    }

    for (const document of previousIndex.documents) {
      if (nextOutlinePaths.has(resolve(document.outlinePath))) {
        continue;
      }
      await rm(document.outlinePath, { force: true }).catch(() => {});
    }

    await atomicWriteFile(paths.documentOutlineIndexPath, `${JSON.stringify(index, null, 2)}
`);
    await atomicWriteFile(paths.documentSitemapPath, `${buildSitemapMarkdown(index, rootDir).trimEnd()}
`);

    return index;
  });
}

export async function getDocumentOutlineForFile(
  filePath: string,
  rootDir = process.cwd(),
): Promise<DocumentOutlineEntry | null> {
  const resolvedPath = resolve(filePath);
  const existing = await readDocumentOutlineIndex(rootDir);
  const fromExisting = existing.documents.find((document) => resolve(document.sourcePath) === resolvedPath);
  if (fromExisting) {
    return fromExisting;
  }
  const rebuilt = await buildDocumentOutlineIndex(rootDir);
  return rebuilt.documents.find((document) => resolve(document.sourcePath) === resolvedPath) ?? null;
}
