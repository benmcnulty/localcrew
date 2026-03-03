import { describe, expect, test } from "bun:test";
// @ts-expect-error — Bun types omit spawnSync but it works at runtime
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getDisplayHtml, getGuiScript } from "../src/gui.ts";

describe("Local UI auth wiring", () => {
  test("propagates an API token from the URL into subsequent API requests", () => {
    const script = getGuiScript();

    expect(script).toContain('window.sessionStorage.getItem("localCrewApiToken")');
    expect(script).toContain('window.sessionStorage.setItem("localCrewApiToken", queryToken)');
    expect(script).toContain('headers.authorization = "Bearer " + state.apiToken');
  });
});

describe("Display activity lifecycle", () => {
  test("defaults to auto-pause mode and supports always-active monitor toggle", () => {
    const html = getDisplayHtml();

    expect(html).toContain("localCrewDisplayAlwaysActive");
    expect(html).toContain("Auto Pause");
    expect(html).toContain("Monitor Off");
    expect(html).toContain("window.localStorage.setItem(DISPLAY_ACTIVITY_KEY");
    expect(html).toContain("document.visibilityState==='visible'&&document.hasFocus()");
    expect(html).toContain("window.addEventListener('focus',syncActivityState)");
    expect(html).toContain("window.addEventListener('blur',syncActivityState)");
  });

  test("consumes enriched SSE state and task events", () => {
    const html = getDisplayHtml();

    expect(html).toContain("applyStatePayload(d)");
    expect(html).toContain("msg.type==='task-start'");
    expect(html).toContain("msg.type==='task-complete'");
    expect(html).toContain("msg.type==='task-write'");
    expect(html).toContain("msg.type==='queue-fill'");
    expect(html).toContain("msg.type==='daily-complete'");
  });

  test("applies paused display class for animation throttling", () => {
    const html = getDisplayHtml();

    expect(html).toContain("document.body.classList.toggle('paused',!shouldStayActive())");
    expect(html).toContain(".paused #dqfill");
    expect(html).toContain(".paused .dbar-fill");
  });
});

describe("Served scripts are syntactically valid JavaScript", () => {
  function checkSyntax(code: string, label: string): string | null {
    const tmp = join(tmpdir(), `localcrew-${label}-${Date.now()}.js`);
    try {
      writeFileSync(tmp, code);
      const result = spawnSync("node", ["--check", tmp], { encoding: "utf8" });
      if (result.status !== 0) {
        return result.stderr.trim();
      }
      return null;
    } finally {
      try { unlinkSync(tmp); } catch {}
    }
  }

  test("display billboard script has no syntax errors", () => {
    const html = getDisplayHtml();
    const match = html.match(/<script>([\s\S]*)<\/script>/);
    expect(match).not.toBeNull();
    const error = checkSyntax(match![1], "display");
    expect(error).toBeNull();
  });

  test("GUI app script has no syntax errors", () => {
    const script = getGuiScript();
    const error = checkSyntax(script, "gui");
    expect(error).toBeNull();
  });
});
