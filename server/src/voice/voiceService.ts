export type VoiceService = {
  provider: "elevenlabs" | "browser-fallback";
  isConfigured: boolean;
  speak(text: string): Promise<{ provider: string; audioBase64?: string }>;
  transcribe(audio: ArrayBuffer): Promise<{ transcript: string; provider: string }>;
};

export const createBrowserFallbackVoiceService = (): VoiceService => ({
  provider: "browser-fallback",
  isConfigured: true,
  async speak() {
    return { provider: "browser-fallback" };
  },
  async transcribe() {
    return { transcript: "", provider: "mock" };
  }
});
