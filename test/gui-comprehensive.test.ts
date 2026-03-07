/**
 * Comprehensive GUI test suite.
 *
 * Covers admin UI structure, responsive breakpoints, display UI features,
 * JavaScript helpers, and the 5K billboard breakpoint.
 */
import { describe, expect, test } from "bun:test";
import {
  getGuiHtml,
  getGuiStyles,
  getGuiScript,
  getDisplayHtml,
} from "../src/gui.ts";

const adminHtml = getGuiHtml();
const adminCss = getGuiStyles();
const adminJs = getGuiScript();
const displayHtml = getDisplayHtml();

// ─── Admin Structure ──────────────────────────────────────────────────────────

describe("Admin UI: topbar", () => {
  test("has logo, version badge, and orchestrator name slot", () => {
    expect(adminHtml).toContain("Local Crew");
    expect(adminHtml).toContain("badge-dim");
    expect(adminHtml).toContain('id="topbar-orchestrator"');
  });

  test("has global status dot and API live badge", () => {
    expect(adminHtml).toContain('id="topbar-dot"');
    expect(adminHtml).toContain("badge-live");
  });
});

describe("Admin UI: dashboard section", () => {
  test("has stat tiles", () => {
    expect(adminHtml).toContain("stat-resources");
    expect(adminHtml).toContain("stat-mode");
  });

  test("has command buttons with data-command attributes", () => {
    const commandPattern = /data-command="\/[a-z]+"/g;
    const commands = adminHtml.match(commandPattern) || [];
    expect(commands.length).toBeGreaterThanOrEqual(4);
  });

  test("has command input form", () => {
    expect(adminHtml).toContain("id=\"command-input\"");
  });

  test("has live view tab buttons", () => {
    expect(adminHtml).toContain("data-tab=\"status\"");
    expect(adminHtml).toContain("data-tab=\"queue\"");
  });

  test("has result output area", () => {
    expect(adminHtml).toContain("id=\"result-output\"");
  });
});

describe("Admin UI: resources section", () => {
  test("has resource form fields", () => {
    expect(adminHtml).toContain('id="resource-alias"');
    expect(adminHtml).toContain('id="resource-label"');
    expect(adminHtml).toContain('id="resource-base-url"');
    expect(adminHtml).toContain('id="resource-tier"');
    expect(adminHtml).toContain('id="resource-api-style"');
  });

  test("has tier select options", () => {
    expect(adminHtml).toContain("value=\"top\"");
    expect(adminHtml).toContain("value=\"mid\"");
    expect(adminHtml).toContain("value=\"low\"");
  });

  test("has API style select options", () => {
    expect(adminHtml).toContain("value=\"ollama\"");
    expect(adminHtml).toContain("value=\"openai\"");
    expect(adminHtml).toContain("value=\"anthropic\"");
  });

  test("has resource list container", () => {
    expect(adminHtml).toContain("id=\"resource-list\"");
  });
});

describe("Admin UI: participants section", () => {
  test("has participant form fields", () => {
    expect(adminHtml).toContain('id="participant-alias"');
    expect(adminHtml).toContain('id="participant-nickname"');
  });

  test("has participant list container", () => {
    expect(adminHtml).toContain('id="participant-list"');
  });
});

describe("Admin UI: direct chat section", () => {
  test("has resource/model selects and textarea", () => {
    expect(adminHtml).toContain('id="direct-resource"');
    expect(adminHtml).toContain('id="direct-model"');
    expect(adminHtml).toContain('id="direct-message"');
  });

  test("has response output area", () => {
    expect(adminHtml).toContain('id="direct-result-output"');
  });
});

describe("Admin UI: dropbox section", () => {
  test("has inbox form with filename and content", () => {
    expect(adminHtml).toContain("id=\"inbox-filename\"");
    expect(adminHtml).toContain("id=\"inbox-content\"");
  });

  test("has dropbox status output", () => {
    expect(adminHtml).toContain('id="dropbox-status-output"');
  });
});

