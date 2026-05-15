import type { VoiceOpsState } from "../../shared/types";

export type StudioWorkflowState = "pending" | "active" | "complete" | "blocked" | "failed";

export type StudioWorkflowItem = {
  label: "Listening" | "Thinking" | "Planning" | "Coding" | "Testing" | "Speaking";
  detail: string;
  state: StudioWorkflowState;
};

const hasTranscript = (state: VoiceOpsState): boolean => state.currentTranscript.trim().length > 0;

const hasClassifiedIntent = (state: VoiceOpsState): boolean => state.parsedIntent !== "UNKNOWN";

const isValidationIntent = (state: VoiceOpsState): boolean => state.parsedIntent === "RUN_TESTS";

const isBuildIntent = (state: VoiceOpsState): boolean =>
  state.parsedIntent === "BUILD_FEATURE" || state.parsedIntent === "FIX_ERRORS";

export const buildStudioWorkflow = (state: VoiceOpsState): StudioWorkflowItem[] => {
  const transcriptReady = hasTranscript(state);
  const classified = hasClassifiedIntent(state);
  const validationIntent = isValidationIntent(state);
  const buildIntent = isBuildIntent(state);
  const agentFailed = state.agentStatus === "failed" || state.agentStatus === "stopped";
  const agentComplete = state.agentStatus === "complete";
  const agentRunning = state.agentStatus === "running";

  return [
    {
      label: "Listening",
      detail:
        state.microphoneStatus === "listening"
          ? "Capturing voice input."
          : transcriptReady
            ? "Command captured."
            : "Waiting for voice or typed input.",
      state: state.microphoneStatus === "listening" ? "active" : transcriptReady ? "complete" : "pending"
    },
    {
      label: "Thinking",
      detail: classified ? `Intent classified as ${state.parsedIntent}.` : "Understanding the command.",
      state: classified ? "complete" : transcriptReady ? "active" : "pending"
    },
    {
      label: "Planning",
      detail: state.pendingApproval
        ? state.pendingApproval.message
        : classified
          ? `Safety check finished with ${state.riskLevel} risk.`
          : "Waiting for intent and safety check.",
      state: state.pendingApproval ? "blocked" : classified ? "complete" : "pending"
    },
    {
      label: "Coding",
      detail:
        agentRunning && buildIntent
          ? "Agent is applying code changes."
          : agentComplete || (agentRunning && validationIntent)
            ? "Code step is ready."
            : agentFailed
              ? "Agent needs recovery."
              : "Ready when a build or fix command arrives.",
      state: agentRunning && buildIntent ? "active" : agentFailed ? "failed" : agentComplete || validationIntent ? "complete" : "pending"
    },
    {
      label: "Testing",
      detail:
        agentRunning && validationIntent
          ? "Validation workflow is streaming terminal output."
          : agentComplete && validationIntent
            ? "Validation workflow complete."
            : agentFailed && validationIntent
              ? "Validation needs a fix command."
              : "Waiting for build, test, or typecheck.",
      state:
        agentRunning && validationIntent
          ? "active"
          : agentFailed && validationIntent
            ? "failed"
            : agentComplete && validationIntent
              ? "complete"
              : "pending"
    },
    {
      label: "Speaking",
      detail: state.lastSpokenResponse || "Waiting to speak.",
      state: state.lastSpokenResponse ? "complete" : "pending"
    }
  ];
};
