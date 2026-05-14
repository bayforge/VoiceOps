import { describe, expect, test } from "vitest";
import { classifyIntent } from "./intent";
import { checkActionSafety, checkShellCommandSafety } from "./safety";

describe("safety checker", () => {
  test("allows normal build workflow commands", () => {
    const result = checkShellCommandSafety("npm run build", "C:/repo", "C:/repo");

    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(false);
    expect(result.riskLevel).toBe("low");
  });

  test("requires approval for commit actions", () => {
    const action = classifyIntent("Commit it as add voice recipe landing page.");
    const result = checkActionSafety(action);

    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(result.riskLevel).toBe("high");
    expect(result.reasons).toContain("Local commits require explicit voice approval.");
  });

  test("blocks destructive shell commands until approved", () => {
    const result = checkShellCommandSafety("rm -rf dist", "C:/repo", "C:/repo");

    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(result.riskLevel).toBe("high");
    expect(result.reasons).toContain("Command contains a destructive token: rm.");
  });

  test("blocks commands that touch env files", () => {
    const result = checkShellCommandSafety("type .env", "C:/repo", "C:/repo");

    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(result.riskLevel).toBe("high");
    expect(result.reasons).toContain("Command touches environment or secret material.");
  });
});
