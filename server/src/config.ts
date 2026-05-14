import path from "node:path";
import type { AppConfig, VoiceConfig, VoiceSttMode, VoiceTtsMode } from "../../shared/types.js";

const trimEnv = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const requestedSttMode = (value: string | undefined): VoiceSttMode =>
  value?.toLowerCase() === "elevenlabs" ? "elevenlabs" : "mock";

const requestedTtsMode = (value: string | undefined): VoiceTtsMode =>
  value?.toLowerCase() === "elevenlabs" ? "elevenlabs" : "browser";

const loadVoiceConfig = (env: NodeJS.ProcessEnv): VoiceConfig => {
  const elevenLabsApiKey = trimEnv(env.ELEVENLABS_API_KEY);
  const elevenLabsVoiceId = trimEnv(env.ELEVENLABS_VOICE_ID);
  const elevenLabsConfigured = Boolean(elevenLabsApiKey);
  const elevenLabsVoiceConfigured = Boolean(elevenLabsApiKey && elevenLabsVoiceId);

  const sttMode =
    requestedSttMode(env.VOICE_STT_MODE) === "elevenlabs" && elevenLabsConfigured ? "elevenlabs" : "mock";
  const ttsMode =
    requestedTtsMode(env.VOICE_TTS_MODE) === "elevenlabs" && elevenLabsVoiceConfigured ? "elevenlabs" : "browser";

  return {
    sttMode,
    ttsMode,
    elevenLabsApiKey,
    elevenLabsConfigured,
    elevenLabsVoiceConfigured,
    elevenLabsVoiceId,
    sttModelId: trimEnv(env.ELEVENLABS_STT_MODEL_ID) ?? "scribe_v2_realtime",
    ttsModelId: trimEnv(env.ELEVENLABS_TTS_MODEL_ID) ?? "eleven_flash_v2_5",
    ttsOutputFormat: trimEnv(env.ELEVENLABS_TTS_OUTPUT_FORMAT) ?? "mp3_44100_128",
    realtimeSttUrl: trimEnv(env.ELEVENLABS_REALTIME_STT_URL) ?? "wss://api.elevenlabs.io/v1/speech-to-text/realtime",
    tokenUrl: trimEnv(env.ELEVENLABS_STT_TOKEN_URL) ?? "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
    ttsStreamUrl: trimEnv(env.ELEVENLABS_TTS_STREAM_URL) ?? "https://api.elevenlabs.io/v1/text-to-speech"
  };
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => ({
  port: Number(env.PORT ?? 8787),
  repoRoot: path.resolve(env.REPO_ROOT && env.REPO_ROOT.trim() ? env.REPO_ROOT : process.cwd()),
  runnerMode: "mock",
  voice: loadVoiceConfig(env)
});
