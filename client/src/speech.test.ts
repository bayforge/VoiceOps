import { describe, expect, test, vi } from "vitest";
import { createBrowserSpeaker } from "./speech";

describe("browser speech fallback", () => {
  test("reports unavailable speech synthesis without throwing", () => {
    const speaker = createBrowserSpeaker(undefined);

    expect(speaker.available).toBe(false);
    expect(() => speaker.speak("Hello")).not.toThrow();
  });

  test("speaks with browser SpeechSynthesis when available", () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    const speaker = createBrowserSpeaker({
      speechSynthesis: { speak, cancel },
      SpeechSynthesisUtterance: class {
        text: string;
        rate = 1;
        pitch = 1;
        constructor(text: string) {
          this.text = text;
        }
      }
    });

    speaker.speak("Task complete.");

    expect(cancel).toHaveBeenCalledOnce();
    expect(speak).toHaveBeenCalledOnce();
    expect(speaker.available).toBe(true);
  });
});
