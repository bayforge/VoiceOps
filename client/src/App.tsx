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
      <section className="topbar" aria-label="VoiceOps status">
        <div>
          <p className="eyebrow">Cursor VoiceOps</p>
          <h1>Demo cockpit</h1>
        </div>
        <div className="status-cluster">
          <Badge label="API" value={state.connectionStatus} tone={state.connectionStatus === "connected" ? "good" : "bad"} />
          <Badge label="Mic" value={state.microphoneStatus} tone={state.microphoneStatus === "listening" ? "warn" : "neutral"} />
          <Badge label="STT" value={voiceConfig?.sttMode ?? "mock"} tone={voiceConfig?.sttMode === "elevenlabs" ? "good" : "neutral"} />
          <Badge label="TTS" value={voiceConfig?.ttsMode ?? "browser"} tone={voiceConfig?.ttsMode === "elevenlabs" ? "good" : "neutral"} />
          <Badge label="Risk" value={state.riskLevel} tone={state.riskLevel === "high" ? "bad" : state.riskLevel === "medium" ? "warn" : "good"} />
        </div>
      </section>

      <section className="command-band">
        <div className="transcript-card">
          <div className="transcript-head">
            <p className="section-label">Live transcript</p>
            <span className={`agent-pill agent-${state.agentStatus}`}>{state.agentStatus}</span>
          </div>
          <p className="transcript">{state.currentTranscript || draft || "Waiting for a voice command."}</p>
          <div className="transcript-meta">
            <span>{state.parsedIntent}</span>
            <span>Risk {state.riskLevel}</span>
            <span>{state.demoMode ? "Demo armed" : "Demo off"}</span>
          </div>
        </div>
        <form className="command-form" onSubmit={handleSubmit}>
          <input
            id="voice-command-transcript"
            name="transcript"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type or paste a spoken command"
            aria-label="Voice command transcript"
          />
          <button type="submit">Send</button>
          <button type="button" className="secondary" onClick={handleMicrophone}>
            {micListening ? "Stop mic" : "Start mic"}
          </button>
        </form>
      </section>

      <section className="grid">
        <Panel title="Intent">
          <div className="intent-readout">{state.parsedIntent}</div>
          <p className="muted">{statusLabel(state)}</p>
        </Panel>

        <Panel title="Approval">
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
            <p className="muted">No approval waiting.</p>
          )}
        </Panel>

        <Panel title="Spoken response">
          <p className="spoken">{state.lastSpokenResponse}</p>
        </Panel>

        <Panel title="Demo controls">
          <div className="demo-grid">
            {demoCommands.map((command, index) => (
              <button
                key={command.intent}
                type="button"
                className="secondary"
                onClick={() => void sendTranscript(command.transcript)}
              >
                <span>{index + 1}</span>
                {command.label}
              </button>
            ))}
          </div>
        </Panel>
      </section>

      <section className="workbench">
        <div className="terminal">
          <div className="terminal-head">
            <p>Terminal stream</p>
            <span>{state.agentStatus}</span>
          </div>
          <div className="terminal-body" aria-live="polite">
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
          <Panel title="Status timeline">
            <ol className="timeline">
              {timelineItems.map((item) => (
                <TimelineStep key={item.label} item={item} />
              ))}
            </ol>
          </Panel>
          <Panel title="Diff summary">
            <p className="summary-text">{state.diffSummary || "Ask VoiceOps to read what changed."}</p>
          </Panel>
        </div>
      </section>
    </main>
  );
}

function Badge({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "bad" | "neutral" }) {
  return (
    <div className={`badge badge-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="panel">
      <h2>{title}</h2>
      {children}
    </article>
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
