export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface EndpointConfig {
  baseUrl: string;
  model: string;
  instructions: string;
  voicePreset: string;
}

export interface AppConfig {
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
  createdBy: string;
  status: "queued" | "completed";
  requestedResource?: string;
  assignedResource?: string;
  assignedModel?: string;
  agentName?: string;
  result?: string;
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
  kind: "instructions" | "agentSpec";
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
  kind: "status" | "explore";
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

export type Command =
  | { type: "message"; text: string; alias?: string }
  | { type: "crosstalk"; fromAlias: string; toAlias: string; text: string }
  | { type: "chatMode" }
  | { type: "groupMode" }
  | { type: "autoMode" }
  | { type: "stopAuto" }
  | { type: "status" }
  | { type: "explore" }
  | { type: "endMode" }
  | { type: "help" }
  | { type: "priority.get" }
  | { type: "priority.set"; priority: TaskPriority }
  | { type: "agent.list" }
  | { type: "agent.new" }
  | { type: "agent.chat"; name: string }
  | { type: "agent.edit"; name: string }
  | { type: "model.get" }
  | { type: "model.set"; alias: string }
  | { type: "default.get" }
  | { type: "default.set"; alias: string }
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
