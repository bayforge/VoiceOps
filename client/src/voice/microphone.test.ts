import { describe, expect, test, vi } from "vitest";
import { requestMicrophoneCapture } from "./microphone";

describe("microphone capture", () => {
  test("reports unavailable when media devices are missing", async () => {
    await expect(requestMicrophoneCapture(undefined)).resolves.toEqual({
      available: false,
      reason: "Microphone capture is not available in this browser."
    });
  });

  test("starts and stops an audio media stream", async () => {
    const stop = vi.fn();
    const stream = {
      getTracks: () => [{ stop }]
    } as unknown as MediaStream;
    const mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(stream)
    } as unknown as MediaDevices;

    const result = await requestMicrophoneCapture(mediaDevices);

    expect(result).toMatchObject({ available: true, stream });
    expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: true,
        noiseSuppression: true
      }
    });
    if (result.available) {
      result.stop();
    }
    expect(stop).toHaveBeenCalled();
  });
});
