import type { AppConfig } from "../../../shared/types.js";
import { MockAgentRunner } from "./mockAgentRunner.js";
import { ShellAgentRunner } from "./shellAgentRunner.js";
import type { AgentRunner } from "./types.js";

export const createAgentRunner = (config: AppConfig): AgentRunner =>
  config.runnerMode === "shell"
    ? new ShellAgentRunner({ commands: config.commands })
    : new MockAgentRunner({ commands: config.commands });
