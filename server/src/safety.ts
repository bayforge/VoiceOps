import type { RiskLevel, SafetyResult, VoiceAction } from "../../shared/types.js";

const destructivePatterns = [/\b(rm|del|rmdir|remove-item)\b/i, /\bgit\s+(reset|clean|push|commit)\b/i];
const installPatterns = [/\bnpm\s+(install|i)\b/i, /\bpnpm\s+(add|install)\b/i, /\byarn\s+(add|install)\b/i, /\bbun\s+add\b/i];
const secretPatterns = [/\.env\b/i, /\bcredentials?\b/i, /\btokens?\b/i, /\bsecrets?\b/i, /\bssh\b/i, /\bid_rsa\b/i, /\bid_ed25519\b/i];

const result = (
  allowed: boolean,
  requiresApproval: boolean,
  riskLevel: RiskLevel,
  reasons: string[] = []
): SafetyResult => ({ allowed, requiresApproval, riskLevel, reasons });

const dangerousTranscriptReasons = (action: VoiceAction): string[] => {
  const text = `${action.rawTranscript} ${action.normalizedText}`;
  const reasons: string[] = [];

  if (destructivePatterns.some((pattern) => pattern.test(text))) {
    reasons.push("Transcript mentions destructive command text.");
  }

  if (installPatterns.some((pattern) => pattern.test(text))) {
    reasons.push("Transcript mentions package installation.");
  }

  if (/\bsudo\b/i.test(text)) {
    reasons.push("Transcript mentions sudo.");
  }

  if (secretPatterns.some((pattern) => pattern.test(text))) {
    reasons.push("Transcript mentions environment or secret material.");
  }

  return reasons;
};

export const checkActionSafety = (action: VoiceAction): SafetyResult => {
  if (action.intent === "UNKNOWN") {
    return result(false, false, "low", ["Unknown commands require clarification."]);
  }

  const dangerousReasons = dangerousTranscriptReasons(action);
  if (dangerousReasons.length > 0) {
    return result(false, true, "high", dangerousReasons);
  }

  if (action.intent === "COMMIT_CHANGES") {
    return result(false, true, "high", ["Local commits require explicit voice approval."]);
  }

  if (action.intent === "CREATE_BRANCH") {
    return result(false, true, "high", ["Branch changes require explicit voice approval."]);
  }

  if (action.requiresApproval) {
    return result(false, true, action.riskLevel, ["Action requires explicit approval."]);
  }

  return result(true, false, action.riskLevel);
};
