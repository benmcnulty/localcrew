import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const loadedRoots = new Set<string>();
const LEGACY_PREFIX = `${"C"}RUSTY_`;

function parseEnvFile(content: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    let value = match[2].trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }

    values[key] = value
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'");
  }

  return values;
}

export function loadLocalEnv(rootDir = process.cwd()): void {
  const resolvedRoot = resolve(rootDir);
  if (loadedRoots.has(resolvedRoot)) {
    return;
  }

  const mergedValues: Record<string, string> = {};
  for (const fileName of [".env", ".env.local"]) {
    const path = join(resolvedRoot, fileName);
    if (!existsSync(path)) {
      continue;
    }

    Object.assign(mergedValues, parseEnvFile(readFileSync(path, "utf8")));
  }

  for (const [key, value] of Object.entries(mergedValues)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  loadedRoots.add(resolvedRoot);
}

export function getEnvString(name: string, fallback: string): string {
  const value = getEnvValue(name);
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }

  return value.trim();
}

export function getOptionalEnvString(name: string, fallback?: string): string | undefined {
  const value = getEnvValue(name);
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }

  return value.trim();
}

export function getEnvBoolean(name: string, fallback: boolean): boolean {
  const value = getEnvValue(name)?.trim().toLowerCase();
  if (!value) {
    return fallback;
  }

  if (["1", "true", "yes", "on"].includes(value)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value)) {
    return false;
  }

  return fallback;
}

export function getEnvNumber(name: string, fallback: number): number {
  const value = getEnvValue(name)?.trim();
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getEnvList(name: string, fallback: string[]): string[] {
  const value = getEnvValue(name);
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }

  const parsed = value
    .split("|")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");

  return parsed.length > 0 ? parsed : fallback;
}

function getEnvValue(name: string): string | undefined {
  if (name.startsWith("LOCALCREW_")) {
    const primary = process.env[name];
    if (typeof primary === "string" && primary.trim() !== "") {
      return primary;
    }
    const legacy = process.env[name.replace(/^LOCALCREW_/, LEGACY_PREFIX)];
    if (typeof legacy === "string" && legacy.trim() !== "") {
      return legacy;
    }
    return undefined;
  }

  if (name.startsWith(LEGACY_PREFIX)) {
    const migratedName = name.replace(new RegExp(`^${LEGACY_PREFIX}`), "LOCALCREW_");
    const migrated = process.env[migratedName];
    if (typeof migrated === "string" && migrated.trim() !== "") {
      return migrated;
    }
  }

  return process.env[name];
}
