import { createHash } from "node:crypto";

import type { SecurityFinding } from "./types.ts";

const BLOCKED_PATTERNS: Array<[RegExp, string]> = [
  [/ignore (all|previous|prior) instructions/i, "Attempts to override higher-priority instructions."],
  [/exfiltrat(e|ion)|send .*secret|upload .*credential/i, "Contains credential exfiltration language."],
  [/curl\s+[^\n|]+\|\s*(sh|bash)/i, "Contains remote shell pipe."],
  [/read\s+~\/.ssh|\.env\b|keychain/i, "Targets sensitive local secrets."],
];

const WARNING_PATTERNS: Array<[RegExp, string]> = [
  [/sudo\b/i, "Contains privileged shell guidance."],
  [/rm\s+-rf\b/i, "Contains destructive shell guidance."],
  [/always run/i, "Contains absolutist action language."],
];

export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function scanSkillText(text: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  for (const [pattern, message] of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      findings.push({ code: "blocked-pattern", message, severity: "blocked" });
    }
  }

  for (const [pattern, message] of WARNING_PATTERNS) {
    if (pattern.test(text)) {
      findings.push({ code: "warning-pattern", message, severity: "warning" });
    }
  }

  return findings;
}
