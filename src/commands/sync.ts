import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { COMBO_RULES, FRONTEND_BONUS_SKILLS, TECHNOLOGY_RULES } from "../maps.ts";
import { createRegistryEntry, getDefaultRegistryDir, loadManifest, writeManifest } from "../registry.ts";
import { syncUpstreamRegistry } from "../sync.ts";
import type { SkillSource } from "../types.ts";

function parseArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function collectSkills() {
  const all = new Map<string, { source: SkillSource["source"]; sourceRepo: string; sourcePath: string }>();
  for (const rule of [...TECHNOLOGY_RULES, ...COMBO_RULES]) {
    for (const skill of rule.skills) {
      all.set(skill.registryId, skill);
    }
  }
  for (const skill of FRONTEND_BONUS_SKILLS) {
    all.set(skill.registryId, skill);
  }
  return all;
}

async function main(): Promise<void> {
  const projectRoot = resolve(join(import.meta.dirname, "..", ".."));
  const registryDir = resolve(parseArg("--registry-dir") ?? getDefaultRegistryDir(projectRoot));
  const skillId = parseArg("--only");

  if (process.argv.includes("--local-only")) {
    const existing = loadManifest(registryDir);
    const manifest = { ...existing, skills: {} as typeof existing.skills };
    const skills = collectSkills();

    for (const [registryId, meta] of skills) {
      if (skillId && registryId !== skillId) continue;
      const skillDir = join(registryDir, registryId);
      const skillFile = join(skillDir, "SKILL.md");
      if (!existsSync(skillFile)) continue;
      manifest.skills[registryId] = createRegistryEntry({
        registryId,
        registryDir,
        source: meta.source,
        sourceRepo: meta.sourceRepo,
        sourcePath: meta.sourcePath,
      });
    }

    manifest.generatedAt = new Date().toISOString();
    writeManifest(registryDir, manifest);
    console.log(`Local registry updated: ${registryDir}`);
    return;
  }

  const result = await syncUpstreamRegistry({
    registryDir,
    only: skillId,
    noReview: process.argv.includes("--no-review"),
    verbose: process.argv.includes("--verbose") || process.argv.includes("-v"),
    keepTemp: process.argv.includes("--keep-temp"),
  });
  console.log(`Upstream registry updated: ${registryDir}`);
  console.log(`Updated: ${result.updated.join(", ") || "none"}`);
  console.log(`Skipped: ${result.skipped.join(", ") || "none"}`);
}

main();
