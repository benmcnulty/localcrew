/**
 * GUI Regression Tests — Comprehensive DOM structure, CSS, and JS behavior validation.
 *
 * These tests validate the HTML/CSS/JS output of gui.ts against known-good behavior
 * to catch regressions in modals, overlays, z-index layering, keyboard/mouse dismissal,
 * mutual exclusion, and CSS specificity. All checks are string/regex-based against the
 * generated HTML/CSS/JS so no browser is required.
 */
import { describe, expect, test } from "bun:test";
import {
  getGuiHtml,
  getGuiStyles,
  getGuiScript,
  getDisplayHtml,
} from "../src/gui.ts";

// ─── Admin UI: HTML Structure ─────────────────────────────────────────────────

describe("Admin UI: HTML structure", () => {
  const html = getGuiHtml();

  test("modal overlay has hidden attribute by default", () => {
    expect(html).toMatch(/<div id="modal-overlay"[^>]*hidden/);
  });

  test("edit panel exists inside modal overlay with hidden attribute", () => {
    expect(html).toMatch(/<section id="edit-panel"[^>]*hidden/);
  });

  test("workflow panel exists inside modal overlay with hidden attribute", () => {
    expect(html).toMatch(/<section id="workflow-panel"[^>]*hidden/);
  });

  test("edit panel has a Cancel button", () => {
    expect(html).toContain('id="edit-cancel"');
    expect(html).toMatch(/id="edit-cancel"[^>]*>Cancel</);
  });

  test("workflow panel has a Cancel button", () => {
    expect(html).toContain('id="workflow-cancel"');
    expect(html).toMatch(/id="workflow-cancel"[^>]*>Cancel</);
  });

  test("edit panel has a form with Save button", () => {
    expect(html).toContain('id="edit-form"');
    expect(html).toContain('id="edit-text"');
    expect(html).toMatch(/<button type="submit">Save<\/button>/);
  });

  test("modal overlay wraps a single modal-card", () => {
    const overlayMatch = html.match(
      /id="modal-overlay"[\s\S]*?<div class="modal-card">/
    );
    expect(overlayMatch).not.toBeNull();
  });

  test("navigation sidebar has section tabs", () => {
    expect(html).toContain('data-section="dashboard"');
    expect(html).toContain('data-section="resources"');
    expect(html).toContain('data-section="participants"');
    expect(html).toContain('data-section="queue"');
    expect(html).toContain('data-section="topology"');
    expect(html).toContain('data-section="explorer"');
    expect(html).toContain('data-section="guide"');
  });

  test("main content area exists", () => {
    expect(html).toContain('id="content"');
  });
});

// ─── Admin UI: CSS Specificity & Regression ───────────────────────────────────

describe("Admin UI: CSS specificity fixes", () => {
  const styles = getGuiStyles();

  test("section[hidden] has display:none to override flex", () => {
    expect(styles).toMatch(/section\[hidden\]\s*\{[^}]*display:\s*none/);
  });

  test(".modal-overlay[hidden] has display:none to override flex", () => {
    expect(styles).toMatch(
      /\.modal-overlay\[hidden\]\s*\{[^}]*display:\s*none/
    );
  });

  test("modal-overlay has z-index 100", () => {
    // The .modal-overlay rule should contain z-index: 100
    const overlayBlock = styles.match(
      /\.modal-overlay\s*\{[^}]*z-index:\s*(\d+)/
    );
    expect(overlayBlock).not.toBeNull();
    expect(overlayBlock![1]).toBe("100");
  });
});

// ─── Admin UI: JavaScript Behavior ────────────────────────────────────────────

describe("Admin UI: updateModalOverlay helper", () => {
  const script = getGuiScript();

  test("updateModalOverlay function is defined", () => {
    expect(script).toContain("function updateModalOverlay()");
  });

  test("updateModalOverlay checks both pendingEdit and pendingWorkflow", () => {
    expect(script).toMatch(
      /state\.pendingEdit\s*\|\|\s*state\.pendingWorkflow/
    );
  });

  test("updateModalOverlay manages body overflow for scroll lock", () => {
    expect(script).toMatch(
      /document\.body\.style\.overflow\s*=\s*anyOpen\s*\?\s*"hidden"/
    );
  });
});

