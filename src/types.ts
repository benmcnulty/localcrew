export type Role = "system" | "user" | "assistant";
export type EndpointApiStyle = "ollama" | "openai" | "anthropic";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface EndpointConfig {
  resourceAlias: string;
  nickname: string;
  baseUrl: string;
  apiStyle?: EndpointApiStyle;
  apiKeyEnv?: string;
  model: string;
  instructions: string;
  voicePreset: string;
}

export interface AppConfig {
  orchestratorName: string;
  defaultEndpoint: string;
  soundEnabled: boolean;
  endpoints: Record<string, EndpointConfig>;
}

export interface UserConversationMessage {
  speaker: "user";
  target: string;
  content: string;
}

export interface AssistantConversationMessage {
  speaker: "assistant";
  endpoint: string;
  content: string;
  directedTo?: string;
}

export type ConversationMessage = UserConversationMessage | AssistantConversationMessage;

export interface SharedConversationState {
  messages: ConversationMessage[];
  compactedUntil: number;
  summary: string;
}

export interface SessionsFile {
  conversation: SharedConversationState;
}

export type TaskPriority = "high" | "medium" | "low";

export interface AutoQueueTask {
  id: number;
  content: string;
  priority: TaskPriority;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  createdBy: string;
  status: "queued" | "completed";
  delegationRole?: string;
  requestedResource?: string;
  requestedModel?: string;
  assignedResource?: string;
  assignedModel?: string;
  agentName?: string;
  result?: string;
  errorMessage?: string;
  sourceDocumentRelativePath?: string;
  sourceDocumentName?: string;
}

export interface AutoState {
  enabled: boolean;
  defaultPriority: TaskPriority;
  lastTaskId: number;
  pending: AutoQueueTask[];
  completed: AutoQueueTask[];
}

export interface SystemState {
  auto: AutoState;
}

