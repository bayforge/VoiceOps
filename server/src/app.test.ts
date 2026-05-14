import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createServer, type Server } from "node:http";
import { createVoiceOpsApp } from "./app";

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

  beforeEach(async () => {
    const app = createVoiceOpsApp({
      repoRoot: process.cwd(),
      runnerMode: "mock"
    });
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
        "Mock response complete. No shell command was run."
      ])
    );
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

  test("approves pending actions in mock mode without executing git", async () => {
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
    expect(body.state.lastSpokenResponse).toBe("Approved commit request in mock mode. No git command was run.");
  });
});