describe("Admin UI: renderWorkflow does not clobber renderEdit", () => {
  const script = getGuiScript();

  test("renderWorkflow(null) does NOT unconditionally hide editPanel", () => {
    // Extract renderWorkflow function body
    const fnMatch = script.match(
      /function renderWorkflow\(request\)\s*\{([\s\S]*?)\n\s*function /
    );
    expect(fnMatch).not.toBeNull();
    const body = fnMatch![1];

    // Should hide editPanel only conditional on request being truthy
    // Actual code: if (request && els.editPanel) els.editPanel.hidden = true;
    expect(body).toMatch(/if\s*\(\s*request\s*&&\s*els\.editPanel/);

    // The line that sets editPanel.hidden must be guarded by `request &&`
    const editHideLine = body.match(
      /els\.editPanel.*\.hidden\s*=\s*true/
    );
    expect(editHideLine).not.toBeNull();
    // Verify it's within a conditional, not standalone
    expect(body).not.toMatch(
      /^\s*if\s*\(\s*els\.editPanel\s*\)\s*els\.editPanel\.hidden\s*=\s*true/m
    );
  });

  test("renderWorkflow calls updateModalOverlay instead of setting overlay directly", () => {
    const fnMatch = script.match(
      /function renderWorkflow\(request\)\s*\{([\s\S]*?)\n\s*function /
    );
    expect(fnMatch).not.toBeNull();
    const body = fnMatch![1];

    expect(body).toContain("updateModalOverlay()");
    // Should NOT directly set modalOverlay.hidden
    expect(body).not.toMatch(/els\.modalOverlay\.hidden\s*=/);
  });
});

describe("Admin UI: renderEdit does not clobber renderWorkflow", () => {
  const script = getGuiScript();

  test("renderEdit(null) does NOT unconditionally hide workflowPanel", () => {
    const fnMatch = script.match(
      /function renderEdit\(request\)\s*\{([\s\S]*?)\n\s*function /
    );
    expect(fnMatch).not.toBeNull();
    const body = fnMatch![1];

    // Should hide workflowPanel only conditional on request being truthy
    expect(body).toMatch(/if\s*\(\s*request\s*&&/);
    expect(body).toContain("els.workflowPanel");
  });

  test("renderEdit calls updateModalOverlay", () => {
    const fnMatch = script.match(
      /function renderEdit\(request\)\s*\{([\s\S]*?)\n\s*function /
    );
    expect(fnMatch).not.toBeNull();
    expect(fnMatch![1]).toContain("updateModalOverlay()");
  });
});

describe("Admin UI: keyboard and mouse dismissal", () => {
  const script = getGuiScript();

  test("Escape key handler is registered via keydown listener", () => {
    expect(script).toMatch(
      /document\.addEventListener\(\s*"keydown"/
    );
  });

  test("Escape handler closes both edit and workflow modals", () => {
    // After Escape press, both renderEdit(null) and renderWorkflow(null) should be called
    expect(script).toMatch(
      /key\s*===\s*"Escape"[\s\S]*?renderEdit\(null\)/
    );
    expect(script).toMatch(
      /key\s*===\s*"Escape"[\s\S]*?renderWorkflow\(null\)/
    );
  });

  test("backdrop click handler is registered on modal-overlay", () => {
    // Look for click listener on modal-overlay that checks event.target
    expect(script).toMatch(
      /modalOverlay[\s\S]*?addEventListener\(\s*"click"/
    );
    expect(script).toMatch(/event\.target\s*===\s*els\.modalOverlay/);
  });

  test("workflow cancel button handler calls renderWorkflow(null)", () => {
    expect(script).toMatch(
      /workflowCancel[\s\S]*?addEventListener[\s\S]*?renderWorkflow\(null\)/
    );
  });
});

// ─── Display UI: HTML Structure ───────────────────────────────────────────────

describe("Display UI: HTML structure", () => {
  const html = getDisplayHtml();

  test("three-column layout exists", () => {
    expect(html).toContain('id="dpnet"');
    expect(html).toContain('id="dpmain"');
    expect(html).toContain('id="dpmet"');
  });

  test("Matrix overlay with canvas and close button", () => {
    expect(html).toContain('id="matrix-overlay"');
    expect(html).toContain('id="matrix-canvas"');
    expect(html).toContain('id="mx-close"');
    expect(html).toMatch(/aria-label="Exit Matrix view"/);
  });

  test("Daily overlay with close button and content sections", () => {
    expect(html).toContain('id="daily-overlay"');
    expect(html).toContain('id="daily-close"');
    expect(html).toContain('id="daily-body"');
    expect(html).toContain('id="daily-updated"');
    expect(html).toMatch(/aria-label="Close Daily Work"/);
  });

  test("Matrix and Daily trigger buttons in the UI", () => {
    expect(html).toContain('id="dmatrix-btn"');
    expect(html).toContain('id="ddaily-btn"');
    expect(html).toMatch(/>Matrix</);
    expect(html).toMatch(/>Daily</);
  });

  test("log strip footer exists", () => {
    expect(html).toContain('id="dlog-strip"');
    expect(html).toContain('id="dlogfeed"');
  });

  test("daily stale badge is hidden by default", () => {
    expect(html).toMatch(/id="daily-stale-badge"[^>]*style="display:none"/);
  });
});

// ─── Display UI: CSS z-index Layering ─────────────────────────────────────────

describe("Display UI: z-index layering", () => {
  const html = getDisplayHtml();

  test("scanlines z-index is 50 (not 9999)", () => {
    // body::after scanline overlay
    const bodyAfterMatch = html.match(
      /body::after\s*\{[^}]*z-index:\s*(\d+)/
    );
    expect(bodyAfterMatch).not.toBeNull();
    expect(bodyAfterMatch![1]).toBe("50");
  });

  test("matrix overlay z-index is 10000", () => {
    const matrixBlock = html.match(
      /#matrix-overlay\s*\{[^}]*z-index:\s*(\d+)/
    );
    expect(matrixBlock).not.toBeNull();
    expect(matrixBlock![1]).toBe("10000");
  });

  test("daily overlay z-index is 100", () => {
    // Looking for the positioned daily-overlay rule
    const dailyBlock = html.match(
      /#daily-overlay\.active\s*\{[^}]*z-index:\s*(\d+)/
    );
    // May also check the base #daily-overlay rule
    const dailyBase = html.match(
      /#daily-overlay\s*\{[^}]*z-index:\s*(\d+)/
    );
    const zIndex = dailyBlock
      ? dailyBlock[1]
      : dailyBase
        ? dailyBase[1]
        : null;
    expect(zIndex).toBe("100");
  });

  test("scanlines do NOT overlap daily overlay (50 < 100)", () => {
    const scanlineZ = parseInt(
      html.match(/body::after\s*\{[^}]*z-index:\s*(\d+)/)![1],
    );
    const dailyZ = parseInt(
      html.match(/#daily-overlay\s*\{[^}]*z-index:\s*(\d+)/)![1],
    );
    expect(scanlineZ).toBeLessThan(dailyZ);
  });

  test("matrix overlay is above everything else (10000 > daily 100)", () => {
    const matrixZ = parseInt(
      html.match(/#matrix-overlay\s*\{[^}]*z-index:\s*(\d+)/)![1],
    );
    expect(matrixZ).toBeGreaterThan(100);
  });
});

// ─── Display UI: JavaScript Overlay Behavior ──────────────────────────────────

describe("Display UI: Matrix/Daily mutual exclusion", () => {
  const html = getDisplayHtml();

  test("mxStart closes daily overlay before opening matrix", () => {
    // mxStart should contain: if(DAILY.on)dailyClose();
    expect(html).toMatch(/function mxStart\(\)\s*\{[\s\S]*?DAILY\.on\)dailyClose\(\)/);
  });

  test("dailyOpen closes matrix overlay before opening daily", () => {
    // dailyOpen should contain: if(MX.on)mxStop();
    expect(html).toMatch(/function dailyOpen\(\)\s*\{[\s\S]*?MX\.on\)mxStop\(\)/);
  });

  test("mxStart guards against double-open", () => {
    expect(html).toMatch(/function mxStart\(\)\s*\{[\s\S]*?if\(MX\.on\)return/);
  });

  test("dailyOpen guards against double-open", () => {
    expect(html).toMatch(/function dailyOpen\(\)\s*\{[\s\S]*?if\(DAILY\.on\)return/);
  });
});

describe("Display UI: keyboard and mouse dismissal", () => {
  const html = getDisplayHtml();

  test("Escape key handler closes active overlays", () => {
    expect(html).toMatch(
      /addEventListener\(\s*['"]keydown['"][\s\S]*?['"]Escape['"]/
    );
  });

  test("Escape prioritizes Daily over Matrix", () => {
    // The handler should check DAILY.on first
    const escapeBlock = html.match(
      /['"]Escape['"][\s\S]*?dailyClose[\s\S]*?mxStop/
    );
    expect(escapeBlock).not.toBeNull();
  });

  test("backdrop click on daily overlay calls dailyClose", () => {
    expect(html).toMatch(
      /DAILY\.overlay[\s\S]*?addEventListener\(\s*['"]click['"]/
    );
    expect(html).toMatch(
      /e\.target\s*===\s*DAILY\.overlay\)\s*dailyClose\(\)/
    );
  });

  test("Matrix close button wired to mxStop", () => {
    expect(html).toMatch(
      /MX\.closeEl[\s\S]*?addEventListener\(\s*['"]click['"][\s\S]*?mxStop/
    );
  });

  test("Daily close button wired to dailyClose", () => {
    expect(html).toMatch(
      /DAILY\.closeEl[\s\S]*?addEventListener\(\s*['"]click['"][\s\S]*?dailyClose/
    );
  });

  test("Matrix button wired to mxStart", () => {
    expect(html).toMatch(/mxBtn[\s\S]*?addEventListener[\s\S]*?mxStart/);
  });

  test("Daily button wired to dailyOpen", () => {
    expect(html).toMatch(/dailyBtn[\s\S]*?addEventListener[\s\S]*?dailyOpen/);
  });
});

describe("Display UI: overlay visibility uses classList.add/remove('active')", () => {
  const html = getDisplayHtml();

  test("Matrix overlay toggles via classList", () => {
    expect(html).toMatch(/classList\.add\(\s*['"]active['"]\)/);
    expect(html).toMatch(/classList\.remove\(\s*['"]active['"]\)/);
  });

  test("Daily overlay toggles via classList", () => {
    expect(html).toMatch(
      /DAILY\.overlay\.classList\.add\(\s*['"]active['"]\)/
    );
    expect(html).toMatch(
      /DAILY\.overlay\.classList\.remove\(\s*['"]active['"]\)/
    );
  });

  test("Matrix overlay is initially inactive (no 'active' class in HTML)", () => {
    // The #matrix-overlay div in the HTML should not have the active class
    expect(html).not.toMatch(/<div id="matrix-overlay"[^>]*class="[^"]*active/);
  });

  test("Daily overlay is initially inactive (no 'active' class in HTML)", () => {
    expect(html).not.toMatch(/<div id="daily-overlay"[^>]*class="[^"]*active/);
  });
});

// ─── Admin UI: submitCommand flow ─────────────────────────────────────────────

describe("Admin UI: submitCommand renders edit/workflow correctly", () => {
  const script = getGuiScript();

  test("submitCommand calls renderEdit then renderWorkflow in sequence", () => {
    // After the submit, both should be called to render the server's response
    const fnMatch = script.match(
      /async function submitCommand[\s\S]*?renderEdit\([\s\S]*?renderWorkflow\(/
    );
    expect(fnMatch).not.toBeNull();
  });

  test("submitCommand passes null when no editRequest in response", () => {
    expect(script).toMatch(
      /renderEdit\(payload\.result\s*\?\s*payload\.result\.editRequest\s*:\s*null\)/
    );
  });

  test("submitCommand passes null when no workflowRequest in response", () => {
    expect(script).toMatch(
      /renderWorkflow\(payload\.result\s*\?\s*payload\.result\.workflowRequest\s*:\s*null\)/
    );
  });
});

// ─── Display UI: Daily content rendering ──────────────────────────────────────

describe("Display UI: Daily work content", () => {
  const html = getDisplayHtml();

  test("Daily fetch calls /api/daily-work", () => {
    expect(html).toContain("/api/daily-work");
  });

  test("Daily content area has loading placeholder", () => {
    expect(html).toMatch(/class="daily-empty"[\s\S]*?Loading/);
  });

  test("Daily displays update timestamp", () => {
    expect(html).toContain("daily-updated");
  });

  test("Daily has a stale badge indicator", () => {
    expect(html).toContain("daily-stale-badge");
    expect(html).toContain("daily-stale");
  });
});

// ─── Admin UI: section navigation ─────────────────────────────────────────────

describe("Admin UI: section navigation", () => {
  const html = getGuiHtml();

  test("all content sections have unique IDs", () => {
    const sectionIds = [
      "section-dashboard",
      "section-resources",
      "section-participants",
      "section-queue",
      "section-direct",
      "section-topology",
      "section-dropbox",
      "section-explorer",
      "section-settings",
      "section-guide",
    ];
    for (const id of sectionIds) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  test("navigation links point to sections via data-section attribute", () => {
    const script = getGuiScript();
    expect(script).toMatch(/nav-item\[data-section\]/);
    expect(script).toMatch(/querySelectorAll/);
  });
});

// ─── Admin UI: body scroll lock ───────────────────────────────────────────────

describe("Admin UI: body scroll lock with modals", () => {
  const script = getGuiScript();

  test("body overflow is set to hidden when modal is open", () => {
    expect(script).toMatch(
      /document\.body\.style\.overflow\s*=\s*anyOpen\s*\?\s*"hidden"\s*:\s*""/
    );
  });
});

// ─── API token propagation ────────────────────────────────────────────────────

describe("Admin UI: API token propagation", () => {
  const script = getGuiScript();

  test("token extracted from URL query param and stored in sessionStorage", () => {
    expect(script).toContain("sessionStorage.getItem");
    expect(script).toContain("sessionStorage.setItem");
  });

  test("token attached as Bearer header on API calls", () => {
    expect(script).toContain('headers.authorization = "Bearer "');
  });
});
