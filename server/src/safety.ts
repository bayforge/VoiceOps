import path from "node:path";
import type { ConfiguredCommand, RiskLevel, SafetyResult, VoiceAction } from "../../shared/types.js";

const destructivePatterns = [/\b(rm|del|rmdir|remove-item)\b/i, /\bgit\s+(reset|clean|push)\b/i];
const installPatterns = [/\bnpm\s+(install|i)\b/i, /\bpnpm\s+(add|install)\b/i, /\byarn\s+(add|install)\b/i, /\bbun\s+add\b/i];
const secretPatterns = [/\.env\b/i, /\bcredentials?\b/i, /\btokens?\b/i, /\bsecrets?\b/i, /\bssh\b/i, /\bid_rsa\b/i, /\bid_ed25519\b/i];
const shellControlPatterns = [/&&/, /\|\|/, /[;|<>`]/, /\$\(/];

const result = (
  allowed: boolean,
  requiresApproval: boolean,
  riskLevel: RiskLevel,
  reasons: string[] = []
): SafetyResult => ({ allowed, requiresApproval, riskLevel, reasons });

const dangerousTranscriptReasons = (action: VoiceAction): string[] => {
  const text = `${action.rawTranscript} ${action.normalizedText}`;
  const reasons: string[] = [];

  if (destructivePatterns.some((pattern) => pattern.test(text))) {
    reasons.push("Transcript mentions destructive command text.");
  }

  if (installPatterns.some((pattern) => pattern.test(text))) {
    reasons.push("Transcript mentions package installation.");
  }

  if (/\bsudo\b/i.test(text)) {
    reasons.push("Transcript mentions sudo.");
  }

  if (secretPatterns.some((pattern) => pattern.test(text))) {
    reasons.push("Transcript mentions environment or secret material.");
  }

  return reasons;
};

export const checkActionSafety = (action: VoiceAction): SafetyResult => {
  if (action.intent === "UNKNOWN") {
    return result(false, false, "low", ["Unknown commands require clarification."]);
  }

  const dangerousReasons = dangerousTranscriptReasons(action);
  if (dangerousReasons.length > 0) {
    return result(false, true, "high", dangerousReasons);
  }

  if (action.intent === "COMMIT_CHANGES") {
    return result(false, true, "high", ["Local commits require explicit voice approval."]);
  }

  if (action.intent === "CREATE_BRANCH") {
    return result(false, true, "high", ["Branch changes require explicit voice approval."]);
  }

  if (action.requiresApproval) {
    return result(false, true, action.riskLevel, ["Action requires explicit approval."]);
  }

  return result(true, false, action.riskLevel);
};

const isInsideRepo = (cwd: string, repoRoot: string): boolean => {
  const resolvedCwd = path.resolve(cwd);
  const resolvedRepoRoot = path.resolve(repoRoot);
  const relative = path.relative(resolvedRepoRoot, resolvedCwd);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const commandText = (command: ConfiguredCommand): string =>
  [command.executable, ...command.args].join(" ").trim();

const gitSubcommand = (command: ConfiguredCommand): string | undefined => {
  if (!/^git(?:\.exe)?$/i.test(path.basename(command.executable))) {
    return undefined;
  }

  for (let index = 0; index < command.args.length; index += 1) {
    const arg = command.args[index];
    if (arg === "-c" || arg === "--config-env") {
      index += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      continue;
    }
    return arg;
  }

  return undefined;
};

const isGitBranchDeletion = (command: ConfiguredCommand): boolean => {
  if (gitSubcommand(command) !== "branch") {
    return false;
  }
  return command.args.some((arg) => arg === "-d" || arg === "-D" || arg === "--delete");
};

const isGitBranchCreation = (command: ConfiguredCommand): boolean => {
  const subcommand = gitSubcommand(command);
  if (subcommand === "switch") {
    return command.args.includes("-c") || command.args.includes("--create");
  }
  if (subcommand === "checkout") {
    return command.args.includes("-b") || command.args.includes("-B");
  }
  return false;
};

export const checkCommandSafety = (
  command: ConfiguredCommand,
  options: { approved?: boolean } = {}
): SafetyResult => {
  const text = `${command.raw} ${commandText(command)}`;
  const reasons: string[] = [];

  if (!command.executable.trim()) {
    reasons.push("Configured command is empty.");
  }

  if (!isInsideRepo(command.cwd, command.repoRoot)) {
    reasons.push("Configured command would run outside the repo root.");
  }

  if (shellControlPatterns.some((pattern) => pattern.test(command.raw))) {
    reasons.push("Configured command contains shell control syntax.");
  }

  if (destructivePatterns.some((pattern) => pattern.test(text)) || isGitBranchDeletion(command)) {
    reasons.push("Configured command mentions a destructive git or file operation.");
  }

  if (installPatterns.some((pattern) => pattern.test(text))) {
    reasons.push("Configured command mentions package installation.");
  }

  if (/\bsudo\b/i.test(text)) {
    reasons.push("Configured command mentions sudo.");
  }

  if (secretPatterns.some((pattern) => pattern.test(text))) {
    reasons.push("Configured command references environment or secret material.");
  }

  const subcommand = gitSubcommand(command);
  if ((subcommand === "commit" || isGitBranchCreation(command)) && !options.approved) {
    reasons.push(
      subcommand === "commit"
        ? "Local commits require explicit voice approval."
        : "Branch changes require explicit voice approval."
    );
  }

  if (reasons.length > 0) {
    return result(false, true, "high", reasons);
  }

  return result(true, false, "low");
};

export const assertCommandAllowed = (
  command: ConfiguredCommand,
  options: { approved?: boolean } = {}
): void => {
  const safety = checkCommandSafety(command, options);
  if (!safety.allowed) {
    throw new Error(safety.reasons.join(" "));
  }
};
