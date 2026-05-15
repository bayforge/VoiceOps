import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import type {
  AgentEvent,
  AgentTask,
  AppConfig,
  PendingApproval,
  ValidationWorkflow,
  VoiceAction,
  VoiceOpsState
} from "../../shared/types.js";
import { classifyIntent } from "./intent.js";
import { checkActionSafety } from "./safety.js";
import { EventHub } from "./eventHub.js";
import { createInitialState, pushTerminalEvent, systemEvent } from "./state.js";
import { createAgentRunner } from "./runners/index.js";
import type { AgentRunner } from "./runners/types.js";
import { createBranch, createLocalCommit, summarizeGitDiff } from "./git.js";
import { writeDemoLandingPageArtifact } from "./demoArtifacts.js";
import {
  createElevenLabsRealtimeSttService,
  createElevenLabsTtsService,
  publicVoiceConfig
} from "./voice/elevenLabs.js";

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

const writeAudio = (res: ServerResponse, contentType: string, audio: ArrayBuffer): void => {
  res.writeHead(200, {
    "content-type": contentType,
    "access-control-allow-origin": "*",
    "cache-control": "no-store"
  });
  res.end(Buffer.from(audio));
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

const startedSpokenResponseForAction = (action: VoiceAction): string => {
  if (action.intent === "BUILD_FEATURE") {
    return "I am building the landing page now.";
  }
  if (action.intent === "RUN_TESTS") {
    const workflow = workflowFromAction(action);
    return workflow === "build" ? "Running the build now." : `Running the ${workflow} workflow now.`;
  }
  if (action.intent === "FIX_ERRORS") {
    return "I am fixing the latest error context now.";
  }
  return "Agent is working.";
};

const spokenResponseForAction = (action: VoiceAction, artifactPath?: string): string => {
  if (action.intent === "BUILD_FEATURE") {
    return artifactPath
      ? `Landing page demo artifact ready at ${artifactPath}. Say run the build when ready.`
      : "Feature task complete. Say run the build when ready.";
  }
  if (action.intent === "RUN_TESTS") {
    const workflow = workflowFromAction(action);
    return `${workflow[0].toUpperCase()}${workflow.slice(1)} workflow complete. Say fix the error if needed, or read me what changed.`;
  }
  if (action.intent === "FIX_ERRORS") {
    return "Fix workflow complete. Say read me what changed.";
  }
  return "Task complete.";
};

const workflowFromAction = (action: VoiceAction): ValidationWorkflow => {
  const workflow = asString(action.payload?.workflow);
  return workflow === "build" || workflow === "typecheck" ? workflow : "test";
};

const taskTypeFromAction = (action: VoiceAction): AgentTask["type"] => {
  if (action.intent === "BUILD_FEATURE") {
    return "feature";
  }
  if (action.intent === "RUN_TESTS") {
    return "test";
  }
  if (action.intent === "FIX_ERRORS") {
    return "fix";
  }
  if (action.intent === "SUMMARIZE_DIFF") {
    return "summarize";
  }
  if (action.intent === "CREATE_BRANCH") {
    return "branch";
  }
  if (action.intent === "COMMIT_CHANGES") {
    return "commit";
  }
  return "demo";
};

const approvalMessageForAction = (action: VoiceAction): string => {
  if (action.intent === "COMMIT_CHANGES") {
    return `Commit changes as "${String(action.payload?.message ?? "voiceops update")}"?`;
  }
  if (action.intent === "CREATE_BRANCH") {
    return `Create branch "${String(action.payload?.branchName ?? "voiceops-demo")}"?`;
  }
  return "Risky action requires confirmation before continuing.";
};

const approvalKindForAction = (action: VoiceAction): PendingApproval["kind"] => {
  if (action.intent === "COMMIT_CHANGES") {
    return "commit";
  }
  if (action.intent === "CREATE_BRANCH") {
    return "branch";
  }
  return "risky_action";
};

export const createVoiceOpsApp = (config: AppConfig) => {
  const hub = new EventHub();
  const sttService = createElevenLabsRealtimeSttService(config.voice);
  const ttsService = createElevenLabsTtsService(config.voice);
  let state: VoiceOpsState = createInitialState();
  let activeRunner: AgentRunner | null = null;

  const publish = (nextState: VoiceOpsState): void => {
    state = { ...nextState, updatedAt: new Date().toISOString() };
    hub.publish(state);
  };

  const patchState = (patch: Partial<VoiceOpsState>): void => {
    publish({ ...state, ...patch });
  };

  const appendEvent = (event: AgentEvent): void => {
    publish(pushTerminalEvent(state, event));
  };

  const appendSystemEvent = (
    type: AgentEvent["type"],
    message: string,
    data?: Record<string, unknown>
  ): void => {
    appendEvent(systemEvent(type, message, data));
  };

  const createPendingApproval = (action: VoiceAction): PendingApproval => ({
    id: crypto.randomUUID(),
    kind: approvalKindForAction(action),
    message: approvalMessageForAction(action),
    action,
    createdAt: new Date().toISOString()
  });

  const createAgentTask = (action: VoiceAction): AgentTask => ({
    id: crypto.randomUUID(),
    type: taskTypeFromAction(action),
    prompt: asString(action.payload?.prompt) ?? action.rawTranscript,
    repoRoot: config.repoRoot,
    requiresApproval: action.requiresApproval,
    approved: false,
    workflow: action.intent === "RUN_TESTS" ? workflowFromAction(action) : undefined
  });

  const runAgentWorkflow = async (action: VoiceAction): Promise<void> => {
    const runner = createAgentRunner(config);
    activeRunner = runner;
    const task = createAgentTask(action);
    let lastEvent: AgentEvent | undefined;
    let demoArtifactPath: string | undefined;

    patchState({ agentStatus: "running", lastSpokenResponse: startedSpokenResponseForAction(action) });
    for await (const event of runner.runTask(task)) {
      lastEvent = event;
      appendEvent(event);
    }

    if (
      config.runnerMode === "mock" &&
      state.demoMode &&
      action.intent === "BUILD_FEATURE" &&
      lastEvent?.type !== "failed" &&
      lastEvent?.type !== "stopped"
    ) {
      try {
        const artifact = await writeDemoLandingPageArtifact(config.repoRoot);
        demoArtifactPath = artifact.relativePath;
        appendSystemEvent("stdout", artifact.message, { taskId: task.id, path: artifact.relativePath });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to write the demo artifact.";
        lastEvent = systemEvent("failed", message, { taskId: task.id });
        appendEvent(lastEvent);
      }
    }

    activeRunner = null;
    patchState({
      agentStatus:
        lastEvent?.type === "failed"
          ? "failed"
          : lastEvent?.type === "stopped"
            ? "stopped"
            : "complete",
      lastSpokenResponse:
        lastEvent?.type === "failed"
          ? lastEvent.message
          : lastEvent?.type === "stopped"
            ? "Agent stopped."
            : spokenResponseForAction(action, demoArtifactPath)
    });
  };

  const runDiffSummary = async (): Promise<void> => {
    patchState({ agentStatus: "running" });
    appendSystemEvent("started", "Git diff summary workflow started.");
    try {
      const summary = await summarizeGitDiff(config.repoRoot);
      appendSystemEvent("stdout", summary);
      appendSystemEvent("completed", "Git diff summary ready.");
      patchState({
        agentStatus: "complete",
        diffSummary: summary,
        lastSpokenResponse: summary
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to summarize git diff.";
      appendSystemEvent("failed", message);
      patchState({
        agentStatus: "failed",
        lastSpokenResponse: message
      });
    }
  };

  const runApprovedAction = async (approval: PendingApproval): Promise<string> => {
    if (approval.kind === "commit") {
      const message = asString(approval.action.payload?.message) ?? "voiceops update";
      appendSystemEvent("started", `Creating local commit: ${message}`, { approvalId: approval.id });
      const result = await createLocalCommit(config.repoRoot, message, { approved: true });
      appendSystemEvent("completed", result.message, { approvalId: approval.id });
      return result.message;
    }

    if (approval.kind === "branch") {
      const branchName = asString(approval.action.payload?.branchName) ?? "voiceops-demo";
      appendSystemEvent("started", `Creating branch: ${branchName}`, { approvalId: approval.id });
      const result = await createBranch(config.repoRoot, branchName, { approved: true });
      appendSystemEvent("completed", result.message, { approvalId: approval.id });
      return result.message;
    }

    const response = "Approved risky request. No command was run.";
    appendSystemEvent("completed", response, { approvalId: approval.id });
    return response;
  };

  const approvePending = async (res: ServerResponse): Promise<void> => {
    const approval = state.pendingApproval;
    if (!approval) {
      patchState({ lastSpokenResponse: "There is no pending approval." });
      writeJson(res, 409, { error: "no pending approval", state });
      return;
    }

    patchState({ pendingApproval: null, agentStatus: "running" });
    try {
      const response = await runApprovedAction(approval);
      patchState({
        agentStatus: "complete",
        lastSpokenResponse: response
      });
      writeJson(res, 200, { approved: true, state });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Approved action failed.";
      appendSystemEvent("failed", message, { approvalId: approval.id });
      patchState({
        agentStatus: "failed",
        lastSpokenResponse: message
      });
      writeJson(res, 400, { approved: false, error: message, state });
    }
  };

  const rejectPending = (res: ServerResponse): void => {
    const hadApproval = Boolean(state.pendingApproval);
    const response = hadApproval ? "Approval rejected. No action was taken." : "Nothing was waiting for approval.";
    patchState({
      pendingApproval: null,
      agentStatus: "idle",
      lastSpokenResponse: response
    });
    appendSystemEvent("status", response);
    writeJson(res, 200, { rejected: hadApproval, state });
  };

  const respondToCommand = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const body = await readJson(req);
    const transcript = asString(body.transcript);
    if (!transcript?.trim()) {
      writeJson(res, 400, { error: "Transcript is required. Say or type a command before sending." });
      return;
    }

    const action = classifyIntent(transcript);
    const safety = checkActionSafety(action);
    patchState({
      currentTranscript: transcript,
      parsedIntent: action.intent,
      riskLevel: safety.riskLevel
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
      const approval = createPendingApproval(action);
      const response =
        approval.kind === "commit"
          ? "Committing changes requires confirmation. Say confirm commit to continue."
          : approval.kind === "branch"
            ? "Creating a branch requires confirmation. Say confirm branch to continue."
            : "Approval required before continuing.";
      patchState({
        pendingApproval: approval,
        agentStatus: "waiting_approval",
        lastSpokenResponse: response
      });
      appendSystemEvent("approval_required", approval.message, { approvalId: approval.id, reasons: safety.reasons });
      writeJson(res, 202, { action, safety, state });
      return;
    }

    if (!safety.allowed) {
      patchState({
        agentStatus: "idle",
        lastSpokenResponse: safety.reasons[0] ?? "I need a clearer command before continuing."
      });
      writeJson(res, 400, { action, safety, state });
      return;
    }

    if (action.intent === "DEMO_MODE") {
      patchState({
        demoMode: true,
        agentStatus: "idle",
        lastSpokenResponse: "Demo mode ready. Say a coding task."
      });
      appendSystemEvent("status", "Demo mode ready. Say a coding task.");
      writeJson(res, 200, { action, safety, state });
      return;
    }

    if (action.intent === "STOP_AGENT") {
      if (activeRunner) {
        await activeRunner.stop();
        patchState({ lastSpokenResponse: "Stopping the active agent." });
        appendSystemEvent("status", "Stopping the active agent.");
      } else {
        patchState({ agentStatus: "stopped", lastSpokenResponse: "Agent stopped." });
        appendSystemEvent("stopped", "Agent stopped.");
      }
      writeJson(res, 200, { action, safety, state });
      return;
    }

    if (action.intent === "EXPLAIN_STATUS") {
      const response = `Current status: ${state.agentStatus}. Last intent: ${state.parsedIntent}.`;
      patchState({ lastSpokenResponse: response });
      appendSystemEvent("status", response);
      writeJson(res, 200, { action, safety, state });
      return;
    }

    if (action.intent === "UNKNOWN") {
      patchState({
        lastSpokenResponse: "I need a clearer command. Try start demo mode, run the build, or read me what changed."
      });
      writeJson(res, 200, { action, safety, state });
      return;
    }

    if (action.intent === "SUMMARIZE_DIFF") {
      await runDiffSummary();
      writeJson(res, 202, { action, safety, state });
      return;
    }

    await runAgentWorkflow(action);
    writeJson(res, 202, { action, safety, state });
  };

  const streamEvents = (req: IncomingMessage, res: ServerResponse): void => {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "access-control-allow-origin": "*"
    });

    const send = (nextState: VoiceOpsState) => {
      res.write("event: state\n");
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
        writeJson(res, 200, {
          ok: true,
          service: "cursor-voiceops",
          runnerMode: config.runnerMode,
          voice: publicVoiceConfig(config.voice)
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/voice/config") {
        writeJson(res, 200, { voice: publicVoiceConfig(config.voice) });
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

      if (req.method === "POST" && url.pathname === "/voice/stt-session") {
        writeJson(res, 200, await sttService.createClientSession());
        return;
      }

      if (req.method === "POST" && url.pathname === "/voice/tts") {
        const body = await readJson(req);
        const text = asString(body.text) ?? "";
        const speech = await ttsService.synthesize(text);
        if (!speech.available) {
          writeJson(res, 503, speech);
          return;
        }
        writeAudio(res, speech.contentType, speech.audio);
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
