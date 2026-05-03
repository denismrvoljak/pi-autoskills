import { join, resolve } from "node:path";

import { COMBO_RULES, FRONTEND_BONUS_SKILLS, TECHNOLOGY_RULES } from "../maps.ts";
import { loadManifest, verifyManifestEntry } from "../registry.ts";

function parseArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function main(): void {
  const projectRoot = resolve(join(import.meta.dirname, "..", ".."));
  const registryDir = resolve(parseArg("--registry-dir") ?? join(projectRoot, "registry"));
  const manifest = loadManifest(registryDir);
  const errors: string[] = [];

  for (const [registryId, entry] of Object.entries(manifest.skills)) {
    const verdict = verifyManifestEntry(registryDir, entry);
    if (!verdict.ok) errors.push(`${registryId}: ${verdict.reason}`);
  }

  const referenced = new Set<string>();
  for (const rule of [...TECHNOLOGY_RULES, ...COMBO_RULES]) {
    for (const skill of rule.skills) referenced.add(skill.registryId);
  }
  for (const skill of FRONTEND_BONUS_SKILLS) referenced.add(skill.registryId);

  for (const registryId of [...referenced].sort()) {
    if (!manifest.skills[registryId]) errors.push(`${registryId}: missing registry entry for mapped skill`);
  }

  if (errors.length > 0) {
    console.error("Registry validation failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`Registry validation passed: ${Object.keys(manifest.skills).length} skills.`);
}

main();
