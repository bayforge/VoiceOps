import type { ElevenLabsSttSession, PublicVoiceConfig, VoiceAction, VoiceOpsState } from "../../shared/types";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8787";

export type CommandResponse = {
  action?: VoiceAction;
  state: VoiceOpsState;
  error?: string;
};

export const getHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${apiBase}/health`);
    return response.ok;
  } catch {
    return false;
  }
};

export const getState = async (): Promise<VoiceOpsState | null> => {
  try {
    const response = await fetch(`${apiBase}/state`);
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { state: VoiceOpsState };
    return body.state;
  } catch {
    return null;
  }
};

export const submitCommand = async (transcript: string): Promise<CommandResponse> => {
  const response = await fetch(`${apiBase}/commands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transcript })
  });
  return (await response.json()) as CommandResponse;
};

export const approvePending = async (): Promise<CommandResponse> => {
  const response = await fetch(`${apiBase}/approvals`, { method: "POST" });
  return (await response.json()) as CommandResponse;
};

export const rejectPending = async (): Promise<CommandResponse> => {
  const response = await fetch(`${apiBase}/rejections`, { method: "POST" });
  return (await response.json()) as CommandResponse;
};

export const getVoiceConfig = async (): Promise<PublicVoiceConfig | null> => {
  try {
    const response = await fetch(`${apiBase}/voice/config`);
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { voice: PublicVoiceConfig };
    return body.voice;
  } catch {
    return null;
  }
};

export const createSttSession = async (): Promise<ElevenLabsSttSession> => {
  const response = await fetch(`${apiBase}/voice/stt-session`, { method: "POST" });
  return (await response.json()) as ElevenLabsSttSession;
};

export const synthesizeElevenLabsSpeech = async (text: string): Promise<Blob | null> => {
  try {
    const response = await fetch(`${apiBase}/voice/tts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!response.ok) {
      return null;
    }
    return await response.blob();
  } catch {
    return null;
  }
};

export const connectStateStream = (
  onState: (state: VoiceOpsState) => void,
  onError: () => void
): EventSource => {
  const events = new EventSource(`${apiBase}/events`);
  events.addEventListener("state", (event) => {
    onState(JSON.parse((event as MessageEvent).data) as VoiceOpsState);
  });
  events.onerror = () => onError();
  return events;
};