export interface AgentMeta {
  slug: string;
  name: string;
  summary: string;
  preferredResource: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentCreateAnswers {
  name: string;
  summary: string;
  mission: string;
  style: string;
  skills: string;
  preferredResource: string;
}

export interface AgentMemoryFile {
  conversation: SharedConversationState;
}

export interface EditRequest {
  kind: "instructions" | "agentSpec" | "resource" | "participant";
  target: string;
  prompt: string;
  initialText: string;
}

export interface WorkflowQuestion {
  key: keyof AgentCreateAnswers;
  prompt: string;
}

export interface WorkflowRequest {
  kind: "agent.create";
  introLines: string[];
  questions: WorkflowQuestion[];
}

export interface ViewerRequest {
  kind: "status" | "explore" | "hud";
}

export type ReplMode = "command" | "chat" | "group" | "auto" | "agent";

export interface RuntimeState {
  mode: ReplMode;
  currentEndpoint: string;
  currentAgent?: string;
}

export interface FollowUpRequest {
  fromAlias: string;
  toAlias: string;
  message: string;
}

export interface OllamaChatResult {
  text: string;
  totalDuration?: number;
  loadDuration?: number;
  promptEvalCount?: number;
  promptEvalDuration?: number;
  evalCount?: number;
  evalDuration?: number;
}

export interface AuditEvent {
  id: number;
  timestamp: string;
  kind: "ollama.chat" | "wikipedia.search" | "system";
  scope: string;
  summary: string;
  success: boolean;
  actor?: string;
  resourceAlias?: string;
  target?: string;
  model?: string;
  durationMs?: number;
  promptMessageCount?: number;
  promptChars?: number;
  responseChars?: number;
  promptEvalCount?: number;
  evalCount?: number;
  requestMessages?: ChatMessage[];
  responseText?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface TelemetryMetricBucket {
  calls: number;
  errors: number;
  totalDurationMs: number;
  promptEvalCount: number;
  evalCount: number;
  promptChars: number;
  responseChars: number;
}

export interface TelemetryRecentEvent {
  id: number;
  timestamp: string;
  kind: string;
  scope: string;
  summary: string;
  success: boolean;
}

export interface TelemetrySummary {
  updatedAt: string | null;
  totalEvents: number;
  lastEventId: number;
  byKind: Record<string, number>;
  byScope: Record<string, number>;
  models: Record<string, TelemetryMetricBucket>;
  resources: Record<string, TelemetryMetricBucket>;
  wikipedia: {
    calls: number;
    errors: number;
    totalDurationMs: number;
    recentQueries: string[];
  };
  recent: TelemetryRecentEvent[];
}

export interface ResourceSyncReport {
  alias: string;
  label: string;
  baseUrl: string;
  apiStyle?: EndpointApiStyle;
  apiKeyEnv?: string;
  deviceId?: string;
  tier?: "top" | "mid" | "low";
  hostName?: string;
  platform?: string;
  cpuLogicalCores?: number;
  ramGb?: number;
  gpuModel?: string;
  gpuCount?: number;
  totalVramGb?: number;
  maxContextTokens?: number;
  defaultModel?: string;
  reasoningModel?: string;
  codingModel?: string;
  toolsModel?: string;
  embeddingModel?: string;
  availableModels?: string[];
  endpointVersion?: string;
  capabilities?: string[];
  notes?: string[];
}

export interface WikipediaSearchPage {
  pageId: number;
  title: string;
  url: string;
  excerpt: string;
}

export interface WikipediaSearchResult {
  query: string;
  durationMs: number;
  pages: WikipediaSearchPage[];
  chunks: string[];
}

export type Command =
  | { type: "message"; text: string; alias?: string }
  | { type: "crosstalk"; fromAlias: string; toAlias: string; text: string }
  | { type: "chatMode" }
  | { type: "groupMode" }
  | { type: "autoMode" }
  | { type: "stopAuto" }
  | { type: "status" }
  | { type: "hud" }
  | { type: "explore" }
  | { type: "login" }
  | { type: "endMode" }
  | { type: "help" }
  | { type: "priority.get" }
  | { type: "priority.set"; priority: TaskPriority }
  | { type: "agent.list" }
  | { type: "agent.new" }
  | { type: "agent.chat"; name: string }
  | { type: "agent.edit"; name: string }
  | { type: "participant.list" }
  | { type: "participant.add"; alias: string; resourceAlias: string; nickname?: string }
  | { type: "participant.edit"; alias: string }
  | { type: "participant.remove"; alias: string }
  | { type: "resource.list" }
  | {
      type: "resource.add";
      alias: string;
      label: string;
      baseUrl: string;
      tier?: "top" | "mid" | "low";
      apiStyle?: EndpointApiStyle;
    }
  | { type: "resource.edit"; alias: string }
  | { type: "resource.refresh"; alias: string }
  | { type: "resource.remove"; alias: string }
  | { type: "models.list"; target?: string }
  | { type: "directChat"; resourceAlias: string; model?: string; text: string }
  | { type: "model.get" }
  | { type: "model.set"; alias: string }
  | { type: "model.assign"; alias: string; model: string }
  | { type: "default.get" }
  | { type: "default.set"; alias: string }
  | { type: "nickname.get"; alias?: string }
  | { type: "nickname.set"; alias?: string; nickname: string }
  | { type: "bind.get"; alias?: string }
  | { type: "bind.set"; alias?: string; resourceAlias: string }
  | { type: "orchestrator.get" }
  | { type: "orchestrator.set"; name: string }
  | { type: "rename"; fromAlias: string; toAlias: string }
  | { type: "sound.toggle" }
  | { type: "sound.set"; enabled: boolean }
  | { type: "voice.list" }
  | { type: "voice.get"; alias?: string }
  | { type: "voice.set"; alias?: string; preset: string }
  | { type: "instructions.edit"; alias?: string }
  | { type: "instructions.set"; alias?: string; text: string }
  | { type: "compact" }
  | { type: "clear" }
  | { type: "reset" }
  | { type: "exit" };
