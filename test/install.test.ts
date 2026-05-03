import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { installPlan, createInstallPlan } from "../src/install.ts";
import { createRegistryEntry, loadManifest, writeManifest } from "../src/registry.ts";

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

  const result = installPlan(createInstallPlan(project), registry);

  assert.ok(result.installed.includes("react-tailwind-ui-patterns"));
  assert.ok(existsSync(join(project, ".pi", "skills", "react-tailwind-ui-patterns", "SKILL.md")));

  const lock = JSON.parse(readFileSync(join(project, ".pi", "autoskills-lock.json"), "utf8"));
  assert.equal(lock.skills["react-tailwind-ui-patterns"].sourceType, "pi-autoskills-registry");
});