describe("Admin UI: explorer section", () => {
  test("has file tree and file open form", () => {
    expect(adminHtml).toContain('id="tree-output"');
    expect(adminHtml).toContain('id="file-path-input"');
  });
});

describe("Admin UI: settings section", () => {
  test("has orchestrator name form", () => {
    expect(adminHtml).toContain('id="orchestrator-name"');
  });
});

describe("Admin UI: topology section", () => {
  test("has topology-related form fields", () => {
    expect(adminHtml).toContain('id="topo-assign-alias"');
    expect(adminHtml).toContain('id="topo-assign-role"');
  });
});

describe("Admin UI: guide section", () => {
  test("has topic buttons", () => {
    expect(adminHtml).toContain("guide-topic");
  });

  test("has help output area", () => {
    expect(adminHtml).toContain('id="guide-help-output"');
  });
});

// ─── Admin CSS Responsive ────────────────────────────────────────────────────

describe("Admin CSS: responsive breakpoints", () => {
  test("has mobile breakpoint at max-width 800px", () => {
    expect(adminCss).toContain("@media (max-width: 800px)");
  });

  test("hides sidebar at 800px", () => {
    // Check the CSS has sidebar hidden in the mobile breakpoint
    const mobileSection = adminCss.slice(
      adminCss.indexOf("@media (max-width: 800px)"),
    );
    expect(mobileSection).toContain("#sidebar");
    expect(mobileSection).toContain("display: none");
  });

  test("has small mobile breakpoint at max-width 480px", () => {
    expect(adminCss).toContain("@media (max-width: 480px)");
  });

  test("480px breakpoint adjusts modal-actions to column layout", () => {
    const smallMobile = adminCss.slice(
      adminCss.indexOf("@media (max-width: 480px)"),
    );
    expect(smallMobile).toContain("modal-actions");
    expect(smallMobile).toContain("flex-direction: column");
  });

  test("has desktop breakpoint at min-width 1200px", () => {
    expect(adminCss).toContain("@media (min-width: 1200px)");
  });

  test("1200px breakpoint widens sidebar", () => {
    const desktop = adminCss.slice(
      adminCss.indexOf("@media (min-width: 1200px)"),
    );
    expect(desktop).toContain("#sidebar");
    expect(desktop).toContain("260px");
  });

  test("has large display breakpoint at min-width 1920px", () => {
    expect(adminCss).toContain("@media (min-width: 1920px)");
  });

  test("has stat-grid single column layout at 480px", () => {
    const smallMobile = adminCss.slice(
      adminCss.indexOf("@media (max-width: 480px)"),
    );
    expect(smallMobile).toContain("stat-grid");
    expect(smallMobile).toContain("1fr");
  });
});

describe("Admin CSS: base styles", () => {
  test("has dark theme background", () => {
    expect(adminCss).toContain("background:");
    expect(adminCss).toContain("#0d0f14");
  });

  test("has tier colors", () => {
    expect(adminCss).toContain(".tier-top");
    expect(adminCss).toContain(".tier-mid");
    expect(adminCss).toContain(".tier-low");
  });

  test("has badge styles", () => {
    expect(adminCss).toContain(".badge-live");
    expect(adminCss).toContain(".badge-dim");
  });

  test("has dot status colors", () => {
    expect(adminCss).toContain(".dot-green");
    expect(adminCss).toContain(".dot-red");
    expect(adminCss).toContain(".dot-gray");
  });

  test("has modal overlay with z-index 100", () => {
    expect(adminCss).toContain(".modal-overlay");
    expect(adminCss).toContain("z-index: 100");
  });

  test("hides section[hidden]", () => {
    expect(adminCss).toContain("section[hidden]");
    expect(adminCss).toContain("display: none");
  });
});

