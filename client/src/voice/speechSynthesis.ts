type SpeakerDependencies = {
  synthesis?: SpeechSynthesis;
  createUtterance?: (text: string) => SpeechSynthesisUtterance;
};

export type SpeakResult =
  | {
      spoken: true;
    }
  | {
      spoken: false;
      reason: string;
    };

const browserSynthesis = (): SpeechSynthesis | undefined =>
  typeof window !== "undefined" ? window.speechSynthesis : undefined;

const browserUtterance = (text: string): SpeechSynthesisUtterance | undefined =>
  typeof SpeechSynthesisUtterance !== "undefined" ? new SpeechSynthesisUtterance(text) : undefined;

export const createBrowserSpeechSynthesisSpeaker = (dependencies: SpeakerDependencies = {}) => ({
  async speak(text: string): Promise<SpeakResult> {
    const cleanText = text.trim();
    if (!cleanText) {
      return { spoken: false, reason: "Text is required for speech synthesis." };
    }

    const synthesis = dependencies.synthesis ?? browserSynthesis();
    const utterance = dependencies.createUtterance?.(cleanText) ?? browserUtterance(cleanText);
    if (!synthesis || !utterance) {
      return { spoken: false, reason: "Browser SpeechSynthesis is not available." };
    }

    return new Promise<SpeakResult>((resolve) => {
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onend = () => resolve({ spoken: true });
      utterance.onerror = () => resolve({ spoken: false, reason: "Browser SpeechSynthesis failed to speak." });
      synthesis.cancel();
      synthesis.speak(utterance);
    });
  }
});
