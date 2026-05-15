import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { AgentEvent, AgentTask, CommandConfig, ConfiguredCommand } from "../../../shared/types.js";
import { commandForWorkflow } from "../commands.js";
import { checkCommandSafety } from "../safety.js";
import { systemEvent } from "../state.js";
import type { AgentRunner } from "./types.js";

type ShellAgentRunnerOptions = {
  commands: CommandConfig;
  env?: NodeJS.ProcessEnv;
};

const taskWorkflow = (task: AgentTask): "build" | "test" | "typecheck" =>
  task.workflow === "build" || task.workflow === "typecheck" ? task.workflow : "test";

export class ShellAgentRunner implements AgentRunner {
  private readonly commands: CommandConfig;
  private readonly env: NodeJS.ProcessEnv;
  private child: ChildProcessWithoutNullStreams | null = null;
  private stopRequested = false;

  constructor(options: ShellAgentRunnerOptions) {
    this.commands = options.commands;
    this.env = options.env ?? process.env;
  }

  async *runTask(task: AgentTask): AsyncIterable<AgentEvent> {
    this.stopRequested = false;
    const command = this.commandForTask(task);
    if (!command) {
      yield systemEvent("failed", "Shell runner is enabled, but AGENT_COMMAND is not configured.", { taskId: task.id });
      return;
    }

    const safety = checkCommandSafety(command, { approved: task.approved });
    if (!safety.allowed) {
      yield systemEvent("failed", `Safety check blocked configured command: ${safety.reasons.join(" ")}`, {
        command: command.raw,
        taskId: task.id
      });
      return;
    }

    yield systemEvent("started", `Running configured command: ${command.raw}`, { taskId: task.id });
    yield* this.streamCommand(command, task);
  }

  async stop(): Promise<void> {
    this.stopRequested = true;
    this.child?.kill();
  }

  private commandForTask(task: AgentTask): ConfiguredCommand | undefined {
    if (task.type === "test") {
      return commandForWorkflow(this.commands, taskWorkflow(task));
    }

    if (task.type === "feature" || task.type === "fix") {
      return this.commands.agent;
    }

    return undefined;
  }

  private async *streamCommand(command: ConfiguredCommand, task: AgentTask): AsyncIterable<AgentEvent> {
    const queue: AgentEvent[] = [];
    let wake: (() => void) | undefined;
    let done = false;

    const notify = () => {
      wake?.();
      wake = undefined;
    };

    const push = (event: AgentEvent) => {
      queue.push(event);
      notify();
    };

    this.child = spawn(command.executable, command.args, {
      cwd: command.cwd,
      env: {
        ...this.env,
        VOICEOPS_TASK_ID: task.id,
        VOICEOPS_TASK_TYPE: task.type,
        VOICEOPS_TASK_PROMPT: task.prompt
      },
      shell: false
    });

    this.child.stdout.on("data", (chunk: Buffer) => {
      push(systemEvent("stdout", chunk.toString().trimEnd()));
    });

    this.child.stderr.on("data", (chunk: Buffer) => {
      push(systemEvent("stderr", chunk.toString().trimEnd()));
    });

    this.child.on("error", (error) => {
      push(systemEvent("failed", error.message, { command: command.raw, taskId: task.id }));
      done = true;
      this.child = null;
      notify();
    });

    this.child.on("close", (code, signal) => {
      if (this.stopRequested) {
        push(systemEvent("stopped", "Shell command stopped.", { command: command.raw, signal, taskId: task.id }));
      } else if (code === 0) {
        push(systemEvent("completed", `Command completed successfully: ${command.raw}`, { command: command.raw, taskId: task.id }));
      } else {
        push(systemEvent("failed", `Command failed with exit code ${String(code)}.`, { command: command.raw, code, taskId: task.id }));
      }
      done = true;
      this.child = null;
      notify();
    });

    while (!done || queue.length > 0) {
      if (queue.length > 0) {
        const event = queue.shift();
        if (event) {
          yield event;
        }
        continue;
      }

      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
  }
}
