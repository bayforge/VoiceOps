import type { AgentEvent, AgentTask } from "../../../shared/types.js";

export interface AgentRunner {
  runTask(task: AgentTask): AsyncIterable<AgentEvent>;
  stop(): Promise<void>;
}
