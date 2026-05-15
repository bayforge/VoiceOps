import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createBranch, createLocalCommit, getGitStatus, summarizeGitDiff } from "./git";

const execFileAsync = promisify(execFile);
const scratchRoot = path.join(process.cwd(), ".tmp-tests");

let repoRoot = "";

const git = async (args: string[]) => {
  const result = await execFileAsync("git", args, { cwd: repoRoot });
  return result.stdout.trim();
};

const writeRepoFile = async (relativePath: string, contents: string) => {
  const absolutePath = path.join(repoRoot, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents);
};

beforeEach(async () => {
  repoRoot = path.join(scratchRoot, `repo-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(repoRoot, { recursive: true });
  await git(["init", "--initial-branch=main"]);
  await git(["config", "user.name", "VoiceOps Test"]);
  await git(["config", "user.email", "voiceops@example.test"]);
  await writeRepoFile("README.md", "# test repo\n");
  await git(["add", "README.md"]);
  await git(["commit", "-m", "initial commit"]);
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe("git helpers", () => {
  test("returns concise git status for changed files", async () => {
    await writeRepoFile("src/app.ts", "export const app = true;\n");

    const status = await getGitStatus(repoRoot);

    expect(status.clean).toBe(false);
    expect(status.entries).toEqual([{ code: "??", path: "src/app.ts" }]);
    expect(status.summary).toBe("1 changed file: src/app.ts");
  });

  test("summarizes a diff without exposing file contents", async () => {
    await writeRepoFile("README.md", "# test repo\n\nsecret implementation detail\n");

    const summary = await summarizeGitDiff(repoRoot);

    expect(summary).toContain("1 changed file");
    expect(summary).toContain("README.md");
    expect(summary).not.toContain("secret implementation detail");
  });

  test("creates a branch only after explicit approval", async () => {
    await expect(createBranch(repoRoot, "voice-demo", { approved: false })).rejects.toThrow(/approval/i);

    const result = await createBranch(repoRoot, "voice-demo", { approved: true });

    expect(result.message).toBe("Created and switched to branch voice-demo.");
    await expect(git(["branch", "--show-current"])).resolves.toBe("voice-demo");
  });

  test("creates a local commit only after explicit approval", async () => {
    await writeRepoFile("src/app.ts", "export const app = true;\n");

    await expect(createLocalCommit(repoRoot, "add app file", { approved: false })).rejects.toThrow(/approval/i);

    const result = await createLocalCommit(repoRoot, "add app file", { approved: true });

    expect(result.message).toMatch(/^Committed [a-f0-9]+ add app file\.$/);
    await expect(git(["log", "-1", "--pretty=%s"])).resolves.toBe("add app file");
  });

  test("refuses to commit sensitive files", async () => {
    await writeRepoFile(".env", "ELEVENLABS_API_KEY=secret\n");

    await expect(createLocalCommit(repoRoot, "add env", { approved: true })).rejects.toThrow(/sensitive/i);
  });
});
