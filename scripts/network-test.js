#!/usr/bin/env node

/**
 * Network connectivity test for Local Crew devices.
 *
 * Usage:
 *   node scripts/network-test.js                          # test local ports only
 *   node scripts/network-test.js <orchestrator-ip>        # test orchestrator at IP
 *   node scripts/network-test.js <orchestrator-ip> <agent-ip>  # test orchestrator + agent devices
 *
 * Tests:
 *   - Local Ollama (127.0.0.1:11434)
 *   - Local Crew API (127.0.0.1:4310)
 *   - Remote Ollama on each target IP (:11434)
 *   - Remote Crew API on each target IP (:4310)
 *   - Remote agent gateway on each target IP (:4311)
 *   - Detects processes already using key ports
 */

import { networkInterfaces } from "node:os";
import { createConnection } from "node:net";

const PORTS = {
  ollama: 11434,
  crewApi: 4310,
  agentGateway: 4311,
};

const TIMEOUT_MS = 3000;

function detectLocalIp() {
  const interfaces = networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }
  return undefined;
}

function testTcpPort(host, port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port, timeout: TIMEOUT_MS });
    socket.on("connect", () => {
      socket.destroy();
      resolve({ host, port, reachable: true });
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ host, port, reachable: false, reason: "timeout" });
    });
    socket.on("error", (error) => {
      socket.destroy();
      resolve({ host, port, reachable: false, reason: error.code ?? error.message });
    });
  });
}

async function testHttpEndpoint(url, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    let body = "";
    try {
      body = await response.text();
    } catch { /* ignore */ }
    return { url, label, ok: response.ok, status: response.status, body: body.slice(0, 200) };
  } catch (error) {
    clearTimeout(timer);
    return { url, label, ok: false, status: 0, error: error.code ?? error.message };
  }
}

