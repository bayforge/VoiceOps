import path from "node:path";
import type { AppConfig } from "../../shared/types.js";

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => ({
  port: Number(env.PORT ?? 8787),
  repoRoot: path.resolve(env.REPO_ROOT && env.REPO_ROOT.trim() ? env.REPO_ROOT : process.cwd()),
  runnerMode: "mock"
});
