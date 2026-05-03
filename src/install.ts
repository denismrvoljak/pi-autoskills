import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

import { detectTechnologies } from "./detect.ts";
import { matchSkills } from "./match.ts";
import { getDefaultRegistryDir, loadManifest, verifyManifestEntry } from "./registry.ts";
import type { InstallPlan, InstallResult, MatchResult, UnavailableSkill } from "./types.ts";

function copyVerifiedFiles(srcDir: string, destDir: string, files: string[]): void {
  mkdirSync(destDir, { recursive: true });
  for (const rel of files) {
    const from = join(srcDir, rel);
    const to = join(destDir, rel);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
}

function partitionSkills(registryDir: string, skills: MatchResult[]): {
  available: MatchResult[];
  unavailable: UnavailableSkill[];
} {
  const manifest = loadManifest(registryDir);
  const available: MatchResult[] = [];
  const unavailable: UnavailableSkill[] = [];

  for (const skill of skills) {
    const entry = manifest.skills[skill.registryId];
    if (!entry) {
      unavailable.push({ ...skill, availability: "missing", detail: "not mirrored in audited local registry" });
      continue;
    }

    if (entry.review.status === "rejected" || entry.securityCheck.status === "blocked") {
      unavailable.push({ ...skill, availability: "blocked", detail: "blocked by registry review or security scan" });
      continue;
    }

    const verdict = verifyManifestEntry(registryDir, entry);
    if (!verdict.ok) {
      unavailable.push({ ...skill, availability: "integrity-error", detail: verdict.reason ?? "integrity verification failed" });
      continue;
    }

    available.push(skill);
  }

  return { available, unavailable };
}

export function createInstallPlan(
  projectDir: string,
  registryDir = getDefaultRegistryDir(projectDir),
  outputDir = join(projectDir, ".pi", "skills"),
): InstallPlan {
  const detection = detectTechnologies(projectDir);
  const matchedSkills = matchSkills(detection);
  const { available, unavailable } = partitionSkills(registryDir, matchedSkills);

  return {
    projectDir,
    registryDir,
    outputDir,
    lockfilePath: join(projectDir, ".pi", "autoskills-lock.json"),
    technologies: detection.detected,
    isFrontend: detection.isFrontend,
    combos: detection.combos.map((combo) => ({ id: combo.id, name: combo.name })),
    skills: available,
    unavailableSkills: unavailable,
  };
}

export function installPlan(plan: InstallPlan, registryDir = plan.registryDir): InstallResult {
  const manifest = loadManifest(registryDir);
  mkdirSync(plan.outputDir, { recursive: true });

  const installed: string[] = [];
  const skipped: string[] = [];
  const warnings: string[] = [];
  const lock = {
    version: 1,
    generatedAt: new Date().toISOString(),
    skills: {} as Record<string, unknown>,
  };

  for (const skill of plan.skills) {
    const entry = manifest.skills[skill.registryId];
    if (!entry) {
      warnings.push(`Missing registry entry: ${skill.registryId}`);
      skipped.push(skill.registryId);
      continue;
    }

    if (entry.review.status === "rejected" || entry.securityCheck.status === "blocked") {
      warnings.push(`Blocked skill: ${skill.registryId}`);
      skipped.push(skill.registryId);
      continue;
    }

    const verdict = verifyManifestEntry(registryDir, entry);
    if (!verdict.ok) {
      warnings.push(`Integrity failure for ${skill.registryId}: ${verdict.reason}`);
      skipped.push(skill.registryId);
      continue;
    }

    const src = join(registryDir, skill.registryId);
    const dest = join(plan.outputDir, skill.registryId);
    rmSync(dest, { recursive: true, force: true });
    copyVerifiedFiles(src, dest, entry.files);

    if (entry.securityCheck.status === "warning") {
      warnings.push(`Warning for ${skill.registryId}: ${entry.securityCheck.summary}`);
    }

    lock.skills[skill.registryId] = {
      source: entry.sourceRepo,
      sourceType: "pi-autoskills-registry",
      sourcePath: entry.sourcePath,
      commitSha: entry.commitSha,
      bundleHash: entry.bundleHash,
      reasons: skill.reasons,
    };
    installed.push(skill.registryId);
  }

  mkdirSync(dirname(plan.lockfilePath), { recursive: true });
  writeFileSync(plan.lockfilePath, JSON.stringify(lock, null, 2) + "\n");

  return { installed, skipped, warnings, lockfilePath: plan.lockfilePath };
}

export function readInstalledSkills(projectDir: string): string[] {
  const dir = join(projectDir, ".pi", "skills");
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((entry) => {
      const abs = join(dir, entry);
      return statSync(abs).isDirectory() && existsSync(join(abs, "SKILL.md"));
    })
    .sort();
}

export function readLockfile(projectDir: string): unknown {
  const path = join(projectDir, ".pi", "autoskills-lock.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}
