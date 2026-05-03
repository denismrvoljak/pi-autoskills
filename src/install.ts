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
import { discoverSkills } from "./discovery.ts";
import { matchSkills } from "./match.ts";
import {
  getDefaultCacheRegistryDir,
  getDefaultRegistryDir,
  loadManifest,
  verifyManifestEntry,
} from "./registry.ts";
import { cacheSkillFromSource } from "./sync.ts";
import type {
  InstallPlan,
  InstallResult,
  MatchResult,
  RegistryEntry,
  RegistryManifest,
  UnavailableSkill,
} from "./types.ts";

interface ResolvedSkill {
  registryDir: string;
  entry: RegistryEntry;
}

function copyVerifiedFiles(srcDir: string, destDir: string, files: string[]): void {
  mkdirSync(destDir, { recursive: true });
  for (const rel of files) {
    const from = join(srcDir, rel);
    const to = join(destDir, rel);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
}

function getManifest(cache: Map<string, RegistryManifest>, registryDir: string): RegistryManifest {
  const existing = cache.get(registryDir);
  if (existing) return existing;
  const loaded = loadManifest(registryDir);
  cache.set(registryDir, loaded);
  return loaded;
}

function resolveLocalSkill(
  registryDirs: string[],
  skill: MatchResult,
  manifestCache: Map<string, RegistryManifest>,
): { resolved?: ResolvedSkill; unavailable?: UnavailableSkill } {
  let sawIntegrityError = false;
  let integrityDetail = "integrity verification failed";

  for (const registryDir of registryDirs) {
    const manifest = getManifest(manifestCache, registryDir);
    const entry = manifest.skills[skill.registryId];
    if (!entry) continue;

    if (entry.review.status === "rejected" || entry.securityCheck.status === "blocked") {
      return {
        unavailable: {
          ...skill,
          availability: "blocked",
          detail: "blocked by registry review or security scan",
        },
      };
    }

    const verdict = verifyManifestEntry(registryDir, entry);
    if (!verdict.ok) {
      sawIntegrityError = true;
      integrityDetail = verdict.reason ?? integrityDetail;
      continue;
    }

    return { resolved: { registryDir, entry } };
  }

  if (skill.source !== "pi") {
    return {
      unavailable: {
        ...skill,
        availability: "fetchable",
        detail: sawIntegrityError
          ? `local copy failed integrity checks; dynamic refetch available (${integrityDetail})`
          : "not cached locally; dynamic fetch + audit available",
      },
    };
  }

  return {
    unavailable: {
      ...skill,
      availability: sawIntegrityError ? "integrity-error" : "missing",
      detail: sawIntegrityError ? integrityDetail : "not mirrored in audited local registry",
    },
  };
}

function partitionMatchedSkills(
  matchedSkills: MatchResult[],
  registryDir: string,
  cacheRegistryDir: string,
): { skills: MatchResult[]; unavailableSkills: UnavailableSkill[] } {
  const manifestCache = new Map<string, RegistryManifest>();
  const registryDirs = [cacheRegistryDir, registryDir];
  const skills: MatchResult[] = [];
  const unavailableSkills: UnavailableSkill[] = [];

  for (const skill of matchedSkills) {
    const status = resolveLocalSkill(registryDirs, skill, manifestCache);
    if (status.resolved) skills.push(skill);
    else if (status.unavailable) unavailableSkills.push(status.unavailable);
  }

  return { skills, unavailableSkills };
}

export function createInstallPlan(
  projectDir: string,
  registryDir = getDefaultRegistryDir(projectDir),
  outputDir = join(projectDir, ".pi", "skills"),
  cacheRegistryDir = getDefaultCacheRegistryDir(projectDir),
): InstallPlan {
  const detection = detectTechnologies(projectDir);
  const matchedSkills = matchSkills(detection);
  const { skills, unavailableSkills } = partitionMatchedSkills(matchedSkills, registryDir, cacheRegistryDir);

  return {
    projectDir,
    registryDir,
    cacheRegistryDir,
    outputDir,
    lockfilePath: join(projectDir, ".pi", "autoskills-lock.json"),
    technologies: detection.detected,
    isFrontend: detection.isFrontend,
    combos: detection.combos.map((combo) => ({ id: combo.id, name: combo.name })),
    matchedSkills,
    discoveredSkills: [],
    skills,
    unavailableSkills,
  };
}

export async function createInstallPlanWithDiscovery(
  projectDir: string,
  registryDir = getDefaultRegistryDir(projectDir),
  outputDir = join(projectDir, ".pi", "skills"),
  cacheRegistryDir = getDefaultCacheRegistryDir(projectDir),
): Promise<InstallPlan> {
  const base = createInstallPlan(projectDir, registryDir, outputDir, cacheRegistryDir);
  const discoveredSkills = await discoverSkills(base);
  const mergedMatchedSkills = [...base.matchedSkills];
  const seen = new Set(mergedMatchedSkills.map((skill) => skill.registryId));

  for (const skill of discoveredSkills) {
    if (seen.has(skill.registryId)) continue;
    seen.add(skill.registryId);
    mergedMatchedSkills.push(skill);
  }

  const { skills, unavailableSkills } = partitionMatchedSkills(mergedMatchedSkills, registryDir, cacheRegistryDir);
  return {
    ...base,
    matchedSkills: mergedMatchedSkills,
    discoveredSkills,
    skills,
    unavailableSkills,
  };
}

async function prepareSkillForInstall(
  skill: MatchResult,
  plan: InstallPlan,
  manifestCache: Map<string, RegistryManifest>,
): Promise<{ resolved?: ResolvedSkill; warning?: string }> {
  const local = resolveLocalSkill([plan.cacheRegistryDir, plan.registryDir], skill, manifestCache);
  if (local.resolved) return { resolved: local.resolved };

  if (skill.source === "pi") {
    return { warning: `Unavailable ${skill.registryId}: ${local.unavailable?.detail ?? "missing local skill"}` };
  }

  const fetched = await cacheSkillFromSource(skill, plan.cacheRegistryDir);
  if (!fetched.ok || !fetched.entry) {
    return { warning: `Dynamic fetch failed for ${skill.registryId}: ${fetched.reason ?? "unknown failure"}` };
  }

  manifestCache.delete(plan.cacheRegistryDir);
  const verdict = verifyManifestEntry(plan.cacheRegistryDir, fetched.entry);
  if (!verdict.ok) {
    return { warning: `Integrity failure for ${skill.registryId}: ${verdict.reason}` };
  }

  return {
    resolved: {
      registryDir: plan.cacheRegistryDir,
      entry: fetched.entry,
    },
  };
}

export async function installPlan(
  plan: InstallPlan,
  registryDir = plan.registryDir,
  cacheRegistryDir = plan.cacheRegistryDir,
): Promise<InstallResult> {
  const effectivePlan: InstallPlan = {
    ...plan,
    registryDir,
    cacheRegistryDir,
  };

  mkdirSync(effectivePlan.outputDir, { recursive: true });
  mkdirSync(effectivePlan.cacheRegistryDir, { recursive: true });

  const installed: string[] = [];
  const skipped: string[] = [];
  const warnings: string[] = [];
  const lock = {
    version: 1,
    generatedAt: new Date().toISOString(),
    skills: {} as Record<string, unknown>,
  };
  const manifestCache = new Map<string, RegistryManifest>();

  for (const skill of effectivePlan.matchedSkills) {
    const prepared = await prepareSkillForInstall(skill, effectivePlan, manifestCache);
    if (!prepared.resolved) {
      skipped.push(skill.registryId);
      if (prepared.warning) warnings.push(prepared.warning);
      continue;
    }

    const { registryDir: sourceRegistryDir, entry } = prepared.resolved;
    const src = join(sourceRegistryDir, skill.registryId);
    const dest = join(effectivePlan.outputDir, skill.registryId);
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
      cachedIn: sourceRegistryDir,
    };
    installed.push(skill.registryId);
  }

  mkdirSync(dirname(effectivePlan.lockfilePath), { recursive: true });
  writeFileSync(effectivePlan.lockfilePath, JSON.stringify(lock, null, 2) + "\n");

  return { installed, skipped, warnings, lockfilePath: effectivePlan.lockfilePath };
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
