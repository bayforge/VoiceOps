export type MicrophoneCaptureResult =
  | {
      available: false;
      reason: string;
    }
  | {
      available: true;
      stream: MediaStream;
      stop: () => void;
    };

export const requestMicrophoneCapture = async (
  mediaDevices: MediaDevices | undefined =
    typeof navigator !== "undefined" ? navigator.mediaDevices : undefined
): Promise<MicrophoneCaptureResult> => {
  if (!mediaDevices?.getUserMedia) {
    return {
      available: false,
      reason: "Microphone capture is not available in this browser."
    };
  }

  try {
    const stream = await mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true
      }
    });

    return {
      available: true,
      stream,
      stop: () => stream.getTracks().forEach((track) => track.stop())
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Microphone permission was denied.";
    return {
      available: false,
      reason: message
    };
  }
};
