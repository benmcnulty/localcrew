import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

async function readWorkspaceFile(relativePath: string): Promise<string> {
  return readFile(join(process.cwd(), relativePath), "utf8");
}

describe("release readiness guardrails", () => {
  test("package.json stays zero production dependency", async () => {
    const packageJsonRaw = await readWorkspaceFile("package.json");
    const packageJson = JSON.parse(packageJsonRaw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(Object.keys(packageJson.dependencies ?? {})).toHaveLength(0);
  });

  test("CI uses unified validate gate", async () => {
    const workflow = await readWorkspaceFile(".github/workflows/ci.yml");
    expect(workflow).toContain("run: npm ci");
    expect(workflow).toContain("run: npm run validate");
  });

  test("PR template requires release gate and runbook review", async () => {
    const prTemplate = await readWorkspaceFile(".github/pull_request_template.md");
    expect(prTemplate).toContain("`npm run validate` passes");
    expect(prTemplate).toContain("docs/release-readiness.md");
    expect(prTemplate).toContain("Known limitations");
  });

  test("release readiness runbook defines mandatory gate", async () => {
    const runbook = await readWorkspaceFile("docs/release-readiness.md");
    expect(runbook).toContain("## Release Gate (Must Pass)");
    expect(runbook).toContain("bunx tsc --noEmit");
    expect(runbook).toContain("npm test");
    expect(runbook).toContain("Known Limitations");
  });
});
