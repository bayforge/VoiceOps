import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { AgentEvent, PublicVoiceConfig, VoiceOpsState } from "../../shared/types";
import {
  approvePending,
  connectStateStream,
  createSttSession,
  getHealth,
  getState,
  getVoiceConfig,
  rejectPending,
  submitCommand,
  synthesizeElevenLabsSpeech
} from "./api";
import { demoCommands } from "./demoCommands";
import { buildStatusTimeline, type StatusTimelineItem } from "./statusTimeline";
import { buildStudioWorkflow, type StudioWorkflowItem } from "./studioWorkflow";
import { createElevenLabsRealtimeSttClient, type RealtimeSttConnection } from "./voice/elevenLabsRealtimeStt";
import { requestMicrophoneCapture, type MicrophoneCaptureResult } from "./voice/microphone";
import { createMockSttService } from "./voice/mockStt";
import { createBrowserSpeechSynthesisSpeaker } from "./voice/speechSynthesis";
import "./styles.css";

const initialState: VoiceOpsState = {
  connectionStatus: "disconnected",
  microphoneStatus: "mock",
  currentTranscript: "",
  parsedIntent: "UNKNOWN",
  riskLevel: "low",
  pendingApproval: null,
  agentStatus: "idle",
  terminalLogs: [],
  diffSummary: "",
  lastSpokenResponse: "Say a coding task to begin.",
  demoMode: false,
  updatedAt: new Date().toISOString()
};

const statusLabel = (state: VoiceOpsState): string => {
  if (state.pendingApproval) {
    return "Approval required before continuing.";
  }
  if (state.agentStatus === "running") {
    return "Agent is working...";
  }
  if (state.agentStatus === "complete") {
    return "Task complete.";
  }
  if (state.agentStatus === "failed") {
    return "Task failed.";
  }
  return state.demoMode ? "Demo mode ready." : "Say a coding task to begin.";
};

const nextActionHint = (state: VoiceOpsState): string => {
  if (state.pendingApproval) {
    return state.pendingApproval.kind === "commit"
      ? "Say confirm commit to continue, or reject to cancel."
      : "Say confirm to continue, or reject to cancel.";
  }
  if (state.agentStatus === "running") {
    return "Say stop agent if you need to interrupt the workflow.";
  }
  if (!state.demoMode) {
    return "Say VoiceOps, start demo mode.";
  }
  if (state.parsedIntent === "DEMO_MODE") {
    return "Say a coding task for the app to build.";
  }
  if (state.agentStatus === "complete" && !state.diffSummary) {
    return "Say run the build, fix the error, or read me what changed.";
  }
  return "Speak the next demo command or type it below.";
};

const eventClass = (event: AgentEvent): string => `log-line log-${event.type}`;

const eventLabel = (event: AgentEvent): string =>
  event.type === "approval_required" ? "approval" : event.type;

const formatEventTime = (timestamp: string): string =>
  new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(timestamp));

