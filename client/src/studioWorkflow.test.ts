import { describe, expect, test } from "vitest";
import type { VoiceOpsState } from "../../shared/types";
import { buildStudioWorkflow } from "./studioWorkflow";

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

describe("buildStudioWorkflow", () => {
  test("marks voice capture active while the microphone is listening", () => {
    const steps = buildStudioWorkflow(
      baseState({
        microphoneStatus: "listening"
      })
    );

    expect(steps.map((step) => step.label)).toEqual([
      "Listening",
      "Thinking",
      "Planning",
      "Coding",
      "Testing",
      "Speaking"
    ]);
    expect(steps[0]).toMatchObject({
      label: "Listening",
      state: "active",
      detail: "Capturing voice input."
    });
    expect(steps[1]).toMatchObject({
      label: "Thinking",
      state: "pending"
    });
  });

  test("emphasizes validation when a build or test workflow is running", () => {
    const steps = buildStudioWorkflow(
      baseState({
        currentTranscript: "Run the build.",
        parsedIntent: "RUN_TESTS",
        agentStatus: "running",
        terminalLogs: [
          {
            type: "stdout",
            message: "Safety check passed for configured build command: npm run build.",
            timestamp: "2026-05-14T12:00:01.000Z"
          }
        ]
      })
    );

    expect(steps.find((step) => step.label === "Testing")).toMatchObject({
      state: "active",
      detail: "Validation workflow is streaming terminal output."
    });
    expect(steps.find((step) => step.label === "Coding")).toMatchObject({
      state: "complete"
    });
  });
});
