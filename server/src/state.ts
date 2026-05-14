import type { AgentEvent, VoiceOpsState } from "../../shared/types.js";

export const createInitialState = (): VoiceOpsState => ({
  connectionStatus: "connected",
  microphoneStatus: "mock",
  currentTranscript: "",
  parsedIntent: "UNKNOWN",
  riskLevel: "low",
  pendingApproval: null,
  agentStatus: "idle",
  terminalLogs: [],
  diffSummary: "",
  gitStatus: "",
  lastSpokenResponse: "Say a coding task to begin.",
  demoMode: false,
  updatedAt: new Date().toISOString()
});

export const pushTerminalEvent = (state: VoiceOpsState, event: AgentEvent): VoiceOpsState => ({
  ...state,
  terminalLogs: [...state.terminalLogs, event].slice(-160),
  agentStatus:
    event.type === "started"
      ? "running"
      : event.type === "completed"
        ? "complete"
        : event.type === "failed"
          ? "failed"
          : event.type === "stopped"
            ? "stopped"
            : state.agentStatus,
  updatedAt: new Date().toISOString()
});

export const systemEvent = (type: AgentEvent["type"], message: string, data?: Record<string, unknown>): AgentEvent => ({
  type,
  message,
  timestamp: new Date().toISOString(),
  data
});
