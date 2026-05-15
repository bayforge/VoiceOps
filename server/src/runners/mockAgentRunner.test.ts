import { describe, expect, test } from "vitest";
import type { AgentEvent, AgentTask } from "../../../shared/types";
import { MockAgentRunner } from "./mockAgentRunner";

const task = (overrides: Partial<AgentTask>): AgentTask => ({
  id: "task-1",
  type: "feature",
  prompt: "Create a landing page.",
  repoRoot: process.cwd(),
  requiresApproval: false,
  approved: false,
  ...overrides
});

const collectEvents = async (events: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> => {
  const collected: AgentEvent[] = [];
  for await (const event of events) {
    collected.push(event);
  }
  return collected;
};

describe("MockAgentRunner", () => {
  test("streams realistic build workflow logs without executing a shell command", async () => {
    const runner = new MockAgentRunner();

    const events = await collectEvents(
      runner.runTask(task({ type: "test", prompt: "Run the build.", workflow: "build" }))
    );

    expect(events.map((event) => event.type)).toEqual(["started", "stdout", "stdout", "completed"]);
    expect(events.map((event) => event.message)).toEqual(
      expect.arrayContaining([
        "Mock build workflow started.",
        "Safety check passed for configured build command: npm run build.",
        "Mock build completed successfully. No shell command was run."
      ])
    );
  });

  test("streams hackathon-ready feature logs", async () => {
    const runner = new MockAgentRunner();

    const events = await collectEvents(
      runner.runTask(
        task({
          type: "feature",
          prompt: "Create a landing page for a voice-controlled recipe app with a dark hero and pricing cards."
        })
      )
    );

    expect(events.map((event) => event.message)).toEqual(
      expect.arrayContaining([
        "Planning a dark hero, voice recipe workflow, and pricing cards.",
        "Mock feature task completed. Demo landing page changes are ready for review."
      ])
    );
  });

  test("can stop a running mock task and emit a stopped event", async () => {
    const runner = new MockAgentRunner({ delayMs: 1 });
    const iterator = runner.runTask(task({ type: "feature" }))[Symbol.asyncIterator]();

    const first = await iterator.next();
    await runner.stop();

    const rest: AgentEvent[] = [];
    for (;;) {
      const next = await iterator.next();
      if (next.done) {
        break;
      }
      rest.push(next.value);
    }

    expect(first.value?.type).toBe("started");
    expect(rest.at(-1)).toMatchObject({
      type: "stopped",
      message: "Mock agent stopped before completing the task."
    });
  });
});
