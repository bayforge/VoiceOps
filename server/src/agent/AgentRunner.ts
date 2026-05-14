import type { AgentEvent, AgentTask } from "../../../shared/types.js";

export interface AgentRunner {
  runTask(task: AgentTask): AsyncIterable<AgentEvent>;
  stop(): Promise<void>;
}

export const createAgentEvent = (
  type: AgentEvent["type"],
  message: string,
  data?: Record<string, unknown>
): AgentEvent => ({
  type,
  message,
  timestamp: new Date().toISOString(),
  data
});
