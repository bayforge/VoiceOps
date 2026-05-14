import type { VoiceIntent } from "../../shared/types";

export type DemoCommand = {
  intent: VoiceIntent;
  label: string;
  transcript: string;
};

export const demoCommands: DemoCommand[] = [
  {
    intent: "DEMO_MODE",
    label: "Start demo",
    transcript: "VoiceOps, start demo mode."
  },
  {
    intent: "BUILD_FEATURE",
    label: "Build feature",
    transcript: "Create a landing page for a voice-controlled recipe app with a dark hero and pricing cards."
  },
  {
    intent: "RUN_TESTS",
    label: "Run build",
    transcript: "Run the build."
  },
  {
    intent: "FIX_ERRORS",
    label: "Fix error",
    transcript: "Fix the error."
  },
  {
    intent: "SUMMARIZE_DIFF",
    label: "Summarize diff",
    transcript: "Read me what changed."
  },
  {
    intent: "COMMIT_CHANGES",
    label: "Commit",
    transcript: "Commit it as add voice recipe landing page."
  },
  {
    intent: "APPROVE_ACTION",
    label: "Confirm commit",
    transcript: "Confirm commit."
  }
];
