#!/usr/bin/env node
/**
 * LocalCrew Developer CLI
 * Inspect the live system from a separate terminal.
 *
 * Usage:
 *   node scripts/localcrew-cli.js status
 *   node scripts/localcrew-cli.js queue
 *   node scripts/localcrew-cli.js audit [--limit=50]
 *   node scripts/localcrew-cli.js resources
 *   node scripts/localcrew-cli.js command "message text"
 *   node scripts/localcrew-cli.js watch   (polls /api/status every 3s)
 *
 * Environment:
 *   LOCALCREW_API_URL    (default: http://127.0.0.1:4310)
 *   LOCALCREW_API_TOKEN  (optional bearer token)
 */

const BASE_URL = process.env.LOCALCREW_API_URL ?? "http://127.0.0.1:4310";
const TOKEN = process.env.LOCALCREW_API_TOKEN ?? "";

const ARGS = process.argv.slice(2);
const CMD = ARGS[0] ?? "status";

function headers() {
  const h = { "Content-Type": "application/json" };
  if (TOKEN) h["Authorization"] = `Bearer ${TOKEN}`;
  return h;
}

async function fetchJson(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} from ${path}`);
  return res.json();
}

async function postJson(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} from ${path}`);
  return res.json();
}

function fmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function printStatus(data) {
  const auto = data.auto ?? {};
  const capacityLine =
    auto.availableResourceCount != null || auto.parallelCycleLimit != null
      ? `  Capacity     : ${auto.availableResourceCount ?? "?"} resources  Slots: ${auto.availableCycleSlots ?? 0}/${auto.parallelCycleLimit ?? 0}`
      : null;
  const lines = [
    `\x1b[1mLocalCrew Status\x1b[0m`,
    `  Orchestrator : ${data.orchestratorName ?? "?"} (@${data.orchestratorAlias ?? "?"})`,
    `  Mode         : /${data.mode ?? "?"}`,
    `  Auto busy    : ${auto.busy ? "\x1b[33mYES\x1b[0m" : "no"}`,
    `  Pending      : ${auto.pendingCount ?? 0}${auto.desiredPendingDepth ? ` / ${auto.desiredPendingDepth} target` : ""}  Completed: ${fmt(auto.completedCount ?? 0)}`,
    `  Priority     : ${auto.defaultPriority ?? "?"}`,
    `  Model profile: ${data.modelProfile ?? "?"}`,
    capacityLine
  ].filter(Boolean);
  console.log(lines.join("\n"));
}

function printQueue(data) {
  const active = data.activeTasks ?? [];
  const pending = data.pending ?? [];
  const target = data.desiredPendingDepth ? ` / target ${data.desiredPendingDepth}` : "";
  console.log(`\x1b[1mQueue\x1b[0m  (${active.length} active, ${pending.length} pending${target})`);
  for (const t of active) {
    const res = t.assignedResource ?? t.requestedResource ?? "?";
    console.log(`  \x1b[33m▶ [ACTIVE] @${res} [${t.priority ?? "?"}]\x1b[0m — ${t.content.slice(0, 120)}`);
  }
  for (let i = 0; i < pending.length; i++) {
    const t = pending[i];
    const res = t.requestedResource ?? t.assignedResource;
    const resPart = res ? ` @${res}` : "";
    console.log(`  ${i + 1}. [${t.priority}]${resPart} ${t.content.slice(0, 100)}`);
  }
  if (!active.length && !pending.length) console.log("  (empty)");
}

function printResources(data) {
  console.log(`\x1b[1mResources\x1b[0m  (${data.length})`);
  for (const r of data) {
    const role = r.shipRole ?? r.tier ?? "?";
    const model = r.defaultModel ?? "?";
    console.log(`  @${r.alias.padEnd(12)} ${role.padEnd(8)} ${r.tier.padEnd(4)} ${r.label ?? ""} — ${model}`);
  }
}

function printAudit(data) {
  console.log(`\x1b[1mAudit Log\x1b[0m  (${data.length} events)`);
  for (const e of data) {
    const t = new Date(e.timestamp).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const ok = e.success ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
    console.log(`  ${ok} ${t} [${e.kind}] ${e.summary}`);
  }
}

async function runStatus() {
  const data = await fetchJson("/api/status");
  printStatus(data);
}

async function runQueue() {
  const data = await fetchJson("/api/queue");
  printQueue(data);
}

async function runResources() {
  const data = await fetchJson("/api/resources");
  printResources(data);
}

async function runAudit() {
  const limitArg = ARGS.find(a => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 50;
  const data = await fetchJson(`/api/audit?limit=${limit}`);
  printAudit(data);
}

async function runCommand() {
  const text = ARGS[1];
  if (!text) { console.error("Usage: localcrew-cli.js command <text>"); process.exit(1); }
  const data = await postJson("/api/command", { text });
  console.log(JSON.stringify(data, null, 2));
}

async function runWatch() {
  console.log(`Watching ${BASE_URL} — Ctrl+C to stop`);
  const poll = async () => {
    try {
      const [status, queue] = await Promise.all([
        fetchJson("/api/status"),
        fetchJson("/api/queue")
      ]);
      process.stdout.write("\x1b[2J\x1b[H"); // clear screen
      console.log(`\x1b[2m${new Date().toLocaleTimeString()}\x1b[0m\n`);
      printStatus(status);
      console.log();
      printQueue(queue);
    } catch (err) {
      console.error(`\x1b[31mError: ${err.message}\x1b[0m`);
    }
  };
  await poll();
  setInterval(poll, 3000);
}

const COMMANDS = { status: runStatus, queue: runQueue, resources: runResources, audit: runAudit, command: runCommand, watch: runWatch };

if (!COMMANDS[CMD]) {
  console.error(`Unknown command: ${CMD}\nAvailable: ${Object.keys(COMMANDS).join(", ")}`);
  process.exit(1);
}

COMMANDS[CMD]().catch(err => {
  console.error(`\x1b[31mError: ${err.message}\x1b[0m`);
  process.exit(1);
});
