import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export interface AutoskillsPolicy {
  allowRepos?: string[];
  denyRepos?: string[];
  minDiscoveryScore?: number;
  maxDiscoveredSkills?: number;
}

const DEFAULT_POLICY: Required<AutoskillsPolicy> = {
  allowRepos: [],
  denyRepos: [],
  minDiscoveryScore: 6,
  maxDiscoveredSkills: 12,
};

function readPolicyFile(path: string): AutoskillsPolicy | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as AutoskillsPolicy;
  } catch {
    return null;
  }
}

export function getDefaultPolicyPath(projectDir: string): string {
  return resolve(join(projectDir, ".pi", "autoskills-policy.json"));
}

export function loadPolicy(projectDir: string): Required<AutoskillsPolicy> {
  const envPath = process.env.PI_AUTOSKILLS_POLICY;
  const envPolicy = envPath ? readPolicyFile(resolve(envPath)) : null;
  const projectPolicy = readPolicyFile(getDefaultPolicyPath(projectDir));
  const merged = {
    ...DEFAULT_POLICY,
    ...(projectPolicy ?? {}),
    ...(envPolicy ?? {}),
  };
  return {
    allowRepos: Array.isArray(merged.allowRepos) ? merged.allowRepos.map(String) : [],
    denyRepos: Array.isArray(merged.denyRepos) ? merged.denyRepos.map(String) : [],
    minDiscoveryScore: Number.isFinite(merged.minDiscoveryScore) ? Math.max(0, Number(merged.minDiscoveryScore)) : DEFAULT_POLICY.minDiscoveryScore,
    maxDiscoveredSkills: Number.isFinite(merged.maxDiscoveredSkills) ? Math.max(0, Number(merged.maxDiscoveredSkills)) : DEFAULT_POLICY.maxDiscoveredSkills,
  };
}

function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`, "i");
}

function matchesAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => wildcardToRegExp(pattern).test(value));
}

export function repoAllowed(repo: string, policy: Required<AutoskillsPolicy>): boolean {
  if (policy.allowRepos.length > 0 && !matchesAny(repo, policy.allowRepos)) return false;
  if (policy.denyRepos.length > 0 && matchesAny(repo, policy.denyRepos)) return false;
  return true;
}
