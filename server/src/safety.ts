import path from "node:path";
import type { RiskLevel, SafetyResult, VoiceAction } from "../../shared/types.js";

const destructiveTokens = ["rm", "del", "rmdir", "remove-item"];
const dangerousGitPatterns = [/git\s+reset\b/i, /git\s+clean\b/i, /git\s+push\b/i, /git\s+commit\b/i];
const installPatterns = [/\bnpm\s+(install|i)\b/i, /\bpnpm\s+(add|install)\b/i, /\byarn\s+(add|install)\b/i, /\bbun\s+add\b/i];
const secretPatterns = [/\.env\b/i, /\bcredentials?\b/i, /\btokens?\b/i, /\bsecrets?\b/i, /\bssh\b/i, /\bid_rsa\b/i, /\bid_ed25519\b/i];

const result = (
  allowed: boolean,
  requiresApproval: boolean,
  riskLevel: RiskLevel,
  reasons: string[] = []
): SafetyResult => ({ allowed, requiresApproval, riskLevel, reasons });

export const isInsideRepo = (repoRoot: string, candidatePath: string): boolean => {
  const resolvedRoot = path.resolve(repoRoot);
  const resolvedCandidate = path.resolve(candidatePath);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

export const checkActionSafety = (action: VoiceAction): SafetyResult => {
  if (action.intent === "UNKNOWN") {
    return result(false, false, "low", ["Unknown commands require clarification."]);
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

export const checkShellCommandSafety = (
  command: string,
  cwd: string,
  repoRoot: string,
  approved = false
): SafetyResult => {
  const reasons: string[] = [];
  const normalized = command.trim();
  const lower = normalized.toLowerCase();

  if (!normalized) {
    return result(false, false, "low", ["No command was provided."]);
  }

  if (!isInsideRepo(repoRoot, cwd)) {
    reasons.push("Command would run outside the repository root.");
  }

  for (const token of destructiveTokens) {
    if (new RegExp(`(^|\\s)${token}(\\s|$)`, "i").test(lower)) {
      reasons.push(`Command contains a destructive token: ${token}.`);
      break;
    }
  }

  if (dangerousGitPatterns.some((pattern) => pattern.test(normalized))) {
    reasons.push("Command contains a risky git operation.");
  }

  if (installPatterns.some((pattern) => pattern.test(normalized))) {
    reasons.push("Package installation requires explicit approval.");
  }

  if (/\bsudo\b/i.test(normalized)) {
    reasons.push("Command contains sudo.");
  }

  if (secretPatterns.some((pattern) => pattern.test(normalized))) {
    reasons.push("Command touches environment or secret material.");
  }

  if (reasons.length === 0) {
    return result(true, false, "low");
  }

  return result(approved, true, "high", reasons);
};
