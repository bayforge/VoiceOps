import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import type { AgentEvent, AppConfig, PendingApproval, VoiceAction, VoiceOpsState } from "../../shared/types.js";
import { classifyIntent } from "./intent.js";
import { checkActionSafety } from "./safety.js";
import { EventHub } from "./eventHub.js";
import { createInitialState, pushTerminalEvent, systemEvent } from "./state.js";
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

const mockEventsForAction = (action: VoiceAction): AgentEvent[] => {
  if (action.intent === "BUILD_FEATURE") {
    return [
      systemEvent("started", "Mock agent accepted the feature request."),
      systemEvent("stdout", "Reading the typed transcript and preparing a safe task plan."),
      systemEvent("stdout", "Mocking file edits for the requested UI without touching the shell."),
      systemEvent("completed", "Mock response complete. No shell command was run.")
    ];
  }

  if (action.intent === "RUN_TESTS") {
    const workflow = asString(action.payload?.workflow) ?? "validation";
    return [
      systemEvent("started", `Mock ${workflow} workflow started.`),
      systemEvent("stdout", "Would run validation through the safety layer in a later phase."),
      systemEvent("stdout", "No package, shell, or build command was executed."),
      systemEvent("completed", "Mock response complete. No shell command was run.")
    ];
  }

  if (action.intent === "FIX_ERRORS") {
    return [
      systemEvent("started", "Mock fix workflow started."),
      systemEvent("stdout", "Reading the latest terminal context from app state."),
      systemEvent("stdout", "Preparing a mock repair summary."),
      systemEvent("completed", "Mock response complete. No shell command was run.")
    ];
  }

  if (action.intent === "SUMMARIZE_DIFF") {
    return [
      systemEvent("started", "Mock diff summary workflow started."),
      systemEvent("stdout", "Summarizing state changes from the Phase 1/2 command pipeline."),
      systemEvent("completed", "Mock diff summary ready. No git command was run.")
    ];
  }

  return [systemEvent("status", "Mock response recorded.")];
};

const spokenResponseForAction = (action: VoiceAction): string => {
  if (action.intent === "BUILD_FEATURE") {
    return "I logged a mock build task. Shell execution is not enabled yet.";
  }
  if (action.intent === "RUN_TESTS") {
    return "I logged a mock validation run. No build or test command was executed.";
  }
  if (action.intent === "FIX_ERRORS") {
    return "I logged a mock fix workflow using the current terminal context.";
  }
  if (action.intent === "SUMMARIZE_DIFF") {
    return "Mock diff summary: command pipeline, safety checks, approval state, and dashboard updates are wired.";
  }
  return "Mock response complete.";
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

  const runMockWorkflow = (action: VoiceAction): void => {
    patchState({ agentStatus: "running" });
    for (const event of mockEventsForAction(action)) {
      appendEvent(event);
    }
    patchState({
      agentStatus: "complete",
      diffSummary:
        action.intent === "SUMMARIZE_DIFF" ? spokenResponseForAction(action) : state.diffSummary,
      lastSpokenResponse: spokenResponseForAction(action)
    });
  };

  const approvePending = (res: ServerResponse): void => {
    const approval = state.pendingApproval;
    if (!approval) {
      patchState({ lastSpokenResponse: "There is no pending approval." });
      writeJson(res, 409, { error: "no pending approval", state });
      return;
    }

    const response =
      approval.kind === "commit"
        ? "Approved commit request in mock mode. No git command was run."
        : approval.kind === "branch"
          ? "Approved branch request in mock mode. No git command was run."
          : "Approved risky request in mock mode. No command was run.";

    patchState({
      pendingApproval: null,
      agentStatus: "complete",
      lastSpokenResponse: response
    });
    appendSystemEvent("completed", response, { approvalId: approval.id });
    writeJson(res, 200, { approved: true, state });
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
      writeJson(res, 400, { error: "transcript is required" });
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
      approvePending(res);
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
      patchState({ agentStatus: "stopped", lastSpokenResponse: "Agent stopped." });
      appendSystemEvent("stopped", "Agent stopped.");
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
      patchState({ lastSpokenResponse: "I did not understand that. Say a coding task or ask for demo mode." });
      writeJson(res, 200, { action, safety, state });
      return;
    }

    runMockWorkflow(action);
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
        approvePending(res);
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
