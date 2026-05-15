import type { VoiceOpsState } from "../../shared/types";

export type TimelineState = "pending" | "active" | "complete" | "blocked" | "failed";

export type StatusTimelineItem = {
  label: string;
  detail: string;
  state: TimelineState;
};

const transcriptItem = (state: VoiceOpsState): StatusTimelineItem => ({
  label: "Transcript",
  detail: state.currentTranscript ? "Command captured." : "Waiting for voice or typed input.",
  state: state.currentTranscript ? "complete" : "active"
});

const intentItem = (state: VoiceOpsState): StatusTimelineItem => ({
  label: "Intent",
  detail: state.parsedIntent === "UNKNOWN" ? "No intent classified yet." : state.parsedIntent,
  state: state.parsedIntent === "UNKNOWN" ? "pending" : "complete"
});

const safetyItem = (state: VoiceOpsState): StatusTimelineItem => {
  if (state.pendingApproval) {
    return {
      label: "Approval",
      detail: state.pendingApproval.message,
      state: "blocked"
    };
  }

  if (state.parsedIntent === "UNKNOWN") {
    return {
      label: "Safety check",
      detail: "Waiting for a clear command.",
      state: "pending"
    };
  }

  return {
    label: "Safety check",
    detail: `Risk level: ${state.riskLevel}.`,
    state: "complete"
  };
};

const agentItem = (state: VoiceOpsState): StatusTimelineItem => {
  const logCount = state.terminalLogs.length;
  const logSuffix = logCount === 1 ? "event" : "events";

  if (state.agentStatus === "running") {
    return {
      label: "Agent task",
      detail: `Streaming ${logCount} terminal ${logSuffix}.`,
      state: "active"
    };
  }

  if (state.agentStatus === "waiting_approval") {
    return {
      label: "Agent task",
      detail: "Paused until approval.",
      state: "blocked"
    };
  }

  if (state.agentStatus === "failed" || state.agentStatus === "stopped") {
    return {
      label: "Agent task",
      detail: state.agentStatus === "failed" ? "Needs a fix command." : "Stopped by request.",
      state: "failed"
    };
  }

  if (state.agentStatus === "complete") {
    return {
      label: "Agent task",
      detail: logCount > 0 ? `Completed with ${logCount} terminal ${logSuffix}.` : "Completed.",
      state: "complete"
    };
  }

  return {
    label: "Agent task",
    detail: "Ready for the next command.",
    state: "pending"
  };
};

const responseItem = (state: VoiceOpsState): StatusTimelineItem => ({
  label: "Spoken response",
  detail: state.lastSpokenResponse || "Waiting to speak.",
  state: state.lastSpokenResponse ? "complete" : "pending"
});

export const buildStatusTimeline = (state: VoiceOpsState): StatusTimelineItem[] => [
  transcriptItem(state),
  intentItem(state),
  safetyItem(state),
  agentItem(state),
  responseItem(state)
];
