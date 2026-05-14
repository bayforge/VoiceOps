import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import type { AgentTask, AppConfig, PendingApproval, VoiceOpsState } from "../../shared/types.js";
import { createRunner } from "./agent/createRunner.js";
import { classifyIntent } from "./intent.js";
import { checkActionSafety } from "./safety.js";
import { EventHub } from "./eventHub.js";
import { createInitialState, pushTerminalEvent, systemEvent } from "./state.js";
import { createLocalBranch, createLocalCommit, getGitStatus, summarizeGitDiff } from "./git.js";

type JsonValue = Record<string, unknown>;

const writeJson = (res: ServerResponse, statusCode: number, body: JsonValue): void => {
  res.writeHead(statusCode, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  res.end(JSON.stringify(body));
};

const readJson = async (req: IncomingMessage): Promise<JsonValue> =>
  new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk: Buffer) => {
      raw += chunk.toString();
      if (raw.length > 1024 * 1024) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw) as JsonValue);
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });

const asString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

const taskTypeForIntent = (intent: AgentTask["type"] | string): AgentTask["type"] => {
  if (intent === "RUN_TESTS") {
    return "test";
  }
  if (intent === "FIX_ERRORS") {
    return "fix";
  }
  if (intent === "DEMO_MODE") {
    return "demo";
  }
  return "feature";
};

