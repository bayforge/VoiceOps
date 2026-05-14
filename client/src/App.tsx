import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import type { AgentEvent, VoiceOpsState } from "../../shared/types";
import { approvePending, connectStateStream, getHealth, getState, rejectPending, submitCommand } from "./api";
import { demoCommands } from "./demoCommands";
import { createBrowserSpeaker } from "./speech";
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
  gitStatus: "",
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

function App() {
  const [state, setState] = useState<VoiceOpsState>(initialState);
  const [draft, setDraft] = useState("");
  const [micListening, setMicListening] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const speaker = useMemo(() => createBrowserSpeaker(), []);

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
    if (speechEnabled && speaker.available) {
      speaker.speak(state.lastSpokenResponse);
    }
  }, [speaker, speechEnabled, state.lastSpokenResponse]);

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

  const handleMockMic = () => {
    setMicListening((value) => !value);
    setState((current) => ({
      ...current,
      microphoneStatus: micListening ? "mock" : "listening"
    }));
  };

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="VoiceOps status">
        <div>
          <p className="eyebrow">Cursor VoiceOps</p>
          <h1>Hands-free developer cockpit</h1>
        </div>
        <div className="status-cluster">
          <Badge label="API" value={state.connectionStatus} tone={state.connectionStatus === "connected" ? "good" : "bad"} />
          <Badge label="Mic" value={state.microphoneStatus} tone={state.microphoneStatus === "listening" ? "warn" : "neutral"} />
          <Badge label="Risk" value={state.riskLevel} tone={state.riskLevel === "high" ? "bad" : state.riskLevel === "medium" ? "warn" : "good"} />
        </div>
      </section>

      <section className="command-band">
        <div>
          <p className="section-label">Current transcript</p>
          <p className="transcript">{state.currentTranscript || draft || "Waiting for a voice command."}</p>
        </div>
        <form className="command-form" onSubmit={handleSubmit}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type or paste a spoken command"
            aria-label="Voice command transcript"
          />
          <button type="submit">Send</button>
          <button type="button" className="secondary" onClick={handleMockMic}>
            {micListening ? "Stop mock mic" : "Mock mic"}
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
              <p>{state.pendingApproval.message}</p>
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
            <p className="muted">No pending approval.</p>
          )}
        </Panel>

        <Panel title="Spoken response">
          <p className="spoken">{state.lastSpokenResponse}</p>
          <label className="toggle">
            <input
              checked={speechEnabled}
              onChange={(event) => setSpeechEnabled(event.target.checked)}
              type="checkbox"
            />
            Browser TTS
          </label>
        </Panel>

        <Panel title="Demo controls">
          <div className="demo-grid">
            {demoCommands.map((command) => (
              <button
                key={command.intent}
                type="button"
                className="secondary"
                onClick={() => void sendTranscript(command.transcript)}
              >
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
                  <span>{event.type}</span>
                  {event.message}
                </p>
              ))
            )}
          </div>
        </div>

        <div className="summary-column">
          <Panel title="Diff summary">
            <p className="summary-text">{state.diffSummary || "Ask VoiceOps to read what changed."}</p>
          </Panel>
          <Panel title="Git status">
            <pre>{state.gitStatus || "Git status has not been requested."}</pre>
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

export default App;
