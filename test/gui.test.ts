import { describe, expect, test } from "bun:test";

import { getDisplayHtml, getGuiScript } from "../src/gui.ts";

describe("Local UI auth wiring", () => {
  test("propagates an API token from the URL into subsequent API requests", () => {
    const script = getGuiScript();

    expect(script).toContain('window.sessionStorage.getItem("crustyApiToken")');
    expect(script).toContain('window.sessionStorage.setItem("crustyApiToken", queryToken)');
    expect(script).toContain('headers.authorization = "Bearer " + state.apiToken');
  });
});

describe("Display activity lifecycle", () => {
  test("defaults to auto-pause mode and supports always-active monitor toggle", () => {
    const html = getDisplayHtml();

    expect(html).toContain("crustyDisplayAlwaysActive");
    expect(html).toContain("Auto Pause");
    expect(html).toContain("Monitor Off");
    expect(html).toContain("window.localStorage.setItem(DISPLAY_ACTIVITY_KEY");
    expect(html).toContain("document.visibilityState==='visible'&&document.hasFocus()");
    expect(html).toContain("window.addEventListener('focus',syncActivityState)");
    expect(html).toContain("window.addEventListener('blur',syncActivityState)");
  });
});
