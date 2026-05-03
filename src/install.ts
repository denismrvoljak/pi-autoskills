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
import { loadManifest, verifyManifestEntry } from "./registry.ts";
import type { InstallPlan, InstallResult } from "./types.ts";

function copyDir(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else if (entry.isFile()) {
      mkdirSync(dirname(to), { recursive: true });
      copyFileSync(from, to);
    }
  }
}

export function createInstallPlan(projectDir: string, outputDir = join(projectDir, ".pi", "skills")): InstallPlan {
  const detection = detectTechnologies(projectDir);
  const skills = matchSkills(detection);

  return {
    projectDir,
    outputDir,
    lockfilePath: join(projectDir, ".pi", "autoskills-lock.json"),
    technologies: detection.detected,
    isFrontend: detection.isFrontend,
    combos: detection.combos.map((combo) => ({ id: combo.id, name: combo.name })),
    skills,
  };
}

export function installPlan(plan: InstallPlan, registryDir: string): InstallResult {
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
    copyDir(src, dest);

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
