import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createInstallPlanWithDiscovery } from "../src/install.ts";

function makeProject(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "pi-autoskills-discovery-"));
  for (const [path, content] of Object.entries(files)) {
    const abs = join(root, path);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

test("createInstallPlanWithDiscovery uses catalog adapter and policy config", async () => {
  const project = makeProject({
    ".pi/autoskills-policy.json": JSON.stringify({
      allowRepos: ["clerk/*"],
      denyRepos: ["*/blocked*"],
      minDiscoveryScore: 10,
      maxDiscoveredSkills: 1,
    }),
    "package.json": JSON.stringify({
      dependencies: {
        react: "1",
        "@clerk/nextjs": "1",
      },
    }),
  });

  const catalogPath = join(project, "catalog-index.json");
  writeFileSync(catalogPath, JSON.stringify({
    skills: {
      "clerk-react-patterns": {
        source: "clerk/skills",
        skillPath: "clerk/skills/clerk-react-patterns",
        files: ["SKILL.md", "guide.md", "api.md"],
        bundleHash: "a",
      },
      "clerk-swift": {
        source: "clerk/skills",
        skillPath: "clerk/skills/clerk-swift",
        files: ["SKILL.md"],
        bundleHash: "b",
      },
      "blocked-react-patterns": {
        source: "random/blocked-repo",
        skillPath: "random/blocked-repo/blocked-react-patterns",
        files: ["SKILL.md"],
        bundleHash: "c",
      },
    },
  }));

  const previousCatalog = process.env.PI_AUTOSKILLS_CATALOG_INDEX;
  process.env.PI_AUTOSKILLS_CATALOG_INDEX = catalogPath;

  try {
    const plan = await createInstallPlanWithDiscovery(project);
    const discoveredIds = plan.discoveredSkills.map((skill) => skill.registryId);
    const reasons = plan.discoveredSkills[0]?.reasons.join(" ") ?? "";

    assert.deepEqual(discoveredIds, ["clerk-react-patterns"]);
    assert.match(reasons, /catalog:autoskills/);
    assert.match(reasons, /trust:/);
    assert.match(reasons, /docs-density:/);
    assert.equal(
      plan.unavailableSkills.find((skill) => skill.registryId === "clerk-react-patterns")?.availability,
      "fetchable",
    );
  } finally {
    if (previousCatalog === undefined) delete process.env.PI_AUTOSKILLS_CATALOG_INDEX;
    else process.env.PI_AUTOSKILLS_CATALOG_INDEX = previousCatalog;
  }
});

test("createInstallPlanWithDiscovery falls back to repo tree scan when catalog missing", async () => {
  const project = makeProject({
    "package.json": JSON.stringify({
      dependencies: {
        react: "1",
        "@clerk/nextjs": "1",
      },
    }),
  });

  const previousCatalog = process.env.PI_AUTOSKILLS_CATALOG_INDEX;
  process.env.PI_AUTOSKILLS_CATALOG_INDEX = join(project, "missing-index.json");

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url === "https://api.github.com/repos/clerk/skills") {
      return new Response(JSON.stringify({ default_branch: "main" }), { status: 200 });
    }
    if (url === "https://api.github.com/repos/clerk/skills/branches/main") {
      return new Response(JSON.stringify({ commit: { sha: "abc123" } }), { status: 200 });
    }
    if (url === "https://api.github.com/repos/clerk/skills/git/trees/abc123?recursive=1") {
      return new Response(JSON.stringify({
        tree: [
          { path: "clerk-react-patterns/SKILL.md", type: "blob" },
          { path: "clerk-swift/SKILL.md", type: "blob" },
          { path: "clerk-setup/SKILL.md", type: "blob" },
        ],
      }), { status: 200 });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const plan = await createInstallPlanWithDiscovery(project);
    const discoveredIds = plan.discoveredSkills.map((skill) => skill.registryId);

    assert.ok(discoveredIds.includes("clerk-react-patterns"));
    assert.equal(plan.discoveredSkills[0]?.registryId, "clerk-react-patterns");
    assert.match(plan.discoveredSkills[0]?.reasons.join(" ") ?? "", /catalog:github-tree/);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousCatalog === undefined) delete process.env.PI_AUTOSKILLS_CATALOG_INDEX;
    else process.env.PI_AUTOSKILLS_CATALOG_INDEX = previousCatalog;
  }
});
