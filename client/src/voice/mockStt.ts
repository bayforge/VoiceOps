export type SttTranscript = {
  transcript: string;
  isFinal: boolean;
  source: "mock";
};

const defaultMockTranscripts = [
  "VoiceOps, start demo mode.",
  "Create a landing page for a voice-controlled recipe app with a dark hero and pricing cards.",
  "Run the build.",
  "Fix the error.",
  "Read me what changed.",
  "Commit it as add voice recipe landing page.",
  "Confirm commit."
];

export const createMockSttService = (transcripts: string[] = defaultMockTranscripts) => {
  let index = 0;

  return {
    async listenOnce(): Promise<SttTranscript> {
      const transcript = transcripts[index % transcripts.length] ?? "VoiceOps, start demo mode.";
      index += 1;
      return {
        transcript,
        isFinal: true,
        source: "mock"
      };
    }
  };
};