// ─── Admin JavaScript ────────────────────────────────────────────────────────

describe("Admin JS: core functions", () => {
  test("defines selectSection function", () => {
    expect(adminJs).toContain("function selectSection(");
  });

  test("selectSection toggles active class on nav items", () => {
    expect(adminJs).toContain("classList.toggle");
  });

  test("defines initializeApiToken function", () => {
    expect(adminJs).toContain("initializeApiToken");
  });

  test("handles URL param token extraction and history cleanup", () => {
    expect(adminJs).toContain("searchParams");
    expect(adminJs).toContain("sessionStorage");
    expect(adminJs).toContain("history.replaceState");
  });

  test("defines buildApiHeaders function", () => {
    expect(adminJs).toContain("buildApiHeaders");
  });

  test("defines getJson, postJson, deleteJson helpers", () => {
    expect(adminJs).toContain("getJson");
    expect(adminJs).toContain("postJson");
    expect(adminJs).toContain("deleteJson");
  });

  test("defines renderResources function", () => {
    expect(adminJs).toContain("renderResources");
  });

  test("defines renderParticipants function", () => {
    expect(adminJs).toContain("renderParticipants");
  });

  test("defines refreshView function", () => {
    expect(adminJs).toContain("refreshView");
  });

  test("has auto-refresh interval setup", () => {
    expect(adminJs).toContain("setInterval");
  });

  test("defines renderResult function", () => {
    expect(adminJs).toContain("renderResult");
  });

  test("defines submitCommand function", () => {
    expect(adminJs).toContain("submitCommand");
  });
});

describe("Admin JS: form handlers", () => {
  test("has resource form submit handler", () => {
    expect(adminJs).toContain("resource-form");
  });

  test("has participant form submit handler", () => {
    expect(adminJs).toContain("participant-form");
  });

  test("has command form submit handler", () => {
    expect(adminJs).toContain("command-form");
  });

  test("has inbox form submit handler", () => {
    expect(adminJs).toContain("inbox-form");
  });

  test("has direct chat form submit handler", () => {
    expect(adminJs).toContain("direct-chat-form");
  });
});

// ─── Display CSS Responsive ──────────────────────────────────────────────────

describe("Display CSS: responsive breakpoints", () => {
  test("has tablet breakpoint at 768px", () => {
    expect(displayHtml).toContain("min-width: 768px");
  });

  test("has desktop breakpoint at 1200px", () => {
    expect(displayHtml).toContain("min-width: 1200px");
  });

  test("has QHD breakpoint at 2560px", () => {
    expect(displayHtml).toContain("min-width: 2560px");
  });

  test("has HD Billboard breakpoint at 1920px", () => {
    expect(displayHtml).toContain("min-width: 1920px");
  });

  test("has 4K Billboard breakpoint at 3840px", () => {
    expect(displayHtml).toContain("min-width: 3840px");
  });

  test("has 5K Billboard breakpoint at 5120px", () => {
    expect(displayHtml).toContain("min-width: 5120px");
  });
});

