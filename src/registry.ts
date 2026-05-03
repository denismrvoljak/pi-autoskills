import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { scanSkillText, sha256 } from "./security.ts";
import type { RegistryEntry, RegistryManifest } from "./types.ts";

export function getDefaultRegistryDir(_projectRoot?: string): string {
  return resolve(join(import.meta.dirname, "..", "registry"));
}

export function getDefaultCacheRegistryDir(projectRoot: string): string {
  return resolve(join(projectRoot, ".pi", "autoskills-registry"));
}

export function loadManifest(registryDir: string): RegistryManifest {
  const path = join(registryDir, "index.json");
  if (!existsSync(path)) {
    return { version: 1, generatedAt: new Date(0).toISOString(), skills: {} };
  }

  return JSON.parse(readFileSync(path, "utf8")) as RegistryManifest;
}

function walkFiles(root: string, current: string, out: string[]): void {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const abs = join(current, entry.name);
    if (entry.isSymbolicLink()) {
      const rel = abs.slice(root.length + 1).replaceAll("\\", "/");
      throw new Error(`symlink not allowed: ${rel}`);
    }
    if (entry.isDirectory()) {
      walkFiles(root, abs, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const rel = abs.slice(root.length + 1).replaceAll("\\", "/");
    out.push(rel);
  }
}

export function verifyManifestEntry(registryDir: string, entry: RegistryEntry): { ok: boolean; reason?: string } {
  const skillDir = join(registryDir, entry.registryId);
  if (!existsSync(skillDir) || !statSync(skillDir).isDirectory()) {
    return { ok: false, reason: `missing skill dir ${entry.registryId}` };
  }

  let actualFiles: string[];
  try {
    actualFiles = [];
    walkFiles(skillDir, skillDir, actualFiles);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "invalid skill dir" };
  }
  actualFiles.sort();

  const expectedFiles = [...entry.files].sort();
  if (actualFiles.length !== expectedFiles.length || actualFiles.some((file, index) => file !== expectedFiles[index])) {
    return { ok: false, reason: "unexpected file set" };
  }

  for (const rel of entry.files) {
    const path = join(skillDir, rel);
    if (!existsSync(path)) return { ok: false, reason: `missing file ${rel}` };
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) return { ok: false, reason: `invalid file ${rel}` };
    const actual = sha256(readFileSync(path));
    if (actual !== entry.sha256[rel]) {
      return { ok: false, reason: `hash mismatch for ${rel}` };
    }
  }

  const actualBundleHash = sha256(
    entry.files
      .map((rel) => `${rel}:${entry.sha256[rel]}`)
      .sort()
      .join("\n"),
  );

  if (actualBundleHash !== entry.bundleHash) {
    return { ok: false, reason: "bundle hash mismatch" };
  }

  return { ok: true };
}

export function writeManifest(registryDir: string, manifest: RegistryManifest): void {
  mkdirSync(registryDir, { recursive: true });
  writeFileSync(join(registryDir, "index.json"), JSON.stringify(manifest, null, 2) + "\n");
}

export function createRegistryEntry(params: {
  registryId: string;
  registryDir: string;
  source: RegistryEntry["source"];
  sourceRepo: string;
  sourcePath: string;
  commitSha?: string;
}): RegistryEntry {
  const skillDir = join(params.registryDir, params.registryId);
  const files: string[] = [];
  walkFiles(skillDir, skillDir, files);
  files.sort();

  const shaMap: Record<string, string> = {};
  const findings = [] as string[];
  let blocked = false;

  for (const rel of files) {
    const path = join(skillDir, rel);
    const content = readFileSync(path, "utf8");
    shaMap[rel] = sha256(content);
    for (const finding of scanSkillText(content)) {
      findings.push(`${rel}: ${finding.message}`);
      if (finding.severity === "blocked") blocked = true;
    }
  }

  const bundleHash = sha256(files.map((rel) => `${rel}:${shaMap[rel]}`).join("\n"));

  return {
    registryId: params.registryId,
    source: params.source,
    sourceRepo: params.sourceRepo,
    sourcePath: params.sourcePath,
    commitSha: params.commitSha ?? "local-dev",
    files,
    sha256: shaMap,
    bundleHash,
    review: {
      status: blocked ? "rejected" : findings.length > 0 ? "flagged" : "approved",
      summary: blocked
        ? "Static security scan found blocked patterns."
        : findings.length > 0
          ? "Static security scan found warning patterns."
          : "Static security scan found no risky patterns.",
      flags: findings,
      reviewedAt: new Date().toISOString(),
      reviewer: {
        model: "static-rules",
        promptVersion: "0.1.0",
      },
    },
    securityCheck: {
      status: blocked ? "blocked" : findings.length > 0 ? "warning" : "ok",
      summary: blocked
        ? "Blocked by static security scan."
        : findings.length > 0
          ? "Warnings found by static security scan."
          : "Passed static security scan.",
      findings,
      checkedAt: new Date().toISOString(),
    },
  };
}

export function ensureParentDir(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}