function pad(str, len) {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

function icon(ok) {
  return ok ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✘\x1b[0m";
}

async function main() {
  const targets = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  const localIp = detectLocalIp();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Local Crew — Network Connectivity Test");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  This device: ${localIp ?? "(no LAN IP detected)"}`);
  console.log(`  Targets:     ${targets.length > 0 ? targets.join(", ") : "(local only)"}`);
  console.log("");

  // Phase 1: Local port checks
  console.log("── Local Ports ──────────────────────────────────");
  const localChecks = [
    { host: "127.0.0.1", port: PORTS.ollama, label: "Ollama" },
    { host: "127.0.0.1", port: PORTS.crewApi, label: "Crew API" },
    { host: "127.0.0.1", port: PORTS.agentGateway, label: "Agent Gateway" },
  ];

  const localResults = await Promise.all(
    localChecks.map((c) => testTcpPort(c.host, c.port))
  );

  for (let i = 0; i < localChecks.length; i++) {
    const c = localChecks[i];
    const r = localResults[i];
    const status = r.reachable ? "open" : r.reason ?? "closed";
    console.log(`  ${icon(r.reachable)} ${pad(c.label, 16)} ${c.host}:${c.port}  ${status}`);
  }
  console.log("");

  // Phase 2: Local HTTP endpoint checks
  console.log("── Local HTTP Endpoints ─────────────────────────");
  const localHttpChecks = [
    { url: "http://127.0.0.1:11434/api/version", label: "Ollama /api/version" },
    { url: "http://127.0.0.1:11434/api/tags", label: "Ollama /api/tags" },
    { url: "http://127.0.0.1:4310/api/health", label: "Crew API /api/health" },
  ];

  const localHttpResults = await Promise.all(
    localHttpChecks.map((c) => testHttpEndpoint(c.url, c.label))
  );

  for (const r of localHttpResults) {
    const status = r.ok
      ? `HTTP ${r.status} — ${r.body.slice(0, 60)}`
      : r.error
        ? r.error
        : `HTTP ${r.status}`;
    console.log(`  ${icon(r.ok)} ${pad(r.label, 22)} ${status}`);
  }
  console.log("");

  // Phase 3: Remote target checks
  if (targets.length === 0) {
    console.log("── No remote targets specified ──────────────────");
    console.log("  Pass IP addresses as arguments to test remote devices:");
    console.log("  node scripts/network-test.js <orchestrator-ip> <agent-ip>");
    console.log("");
    summarize(localResults, []);
    return;
  }

  const allRemoteResults = [];

  for (const target of targets) {
    console.log(`── Remote: ${target} ─────────────────────────────`);

    // TCP port checks
    const remotePortChecks = [
      { host: target, port: PORTS.ollama, label: "Ollama" },
      { host: target, port: PORTS.crewApi, label: "Crew API" },
      { host: target, port: PORTS.agentGateway, label: "Agent Gateway" },
    ];

    const remotePortResults = await Promise.all(
      remotePortChecks.map((c) => testTcpPort(c.host, c.port))
    );

    for (let i = 0; i < remotePortChecks.length; i++) {
      const c = remotePortChecks[i];
      const r = remotePortResults[i];
      const status = r.reachable ? "open" : r.reason ?? "closed";
      console.log(`  ${icon(r.reachable)} ${pad(c.label, 16)} ${target}:${c.port}  ${status}`);
    }

    // HTTP endpoint checks
    const remoteHttpChecks = [
      { url: `http://${target}:11434/api/version`, label: "Ollama version" },
      { url: `http://${target}:11434/api/tags`, label: "Ollama models" },
      { url: `http://${target}:4310/api/health`, label: "Crew API health" },
    ];

    const remoteHttpResults = await Promise.all(
      remoteHttpChecks.map((c) => testHttpEndpoint(c.url, c.label))
    );

    for (const r of remoteHttpResults) {
      const status = r.ok
        ? `HTTP ${r.status} — ${r.body.slice(0, 60)}`
        : r.error
          ? r.error
          : `HTTP ${r.status}`;
      console.log(`  ${icon(r.ok)} ${pad(r.label, 22)} ${status}`);
    }

    allRemoteResults.push(...remotePortResults);
    console.log("");
  }

  summarize(localResults, allRemoteResults);
}

function summarize(localResults, remoteResults) {
  const localOpen = localResults.filter((r) => r.reachable).length;
  const remoteOpen = remoteResults.filter((r) => r.reachable).length;
  const totalChecks = localResults.length + remoteResults.length;
  const totalOpen = localOpen + remoteOpen;

  console.log("── Summary ─────────────────────────────────────");
  console.log(`  ${totalOpen}/${totalChecks} ports reachable`);

  // Specific guidance
  const localOllama = localResults.find((r) => r.port === PORTS.ollama);
  const localApi = localResults.find((r) => r.port === PORTS.crewApi);

  if (localOllama && !localOllama.reachable) {
    console.log("");
    console.log("  \x1b[33m⚠ Local Ollama is not running.\x1b[0m");
    console.log("    Start it with: ollama serve");
  }

  if (localApi && !localApi.reachable) {
    console.log("");
    console.log("  \x1b[33m⚠ Local Crew API is not running on port 4310.\x1b[0m");
    console.log("    If this is the orchestrator, start it with: npm run start");
    console.log("    If port is in use: kill $(lsof -t -i :4310) && npm run start");
  }

  const remoteUnreachable = remoteResults.filter((r) => !r.reachable);
  if (remoteUnreachable.length > 0) {
    const byHost = {};
    for (const r of remoteUnreachable) {
      if (!byHost[r.host]) byHost[r.host] = [];
      byHost[r.host].push(r);
    }
    for (const [host, failures] of Object.entries(byHost)) {
      const ports = failures.map((f) => f.port).join(", ");
      const reasons = [...new Set(failures.map((f) => f.reason))].join(", ");
      console.log("");
      console.log(`  \x1b[33m⚠ ${host} — unreachable ports: ${ports} (${reasons})\x1b[0m`);
      if (reasons.includes("ECONNREFUSED")) {
        console.log("    The device is reachable but the service is not running.");
        console.log("    Start ollama serve and/or npm run start on that device.");
      }
      if (reasons.includes("timeout")) {
        console.log("    Firewall or network issue — the port is blocked or the device is offline.");
        console.log("    Check: macOS System Settings > Network > Firewall");
        console.log("    Or allow the port: sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/ollama");
      }
      if (reasons.includes("EHOSTUNREACH") || reasons.includes("ENETUNREACH")) {
        console.log("    Device is not on the same network or is powered off.");
      }
    }
  }

  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((error) => {
  console.error(`Network test failed: ${error.message}`);
  process.exitCode = 1;
});
