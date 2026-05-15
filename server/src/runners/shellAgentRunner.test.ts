import { describe, expect, test } from "vitest";
import type { AgentEvent, AgentTask } from "../../../shared/types";
import { createCommandConfig } from "../commands";
import { ShellAgentRunner } from "./shellAgentRunner";

const task = (overrides: Partial<AgentTask> = {}): AgentTask => ({
  id: "shell-task-1",
  type: "test",
  prompt: "Run the build.",
  repoRoot: process.cwd(),
  requiresApproval: false,
  approved: false,
  workflow: "build",
  ...overrides
});

const collectEvents = async (events: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> => {
  const collected: AgentEvent[] = [];
  for await (const event of events) {
    collected.push(event);
  }
  return collected;
};

describe("ShellAgentRunner", () => {
  test("streams output from a safe configured build command", async () => {
    const commands = createCommandConfig(
      {
        BUILD_COMMAND: "node -e \"console.log('shell-build')\""
      },
      process.cwd()
    );
    const runner = new ShellAgentRunner({ commands });

    const events = await collectEvents(runner.runTask(task()));

    expect(events.map((event) => event.type)).toEqual(["started", "stdout", "completed"]);
    expect(events.map((event) => event.message)).toEqual(
      expect.arrayContaining(["shell-build", "Command completed successfully: node -e \"console.log('shell-build')\""])
    );
  });

  test("blocks unsafe configured commands before execution", async () => {
    const commands = createCommandConfig(
      {
        BUILD_COMMAND: "npm install left-pad"
      },
      process.cwd()
    );
    const runner = new ShellAgentRunner({ commands });

    const events = await collectEvents(runner.runTask(task()));

    expect(events).toEqual([
      expect.objectContaining({
        type: "failed",
        message: expect.stringContaining("Configured command mentions package installation.")
      })
    ]);
  });
});
