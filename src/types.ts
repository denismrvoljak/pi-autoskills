export interface ConfigFileContentBlock {
  files?: string[];
  patterns: string[];
  scanGradleLayout?: boolean;
  scanDotNetLayout?: boolean;
}

export interface DetectConfig {
  packages?: string[];
  packagePatterns?: RegExp[];
  configFiles?: string[];
  fileExtensions?: string[];
  gems?: string[];
  configFileContent?: ConfigFileContentBlock | ConfigFileContentBlock[];
}

export interface SkillSource {
  registryId: string;
  source: "claude" | "codex" | "pi";
  sourceRepo: string;
  sourcePath: string;
}

export interface TechnologyRule {
  id: string;
  name: string;
  detect: DetectConfig;
  skills: SkillSource[];
}

export interface ComboRule {
  id: string;
  name: string;
  requires: string[];
  skills: SkillSource[];
}

export interface DetectedTechnology {
  id: string;
  name: string;
}

export interface DetectResult {
  detected: DetectedTechnology[];
  isFrontend: boolean;
  combos: ComboRule[];
}

export interface MatchResult {
  registryId: string;
  source: SkillSource["source"];
  sourceRepo: string;
  sourcePath: string;
  reasons: string[];
}

export interface RegistryReview {
  status: "approved" | "flagged" | "rejected";
  summary: string;
  flags: string[];
  reviewedAt: string;
  reviewer?: {
    model: string;
    promptVersion: string;
  };
}

export interface RegistrySecurityCheck {
  status: "ok" | "warning" | "blocked";
  summary: string;
  findings: string[];
  checkedAt: string;
}

export interface RegistryEntry {
  registryId: string;
  source: SkillSource["source"];
  sourceRepo: string;
  sourcePath: string;
  commitSha: string;
  files: string[];
  sha256: Record<string, string>;
  bundleHash: string;
  review: RegistryReview;
  securityCheck: RegistrySecurityCheck;
}

export interface RegistryManifest {
  version: number;
  generatedAt: string;
  skills: Record<string, RegistryEntry>;
}

export interface InstallPlan {
  projectDir: string;
  outputDir: string;
  lockfilePath: string;
  technologies: DetectedTechnology[];
  isFrontend: boolean;
  combos: Array<{ id: string; name: string }>;
  skills: MatchResult[];
}

export interface InstallResult {
  installed: string[];
  skipped: string[];
  warnings: string[];
  lockfilePath: string;
}

export interface SecurityFinding {
  code: string;
  message: string;
  severity: "warning" | "blocked";
}
