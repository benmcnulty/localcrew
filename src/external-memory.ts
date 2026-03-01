import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface BuiltinAgentSeed {
  name: string;
  slug: string;
  summary: string;
  preferredResource: string;
  spec: string;
}

interface BuiltinAgentSeedConfig {
  name?: unknown;
  slug?: unknown;
  summary?: unknown;
  preferredResource?: unknown;
}

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function getExternalMemoryDir(rootDir = process.cwd()): string {
  const localDir = join(rootDir, "external-memory");
  if (existsSync(localDir)) {
    return localDir;
  }

  const moduleDir = dirname(fileURLToPath(import.meta.url));
  return resolve(moduleDir, "..", "external-memory");
}

export async function loadSeedFile(
  relativePath: string,
  fallback: string,
  rootDir = process.cwd()
): Promise<string> {
  try {
    return await readFile(join(getExternalMemoryDir(rootDir), relativePath), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

export async function loadBuiltinAgentSeeds(
  rootDir = process.cwd()
): Promise<BuiltinAgentSeed[]> {
  const agentsDir = join(getExternalMemoryDir(rootDir), "agents");

  let entries;
  try {
    entries = await readdir(agentsDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const seeds = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const seedDir = join(agentsDir, entry.name);
        const [rawConfig, spec] = await Promise.all([
          readFile(join(seedDir, "agent.json"), "utf8"),
          readFile(join(seedDir, "spec.md"), "utf8")
        ]);

        const parsed = JSON.parse(rawConfig) as BuiltinAgentSeedConfig;
        if (typeof parsed.name !== "string" || parsed.name.trim() === "") {
          throw new Error(`Builtin agent seed "${entry.name}" is missing a valid name.`);
        }

        if (typeof parsed.summary !== "string" || parsed.summary.trim() === "") {
          throw new Error(`Builtin agent seed "${entry.name}" is missing a valid summary.`);
        }

        if (
          typeof parsed.preferredResource !== "string" ||
          parsed.preferredResource.trim() === ""
        ) {
          throw new Error(
            `Builtin agent seed "${entry.name}" is missing a valid preferredResource.`
          );
        }

        const slug = normalizeSlug(
          typeof parsed.slug === "string" && parsed.slug.trim() !== "" ? parsed.slug : entry.name
        );
        if (!slug) {
          throw new Error(`Builtin agent seed "${entry.name}" resolved to an empty slug.`);
        }

        return {
          name: parsed.name.trim(),
          slug,
          summary: parsed.summary.trim(),
          preferredResource: parsed.preferredResource.trim().toLowerCase(),
          spec: spec.trimEnd()
        } satisfies BuiltinAgentSeed;
      })
  );

  return seeds.sort((left, right) => left.slug.localeCompare(right.slug));
}
