import type { ElevenLabsSttSession } from "../../../shared/types";

type RealtimeSttClientOptions = {
  createSession: () => Promise<ElevenLabsSttSession>;
  createWebSocket?: (url: string) => WebSocket;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onStatus?: (message: string) => void;
};

export type RealtimeSttConnection =
  | {
      connected: false;
      reason: string;
    }
  | {
      connected: true;
      sendBase64Audio: (audioBase64: string, sampleRate: number, commit?: boolean) => void;
      close: () => void;
    };

const defaultWebSocketFactory = (url: string): WebSocket => new WebSocket(url);

const transcriptFromMessage = (payload: unknown): { text: string; isFinal: boolean } | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as { message_type?: unknown; text?: unknown };
  if (typeof record.text !== "string" || !record.text.trim()) {
    return null;
  }

  return {
    text: record.text,
    isFinal: record.message_type === "committed_transcript"
  };
};

export const createElevenLabsRealtimeSttClient = (options: RealtimeSttClientOptions) => ({
  async connect(): Promise<RealtimeSttConnection> {
    const session = await options.createSession();
    if (!session.available) {
      return { connected: false, reason: session.reason };
    }

    const websocket = (options.createWebSocket ?? defaultWebSocketFactory)(session.websocketUrl);

    return new Promise<RealtimeSttConnection>((resolve) => {
      websocket.addEventListener("open", () => {
        options.onStatus?.("ElevenLabs realtime STT connected.");
        resolve({
          connected: true,
          sendBase64Audio: (audioBase64, sampleRate, commit = false) => {
            websocket.send(
              JSON.stringify({
                message_type: "input_audio_chunk",
                audio_base_64: audioBase64,
                sample_rate: sampleRate,
                commit
              })
            );
          },
          close: () => websocket.close()
        });
      });

      websocket.addEventListener("message", (event) => {
        try {
          const transcript = transcriptFromMessage(JSON.parse(String(event.data)));
          if (transcript) {
            options.onTranscript?.(transcript.text, transcript.isFinal);
          }
        } catch {
          options.onStatus?.("Ignored malformed ElevenLabs STT message.");
        }
      });

      websocket.addEventListener("error", () => {
        resolve({ connected: false, reason: "ElevenLabs realtime STT connection failed." });
      });
    });
  }
});
