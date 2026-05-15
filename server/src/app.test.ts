import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { promisify } from "node:util";
import { createVoiceOpsApp } from "./app";
import { loadConfig } from "./config";

const execFileAsync = promisify(execFile);
const scratchRoot = path.join(process.cwd(), ".tmp-tests");

const listen = (server: Server) =>
  new Promise<number>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "object" && address) {
        resolve(address.port);
      }
    });
  });

describe("VoiceOps HTTP app", () => {
  let server: Server | undefined;
  let baseUrl = "";
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
    repoRoot = path.join(scratchRoot, `app-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(repoRoot, { recursive: true });
    await git(["init", "--initial-branch=main"]);
    await git(["config", "user.name", "VoiceOps Test"]);
    await git(["config", "user.email", "voiceops@example.test"]);
    await writeRepoFile("README.md", "# app test repo\n");
    await git(["add", "README.md"]);
    await git(["commit", "-m", "initial commit"]);

    const app = createVoiceOpsApp(loadConfig({ REPO_ROOT: repoRoot }));
    server = createServer(app.handle);
    const port = await listen(server);
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      if (!server) {
        resolve();
        return;
      }
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await rm(repoRoot, { recursive: true, force: true });
  });

  test("serves a health endpoint", async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      service: "cursor-voiceops"
    });
  });

  test("accepts commands and returns the parsed action", async () => {
    const response = await fetch(`${baseUrl}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transcript: "VoiceOps, start demo mode." })
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.action.intent).toBe("DEMO_MODE");
    expect(body.state.lastSpokenResponse).toBe("Demo mode ready. Say a coding task.");
  });

  test("routes feature commands through mock terminal output", async () => {
    const response = await fetch(`${baseUrl}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transcript: "Create a landing page for a voice-controlled recipe app with a dark hero and pricing cards."
      })
    });

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.action.intent).toBe("BUILD_FEATURE");
    expect(body.state.agentStatus).toBe("complete");
    expect(body.state.terminalLogs.map((event: { message: string }) => event.message)).toEqual(
      expect.arrayContaining([
        "Mock agent accepted the feature request.",
        "Mock feature task completed. No shell command was run."
      ])
    );
  });

  test("routes build commands through the runner", async () => {
    const response = await fetch(`${baseUrl}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transcript: "Run the build." })
    });

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.action.intent).toBe("RUN_TESTS");
    expect(body.state.terminalLogs.map((event: { message: string }) => event.message)).toEqual(
      expect.arrayContaining([
        "Mock build workflow started.",
        "Safety check passed for configured build command: npm run build."
      ])
    );
  });

  test("summarizes the local git diff", async () => {
    await writeRepoFile("src/app.ts", "export const app = true;\n");

    const response = await fetch(`${baseUrl}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transcript: "Read me what changed." })
    });

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.state.diffSummary).toContain("1 changed file");
    expect(body.state.diffSummary).toContain("src/app.ts");
  });

  test("creates a pending approval for commit commands", async () => {
    const response = await fetch(`${baseUrl}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transcript: "Commit it as add voice recipe landing page." })
    });

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.state.pendingApproval).toMatchObject({
      kind: "commit",
      message: "Commit changes as \"add voice recipe landing page\"?"
    });
    expect(body.state.lastSpokenResponse).toBe(
      "Committing changes requires confirmation. Say confirm commit to continue."
    );
  });

  test("commits pending changes only after approval", async () => {
    await writeRepoFile("src/app.ts", "export const app = true;\n");
    await fetch(`${baseUrl}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transcript: "Commit it as add voice recipe landing page." })
    });

    const response = await fetch(`${baseUrl}/approvals`, { method: "POST" });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.state.pendingApproval).toBeNull();
    expect(body.state.agentStatus).toBe("complete");
    expect(body.state.lastSpokenResponse).toMatch(/^Committed [a-f0-9]+ add voice recipe landing page\.$/);
    await expect(git(["log", "-1", "--pretty=%s"])).resolves.toBe("add voice recipe landing page");
  });
});
