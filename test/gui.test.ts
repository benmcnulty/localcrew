import { describe, expect, test } from "bun:test";

import { getGuiScript } from "../src/gui.ts";

describe("Local UI auth wiring", () => {
  test("propagates an API token from the URL into subsequent API requests", () => {
    const script = getGuiScript();

    expect(script).toContain('window.sessionStorage.getItem("crustyApiToken")');
    expect(script).toContain('window.sessionStorage.setItem("crustyApiToken", queryToken)');
    expect(script).toContain('headers.authorization = "Bearer " + state.apiToken');
  });
});
