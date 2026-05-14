import type { AppConfig } from "../../../shared/types.js";
import type { AgentRunner } from "./AgentRunner.js";
import { MockAgentRunner } from "./MockAgentRunner.js";
import { ShellAgentRunner } from "./ShellAgentRunner.js";

export const createRunner = (config: AppConfig): AgentRunner =>
  config.runnerMode === "shell" ? new ShellAgentRunner(config) : new MockAgentRunner();
