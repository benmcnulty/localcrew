import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  getHeadingSectionRange,
  parseMarkdownHeadings,
  resolveHeadingReference,
  syncDocumentNavigation,
} from "../src/document-outline.ts";
import { getStoragePaths } from "../src/storage.ts";

async function withTempDir(run: (rootDir: string) => Promise<void>): Promise<void> {
  const rootDir = await mkdtemp(join(tmpdir(), "localcrew-"));

  try {
    await run(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

describe("document outline navigation", () => {
  test("parses heading trails and resolves disambiguated selectors", () => {
    const content = [
      "# Root",
      "",
      "## Alpha",
      "",
      "### Shared",
      "- Alpha",
      "",
      "## Beta",
      "",
      "### Shared",
      "- Beta",
    ].join("\n");

    const headings = parseMarkdownHeadings(content);
    expect(headings.map((heading) => heading.trail.join(" > "))).toEqual([
      "Root",
      "Root > Alpha",
      "Root > Alpha > Shared",
      "Root > Beta",
      "Root > Beta > Shared",
    ]);

    const heading = resolveHeadingReference(content, "HEADING: Root > Beta > Shared");
    expect(heading.line).toBe(10);
    const range = getHeadingSectionRange(content, "HEADING: Root > Beta > Shared");
    expect(content.slice(range.start, range.end)).toContain("- Beta");
  });

  test("writes sitemap and outline sidecars with copyable heading references", async () => {
    await withTempDir(async (rootDir) => {
      const paths = getStoragePaths(rootDir);
      const systemDocPath = join(paths.orchestratorDir, "daily-work.md");
      const externalDocPath = join(rootDir, "external-memory", "orchestrator", "directives.md");
      await mkdir(paths.orchestratorDir, { recursive: true });
      await mkdir(join(rootDir, "external-memory", "orchestrator"), { recursive: true });
      await writeFile(
        systemDocPath,
        [
          "# Daily Work Document",
          "",
          "## Research & Discovery",
          "- New note",
        ].join("\n"),
        "utf8"
      );
      await writeFile(
        externalDocPath,
        [
          "# Directives",
          "",
          "## Core Rules",
          "- Keep it tight",
        ].join("\n"),
        "utf8"
      );

      const index = await syncDocumentNavigation(rootDir);
      const sitemap = await readFile(paths.documentSitemapPath, "utf8");
      const outlinePath = join(
        paths.navigationOutlinesDir,
        "system",
        "secure",
        "orchestrator",
        "daily-work.outline.md"
      );
      const outline = await readFile(outlinePath, "utf8");

      expect(index.documents.map((document) => document.relativePath)).toEqual(
        expect.arrayContaining([
          "system/secure/orchestrator/daily-work.md",
          "external-memory/orchestrator/directives.md",
        ])
      );
      expect(sitemap).toContain("HEADING: Daily Work Document > Research & Discovery");
      expect(outline).toContain("HEADING: Daily Work Document > Research & Discovery");
    });
  });
});
