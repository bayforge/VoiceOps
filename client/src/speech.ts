type SpeechWindow = {
  speechSynthesis?: {
    speak: (utterance: BrowserUtterance) => void;
    cancel: () => void;
  };
  SpeechSynthesisUtterance?: new (text: string) => BrowserUtterance;
};

type BrowserUtterance = {
  rate: number;
  pitch: number;
};

export type BrowserSpeaker = {
  available: boolean;
  speak: (text: string) => void;
};

export const createBrowserSpeaker = (target?: SpeechWindow): BrowserSpeaker => {
  const resolvedTarget: SpeechWindow | undefined =
    target ?? (typeof window === "undefined" ? undefined : (window as unknown as SpeechWindow));
  const speechSynthesis = resolvedTarget?.speechSynthesis;
  const Utterance = resolvedTarget?.SpeechSynthesisUtterance;

  if (!speechSynthesis || !Utterance) {
    return {
      available: false,
      speak: () => undefined
    };
  }

  return {
    available: true,
    speak: (text: string) => {
      if (!text.trim()) {
        return;
      }
      speechSynthesis.cancel();
      const utterance = new Utterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
    }
  };
};
