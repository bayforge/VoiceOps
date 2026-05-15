import { describe, expect, test, vi } from "vitest";
import type { VoiceConfig } from "../../../shared/types";
import {
  createElevenLabsRealtimeSttService,
  createElevenLabsTtsService,
  publicVoiceConfig
} from "./elevenLabs";

const configuredVoice: VoiceConfig = {
  sttMode: "elevenlabs",
  ttsMode: "elevenlabs",
  elevenLabsApiKey: "secret-api-key",
  elevenLabsConfigured: true,
  elevenLabsVoiceConfigured: true,
  elevenLabsVoiceId: "voice-123",
  sttModelId: "scribe_v2_realtime",
  ttsModelId: "eleven_flash_v2_5",
  ttsOutputFormat: "mp3_44100_128",
  realtimeSttUrl: "wss://api.elevenlabs.io/v1/speech-to-text/realtime",
  tokenUrl: "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
  ttsStreamUrl: "https://api.elevenlabs.io/v1/text-to-speech"
};

describe("ElevenLabs voice service helpers", () => {
  test("redacts server-only credentials from public voice config", () => {
    const redacted = publicVoiceConfig(configuredVoice);

    expect(redacted).toEqual({
      sttMode: "elevenlabs",
      ttsMode: "elevenlabs",
      elevenLabsConfigured: true,
      elevenLabsVoiceConfigured: true,
      sttModelId: "scribe_v2_realtime",
      ttsModelId: "eleven_flash_v2_5"
    });
    expect(JSON.stringify(redacted)).not.toContain("secret-api-key");
  });

  test("does not request an STT token when the API key is missing", async () => {
    const fetchImpl = vi.fn();
    const service = createElevenLabsRealtimeSttService(
      {
        ...configuredVoice,
        sttMode: "mock",
        elevenLabsApiKey: undefined,
        elevenLabsConfigured: false
      },
      fetchImpl
    );

    await expect(service.createClientSession()).resolves.toEqual({
      available: false,
      reason: "ElevenLabs API key is not configured."
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("creates a browser-safe realtime STT session token when configured", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ token: "single-use-token" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    const service = createElevenLabsRealtimeSttService(configuredVoice, fetchImpl);

    await expect(service.createClientSession()).resolves.toEqual({
      available: true,
      token: "single-use-token",
      websocketUrl:
        "wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&token=single-use-token"
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "xi-api-key": "secret-api-key"
        })
      })
    );
  });

  test("does not synthesize TTS when voice credentials are missing", async () => {
    const fetchImpl = vi.fn();
    const service = createElevenLabsTtsService(
      {
        ...configuredVoice,
        ttsMode: "browser",
        elevenLabsApiKey: undefined,
        elevenLabsConfigured: false,
        elevenLabsVoiceId: undefined,
        elevenLabsVoiceConfigured: false
      },
      fetchImpl
    );

    await expect(service.synthesize("Hello")).resolves.toEqual({
      available: false,
      reason: "ElevenLabs voice credentials are not configured."
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("streams TTS audio from the configured ElevenLabs voice", async () => {
    const audio = new Uint8Array([1, 2, 3]).buffer;
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(audio, {
        status: 200,
        headers: { "content-type": "audio/mpeg" }
      })
    );
    const service = createElevenLabsTtsService(configuredVoice, fetchImpl);

    const result = await service.synthesize("Task complete.");

    expect(result).toMatchObject({
      available: true,
      contentType: "audio/mpeg"
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.elevenlabs.io/v1/text-to-speech/voice-123/stream?output_format=mp3_44100_128",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          text: "Task complete.",
          model_id: "eleven_flash_v2_5"
        })
      })
    );
  });
});
