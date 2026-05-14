import { createBrowserFallbackVoiceService, type VoiceService } from "./voiceService.js";

type ElevenLabsConfig = {
  apiKey?: string;
  voiceId?: string;
};

const toBase64 = (buffer: ArrayBuffer): string => Buffer.from(buffer).toString("base64");

export const createElevenLabsVoiceService = (
  config: ElevenLabsConfig,
  fetchImpl: typeof fetch = fetch
): VoiceService => {
  const apiKey = config.apiKey;
  const voiceId = config.voiceId;

  if (!apiKey || !voiceId) {
    return createBrowserFallbackVoiceService();
  }

  return {
    provider: "elevenlabs",
    isConfigured: true,
    async speak(text: string) {
      const response = await fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "xi-api-key": apiKey
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2"
        })
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs TTS failed with status ${response.status}.`);
      }

      return {
        provider: "elevenlabs",
        audioBase64: toBase64(await response.arrayBuffer())
      };
    },
    async transcribe() {
      throw new Error("Realtime ElevenLabs STT is configured as an integration boundary for the MVP UI mock mode.");
    }
  };
};
