import type { ElevenLabsSttSession, PublicVoiceConfig, VoiceConfig } from "../../../shared/types.js";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type ElevenLabsTtsResult =
  | {
      available: false;
      reason: string;
    }
  | {
      available: true;
      audio: ArrayBuffer;
      contentType: string;
    };

export const publicVoiceConfig = (config: VoiceConfig): PublicVoiceConfig => ({
  sttMode: config.sttMode,
  ttsMode: config.ttsMode,
  elevenLabsConfigured: config.elevenLabsConfigured,
  elevenLabsVoiceConfigured: config.elevenLabsVoiceConfigured,
  sttModelId: config.sttModelId,
  ttsModelId: config.ttsModelId
});

const unavailable = (reason: string): { available: false; reason: string } => ({
  available: false,
  reason
});

const readToken = async (response: Response): Promise<string | undefined> => {
  const body = (await response.json()) as { token?: unknown };
  return typeof body.token === "string" && body.token.trim() ? body.token.trim() : undefined;
};

export const createElevenLabsRealtimeSttService = (
  config: VoiceConfig,
  fetchImpl: FetchLike = fetch
) => ({
  async createClientSession(): Promise<ElevenLabsSttSession> {
    if (!config.elevenLabsApiKey) {
      return unavailable("ElevenLabs API key is not configured.");
    }

    const response = await fetchImpl(config.tokenUrl, {
      method: "POST",
      headers: {
        "xi-api-key": config.elevenLabsApiKey
      }
    });

    if (!response.ok) {
      return unavailable(`ElevenLabs STT token request failed with status ${response.status}.`);
    }

    const token = await readToken(response);
    if (!token) {
      return unavailable("ElevenLabs STT token response was missing a token.");
    }

    const websocketUrl = new URL(config.realtimeSttUrl);
    websocketUrl.searchParams.set("model_id", config.sttModelId);
    websocketUrl.searchParams.set("token", token);

    return {
      available: true,
      token,
      websocketUrl: websocketUrl.toString()
    };
  }
});

export const createElevenLabsTtsService = (
  config: VoiceConfig,
  fetchImpl: FetchLike = fetch
) => ({
  async synthesize(text: string): Promise<ElevenLabsTtsResult> {
    const cleanText = text.trim();
    if (!cleanText) {
      return unavailable("Text is required for speech synthesis.");
    }

    if (!config.elevenLabsApiKey || !config.elevenLabsVoiceId) {
      return unavailable("ElevenLabs voice credentials are not configured.");
    }

    const url = new URL(
      `${config.ttsStreamUrl.replace(/\/+$/u, "")}/${encodeURIComponent(config.elevenLabsVoiceId)}/stream`
    );
    url.searchParams.set("output_format", config.ttsOutputFormat);

    const response = await fetchImpl(url.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "xi-api-key": config.elevenLabsApiKey
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: config.ttsModelId
      })
    });

    if (!response.ok) {
      return unavailable(`ElevenLabs TTS request failed with status ${response.status}.`);
    }

    return {
      available: true,
      audio: await response.arrayBuffer(),
      contentType: response.headers.get("content-type") ?? "audio/mpeg"
    };
  }
});
