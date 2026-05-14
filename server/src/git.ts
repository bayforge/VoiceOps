import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const safeDirectoryArgs = (repoRoot: string): string[] => ["-c", `safe.directory=${repoRoot}`];

const sanitizeCommitMessage = (message: string): string => {
  const sanitized = message.replace(/[\r\n]+/g, " ").trim();
  return sanitized.length > 0 ? sanitized.slice(0, 120) : "voiceops update";
};

export const runGit = async (repoRoot: string, args: string[]): Promise<string> => {
  const { stdout, stderr } = await execFileAsync("git", [...safeDirectoryArgs(repoRoot), ...args], {
    cwd: repoRoot,
    timeout: 15000,
    maxBuffer: 1024 * 1024
  });
  return `${stdout}${stderr}`.trim();
};

export const getGitStatus = async (repoRoot: string): Promise<string> => {
  const status = await runGit(repoRoot, ["status", "--short"]);
  return status || "Working tree clean.";
};

export const summarizeGitDiff = async (repoRoot: string): Promise<string> => {
  const [status, stat, names] = await Promise.all([
    runGit(repoRoot, ["status", "--short"]),
    runGit(repoRoot, ["diff", "--stat"]),
    runGit(repoRoot, ["diff", "--name-status"])
  ]);

  if (!status.trim()) {
    return "No local changes detected.";
  }

  const changedFiles = names
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.replace(/\s+/g, " "))
    .slice(0, 8);

  const statLine = stat.split(/\r?\n/).filter(Boolean).at(-1);
  const files = changedFiles.length > 0 ? changedFiles.join("; ") : status.split(/\r?\n/).slice(0, 8).join("; ");
  return [statLine, `Changed files: ${files}`].filter(Boolean).join(" ");
};

export const createLocalCommit = async (repoRoot: string, message: string): Promise<string> => {
  const status = await runGit(repoRoot, ["status", "--short"]);
  if (!status.trim()) {
    return "No changes to commit.";
  }

  await runGit(repoRoot, ["add", "-A"]);
  const output = await runGit(repoRoot, ["commit", "-m", sanitizeCommitMessage(message)]);
  return output || "Committed successfully.";
};

export const createLocalBranch = async (repoRoot: string, branchName: string): Promise<string> => {
  const safeName = branchName.trim().toLowerCase().replace(/[^a-z0-9/_-]+/g, "-").slice(0, 80);
  if (!safeName) {
    throw new Error("Branch name is empty.");
  }
  await runGit(repoRoot, ["checkout", "-b", safeName]);
  return `Created and switched to branch ${safeName}.`;
};
