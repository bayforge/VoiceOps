import { describe, expect, test } from "vitest";
import { demoCommands } from "./demoCommands";

describe("demoCommands", () => {
  test("contains the required 90-second demo voice flow", () => {
    expect(demoCommands.map((command) => command.intent)).toEqual([
      "DEMO_MODE",
      "BUILD_FEATURE",
      "RUN_TESTS",
      "FIX_ERRORS",
      "SUMMARIZE_DIFF",
      "COMMIT_CHANGES",
      "APPROVE_ACTION"
    ]);
  });
});
