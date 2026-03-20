/**
 * Prompt component loader for LocalCrew.
 *
 * Loads composable prompt fragments from external-memory/prompts/components/,
 * supports {{varName}} interpolation and {{#if flag}}...{{/if}} conditionals.
 * Results are cached in memory for the process lifetime since prompt files
 * do not change at runtime.
 */

import { loadSeedFile } from "./external-memory.ts";

/** In-memory cache: "rootDir:componentPath" -> file content */
const cache = new Map<string, string>();

const PROMPTS_BASE = "prompts/";

/**
 * Load a single prompt component from external-memory/prompts/{componentPath}.
 * Returns `fallback` if the file does not exist. Results are cached for the
 * process lifetime — call clearPromptCache() between test cases to force
 * fresh loads.
 */
export async function loadPromptComponent(
  componentPath: string,
  fallback: string,
  rootDir?: string
): Promise<string> {
  const effectiveRoot = rootDir ?? process.cwd();
  const cacheKey = `${effectiveRoot}:${componentPath}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  const content = await loadSeedFile(PROMPTS_BASE + componentPath, fallback, effectiveRoot);
  cache.set(cacheKey, content);
  return content;
}

/**
 * Interpolate {{varName}} placeholders in a template string.
 * Unknown variables (not present in `vars` or mapped to undefined) are
 * left as-is so they are visible as unresolved markers.
 */
export function interpolatePrompt(
  template: string,
  vars: Record<string, string | undefined>
): string {
  return template.replace(/\{\{([^}#/][^}]*)\}\}/g, (_match, key) => {
    const value = vars[key.trim()];
    return value !== undefined ? value : _match;
  });
}

/**
 * Strip {{#if flag}}...{{/if}} blocks when the flag is false/absent.
 * Keeps the inner content (verbatim) when the flag is true. Supports both
 * inline and multi-line blocks. Does not support nesting.
 */
export function applyConditionals(
  template: string,
  flags: Record<string, boolean>
): string {
  return template.replace(
    /\{\{#if ([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, flagName, content) => (flags[flagName.trim()] ? content : "")
  );
}

/**
 * Load and compose multiple prompt components into a single string.
 *
 * Steps:
 * 1. Load each component file (or use per-path fallback).
 * 2. Concatenate with a single space.
 * 3. Apply conditional blocks ({{#if flag}}...{{/if}}).
 * 4. Interpolate template variables ({{varName}}).
 * 5. Trim the result.
 *
 * Non-empty parts are joined; empty parts (file missing + empty fallback)
 * are skipped to avoid spurious spaces.
 */
export async function composePromptBlock(
  componentPaths: string[],
  vars: Record<string, string | undefined>,
  flags?: Record<string, boolean>,
  fallbacks?: Record<string, string>,
  rootDir?: string
): Promise<string> {
  const parts = await Promise.all(
    componentPaths.map((path) =>
      loadPromptComponent(path, fallbacks?.[path] ?? "", rootDir)
    )
  );

  let combined = parts.filter((part) => part.trim()).join(" ");

  if (flags && Object.keys(flags).length > 0) {
    combined = applyConditionals(combined, flags);
  }

  combined = interpolatePrompt(combined, vars);
  return combined.trim();
}

/**
 * Clear the component cache. Call this in tests between cases that load
 * from different temp directories.
 */
export function clearPromptCache(): void {
  cache.clear();
}