function App() {
  const [state, setState] = useState<VoiceOpsState>(initialState);
  const [voiceConfig, setVoiceConfig] = useState<PublicVoiceConfig | null>(null);
  const [draft, setDraft] = useState("");
  const [micListening, setMicListening] = useState(false);
  const mockStt = useMemo(() => createMockSttService(), []);
  const speaker = useMemo(() => createBrowserSpeechSynthesisSpeaker(), []);
  const microphoneRef = useRef<Extract<MicrophoneCaptureResult, { available: true }> | null>(null);
  const realtimeSttRef = useRef<Extract<RealtimeSttConnection, { connected: true }> | null>(null);
  const lastSpokenRef = useRef(initialState.lastSpokenResponse);
  const timelineItems = useMemo(() => buildStatusTimeline(state), [state]);
  const studioWorkflow = useMemo(() => buildStudioWorkflow(state), [state]);
  const displayedTranscript = state.currentTranscript || draft;
  const latestLog = state.terminalLogs[state.terminalLogs.length - 1];
  const voiceActive = micListening || state.microphoneStatus === "listening";
  const outputPreview = state.diffSummary || latestLog?.message || "No generated output yet. Start demo mode to produce a real artifact.";

  useEffect(() => {
    let mounted = true;
    void getHealth().then(async (ok) => {
      if (!mounted) {
        return;
      }
      const snapshot = await getState();
      setState((current) => ({
        ...(snapshot ?? current),
        connectionStatus: ok ? "connected" : "disconnected"
      }));
      const nextVoiceConfig = await getVoiceConfig();
      if (mounted) {
        setVoiceConfig(nextVoiceConfig);
      }
    });

    const events = connectStateStream(
      (nextState) => setState({ ...nextState, connectionStatus: "connected" }),
      () => setState((current) => ({ ...current, connectionStatus: "disconnected" }))
    );

    return () => {
      mounted = false;
      events.close();
    };
  }, []);

  useEffect(() => {
    if (!state.lastSpokenResponse || state.lastSpokenResponse === lastSpokenRef.current) {
      return;
    }
    lastSpokenRef.current = state.lastSpokenResponse;
    void speakResponse(state.lastSpokenResponse);
  }, [state.lastSpokenResponse, voiceConfig?.ttsMode]);

  const speakResponse = async (text: string) => {
    if (voiceConfig?.ttsMode === "elevenlabs") {
      const audio = await synthesizeElevenLabsSpeech(text);
      if (audio) {
        const url = URL.createObjectURL(audio);
        const player = new Audio(url);
        player.onended = () => URL.revokeObjectURL(url);
        player.onerror = () => URL.revokeObjectURL(url);
        try {
          await player.play();
          return;
        } catch {
          URL.revokeObjectURL(url);
        }
      }
    }

    await speaker.speak(text);
  };

  const sendTranscript = async (transcript: string) => {
    const cleanTranscript = transcript.trim();
    if (!cleanTranscript) {
      return;
    }
    setDraft(cleanTranscript);
    const response = await submitCommand(cleanTranscript);
    if (response.state) {
      setState((current) => ({
        ...response.state,
        connectionStatus: current.connectionStatus
      }));
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await sendTranscript(draft);
  };

  const stopMicrophone = () => {
    realtimeSttRef.current?.close();
    realtimeSttRef.current = null;
    microphoneRef.current?.stop();
    microphoneRef.current = null;
    setMicListening(false);
    setState((current) => ({
      ...current,
      microphoneStatus: "mock"
    }));
  };

  const handleMicrophone = async () => {
    if (micListening) {
      stopMicrophone();
      return;
    }

    setState((current) => ({ ...current, microphoneStatus: "listening" }));
    const capture = await requestMicrophoneCapture();
    if (!capture.available) {
      setState((current) => ({
        ...current,
        microphoneStatus: "mock",
        lastSpokenResponse: `${capture.reason} Using mock speech input.`
      }));
      const transcript = await mockStt.listenOnce();
      await sendTranscript(transcript.transcript);
      return;
    }

    microphoneRef.current = capture;
    setMicListening(true);

    if (voiceConfig?.sttMode === "elevenlabs") {
      const client = createElevenLabsRealtimeSttClient({
        createSession: createSttSession,
        onTranscript: (text, isFinal) => {
          setDraft(text);
          setState((current) => ({ ...current, currentTranscript: text }));
          if (isFinal) {
            void sendTranscript(text);
          }
        },
        onStatus: (message) => {
          setState((current) => ({ ...current, lastSpokenResponse: message }));
        }
      });
      const connection = await client.connect();
      if (connection.connected) {
        realtimeSttRef.current = connection;
        setState((current) => ({ ...current, lastSpokenResponse: "Listening with ElevenLabs realtime speech to text." }));
        return;
      }

      setState((current) => ({
        ...current,
        lastSpokenResponse: `${connection.reason} Using mock speech input.`
      }));
    }

    const transcript = await mockStt.listenOnce();
    await sendTranscript(transcript.transcript);
    stopMicrophone();
  };

  return (
    <main className="app-shell">
      <div className="background-glow glow-one" aria-hidden="true" />
      <div className="background-glow glow-two" aria-hidden="true" />

      <header className="studio-header" aria-label="VoiceOps status">
        <div className="brand-lockup">
          <p className="eyebrow">Cursor VoiceOps</p>
          <h1>Voice development studio</h1>
          <p className="hero-copy">
            Speak a task, watch the agent plan, code, validate, summarize, and ask before risky actions.
          </p>
        </div>
        <div className="status-cluster" aria-label="System status">
          <StatusBadge label="API" value={state.connectionStatus} tone={state.connectionStatus === "connected" ? "good" : "bad"} />
          <StatusBadge label="Mic" value={state.microphoneStatus} tone={state.microphoneStatus === "listening" ? "warn" : "neutral"} />
          <StatusBadge label="STT" value={voiceConfig?.sttMode ?? "mock"} tone={voiceConfig?.sttMode === "elevenlabs" ? "good" : "neutral"} />
          <StatusBadge label="TTS" value={voiceConfig?.ttsMode ?? "browser"} tone={voiceConfig?.ttsMode === "elevenlabs" ? "good" : "neutral"} />
          <StatusBadge label="Risk" value={state.riskLevel} tone={state.riskLevel === "high" ? "bad" : state.riskLevel === "medium" ? "warn" : "good"} />
        </div>
      </header>

      <section className="studio-grid" aria-label="Voice command studio">
        <GlassPanel className="voice-panel" eyebrow="Voice input" title="Command channel">
          <div className="voice-stage">
            <VoiceOrb active={voiceActive} status={state.microphoneStatus} />
            <div>
              <p className="state-kicker">{voiceActive ? "Listening now" : state.demoMode ? "Demo mode armed" : "Standing by"}</p>
              <p className="next-action">{nextActionHint(state)}</p>
            </div>
          </div>

          <form className="floating-action-input" onSubmit={handleSubmit}>
            <input
              id="voice-command-transcript"
              name="transcript"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type or paste a spoken command"
              aria-label="Voice command transcript"
            />
            <button type="submit">Send</button>
            <button
              type="button"
              className="secondary"
              onClick={handleMicrophone}
              aria-label={micListening ? "Stop microphone capture" : "Start microphone capture"}
              aria-pressed={micListening}
            >
              {micListening ? "Stop mic" : "Start mic"}
            </button>
          </form>
        </GlassPanel>

        <GlassPanel className="conversation-panel" eyebrow="Conversation" title="What VoiceOps heard">
          <div className="conversation-stack" aria-live="polite">
            <ConversationMessage role="You said" tone="user">
              {displayedTranscript || "Waiting for a voice command."}
            </ConversationMessage>
            <ConversationMessage role="VoiceOps says" tone="assistant">
              {state.lastSpokenResponse}
            </ConversationMessage>
          </div>
          <div className="intent-strip" aria-label="Parsed command details">
            <MetricPill label="Intent" value={state.parsedIntent} />
            <MetricPill label="Risk" value={state.riskLevel} />
            <MetricPill label="Agent" value={state.agentStatus} />
            <MetricPill label="Mode" value={state.demoMode ? "demo" : "manual"} />
          </div>
        </GlassPanel>

        <GlassPanel className="workflow-panel" eyebrow="Agent workflow" title="Live execution path">
          <ol className="workflow-steps">
            {studioWorkflow.map((item) => (
              <WorkflowStep key={item.label} item={item} />
            ))}
          </ol>
        </GlassPanel>
      </section>

      <section className="review-grid" aria-label="Agent controls and review">
        <GlassPanel className={state.pendingApproval ? "approval-panel approval-panel-active" : "approval-panel"} eyebrow="Safety gate" title="Approval prompt">
          {state.pendingApproval ? (
            <div className="approval">
              <p className="approval-kicker">Approval required</p>
              <p>{state.pendingApproval.message}</p>
              <p className="voice-hint">
                {state.pendingApproval.kind === "commit"
                  ? "Say confirm commit to continue."
                  : "Say confirm to continue."}
              </p>
              <div className="button-row">
                <button type="button" onClick={() => void approvePending().then((response) => response.state && setState(response.state))}>
                  Confirm
                </button>
                <button type="button" className="danger" onClick={() => void rejectPending().then((response) => response.state && setState(response.state))}>
                  Reject
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <span aria-hidden="true" />
              <p>No approval waiting.</p>
              <small>Commits, branches, deletion, and risky commands pause here first.</small>
            </div>
          )}
        </GlassPanel>

        <GlassPanel className="onboarding-panel" eyebrow="Demo script" title="Next voice moves">
          <p className="panel-lede">{statusLabel(state)}</p>
          <div className="demo-grid">
            {demoCommands.map((command, index) => (
              <button
                key={command.intent}
                type="button"
                className="secondary demo-command"
                onClick={() => void sendTranscript(command.transcript)}
              >
                <span>{index + 1}</span>
                {command.label}
              </button>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel className="output-panel" eyebrow="Output preview" title="Produced app/code signal">
          <p className="summary-text">{outputPreview}</p>
        </GlassPanel>
      </section>

      <section className="workbench" aria-label="Execution workbench">
        <div className="terminal glass-panel">
          <div className="terminal-head">
            <div>
              <p className="eyebrow">Terminal</p>
              <h2>Execution logs</h2>
            </div>
            <span className={`agent-pill agent-${state.agentStatus}`}>{state.agentStatus}</span>
          </div>
          <div className="terminal-body" aria-live="polite" aria-label="Terminal output stream">
            {state.terminalLogs.length === 0 ? (
              <p className="log-line muted">No terminal output yet.</p>
            ) : (
              state.terminalLogs.map((event, index) => (
                <p key={`${event.timestamp}-${index}`} className={eventClass(event)}>
                  <span className="log-time">{formatEventTime(event.timestamp)}</span>
                  <span>{eventLabel(event)}</span>
                  {event.message}
                </p>
              ))
            )}
          </div>
        </div>

        <div className="summary-column">
          <GlassPanel eyebrow="Pipeline" title="Safety timeline">
            <ol className="timeline">
              {timelineItems.map((item) => (
                <TimelineStep key={item.label} item={item} />
              ))}
            </ol>
          </GlassPanel>
          <GlassPanel eyebrow="Git" title="Diff summary">
            <p className="summary-text">{state.diffSummary || "Ask VoiceOps to read what changed."}</p>
          </GlassPanel>
        </div>
      </section>
    </main>
  );
}

function StatusBadge({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "bad" | "neutral" }) {
  return (
    <div className={`status-badge badge-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="metric-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}

function GlassPanel({
  title,
  eyebrow,
  className = "",
  children
}: {
  title: string;
  eyebrow?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <article className={`glass-panel ${className}`}>
      <div className="panel-heading">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      {children}
    </article>
  );
}

function VoiceOrb({ active, status }: { active: boolean; status: string }) {
  return (
    <div className={active ? "voice-orb voice-orb-active" : "voice-orb"} role="img" aria-label={`Voice activity status: ${status}`}>
      <span className="orb-core" />
      <span className="orb-ring orb-ring-one" />
      <span className="orb-ring orb-ring-two" />
      <span className="orb-wave orb-wave-one" />
      <span className="orb-wave orb-wave-two" />
      <span className="orb-wave orb-wave-three" />
    </div>
  );
}

function ConversationMessage({ role, tone, children }: { role: string; tone: "user" | "assistant"; children: ReactNode }) {
  return (
    <div className={`conversation-message message-${tone}`}>
      <span>{role}</span>
      <p>{children}</p>
    </div>
  );
}

function WorkflowStep({ item }: { item: StudioWorkflowItem }) {
  return (
    <li className={`workflow-step workflow-${item.state}`}>
      <span className="workflow-index" aria-hidden="true" />
      <div>
        <strong>{item.label}</strong>
        <p>{item.detail}</p>
      </div>
    </li>
  );
}

function TimelineStep({ item }: { item: StatusTimelineItem }) {
  return (
    <li className={`timeline-step timeline-${item.state}`}>
      <span className="timeline-dot" aria-hidden="true" />
      <div>
        <strong>{item.label}</strong>
        <p>{item.detail}</p>
      </div>
    </li>
  );
}

export default App;
