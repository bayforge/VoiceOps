import { describe, expect, test, vi } from "vitest";
import { createBrowserSpeechSynthesisSpeaker } from "./speechSynthesis";

describe("browser SpeechSynthesis fallback", () => {
  test("reports unavailable without throwing when SpeechSynthesis is missing", async () => {
    const speaker = createBrowserSpeechSynthesisSpeaker({});

    await expect(speaker.speak("Task complete.")).resolves.toEqual({
      spoken: false,
      reason: "Browser SpeechSynthesis is not available."
    });
  });

  test("speaks text with injected browser synthesis support", async () => {
    const speak = vi.fn((utterance: SpeechSynthesisUtterance) => {
      utterance.onend?.({} as SpeechSynthesisEvent);
    });
    const speaker = createBrowserSpeechSynthesisSpeaker({
      synthesis: {
        cancel: vi.fn(),
        speak
      } as unknown as SpeechSynthesis,
      createUtterance: (text) =>
        ({
          text,
          rate: 1,
          pitch: 1,
          volume: 1
        }) as SpeechSynthesisUtterance
    });

    await expect(speaker.speak("Demo mode ready.")).resolves.toEqual({ spoken: true });
    expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: "Demo mode ready." }));
  });
});