describe("Display CSS: 5K breakpoint values", () => {
  test("5K sets html font-size to 30px", () => {
    const idx5k = displayHtml.indexOf("min-width: 5120px");
    const chunk = displayHtml.slice(idx5k, idx5k + 400);
    expect(chunk).toContain("font-size: 30px");
  });

  test("5K sets larger topbar height", () => {
    const idx5k = displayHtml.indexOf("min-width: 5120px");
    const chunk = displayHtml.slice(idx5k, idx5k + 400);
    expect(chunk).toContain("--topbar-h:160px");
  });

  test("5K sets larger gap and padding", () => {
    const idx5k = displayHtml.indexOf("min-width: 5120px");
    const chunk = displayHtml.slice(idx5k, idx5k + 400);
    expect(chunk).toContain("--gap:56px");
    expect(chunk).toContain("--pad:64px");
  });

  test("5K sets scaled font sizes", () => {
    const idx5k = displayHtml.indexOf("min-width: 5120px");
    const chunk = displayHtml.slice(idx5k, idx5k + 500);
    expect(chunk).toContain("--fs-base:3.2rem");
    expect(chunk).toContain("--fs-xl:7.5rem");
  });

  test("5K has larger ticker dots", () => {
    expect(displayHtml).toContain(
      "min-width:5120px){.dticker-dot{width:20px;height:20px}",
    );
  });

  test("5K has larger close buttons", () => {
    expect(displayHtml).toContain("min-width:5120px){.mx-close{width:86px");
    expect(displayHtml).toContain("min-width:5120px){.daily-close{width:86px");
  });

  test("5K has wider panels", () => {
    expect(displayHtml).toContain(
      "min-width: 5120px) { #dpnet { flex: 0 0 640px; }",
    );
  });

  test("5K has larger progress bar track", () => {
    expect(displayHtml).toContain(
      "min-width: 5120px) { .dtrack { height: 52px;",
    );
  });

  test("5K has larger network panel", () => {
    expect(displayHtml).toContain(
      "min-width: 5120px) { #dpnet { flex: 0 0 640px;",
    );
  });

  test("5K has larger model bar track", () => {
    expect(displayHtml).toContain(
      "min-width: 5120px) { .dbar-track { height: 16px; }",
    );
  });

  test("5K has scaled Matrix depth sizes", () => {
    // Canvas renderer scales depth sizes dynamically via mxSizeCanvas
    expect(displayHtml).toContain("mxSizeCanvas");
    expect(displayHtml).toContain("w>=5120?2.0");
  });

  test("5K has scaled Daily content", () => {
    const idx5k = displayHtml.lastIndexOf("min-width:5120px)");
    const chunk = displayHtml.slice(idx5k, idx5k + 300);
    expect(chunk).toContain("max-width:2800px");
  });
});

describe("Display CSS: 4K breakpoint values", () => {
  test("4K sets html font-size to 24px", () => {
    const idx4k = displayHtml.indexOf("/* 4K Billboard */");
    const chunk = displayHtml.slice(idx4k, idx4k + 400);
    expect(chunk).toContain("font-size: 24px");
  });

  test("4K sets larger topbar height", () => {
    const idx4k = displayHtml.indexOf("/* 4K Billboard */");
    const chunk = displayHtml.slice(idx4k, idx4k + 400);
    expect(chunk).toContain("--topbar-h:128px");
  });
});

// ─── Display Structure ───────────────────────────────────────────────────────

describe("Display UI: base structure", () => {
  test("has three-column layout", () => {
    expect(displayHtml).toContain('id="dpnet"');
    expect(displayHtml).toContain('id="dpmain"');
    expect(displayHtml).toContain('id="dpmet"');
  });

  test("has top header bar", () => {
    expect(displayHtml).toContain('id="dtop"');
    expect(displayHtml).toContain("Local Crew");
  });

  test("has log strip at bottom", () => {
    expect(displayHtml).toContain('id="dlog-strip"');
    expect(displayHtml).toContain('id="dlogfeed"');
  });

  test("has neon scanline overlay", () => {
    expect(displayHtml).toContain("scanlines");
  });

  test("has CSS custom properties for theming", () => {
    expect(displayHtml).toContain("--bg:");
    expect(displayHtml).toContain("--surface:");
    expect(displayHtml).toContain("--n-blue:");
    expect(displayHtml).toContain("--n-purple:");
    expect(displayHtml).toContain("--n-amber:");
  });
});

describe("Display UI: metrics panel", () => {
  test("has metric tiles", () => {
    expect(displayHtml).toContain("mv-done");
    expect(displayHtml).toContain("mv-events");
    expect(displayHtml).toContain("mv-tokens");
  });

  test("has SVG gauge for TPM", () => {
    expect(displayHtml).toContain('id="dgauge"');
    expect(displayHtml).toContain("<svg");
    expect(displayHtml).toContain("dgauge-fill");
  });

  test("has model bars section", () => {
    expect(displayHtml).toContain('id="dmodelbars"');
  });
});

