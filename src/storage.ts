import { join, resolve } from "node:path";

export interface StoragePaths {
  rootDir: string;
  storageDir: string;
  configPath: string;
  resourcesPath: string;
  sessionsPath: string;
  systemDir: string;
  secureDir: string;
  systemStatePath: string;
  orchestratorDir: string;
  orchestratorMemoryDir: string;
  orchestratorMemoryIndexPath: string;
  orchestratorMemorySummaryPath: string;
  directivesPath: string;
  roadmapPath: string;
  focusTodoPath: string;
  changelogPath: string;
  deviceInventoryPath: string;
  agentWorkflowPath: string;
  telemetryDir: string;
  auditLogPath: string;
  telemetrySummaryPath: string;
  agentsDir: string;
  agentsIndexPath: string;
}

export function getStoragePaths(rootDir = process.cwd()): StoragePaths {
  const resolvedRoot = resolve(rootDir);
  const storageDir = join(resolvedRoot, ".crusty");
  const systemDir = join(storageDir, "system");
  const secureDir = join(systemDir, "secure");
  const orchestratorDir = join(secureDir, "orchestrator");
  const orchestratorMemoryDir = join(orchestratorDir, "memory");
  const telemetryDir = join(orchestratorDir, "telemetry");
  const agentsDir = join(secureDir, "agents");

  return {
    rootDir: resolvedRoot,
    storageDir,
    configPath: join(storageDir, "config.json"),
    resourcesPath: join(storageDir, "resources.json"),
    sessionsPath: join(storageDir, "sessions.json"),
    systemDir,
    secureDir,
    systemStatePath: join(systemDir, "state.json"),
    orchestratorDir,
    orchestratorMemoryDir,
    orchestratorMemoryIndexPath: join(orchestratorMemoryDir, "index.json"),
    orchestratorMemorySummaryPath: join(orchestratorMemoryDir, "summary.md"),
    directivesPath: join(orchestratorDir, "directives.md"),
    roadmapPath: join(orchestratorDir, "roadmap.md"),
    focusTodoPath: join(orchestratorDir, "focus-todo.md"),
    changelogPath: join(orchestratorDir, "changelog.md"),
    deviceInventoryPath: join(orchestratorDir, "device-inventory.md"),
    agentWorkflowPath: join(orchestratorDir, "agent-new-workflow.md"),
    telemetryDir,
    auditLogPath: join(telemetryDir, "audit-log.jsonl"),
    telemetrySummaryPath: join(telemetryDir, "summary.json"),
    agentsDir,
    agentsIndexPath: join(agentsDir, "index.json")
  };
}
