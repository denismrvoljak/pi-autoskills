import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createRegistryEntry, loadManifest, writeManifest } from "../src/registry.ts";

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "pi-autoskills-sync-"));
}

test("registry entries can be created from normalized markdown-only bundles", () => {
  const registry = makeTmpDir();
  mkdirSync(join(registry, "sample-skill", "references"), { recursive: true });
  writeFileSync(
    join(registry, "sample-skill", "SKILL.md"),
    "---\nname: sample-skill\ndescription: sample\n---\n\n# Sample\n\n## Runtime Safety\n",
  );
  writeFileSync(join(registry, "sample-skill", "references", "guide.md"), "# Guide");

  const entry = createRegistryEntry({
    registryId: "sample-skill",
    registryDir: registry,
    source: "claude",
    sourceRepo: "owner/repo",
    sourcePath: "sample-skill/SKILL.md",
    commitSha: "abc123",
  });

  assert.deepEqual(entry.files, ["SKILL.md", "references/guide.md"]);
  assert.equal(entry.sourceRepo, "owner/repo");
  assert.equal(entry.commitSha, "abc123");
});

test("manifest roundtrip preserves registry entries", () => {
  const registry = makeTmpDir();
  const manifest = loadManifest(registry);
  manifest.skills["demo"] = {
    registryId: "demo",
    source: "pi",
    sourceRepo: "pi-autoskills/registry",
    sourcePath: "demo/SKILL.md",
    commitSha: "local-dev",
    files: ["SKILL.md"],
    sha256: { "SKILL.md": "abc" },
    bundleHash: "hash",
    review: {
      status: "approved",
      summary: "ok",
      flags: [],
      reviewedAt: new Date().toISOString(),
    },
    securityCheck: {
      status: "ok",
      summary: "ok",
      findings: [],
      checkedAt: new Date().toISOString(),
    },
  };
  writeManifest(registry, manifest);
  const reread = JSON.parse(readFileSync(join(registry, "index.json"), "utf8"));
  assert.equal(reread.skills.demo.registryId, "demo");
});