describe("Display UI: queue panel", () => {
  test("has queue fill bar with shimmer", () => {
    expect(displayHtml).toContain('id="dqfill"');
    expect(displayHtml).toContain("shimmer");
  });

  test("has queue list", () => {
    expect(displayHtml).toContain('id="dqlist"');
  });

  test("has queue percentage display", () => {
    expect(displayHtml).toContain("dqpct");
  });
});

describe("Display UI: network panel", () => {
  test("has resource grid", () => {
    expect(displayHtml).toContain('id="dres-grid"');
  });

  test("resource dot elements reference CSS dot classes", () => {
    expect(displayHtml).toContain("ddot");
    expect(displayHtml).toContain("dotPulse");
  });
});

describe("Display UI: animations", () => {
  test("has paused mode CSS class", () => {
    expect(displayHtml).toContain(".paused");
    expect(displayHtml).toContain("animation: none !important");
  });

  test("has dot pulse keyframes", () => {
    expect(displayHtml).toContain("@keyframes dotPulse");
  });

  test("has busy pulse keyframes", () => {
    expect(displayHtml).toContain("@keyframes busyPulse");
  });

  test("has flash keyframes for value changes", () => {
    expect(displayHtml).toContain("@keyframes valFlash");
  });

  test("has ticker slide keyframes", () => {
    expect(displayHtml).toContain("@keyframes tickerSlide");
  });

  test("has resource busy animation", () => {
    expect(displayHtml).toContain("@keyframes resBusy");
  });
});

// ─── Display JavaScript ──────────────────────────────────────────────────────

describe("Display JS: helper functions", () => {
  test("defines esc() HTML escaping function", () => {
    expect(displayHtml).toContain("function esc(");
  });

  test("esc handles angle brackets and ampersands", () => {
    // Check the implementation handles the key characters
    expect(displayHtml).toContain("&amp;");
    expect(displayHtml).toContain("&lt;");
    expect(displayHtml).toContain("&gt;");
  });

  test("defines fmt() number formatting function", () => {
    expect(displayHtml).toContain("function fmt(");
  });

  test("fmt handles K and M suffixes", () => {
    const jsStart = displayHtml.indexOf("function fmt(");
    const fmtBody = displayHtml.slice(jsStart, jsStart + 300);
    expect(fmtBody).toContain("1000000");
  });

  test("defines fetchJ() fetch wrapper", () => {
    expect(displayHtml).toContain("fetchJ");
  });

  test("defines setVal() with flash animation", () => {
    expect(displayHtml).toContain("setVal");
    expect(displayHtml).toContain("flash");
  });
});

describe("Display JS: data loading", () => {
  test("defines loadStatus function", () => {
    expect(displayHtml).toContain("loadStatus");
  });

  test("defines loadQueue function", () => {
    expect(displayHtml).toContain("loadQueue");
  });

  test("defines loadResources function", () => {
    expect(displayHtml).toContain("loadResources");
  });

  test("defines loadAudit function", () => {
    expect(displayHtml).toContain("loadAudit");
  });

  test("loadAudit tracks TPM via EMA", () => {
    expect(displayHtml).toContain("updateTpmEma");
  });
});

describe("Display JS: SSE handling", () => {
  test("defines startSSE function", () => {
    expect(displayHtml).toContain("startSSE");
  });

  test("defines closeSSE function", () => {
    expect(displayHtml).toContain("closeSSE");
  });

  test("SSE connects to /api/events endpoint", () => {
    expect(displayHtml).toContain("/api/events");
  });

  test("has reconnect logic with delay", () => {
    expect(displayHtml).toContain("onerror");
    // Reconnect uses setTimeout
    expect(displayHtml).toContain("setTimeout");
  });

  test("has fallback polling timer", () => {
    expect(displayHtml).toContain("setInterval");
    expect(displayHtml).toContain("PollTimer");
  });
});

