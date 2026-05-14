import { describe, expect, test } from "vitest";
import { classifyIntent } from "./intent";

describe("classifyIntent", () => {
  test("classifies the hackathon demo opener", () => {
    const action = classifyIntent("VoiceOps, start demo mode.");

    expect(action.intent).toBe("DEMO_MODE");
    expect(action.requiresApproval).toBe(false);
    expect(action.riskLevel).toBe("low");
  });

  test("classifies a landing page request as a feature build", () => {
    const action = classifyIntent(
      "Create a landing page for a voice-controlled recipe app with a dark hero and pricing cards."
    );

    expect(action.intent).toBe("BUILD_FEATURE");
    expect(action.payload).toEqual({
      prompt:
        "Create a landing page for a voice-controlled recipe app with a dark hero and pricing cards."
    });
  });

  test("classifies build validation as RUN_TESTS with a build workflow", () => {
    const action = classifyIntent("Run the build.");

    expect(action.intent).toBe("RUN_TESTS");
    expect(action.payload).toEqual({ workflow: "build" });
  });

  test("extracts a commit message and marks commit as approval-gated", () => {
    const action = classifyIntent("Commit it as add voice recipe landing page.");

    expect(action.intent).toBe("COMMIT_CHANGES");
    expect(action.requiresApproval).toBe(true);
    expect(action.riskLevel).toBe("high");
    expect(action.payload).toEqual({ message: "add voice recipe landing page" });
  });
});
