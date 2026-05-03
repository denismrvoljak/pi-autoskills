import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  detectTechnologies,
  getAllPackageNames,
  getDenoImportNames,
  parseSettingsGradleModules,
  readGemfile,
  resolveWorkspaces,
} from "../src/detect.ts";
import { createInstallPlan } from "../src/install.ts";

function makeProject(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "pi-autoskills-"));
  for (const [path, content] of Object.entries(files)) {
    const abs = join(root, path);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

test("getAllPackageNames returns dependencies and devDependencies", () => {
  assert.deepEqual(
    getAllPackageNames({
      dependencies: { react: "1" },
      devDependencies: { typescript: "1" },
    }),
    ["react", "typescript"],
  );
});

test("getDenoImportNames reads npm and jsr imports", () => {
  assert.deepEqual(
    getDenoImportNames({
      imports: {
        react: "npm:react@19",
        hono: "jsr:@hono/hono@4",
      },
    }),
    ["react", "@hono/hono"],
  );
});

test("readGemfile parses gem names", () => {
  const project = makeProject({
    Gemfile: "gem 'rails'\ngem \"sidekiq\"\n",
  });

  assert.deepEqual(readGemfile(project), ["rails", "sidekiq"]);
});

test("parseSettingsGradleModules handles colon paths", () => {
  assert.deepEqual(parseSettingsGradleModules('include(":app", ":feature:login")'), [
    "app",
    "feature/login",
  ]);
});

test("resolveWorkspaces reads pnpm workspace patterns", () => {
  const project = makeProject({
    "pnpm-workspace.yaml": "packages:\n  - apps/*\n",
    "apps/web/package.json": "{}",
    "apps/api/package.json": "{}",
  });

  const resolved = resolveWorkspaces(project).map((dir) => dir.replace(`${project}/`, "")).sort();
  assert.deepEqual(resolved, ["apps/api", "apps/web"]);
});

test("detectTechnologies detects packages, configs, patterns, frontend files, and combos", () => {
  const project = makeProject({
    "package.json": JSON.stringify({
      dependencies: {
        react: "1",
        next: "1",
        tailwindcss: "1",
        zod: "1",
        "react-hook-form": "1",
        "@clerk/nextjs": "1",
      },
      devDependencies: {
        typescript: "1",
        "@playwright/test": "1",
      },
    }),
    "playwright.config.ts": "export default {}",
    "src/index.html": "<html></html>",
  });

  const result = detectTechnologies(project);
  const ids = result.detected.map((entry) => entry.id).sort();
  const combos = result.combos.map((entry) => entry.id).sort();

  assert.equal(result.isFrontend, true);
  assert.deepEqual(ids, [
    "clerk",
    "nextjs",
    "playwright",
    "react",
    "react-hook-form",
    "tailwind",
    "typescript",
    "zod",
  ]);
  assert.deepEqual(combos, ["nextjs-playwright", "react-tailwind", "rhf-zod"]);
});

test("detectTechnologies merges workspace technologies", () => {
  const project = makeProject({
    "package.json": JSON.stringify({ workspaces: ["packages/*"] }),
    "packages/app/package.json": JSON.stringify({ dependencies: { react: "1" } }),
    "packages/server/package.json": JSON.stringify({ dependencies: { express: "1" } }),
  });

  const result = detectTechnologies(project);
  const ids = result.detected.map((entry) => entry.id).sort();

  assert.deepEqual(ids, ["express", "react"]);
});

test("createInstallPlan includes frontend bonus and combo skills", () => {
  const project = makeProject({
    "package.json": JSON.stringify({
      dependencies: { react: "1", tailwindcss: "1" },
    }),
    "src/app.tsx": "export function App() { return null }",
  });

  const plan = createInstallPlan(project);
  const skillIds = plan.skills.map((skill) => skill.registryId);

  assert.equal(plan.isFrontend, true);
  assert.ok(skillIds.includes("react-tailwind-ui-patterns"));
  assert.ok(skillIds.includes("frontend-accessibility-basics"));
  assert.ok(skillIds.includes("frontend-seo-basics"));
});
