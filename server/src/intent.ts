import type { RiskLevel, VoiceAction, VoiceIntent } from "../../shared/types.js";

const makeAction = (
  intent: VoiceIntent,
  rawTranscript: string,
  normalizedText: string,
  confidence: number,
  payload: Record<string, unknown> | undefined,
  requiresApproval: boolean,
  riskLevel: RiskLevel
): VoiceAction => ({
  intent,
  rawTranscript,
  normalizedText,
  confidence,
  payload,
  requiresApproval,
  riskLevel
});

export const normalizeTranscript = (transcript: string): string =>
  transcript
    .trim()
    .replace(/[.!?]+$/g, "")
    .replace(/^voiceops[\s,:\-]+/i, "")
    .replace(/\s+/g, " ")
    .toLowerCase();

const originalWithoutWakeWord = (transcript: string): string =>
  transcript
    .trim()
    .replace(/^voiceops[\s,:\-]+/i, "")
    .trim();

const extractAfter = (text: string, patterns: RegExp[]): string | undefined => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/^["']|["']$/g, "").replace(/[.!?]+$/g, "");
    }
  }
  return undefined;
};

export const classifyIntent = (transcript: string): VoiceAction => {
  const normalizedText = normalizeTranscript(transcript);
  const prompt = originalWithoutWakeWord(transcript);

  if (!normalizedText) {
    return makeAction("UNKNOWN", transcript, normalizedText, 0.2, undefined, false, "low");
  }

  if (/\b(confirm|approve|yes confirm|confirm commit|confirm branch|confirm install)\b/.test(normalizedText)) {
    return makeAction("APPROVE_ACTION", transcript, normalizedText, 0.95, undefined, false, "low");
  }

  if (/\b(cancel|reject|do not|don't|no)\b/.test(normalizedText)) {
    return makeAction("REJECT_ACTION", transcript, normalizedText, 0.9, undefined, false, "low");
  }

  if (/\b(start demo mode|demo mode|run the hackathon demo)\b/.test(normalizedText)) {
    return makeAction("DEMO_MODE", transcript, normalizedText, 0.95, undefined, false, "low");
  }

  if (/\b(stop|abort|cancel the agent)\b/.test(normalizedText)) {
    return makeAction("STOP_AGENT", transcript, normalizedText, 0.9, undefined, false, "medium");
  }

  if (/\b(what are you doing|what is happening|read status|status)\b/.test(normalizedText)) {
    return makeAction("EXPLAIN_STATUS", transcript, normalizedText, 0.85, undefined, false, "low");
  }

  if (/\b(commit|create a commit)\b/.test(normalizedText)) {
    const message =
      extractAfter(prompt, [/commit(?: it| this)? as (.+)$/i, /commit message (.+)$/i]) ?? "voiceops update";
    return makeAction(
      "COMMIT_CHANGES",
      transcript,
      normalizedText,
      0.95,
      { message },
      true,
      "high"
    );
  }

  if (/\b(create|start|make)\b.*\bbranch\b/.test(normalizedText)) {
    const branchName =
      extractAfter(prompt, [/branch (?:called|named) (.+)$/i, /branch (.+)$/i]) ?? "voiceops-demo";
    return makeAction(
      "CREATE_BRANCH",
      transcript,
      normalizedText,
      0.9,
      { branchName: branchName.toLowerCase().replace(/[^a-z0-9/_-]+/g, "-") },
      true,
      "high"
    );
  }

  if (/\b(read me what changed|what changed|summarize the diff|read.*changes|diff summary)\b/.test(normalizedText)) {
    return makeAction("SUMMARIZE_DIFF", transcript, normalizedText, 0.9, undefined, false, "low");
  }

  if (/\b(fix|resolve|repair|make.*pass)\b/.test(normalizedText)) {
    return makeAction("FIX_ERRORS", transcript, normalizedText, 0.85, { prompt }, false, "medium");
  }

  if (/\b(run|check)\b.*\b(build|test|tests|typecheck|passes)\b/.test(normalizedText)) {
    const workflow = normalizedText.includes("build")
      ? "build"
      : normalizedText.includes("typecheck")
        ? "typecheck"
        : "test";
    return makeAction("RUN_TESTS", transcript, normalizedText, 0.9, { workflow }, false, "low");
  }

  if (/\b(build|create|add|make|implement|design)\b/.test(normalizedText)) {
    return makeAction("BUILD_FEATURE", transcript, normalizedText, 0.85, { prompt }, false, "low");
  }

  return makeAction("UNKNOWN", transcript, normalizedText, 0.25, undefined, false, "low");
};
