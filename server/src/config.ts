import path from "node:path";
import type { AppConfig, RunnerMode } from "../../shared/types.js";

const asRunnerMode = (value: string | undefined): RunnerMode => (value === "shell" ? "shell" : "mock");

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => ({
  port: Number(env.PORT ?? 8787),
  repoRoot: path.resolve(env.REPO_ROOT && env.REPO_ROOT.trim() ? env.REPO_ROOT : process.cwd()),
  runnerMode: asRunnerMode(env.AGENT_RUNNER_MODE),
  agentCommand: env.AGENT_COMMAND,
  buildCommand: env.BUILD_COMMAND ?? "npm run build",
  testCommand: env.TEST_COMMAND ?? "npm test",
  typecheckCommand: env.TYPECHECK_COMMAND ?? "npm run typecheck",
  elevenLabsApiKey: env.ELEVENLABS_API_KEY,
  elevenLabsVoiceId: env.ELEVENLABS_VOICE_ID
});
