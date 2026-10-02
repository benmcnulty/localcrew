// Exercise the documented Node entrypoint without touching a real crew or model.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));
assert.equal(packageJson.scripts.start, "node src/index.ts");
const rootDir = await mkdtemp(join(tmpdir(), "localcrew-node-startup-"));

try {
  for (const path of ["src", "package.json", "external-memory"]) {
    await cp(join(repoRoot, path), join(rootDir, path), { recursive: true });
  }
  // Do not inherit endpoint, auth, portal, or auto-run settings from the host.
  const env = Object.fromEntries(
    ["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "LANG"].flatMap((key) =>
      process.env[key] === undefined ? [] : [[key, process.env[key]]]
    )
  );
  env.LOCALCREW_API_ENABLED = "true";
  env.LOCALCREW_API_BIND_HOST = "127.0.0.1";
  env.LOCALCREW_API_PORT = "0";
  env.LOCALCREW_API_TOKEN = "startup-test-token";
  env.LOCALCREW_SOUND_ENABLED = "false";
  env.LOCALCREW_ORCHESTRATOR_BASE_URL = "http://127.0.0.1:9";

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["src/index.ts"], {
      cwd: rootDir,
      env,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let output = "";
    let errors = "";
    let sentExit = false;
    let timedOut = false;
    let smokeError;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 15_000);
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      // Wait for the CLI question, so input is not lost during initialization.
      if (!sentExit && output.includes("Resources")) {
        sentExit = true;
        setTimeout(async () => {
          try {
            const uiUrl = output.match(/http:\/\/127\.0\.0\.1:\d+\/ui/)?.[0];
            assert.ok(uiUrl, "Node entrypoint did not start its HTTP API");
            const apiUrl = uiUrl.slice(0, -3);
            const options = { signal: AbortSignal.timeout(5_000) };
            assert.equal((await fetch(`${apiUrl}/api/health`, options)).status, 200);
            assert.equal((await fetch(`${apiUrl}/api/resources`, options)).status, 200);
            for (const method of ["POST", "DELETE"]) {
              assert.equal((await fetch(`${apiUrl}/api/resources`, { ...options, method })).status, 401);
            }
            child.stdin.end("/exit\n");
          } catch (error) {
            smokeError = error;
            child.kill();
          }
        }, 50);
      }
    });
    child.stderr.on("data", (chunk) => { errors += chunk.toString(); });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      try {
        if (smokeError) throw smokeError;
        assert.equal(code, 0, `Node entrypoint failed: ${errors}`);
        assert.ok(!timedOut, "Node startup/shutdown exceeded 15 seconds");
        assert.ok(sentExit, "CLI did not reach its resource inventory");
        assert.ok(!errors.includes("Fatal error:"), errors);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
  console.log(`Node startup, HTTP auth, and /exit passed on ${process.version}; temporary state removed.`);
} finally {
  await rm(rootDir, { recursive: true, force: true });
}
