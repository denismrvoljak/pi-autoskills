import test from "node:test";
import assert from "node:assert/strict";

import { COMBO_RULES, FRONTEND_BONUS_SKILLS, TECHNOLOGY_RULES } from "../src/maps.ts";
import { getDefaultRegistryDir, loadManifest, verifyManifestEntry } from "../src/registry.ts";

test("bundled registry covers every referenced mapped skill", () => {
  const manifest = loadManifest(getDefaultRegistryDir());
  const referenced = new Set<string>();

  for (const rule of [...TECHNOLOGY_RULES, ...COMBO_RULES]) {
    for (const skill of rule.skills) referenced.add(skill.registryId);
  }
  for (const skill of FRONTEND_BONUS_SKILLS) referenced.add(skill.registryId);

  const missing = [...referenced].sort().filter((registryId) => !manifest.skills[registryId]);
  assert.deepEqual(missing, []);
});

test("bundled registry entries pass integrity verification", () => {
  const registryDir = getDefaultRegistryDir();
  const manifest = loadManifest(registryDir);

  const failures = Object.entries(manifest.skills)
    .map(([registryId, entry]) => [registryId, verifyManifestEntry(registryDir, entry)] as const)
    .filter(([, verdict]) => !verdict.ok)
    .map(([registryId, verdict]) => `${registryId}: ${verdict.reason}`);

  assert.deepEqual(failures, []);
});
