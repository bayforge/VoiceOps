import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { createCommandFromParts } from "./commands.js";
import { assertCommandAllowed } from "./safety.js";

const execFileAsync = promisify(execFile);

export type GitStatusEntry = {
  code: string;
  path: string;
};

export type GitStatus = {
  clean: boolean;
  entries: GitStatusEntry[];
  summary: string;
};

export type GitResult = {
  message: string;
};

const sensitivePathPatterns = [
  /^\.env(?:\.|$)/i,
  /(^|[\\/])\.env(?:\.|$)/i,
  /credentials?/i,
  /tokens?/i,
  /secrets?/i,
  /(^|[\\/])\.ssh([\\/]|$)/i,
  /id_rsa/i,
  /id_ed25519/i
];

const runGit = async (
  repoRoot: string,
  args: string[],
  options: { approved?: boolean } = {}
): Promise<string> => {
  const command = createCommandFromParts("git", "git", args, repoRoot, repoRoot);
  assertCommandAllowed(command, options);
  const result = await execFileAsync(command.executable, command.args, {
    cwd: command.cwd,
    maxBuffer: 1024 * 1024
  });
  return result.stdout.trim();
};

const parseStatus = (stdout: string): GitStatusEntry[] =>
  stdout
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => ({
      code: line.slice(0, 2),
      path: line.slice(3)
    }));

const summarizeEntries = (entries: GitStatusEntry[]): string => {
  if (entries.length === 0) {
    return "Working tree clean.";
  }

  const suffix = entries.length === 1 ? "file" : "files";
  const shown = entries
    .slice(0, 5)
    .map((entry) => entry.path)
    .join(", ");
  const hidden = entries.length > 5 ? `, and ${entries.length - 5} more` : "";
  return `${entries.length} changed ${suffix}: ${shown}${hidden}`;
};

const isSensitivePath = (relativePath: string): boolean =>
  sensitivePathPatterns.some((pattern) => pattern.test(relativePath));

const validateBranchName = (branchName: string): string => {
  const trimmed = branchName.trim();
  if (
    !trimmed ||
    trimmed.startsWith("-") ||
    trimmed.includes("..") ||
    trimmed.includes("@{") ||
    trimmed.includes("\\") ||
    trimmed.endsWith("/") ||
    trimmed.endsWith(".") ||
    trimmed.endsWith(".lock") ||
    !/^[A-Za-z0-9._/-]+$/.test(trimmed)
  ) {
    throw new Error("Invalid branch name.");
  }
  return trimmed;
};

const validateCommitMessage = (message: string): string => {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error("Commit message cannot be empty.");
  }
  if (/[\r\n]/.test(trimmed)) {
    throw new Error("Commit message must be a single line.");
  }
  return trimmed;
};

export const getGitStatus = async (repoRoot: string): Promise<GitStatus> => {
  const stdout = await runGit(repoRoot, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const entries = parseStatus(stdout);
  return {
    clean: entries.length === 0,
    entries,
    summary: summarizeEntries(entries)
  };
};

export const summarizeGitDiff = async (repoRoot: string): Promise<string> => {
  const status = await getGitStatus(repoRoot);
  if (status.clean) {
    return "No local changes.";
  }

  const unstagedStat = await runGit(repoRoot, ["diff", "--stat", "--", "."]);
  const stagedStat = await runGit(repoRoot, ["diff", "--cached", "--stat", "--", "."]);
  const stat = [unstagedStat, stagedStat]
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

  return stat ? `${status.summary}. ${stat}` : status.summary;
};

export const createBranch = async (
  repoRoot: string,
  branchName: string,
  options: { approved: boolean }
): Promise<GitResult> => {
  if (!options.approved) {
    throw new Error("Branch creation requires approval.");
  }

  const safeBranchName = validateBranchName(branchName);
  await runGit(repoRoot, ["switch", "-c", safeBranchName], { approved: true });
  return { message: `Created and switched to branch ${safeBranchName}.` };
};

export const createLocalCommit = async (
  repoRoot: string,
  message: string,
  options: { approved: boolean }
): Promise<GitResult> => {
  if (!options.approved) {
    throw new Error("Local commits require approval.");
  }

  const commitMessage = validateCommitMessage(message);
  const status = await getGitStatus(repoRoot);
  if (status.clean) {
    throw new Error("No changes to commit.");
  }

  const sensitive = status.entries.filter((entry) => isSensitivePath(entry.path));
  if (sensitive.length > 0) {
    throw new Error("Refusing to commit sensitive files.");
  }

  await runGit(repoRoot, ["add", "-A", "--", "."], { approved: true });
  await runGit(
    repoRoot,
    ["-c", "user.name=VoiceOps", "-c", "user.email=voiceops@example.local", "commit", "-m", commitMessage],
    { approved: true }
  );
  const hash = await runGit(repoRoot, ["rev-parse", "--short", "HEAD"]);
  return { message: `Committed ${hash} ${commitMessage}.` };
};
