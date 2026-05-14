import { describe, expect, test, vi } from "vitest";
import { createElevenLabsRealtimeSttClient } from "./elevenLabsRealtimeStt";

describe("ElevenLabs realtime STT browser client", () => {
  test("reports unavailable when the session endpoint cannot provide a token", async () => {
    const client = createElevenLabsRealtimeSttClient({
      createSession: vi.fn().mockResolvedValue({
        available: false,
        reason: "ElevenLabs API key is not configured."
      })
    });

    await expect(client.connect()).resolves.toEqual({
      connected: false,
      reason: "ElevenLabs API key is not configured."
    });
  });

  test("connects to the websocket URL returned by the server", async () => {
    const send = vi.fn();
    const close = vi.fn();
    const websocket = {
      readyState: 1,
      send,
      close,
      addEventListener: vi.fn((event: string, callback: () => void) => {
        if (event === "open") {
          callback();
        }
      })
    };
    const createWebSocket = vi.fn(() => websocket as unknown as WebSocket);
    const client = createElevenLabsRealtimeSttClient({
      createSession: vi.fn().mockResolvedValue({
        available: true,
        token: "token",
        websocketUrl: "wss://api.elevenlabs.io/v1/speech-to-text/realtime?token=token"
      }),
      createWebSocket
    });

    const result = await client.connect();

    expect(result).toMatchObject({ connected: true });
    expect(createWebSocket).toHaveBeenCalledWith(
      "wss://api.elevenlabs.io/v1/speech-to-text/realtime?token=token"
    );
    if (result.connected) {
      result.sendBase64Audio("abc", 16000, true);
      result.close();
    }
    expect(send).toHaveBeenCalledWith(
      JSON.stringify({
        message_type: "input_audio_chunk",
        audio_base_64: "abc",
        sample_rate: 16000,
        commit: true
      })
    );
    expect(close).toHaveBeenCalled();
  });
});
