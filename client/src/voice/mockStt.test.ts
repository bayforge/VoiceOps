import { describe, expect, test } from "vitest";
import { createMockSttService } from "./mockStt";

describe("mock STT service", () => {
  test("returns scripted transcripts in sequence", async () => {
    const service = createMockSttService(["VoiceOps, start demo mode.", "Run the build."]);

    await expect(service.listenOnce()).resolves.toEqual({
      transcript: "VoiceOps, start demo mode.",
      isFinal: true,
      source: "mock"
    });
    await expect(service.listenOnce()).resolves.toMatchObject({
      transcript: "Run the build.",
      source: "mock"
    });
  });
});
