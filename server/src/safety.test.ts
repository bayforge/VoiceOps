import { describe, expect, test } from "vitest";
import { classifyIntent } from "./intent";
import { createConfiguredCommand } from "./commands";
import { checkActionSafety, checkCommandSafety } from "./safety";

describe("safety checker", () => {
  test("allows normal build feature requests", () => {
    const action = classifyIntent("Create a landing page.");
    const result = checkActionSafety(action);

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

  test("requires approval for branch actions", () => {
    const action = classifyIntent("Create a branch called voice demo.");
    const result = checkActionSafety(action);

    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(result.riskLevel).toBe("high");
    expect(result.reasons).toContain("Branch changes require explicit voice approval.");
  });

  test("requires approval for dangerous text even when it looks like a feature request", () => {
    const action = classifyIntent("Build a cleanup button that runs rm -rf dist and reads .env.");
    const result = checkActionSafety(action);

    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(result.riskLevel).toBe("high");
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "Transcript mentions destructive command text.",
        "Transcript mentions environment or secret material."
      ])
    );
  });

  test("requires approval when a transcript mentions git commit text", () => {
    const action = classifyIntent("Build a release button that runs git commit -m demo.");
    const result = checkActionSafety(action);

    expect(action.intent).toBe("COMMIT_CHANGES");
    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(result.riskLevel).toBe("high");
    expect(result.reasons).toContain("Local commits require explicit voice approval.");
  });

  test("allows configured build commands inside the repo", () => {
    const command = createConfiguredCommand("build", "npm run build", process.cwd(), process.cwd());
    const result = checkCommandSafety(command);

    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(false);
    expect(result.riskLevel).toBe("low");
  });

  test("blocks configured commands that install packages", () => {
    const command = createConfiguredCommand("build", "npm install left-pad", process.cwd(), process.cwd());
    const result = checkCommandSafety(command);

    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(result.riskLevel).toBe("high");
    expect(result.reasons).toContain("Configured command mentions package installation.");
  });

  test("blocks configured commands outside the repo root", () => {
    const command = createConfiguredCommand("build", "npm run build", "C:\\tmp", process.cwd());
    const result = checkCommandSafety(command);

    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(result.reasons).toContain("Configured command would run outside the repo root.");
  });
});