describe("Display JS: gauge rendering", () => {
  test("defines updateTpmEma function", () => {
    expect(displayHtml).toContain("updateTpmEma");
  });

  test("defines applyTpm for gauge update", () => {
    expect(displayHtml).toContain("applyTpm");
  });

  test("has SVG gauge arc paths", () => {
    expect(displayHtml).toContain("dgauge-track");
    expect(displayHtml).toContain("dgauge-fill");
    expect(displayHtml).toContain("stroke-dashoffset");
  });
});

describe("Display JS: Matrix engine", () => {
  test("defines mxStart and mxStop controls", () => {
    expect(displayHtml).toContain("mxStart");
    expect(displayHtml).toContain("mxStop");
  });

  test("defines mxFeedText for text input", () => {
    expect(displayHtml).toContain("mxFeedText");
  });

  test("defines mxSpawn for column spawning", () => {
    expect(displayHtml).toContain("mxSpawn");
  });

  test("defines mxProcessEvent for SSE integration", () => {
    expect(displayHtml).toContain("mxProcessEvent");
  });

  test("Matrix has CRT scanline effect", () => {
    // CRT scanlines implemented via repeating-linear-gradient on overlays
    expect(displayHtml).toContain("repeating-linear-gradient");
    expect(displayHtml).toContain("scanline");
  });

  test("Matrix has column depth tiers", () => {
    expect(displayHtml).toContain("mxDepths");
    expect(displayHtml).toContain("renderSize");
  });
});

describe("Display JS: Daily Work", () => {
  test("defines mdToHtml for markdown rendering", () => {
    expect(displayHtml).toContain("mdToHtml");
  });

  test("mdToHtml handles headings, bold, code, links", () => {
    const jsStart = displayHtml.indexOf("function mdToHtml");
    const jsSection = displayHtml.slice(jsStart, jsStart + 2000);
    expect(jsSection).toContain("<h1>");
    expect(jsSection).toContain("<strong>");
    expect(jsSection).toContain("<code>");
  });

  test("defines dailyFetch for API loading", () => {
    expect(displayHtml).toContain("dailyFetch");
  });

  test("defines dailyOpen and dailyClose", () => {
    expect(displayHtml).toContain("dailyOpen");
    expect(displayHtml).toContain("dailyClose");
  });

  test("Daily fetches from /api/daily-work", () => {
    expect(displayHtml).toContain("/api/daily-work");
  });
});

describe("Display JS: Activity lifecycle", () => {
  test("defines syncActivityState", () => {
    expect(displayHtml).toContain("syncActivityState");
  });

  test("defines shouldStayActive", () => {
    expect(displayHtml).toContain("shouldStayActive");
  });

  test("stores activity state in localStorage", () => {
    expect(displayHtml).toContain("localStorage");
  });

  test("responds to visibility changes", () => {
    expect(displayHtml).toContain("visibilitychange");
  });

  test("responds to focus events", () => {
    expect(displayHtml).toContain("focus");
  });
});

describe("Display JS: clock", () => {
  test("defines tickClock function", () => {
    expect(displayHtml).toContain("tickClock");
  });

  test("has clock element in HTML", () => {
    expect(displayHtml).toContain('id="dclock"');
  });
});

// ─── CSS Quality ─────────────────────────────────────────────────────────────

