import { describe, expect, test } from "vitest";
import type { VoiceOpsState } from "../../shared/types";
import { buildStatusTimeline } from "./statusTimeline";

const baseState = (overrides: Partial<VoiceOpsState> = {}): VoiceOpsState => ({
  connectionStatus: "connected",
  microphoneStatus: "mock",
  currentTranscript: "",
  parsedIntent: "UNKNOWN",
  riskLevel: "low",
  pendingApproval: null,
  agentStatus: "idle",
  terminalLogs: [],
  diffSummary: "",
  lastSpokenResponse: "Say a coding task to begin.",
  demoMode: false,
  updatedAt: "2026-05-14T12:00:00.000Z",
  ...overrides
});

describe("buildStatusTimeline", () => {
  test("marks approval as blocked when a risky action is waiting", () => {
    const items = buildStatusTimeline(
      baseState({
        currentTranscript: "Commit it as add voice recipe landing page.",
        parsedIntent: "COMMIT_CHANGES",
        riskLevel: "high",
        agentStatus: "waiting_approval",
        pendingApproval: {
          id: "approval-1",
          kind: "commit",
          message: 'Commit changes as "add voice recipe landing page"?',
          createdAt: "2026-05-14T12:00:01.000Z",
          action: {
            intent: "COMMIT_CHANGES",
            rawTranscript: "Commit it as add voice recipe landing page.",
            normalizedText: "commit it as add voice recipe landing page",
            confidence: 0.95,
            payload: { message: "add voice recipe landing page" },
            requiresApproval: true,
            riskLevel: "high"
          }
        }
      })
    );

    expect(items).toContainEqual({
      label: "Approval",
      detail: 'Commit changes as "add voice recipe landing page"?',
      state: "blocked"
    });
  });

  test("shows the agent step as active while logs are streaming", () => {
    const items = buildStatusTimeline(
      baseState({
        currentTranscript: "Run the build.",
        parsedIntent: "RUN_TESTS",
        agentStatus: "running",
        terminalLogs: [
          {
            type: "stdout",
            message: "Safety check passed for configured build command: npm run build.",
            timestamp: "2026-05-14T12:00:02.000Z"
          }
        ]
      })
    );

    expect(items).toContainEqual({
      label: "Agent task",
      detail: "Streaming 1 terminal event.",
      state: "active"
    });
  });
});
