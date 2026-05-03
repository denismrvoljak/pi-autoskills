import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { installPlan, createInstallPlan } from "../src/install.ts";
import { createRegistryEntry, loadManifest, verifyManifestEntry, writeManifest } from "../src/registry.ts";

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "pi-autoskills-install-"));
}

test("installPlan installs verified registry skills and writes lockfile", () => {
  const project = makeTmpDir();
  const registry = makeTmpDir();

  writeFileSync(join(project, "package.json"), JSON.stringify({ dependencies: { react: "1", tailwindcss: "1" } }));

  mkdirSync(join(registry, "react-tailwind-ui-patterns"), { recursive: true });
  writeFileSync(
    join(registry, "react-tailwind-ui-patterns", "SKILL.md"),
    "---\nname: react-tailwind-ui-patterns\ndescription: test\n---\n",
  );

  const manifest = loadManifest(registry);
  manifest.skills["react-tailwind-ui-patterns"] = createRegistryEntry({
    registryId: "react-tailwind-ui-patterns",
    registryDir: registry,
    source: "pi",
    sourceRepo: "pi-autoskills/registry",
    sourcePath: "react-tailwind-ui-patterns/SKILL.md",
  });
  writeManifest(registry, manifest);

  const result = installPlan(createInstallPlan(project, registry), registry);

  assert.ok(result.installed.includes("react-tailwind-ui-patterns"));
  assert.ok(existsSync(join(project, ".pi", "skills", "react-tailwind-ui-patterns", "SKILL.md")));

  const lock = JSON.parse(readFileSync(join(project, ".pi", "autoskills-lock.json"), "utf8"));
  assert.equal(lock.skills["react-tailwind-ui-patterns"].sourceType, "pi-autoskills-registry");
});

test("createInstallPlan marks missing registry skills unavailable instead of installable", () => {
  const project = makeTmpDir();
  const registry = makeTmpDir();

  writeFileSync(join(project, "package.json"), JSON.stringify({ devDependencies: { typescript: "1" } }));

  const plan = createInstallPlan(project, registry);
  assert.equal(plan.skills.length, 0);
  assert.equal(plan.unavailableSkills.length, 1);
  assert.equal(plan.unavailableSkills[0].registryId, "typescript-advanced-types");
  assert.equal(plan.unavailableSkills[0].availability, "missing");
});

test("verifyManifestEntry rejects unexpected extra files", () => {
  const registry = makeTmpDir();

  mkdirSync(join(registry, "sample-skill"), { recursive: true });
  writeFileSync(join(registry, "sample-skill", "SKILL.md"), "# Sample\n");

  const entry = createRegistryEntry({
    registryId: "sample-skill",
    registryDir: registry,
    source: "pi",
    sourceRepo: "pi-autoskills/registry",
    sourcePath: "sample-skill/SKILL.md",
  });

  writeFileSync(join(registry, "sample-skill", "EXTRA.md"), "# Extra\n");

  assert.deepEqual(verifyManifestEntry(registry, entry), { ok: false, reason: "unexpected file set" });
});