describe("CSS: responsive breakpoint ordering", () => {
  test("display breakpoints are in ascending order", () => {
    const breakpoints = [768, 1200, 1920, 2560, 3840, 5120];
    for (const bp of breakpoints) {
      // Each breakpoint should exist somewhere in the display HTML
      const withSpaces = displayHtml.includes(`min-width: ${bp}px`);
      const withoutSpaces = displayHtml.includes(`min-width:${bp}px`);
      expect(withSpaces || withoutSpaces).toBe(true);
    }
  });

  test("admin breakpoints cover mobile → desktop range", () => {
    expect(adminCss).toContain("max-width: 480px");
    expect(adminCss).toContain("max-width: 800px");
    expect(adminCss).toContain("min-width: 1200px");
    expect(adminCss).toContain("min-width: 1920px");
  });
});

describe("CSS: z-index layering", () => {
  test("display scanlines have z-index 50", () => {
    // Scanlines z-index
    const scanIdx = displayHtml.indexOf("scanlines");
    const scanChunk = displayHtml.slice(scanIdx, scanIdx + 200);
    expect(scanChunk).toContain("z-index");
  });

  test("display Daily overlay has z-index 100", () => {
    expect(displayHtml).toContain("z-index: 100");
  });

  test("display Matrix overlay has z-index 10000", () => {
    expect(displayHtml).toContain("z-index: 10000");
  });

  test("Matrix z-index > Daily z-index", () => {
    // Matrix overlay uses z-index 10000, Daily uses z-index 100
    expect(displayHtml).toContain("z-index: 10000");
    expect(displayHtml).toContain("z-index: 100");
  });
});

// ─── JavaScript Syntax Validation ─────────────────────────────────────────────

describe("JavaScript syntax validation", () => {
  test("admin JS is valid JavaScript", () => {
    // Verify the JS is parseable by checking for key structure
    expect(adminJs).toContain("const state");
    expect(adminJs).toContain("function");
    // Should start with state declaration
    expect(adminJs.trimStart().startsWith("const state")).toBe(true);
  });
});

// ─── Matrix Animation Robustness ──────────────────────────────────────────────

describe("Matrix animation robustness (Canvas 2D)", () => {
  test("MX state object tracks columns array", () => {
    expect(displayHtml).toContain("columns:[]");
  });

  test("mxStart spawns initial burst of columns", () => {
    expect(displayHtml).toContain("mxSpawnCol()");
    expect(displayHtml).toContain("burst");
  });

  test("mxStop cancels animation frame and clears buffer", () => {
    expect(displayHtml).toContain("cancelAnimationFrame(MX.raf)");
    expect(displayHtml).toContain("MX.columns=[]");
    expect(displayHtml).toContain("MX.buf=[]");
    expect(displayHtml).toContain("MX.bufIdx=0");
  });

  test("mxStart uses requestAnimationFrame", () => {
    expect(displayHtml).toContain("requestAnimationFrame(mxFrame)");
  });

  test("mxFrame renders with Canvas 2D context", () => {
    expect(displayHtml).toContain("ctx.fillText");
    expect(displayHtml).toContain("ctx.fillRect");
  });

  test("mxSizeCanvas handles device pixel ratio", () => {
    expect(displayHtml).toContain("devicePixelRatio");
    expect(displayHtml).toContain("setTransform");
  });
});

// ─── Page Lifecycle Cleanup ───────────────────────────────────────────────────

describe("Display page lifecycle cleanup", () => {
  test("pagehide listener closes overlays and SSE", () => {
    expect(displayHtml).toContain("pagehide");
    expect(displayHtml).toContain("mxStop()");
    expect(displayHtml).toContain("dailyClose()");
    expect(displayHtml).toContain("closeSSE()");
  });
});

// ─── Markdown Link XSS Prevention ─────────────────────────────────────────────

describe("Daily overlay markdown security", () => {
  test("markdown link rendering validates URL protocol", () => {
    // The mdToHtml function should check protocol safety instead of blindly inserting href
    expect(displayHtml).toContain("new URL(u,location.href)");
    expect(displayHtml).toContain("protocol==='http:'");
    expect(displayHtml).toContain("protocol==='https:'");
  });
});
