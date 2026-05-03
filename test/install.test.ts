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

test("installPlan installs verified registry skills and writes lockfile", async () => {
  const project = makeTmpDir();
  const registry = makeTmpDir();
  const cacheRegistry = makeTmpDir();

  writeFileSync(join(project, "package.json"), JSON.stringify({ devDependencies: { vitest: "1" } }));
  writeFileSync(join(project, "vitest.config.ts"), "export default {}\n");

  mkdirSync(join(registry, "vitest-testing-patterns"), { recursive: true });
  writeFileSync(
    join(registry, "vitest-testing-patterns", "SKILL.md"),
    "---\nname: vitest-testing-patterns\ndescription: test\n---\n",
  );

  const manifest = loadManifest(registry);
  manifest.skills["vitest-testing-patterns"] = createRegistryEntry({
    registryId: "vitest-testing-patterns",
    registryDir: registry,
    source: "pi",
    sourceRepo: "pi-autoskills/registry",
    sourcePath: "vitest-testing-patterns/SKILL.md",
  });
  writeManifest(registry, manifest);

  const result = await installPlan(createInstallPlan(project, registry, undefined, cacheRegistry), registry, cacheRegistry);

  assert.ok(result.installed.includes("vitest-testing-patterns"));
  assert.ok(existsSync(join(project, ".pi", "skills", "vitest-testing-patterns", "SKILL.md")));

  const lock = JSON.parse(readFileSync(join(project, ".pi", "autoskills-lock.json"), "utf8"));
  assert.equal(lock.skills["vitest-testing-patterns"].sourceType, "pi-autoskills-registry");
});

test("createInstallPlan marks upstream missing skills fetchable", () => {
  const project = makeTmpDir();
  const registry = makeTmpDir();
  const cacheRegistry = makeTmpDir();

  writeFileSync(join(project, "package.json"), JSON.stringify({ devDependencies: { typescript: "1" } }));

  const plan = createInstallPlan(project, registry, undefined, cacheRegistry);
  assert.equal(plan.skills.length, 0);
  assert.equal(plan.unavailableSkills.length, 1);
  assert.equal(plan.unavailableSkills[0].registryId, "typescript-advanced-types");
  assert.equal(plan.unavailableSkills[0].availability, "fetchable");
});

test("installPlan dynamically fetches, audits, caches, and installs missing upstream skills", async () => {
  const project = makeTmpDir();
  const registry = makeTmpDir();
  const cacheRegistry = makeTmpDir();

  writeFileSync(join(project, "package.json"), JSON.stringify({ devDependencies: { typescript: "1" } }));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url === "https://api.github.com/repos/wshobson/agents") {
      return new Response(JSON.stringify({ default_branch: "main" }), { status: 200 });
    }
    if (url === "https://api.github.com/repos/wshobson/agents/branches/main") {
      return new Response(JSON.stringify({ commit: { sha: "abc123" } }), { status: 200 });
    }
    if (url === "https://api.github.com/repos/wshobson/agents/git/trees/abc123?recursive=1") {
      return new Response(JSON.stringify({ tree: [{ path: "typescript-advanced-types/SKILL.md", type: "blob" }] }), { status: 200 });
    }
    if (url === "https://raw.githubusercontent.com/wshobson/agents/abc123/typescript-advanced-types/SKILL.md") {
      return new Response("# TypeScript Advanced Types\n\nPrefer precise types.\n", { status: 200 });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const plan = createInstallPlan(project, registry, undefined, cacheRegistry);
    const result = await installPlan(plan, registry, cacheRegistry);

    assert.deepEqual(result.skipped, []);
    assert.ok(result.installed.includes("typescript-advanced-types"));
    assert.ok(existsSync(join(project, ".pi", "skills", "typescript-advanced-types", "SKILL.md")));
    assert.ok(existsSync(join(cacheRegistry, "typescript-advanced-types", "SKILL.md")));
    assert.ok(existsSync(join(cacheRegistry, ".audit", "typescript-advanced-types.json")));

    const manifest = loadManifest(cacheRegistry);
    assert.equal(manifest.skills["typescript-advanced-types"].commitSha, "abc123");

    const lock = JSON.parse(readFileSync(join(project, ".pi", "autoskills-lock.json"), "utf8"));
    assert.equal(lock.skills["typescript-advanced-types"].commitSha, "abc123");

    const audit = JSON.parse(readFileSync(join(cacheRegistry, ".audit", "typescript-advanced-types.json"), "utf8"));
    assert.equal(audit.source.repo, "wshobson/agents");
    assert.equal(audit.review.status, "approved");
  } finally {
    globalThis.fetch = originalFetch;
  }
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
