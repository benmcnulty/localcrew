import { describe, expect, test } from "bun:test";

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
