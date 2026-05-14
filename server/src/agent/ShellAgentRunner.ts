import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { AgentEvent, AgentTask, AppConfig } from "../../../shared/types.js";
import { checkShellCommandSafety } from "../safety.js";
import { createAgentEvent, type AgentRunner } from "./AgentRunner.js";

export class ShellAgentRunner implements AgentRunner {
  private child: ChildProcessWithoutNullStreams | null = null;

  constructor(private readonly config: AppConfig) {}

  async *runTask(task: AgentTask): AsyncIterable<AgentEvent> {
    const command = this.commandForTask(task);
    if (!command) {
      yield createAgentEvent("failed", "Shell runner has no configured command for this workflow.");
      return;
    }

    const safety = checkShellCommandSafety(command, task.repoRoot, this.config.repoRoot, task.approved);
    if (!safety.allowed) {
      yield createAgentEvent("approval_required", safety.reasons.join(" "));
      return;
    }

    yield createAgentEvent("started", `Running configured command: ${command}`);
    yield* this.spawnCommand(command, task.repoRoot);
  }

  async stop(): Promise<void> {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
  }

  private commandForTask(task: AgentTask): string | undefined {
    if (task.command) {
      return task.command;
    }
    if (task.type === "test") {
      return this.config.testCommand;
    }
    if (task.type === "feature" || task.type === "fix") {
      return this.config.agentCommand;
    }
    return undefined;
  }

  private async *spawnCommand(command: string, cwd: string): AsyncIterable<AgentEvent> {
    const child = spawn(command, { cwd, shell: true });
    this.child = child;
    const queue: AgentEvent[] = [];
    let done = false;
    let exitCode: number | null = null;

    child.stdout.on("data", (chunk: Buffer) => {
      queue.push(createAgentEvent("stdout", chunk.toString()));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      queue.push(createAgentEvent("stderr", chunk.toString()));
    });
    child.on("close", (code) => {
      exitCode = code;
      done = true;
    });
    child.on("error", (error) => {
      queue.push(createAgentEvent("failed", error.message));
      done = true;
    });

    while (!done || queue.length > 0) {
      const event = queue.shift();
      if (event) {
        yield event;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    this.child = null;
    yield exitCode === 0
      ? createAgentEvent("completed", "Shell workflow completed successfully.")
      : createAgentEvent("failed", `Shell workflow failed with exit code ${exitCode ?? "unknown"}.`);
  }
}
