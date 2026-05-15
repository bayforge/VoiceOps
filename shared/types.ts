export type VoiceIntent =
  | "BUILD_FEATURE"
  | "RUN_TESTS"
  | "FIX_ERRORS"
  | "SUMMARIZE_DIFF"
  | "CREATE_BRANCH"
  | "COMMIT_CHANGES"
  | "STOP_AGENT"
  | "APPROVE_ACTION"
  | "REJECT_ACTION"
  | "EXPLAIN_STATUS"
  | "DEMO_MODE"
  | "UNKNOWN";

export type RiskLevel = "low" | "medium" | "high";

export type VoiceAction = {
  intent: VoiceIntent;
  rawTranscript: string;
  normalizedText: string;
  confidence: number;
  payload?: Record<string, unknown>;
  requiresApproval: boolean;
  riskLevel: RiskLevel;
};

export type AgentEvent = {
  type:
    | "started"
    | "stdout"
    | "stderr"
    | "status"
    | "approval_required"
    | "completed"
    | "failed"
    | "stopped";
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
};

export type ValidationWorkflow = "build" | "test" | "typecheck";

export type AgentTask = {
  id: string;
  type:
    | "feature"
    | "test"
    | "fix"
    | "summarize"
    | "branch"
    | "commit"
    | "demo";
  prompt: string;
  repoRoot: string;
  requiresApproval: boolean;
  approved: boolean;
  workflow?: ValidationWorkflow;
};

export type AgentStatus = "idle" | "running" | "waiting_approval" | "complete" | "failed" | "stopped";

export type VoiceSttMode = "mock" | "elevenlabs";

export type VoiceTtsMode = "browser" | "elevenlabs";

export type PublicVoiceConfig = {
  sttMode: VoiceSttMode;
  ttsMode: VoiceTtsMode;
  elevenLabsConfigured: boolean;
  elevenLabsVoiceConfigured: boolean;
  sttModelId: string;
  ttsModelId: string;
};

export type VoiceConfig = PublicVoiceConfig & {
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
  ttsOutputFormat: string;
  realtimeSttUrl: string;
  tokenUrl: string;
  ttsStreamUrl: string;
};

export type ElevenLabsSttSession =
  | {
      available: false;
      reason: string;
    }
  | {
      available: true;
      token: string;
      websocketUrl: string;
    };

export type PendingApproval = {
  id: string;
  kind: "commit" | "branch" | "risky_action";
  message: string;
  createdAt: string;
  action: VoiceAction;
};

export type VoiceOpsState = {
  connectionStatus: "connected" | "disconnected";
  microphoneStatus: "idle" | "listening" | "mock";
  currentTranscript: string;
  parsedIntent: VoiceIntent;
  riskLevel: RiskLevel;
  pendingApproval: PendingApproval | null;
  agentStatus: AgentStatus;
  terminalLogs: AgentEvent[];
  diffSummary: string;
  lastSpokenResponse: string;
  demoMode: boolean;
  updatedAt: string;
};

export type SafetyResult = {
  allowed: boolean;
  requiresApproval: boolean;
  riskLevel: RiskLevel;
  reasons: string[];
};

export type RunnerMode = "mock" | "shell";

export type ConfiguredCommand = {
  name: string;
  raw: string;
  executable: string;
  args: string[];
  cwd: string;
  repoRoot: string;
};

export type CommandConfig = {
  agent?: ConfiguredCommand;
  build: ConfiguredCommand;
  test: ConfiguredCommand;
  typecheck: ConfiguredCommand;
};

export type AppConfig = {
  port?: number;
  repoRoot: string;
  runnerMode: RunnerMode;
  commands: CommandConfig;
  voice: VoiceConfig;
};