export const createVoiceOpsApp = (config: AppConfig) => {
  const hub = new EventHub();
  const runner = createRunner(config);
  let state: VoiceOpsState = createInitialState();

  const publish = (nextState: VoiceOpsState): void => {
    state = { ...nextState, updatedAt: new Date().toISOString() };
    hub.publish(state);
  };

  const patchState = (patch: Partial<VoiceOpsState>): void => {
    publish({ ...state, ...patch });
  };

  const appendEvent = (type: Parameters<typeof systemEvent>[0], message: string, data?: Record<string, unknown>): void => {
    publish(pushTerminalEvent(state, systemEvent(type, message, data)));
  };

  const runAgentTask = async (task: AgentTask): Promise<void> => {
    for await (const event of runner.runTask(task)) {
      publish(pushTerminalEvent(state, event));
      if (event.type === "completed") {
        patchState({ lastSpokenResponse: event.message });
      }
      if (event.type === "failed") {
        patchState({ lastSpokenResponse: "Task failed. Say 'fix the error' or 'read the error.'" });
      }
    }
  };

  const createPendingApproval = (approval: Omit<PendingApproval, "id" | "createdAt">): PendingApproval => ({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...approval
  });

  const respondToCommand = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const body = await readJson(req);
    const transcript = asString(body.transcript);
    if (!transcript?.trim()) {
      writeJson(res, 400, { error: "transcript is required" });
      return;
    }

    const action = classifyIntent(transcript);
    const safety = checkActionSafety(action);
    patchState({
      currentTranscript: transcript,
      parsedIntent: action.intent,
      riskLevel: safety.riskLevel,
      pendingApproval: state.pendingApproval,
      lastSpokenResponse: state.lastSpokenResponse
    });

    if (action.intent === "APPROVE_ACTION") {
      await approvePending(res);
      return;
    }

    if (action.intent === "REJECT_ACTION") {
      rejectPending(res);
      return;
    }

    if (safety.requiresApproval) {
      const approval =
        action.intent === "COMMIT_CHANGES"
          ? createPendingApproval({
              kind: "commit",
              message: `Commit changes as "${String(action.payload?.message ?? "voiceops update")}"?`,
              commitMessage: String(action.payload?.message ?? "voiceops update")
            })
          : createPendingApproval({
              kind: "branch",
              message: `Create branch "${String(action.payload?.branchName ?? "voiceops-demo")}"?`,
              branchName: String(action.payload?.branchName ?? "voiceops-demo")
            });
      patchState({
        pendingApproval: approval,
        agentStatus: "waiting_approval",
        lastSpokenResponse:
          approval.kind === "commit"
            ? "Committing changes requires confirmation. Say confirm commit to continue."
            : "Creating a branch requires confirmation. Say confirm branch to continue."
      });
      appendEvent("approval_required", approval.message, { approvalId: approval.id });
      writeJson(res, 202, { action, safety, state });
      return;
    }

    if (!safety.allowed) {
      patchState({ lastSpokenResponse: safety.reasons[0] ?? "I need a clearer command before continuing." });
      writeJson(res, 400, { action, safety, state });
      return;
    }

    if (action.intent === "DEMO_MODE") {
      patchState({
        demoMode: true,
        agentStatus: "idle",
        lastSpokenResponse: "Demo mode ready. Say a coding task."
      });
      appendEvent("status", "Demo mode ready. Say a coding task.");
      writeJson(res, 200, { action, safety, state });
      return;
    }

    if (action.intent === "SUMMARIZE_DIFF") {
      const summary = await summarizeGitDiff(config.repoRoot);
      const gitStatus = await getGitStatus(config.repoRoot);
      patchState({
        diffSummary: summary,
        gitStatus,
        lastSpokenResponse: summary,
        agentStatus: "complete"
      });
      appendEvent("status", summary);
      writeJson(res, 200, { action, safety, state });
      return;
    }

    if (action.intent === "STOP_AGENT") {
      await runner.stop();
      patchState({ agentStatus: "stopped", lastSpokenResponse: "Agent stopped." });
      appendEvent("stopped", "Agent stopped.");
      writeJson(res, 200, { action, safety, state });
      return;
    }

    if (action.intent === "EXPLAIN_STATUS") {
      const response = `Current status: ${state.agentStatus}. Last intent: ${state.parsedIntent}.`;
      patchState({ lastSpokenResponse: response });
      writeJson(res, 200, { action, safety, state });
      return;
    }

    if (action.intent === "UNKNOWN") {
      patchState({ lastSpokenResponse: "I did not understand that. Say a coding task or ask for demo mode." });
      writeJson(res, 200, { action, safety, state });
      return;
    }

    const workflow = asString(action.payload?.workflow);
    const task: AgentTask = {
      id: crypto.randomUUID(),
      type: taskTypeForIntent(action.intent),
      prompt: asString(action.payload?.prompt) ?? transcript,
      repoRoot: config.repoRoot,
      requiresApproval: false,
      approved: true,
      command:
        workflow === "build"
          ? config.buildCommand
          : workflow === "typecheck"
            ? config.typecheckCommand
            : workflow === "test"
              ? config.testCommand
              : undefined
    };
    patchState({
      agentStatus: "running",
      lastSpokenResponse:
        action.intent === "BUILD_FEATURE"
          ? "I am building the landing page now."
          : action.intent === "FIX_ERRORS"
            ? "I am fixing the latest error now."
            : "I am running validation now."
    });
    void runAgentTask(task);
    writeJson(res, 202, { action, safety, state });
  };

  const approvePending = async (res: ServerResponse): Promise<void> => {
    const approval = state.pendingApproval;
    if (!approval) {
      patchState({ lastSpokenResponse: "There is no pending approval." });
      writeJson(res, 409, { error: "no pending approval", state });
      return;
    }

    try {
      const message =
        approval.kind === "commit"
          ? await createLocalCommit(config.repoRoot, approval.commitMessage ?? "voiceops update")
          : approval.kind === "branch"
            ? await createLocalBranch(config.repoRoot, approval.branchName ?? "voiceops-demo")
            : "Approved.";
      patchState({
        pendingApproval: null,
        agentStatus: "complete",
        gitStatus: await getGitStatus(config.repoRoot),
        lastSpokenResponse: approval.kind === "commit" ? "Committed successfully." : message
      });
      appendEvent("completed", message, { approvalId: approval.id });
      writeJson(res, 200, { approved: true, state });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Approval action failed.";
      patchState({
        pendingApproval: null,
        agentStatus: "failed",
        lastSpokenResponse: message
      });
      appendEvent("failed", message, { approvalId: approval.id });
      writeJson(res, 500, { approved: false, error: message, state });
    }
  };

  const rejectPending = (res: ServerResponse): void => {
    const hadApproval = Boolean(state.pendingApproval);
    patchState({
      pendingApproval: null,
      agentStatus: "idle",
      lastSpokenResponse: hadApproval ? "Approval rejected. No action was taken." : "Nothing was waiting for approval."
    });
    appendEvent("status", state.lastSpokenResponse);
    writeJson(res, 200, { rejected: hadApproval, state });
  };

  const streamEvents = (req: IncomingMessage, res: ServerResponse): void => {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "access-control-allow-origin": "*"
    });

    const send = (nextState: VoiceOpsState) => {
      res.write(`event: state\n`);
      res.write(`data: ${JSON.stringify(nextState)}\n\n`);
    };

    send(state);
    const unsubscribe = hub.subscribe(send);
    req.on("close", unsubscribe);
  };

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "content-type"
        });
        res.end();
        return;
      }

      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (req.method === "GET" && url.pathname === "/health") {
        writeJson(res, 200, { ok: true, service: "cursor-voiceops", runnerMode: config.runnerMode });
        return;
      }

      if (req.method === "GET" && url.pathname === "/state") {
        writeJson(res, 200, { state });
        return;
      }

      if (req.method === "GET" && url.pathname === "/events") {
        streamEvents(req, res);
        return;
      }

      if (req.method === "POST" && url.pathname === "/commands") {
        await respondToCommand(req, res);
        return;
      }

      if (req.method === "POST" && url.pathname === "/approvals") {
        await approvePending(res);
        return;
      }

      if (req.method === "POST" && url.pathname === "/rejections") {
        rejectPending(res);
        return;
      }

      writeJson(res, 404, { error: "not found" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal server error.";
      writeJson(res, 500, { error: message });
    }
  };

  return {
    handle,
    getState: () => state
  };
};
