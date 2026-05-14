import type { AgentEvent, AgentTask } from "../../../shared/types.js";
import { createAgentEvent, type AgentRunner } from "./AgentRunner.js";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class MockAgentRunner implements AgentRunner {
  private stopped = false;

  constructor(private readonly delayMs = 250) {}

  async *runTask(task: AgentTask): AsyncIterable<AgentEvent> {
    this.stopped = false;
    const lines = this.linesForTask(task);
    yield createAgentEvent("started", `Agent started ${task.type} workflow.`, { taskId: task.id });

    for (const line of lines) {
      if (this.stopped) {
        yield createAgentEvent("stopped", "Agent stopped by voice command.", { taskId: task.id });
        return;
      }
      await delay(this.delayMs);
      yield createAgentEvent("stdout", line, { taskId: task.id });
    }

    yield createAgentEvent("completed", this.completeMessage(task), { taskId: task.id });
  }

  async stop(): Promise<void> {
    this.stopped = true;
  }

  private linesForTask(task: AgentTask): string[] {
    if (task.type === "feature") {
      return [
        "Planning component structure from the spoken task.",
        "Creating responsive hero and pricing sections.",
        "Applying dark demo-ready styling.",
        "Preparing validation notes for the build."
      ];
    }

    if (task.type === "test") {
      const workflow = task.command ? ` (${task.command})` : "";
      return [
        `Starting validation workflow${workflow}.`,
        "Checking TypeScript surfaces.",
        "Running build simulation.",
        "Validation workflow completed in mock mode."
      ];
    }

    if (task.type === "fix") {
      return [
        "Reading the latest terminal error context.",
        "Applying the smallest safe fix.",
        "Re-running validation in mock mode.",
        "Error workflow completed."
      ];
    }

    return ["Preparing summary.", "Workflow completed."];
  }

  private completeMessage(task: AgentTask): string {
    if (task.type === "feature") {
      return "Feature workflow complete.";
    }
    if (task.type === "test") {
      return "Build workflow complete.";
    }
    if (task.type === "fix") {
      return "Fix workflow complete.";
    }
    return "Agent workflow complete.";
  }
}
