import type { AgentEvent, AgentTask, CommandConfig, ConfiguredCommand } from "../../../shared/types.js";
import { createCommandConfig, commandForWorkflow } from "../commands.js";
import { checkCommandSafety } from "../safety.js";
import { systemEvent } from "../state.js";
import type { AgentRunner } from "./types.js";

type MockAgentRunnerOptions = {
  commands?: CommandConfig;
  delayMs?: number;
};

const wait = (delayMs: number): Promise<void> =>
  delayMs > 0 ? new Promise((resolve) => setTimeout(resolve, delayMs)) : Promise.resolve();

const workflowName = (task: AgentTask): "build" | "test" | "typecheck" =>
  task.workflow === "build" || task.workflow === "typecheck" ? task.workflow : "test";

export class MockAgentRunner implements AgentRunner {
  private stopped = false;
  private readonly commands: CommandConfig;
  private readonly delayMs: number;

  constructor(options: MockAgentRunnerOptions = {}) {
    this.commands = options.commands ?? createCommandConfig({}, process.cwd());
    this.delayMs = options.delayMs ?? 0;
  }

  async *runTask(task: AgentTask): AsyncIterable<AgentEvent> {
    this.stopped = false;

    for (const event of this.eventsForTask(task)) {
      if (this.stopped) {
        yield systemEvent("stopped", "Mock agent stopped before completing the task.", { taskId: task.id });
        return;
      }

      yield event;
      await wait(this.delayMs);
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
  }

  private eventsForTask(task: AgentTask): AgentEvent[] {
    if (task.type === "test") {
      return this.validationEvents(task);
    }

    if (task.type === "fix") {
      return [
        systemEvent("started", "Mock fix workflow started.", { taskId: task.id }),
        systemEvent("stdout", "Reading the latest terminal context from app state."),
        systemEvent("stdout", "Preparing a mock repair summary."),
        systemEvent("completed", "Mock fix task completed. No shell command was run.")
      ];
    }

    if (task.type === "feature") {
      return [
        systemEvent("started", "Mock agent accepted the feature request.", { taskId: task.id }),
        systemEvent("stdout", "Reading the transcript and preparing a safe task plan."),
        systemEvent("stdout", "Mocking file edits for the requested change without touching the shell."),
        systemEvent("completed", "Mock feature task completed. No shell command was run.")
      ];
    }

    return [systemEvent("status", "Mock response recorded.", { taskId: task.id })];
  }

  private validationEvents(task: AgentTask): AgentEvent[] {
    const workflow = workflowName(task);
    const command = commandForWorkflow(this.commands, workflow);
    const safety = checkCommandSafety(command);

    if (!safety.allowed) {
      return [
        systemEvent("started", `Mock ${workflow} workflow started.`, { taskId: task.id }),
        systemEvent("failed", `Safety check blocked configured ${workflow} command: ${safety.reasons.join(" ")}`, {
          command: command.raw
        })
      ];
    }

    return [
      systemEvent("started", `Mock ${workflow} workflow started.`, { taskId: task.id }),
      systemEvent("stdout", `Safety check passed for configured ${workflow} command: ${command.raw}.`),
      systemEvent("stdout", `Would stream output from: ${command.raw}`),
      systemEvent("completed", `Mock ${workflow} completed successfully. No shell command was run.`)
    ];
  }
}
