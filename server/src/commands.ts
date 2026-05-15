import path from "node:path";
import type { CommandConfig, ConfiguredCommand } from "../../shared/types.js";

type CommandName = "agent" | "build" | "test" | "typecheck" | "git";

const defaultCommands = {
  build: "npm run build",
  test: "npm test",
  typecheck: "npm run typecheck"
} as const;

const splitCommandLine = (rawCommand: string): string[] => {
  const parts: string[] = [];
  let current = "";
  let quote: "'" | "\"" | null = null;

  for (let index = 0; index < rawCommand.length; index += 1) {
    const char = rawCommand[index];

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        parts.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (quote) {
    throw new Error("Configured command has an unterminated quoted argument.");
  }

  if (current) {
    parts.push(current);
  }

  if (parts.length === 0) {
    throw new Error("Configured command cannot be empty.");
  }

  return parts;
};

export const createCommandFromParts = (
  name: CommandName,
  executable: string,
  args: string[],
  cwd: string,
  repoRoot: string
): ConfiguredCommand => ({
  name,
  raw: [executable, ...args].join(" "),
  executable,
  args,
  cwd: path.resolve(cwd),
  repoRoot: path.resolve(repoRoot)
});

export const createConfiguredCommand = (
  name: CommandName,
  rawCommand: string,
  cwd: string,
  repoRoot: string
): ConfiguredCommand => {
  const [executable, ...args] = splitCommandLine(rawCommand.trim());
  return {
    name,
    raw: rawCommand.trim(),
    executable,
    args,
    cwd: path.resolve(cwd),
    repoRoot: path.resolve(repoRoot)
  };
};

export const createCommandConfig = (env: NodeJS.ProcessEnv, repoRoot: string): CommandConfig => {
  const agentCommand = env.AGENT_COMMAND?.trim();

  return {
    agent: agentCommand ? createConfiguredCommand("agent", agentCommand, repoRoot, repoRoot) : undefined,
    build: createConfiguredCommand("build", env.BUILD_COMMAND?.trim() || defaultCommands.build, repoRoot, repoRoot),
    test: createConfiguredCommand("test", env.TEST_COMMAND?.trim() || defaultCommands.test, repoRoot, repoRoot),
    typecheck: createConfiguredCommand(
      "typecheck",
      env.TYPECHECK_COMMAND?.trim() || defaultCommands.typecheck,
      repoRoot,
      repoRoot
    )
  };
};

export const commandForWorkflow = (
  commands: CommandConfig,
  workflow: "build" | "test" | "typecheck" | undefined
): ConfiguredCommand => {
  if (workflow === "build") {
    return commands.build;
  }
  if (workflow === "typecheck") {
    return commands.typecheck;
  }
  return commands.test;
};
