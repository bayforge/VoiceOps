import { describe, expect, test } from "vitest";
import { loadConfig } from "./config";

describe("loadConfig voice settings", () => {
  test("defaults to mock STT and browser TTS when ElevenLabs credentials are missing", () => {
    const config = loadConfig({});

    expect(config.runnerMode).toBe("mock");
    expect(config.voice.sttMode).toBe("mock");
    expect(config.voice.ttsMode).toBe("browser");
    expect(config.voice.elevenLabsConfigured).toBe(false);
    expect(config.voice.elevenLabsVoiceConfigured).toBe(false);
    expect(config.voice.sttModelId).toBe("scribe_v2_realtime");
    expect(config.voice.ttsModelId).toBe("eleven_flash_v2_5");
  });

  test("uses ElevenLabs voice modes only when the required environment variables are present", () => {
    const config = loadConfig({
      PORT: "9001",
      AGENT_RUNNER_MODE: "mock",
      ELEVENLABS_API_KEY: "test-secret-key",
      ELEVENLABS_VOICE_ID: "voice-123",
      VOICE_STT_MODE: "elevenlabs",
      VOICE_TTS_MODE: "elevenlabs",
      ELEVENLABS_STT_MODEL_ID: "scribe_custom",
      ELEVENLABS_TTS_MODEL_ID: "eleven_turbo_v2_5"
    });

    expect(config.port).toBe(9001);
    expect(config.voice.sttMode).toBe("elevenlabs");
    expect(config.voice.ttsMode).toBe("elevenlabs");
    expect(config.voice.elevenLabsConfigured).toBe(true);
    expect(config.voice.elevenLabsVoiceConfigured).toBe(true);
    expect(config.voice.sttModelId).toBe("scribe_custom");
    expect(config.voice.ttsModelId).toBe("eleven_turbo_v2_5");
  });

  test("falls back when ElevenLabs modes are requested without credentials", () => {
    const config = loadConfig({
      VOICE_STT_MODE: "elevenlabs",
      VOICE_TTS_MODE: "elevenlabs"
    });

    expect(config.voice.sttMode).toBe("mock");
    expect(config.voice.ttsMode).toBe("browser");
    expect(config.voice.elevenLabsConfigured).toBe(false);
  });
});
