import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  COMBO_RULES,
  FRONTEND_PACKAGES,
  TECHNOLOGY_RULES,
  WEB_FRONTEND_EXTENSIONS,
} from "./maps.ts";
import type {
  ComboRule,
  ConfigFileContentBlock,
  DetectResult,
  DetectedTechnology,
  TechnologyRule,
} from "./types.ts";

const SCAN_SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".nuxt",
  ".svelte-kit",
  "dist",
  "build",
  ".turbo",
  ".cache",
  "coverage",
  "vendor",
  "bin",
  "obj",
]);

const GRADLE_SCAN_ROOT_FILES = [
  "build.gradle.kts",
  "build.gradle",
  "settings.gradle.kts",
  "settings.gradle",
  "gradle/libs.versions.toml",
];

const DOTNET_SCAN_ROOT_FILES = [
  "global.json",
  "NuGet.Config",
  "Directory.Build.props",
  "Directory.Packages.props",
];

export function parseSettingsGradleModules(content: string): string[] {
  const modules: string[] = [];
  const includeRe = /include\s*\(?\s*([^)]+)/g;
  let includeMatch: RegExpExecArray | null;
  while ((includeMatch = includeRe.exec(content)) !== null) {
    const args = includeMatch[1];
    const quotedRe = /['"]([^'"]+)['"]/g;
    let quotedMatch: RegExpExecArray | null;
    while ((quotedMatch = quotedRe.exec(args)) !== null) {
      modules.push(quotedMatch[1].replace(/^:/, "").replace(/:/g, "/"));
    }
  }
  return modules;
}

function readJson(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function readPackageJson(dir: string): Record<string, unknown> | null {
  return readJson(join(dir, "package.json"));
}

export function readDenoJson(dir: string): Record<string, unknown> | null {
  for (const name of ["deno.json", "deno.jsonc"]) {
    const json = readJson(join(dir, name));
    if (json) return json;
  }
  return null;
}

export function readGemfile(dir: string): string[] {
  const gemfilePath = join(dir, "Gemfile");
  if (!existsSync(gemfilePath)) return [];

  try {
    const content = readFileSync(gemfilePath, "utf8");
    const gems: string[] = [];
    const gemRegex = /^\s*gem\s+['"]([^'"]+)['"]/gm;
    let match: RegExpExecArray | null;
    while ((match = gemRegex.exec(content)) !== null) gems.push(match[1]);
    return gems;
  } catch {
    return [];
  }
}

export function getAllPackageNames(pkg: Record<string, unknown> | null): string[] {
  if (!pkg) return [];
  return [
    ...Object.keys((pkg.dependencies as Record<string, string>) || {}),
    ...Object.keys((pkg.devDependencies as Record<string, string>) || {}),
  ];
}

export function getDenoImportNames(denoJson: Record<string, unknown> | null): string[] {
  if (!denoJson?.imports) return [];

  return Object.values(denoJson.imports as Record<string, string>)
    .filter((value) => typeof value === "string" && (value.startsWith("npm:") || value.startsWith("jsr:")))
    .map((specifier) => {
      const bare = specifier.replace(/^(?:npm|jsr):/, "");
      if (bare.startsWith("@")) return bare.replace(/^(@[^/]+\/[^@]+).*$/, "$1");
      return bare.replace(/@.*$/, "");
    });
}

function hasFileWithExtension(projectDir: string, extensions: string[], maxDepth = 4): boolean {
  const normalized = new Set(extensions.map((ext) => (ext.startsWith(".") ? ext : `.${ext}`).toLowerCase()));

  function scan(dir: string, depth: number): boolean {
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return false;
    }

    for (const entry of entries) {
      if (entry.isFile()) {
        const lowerName = entry.name.toLowerCase();
        if ([...normalized].some((ext) => lowerName.endsWith(ext))) return true;
      } else if (entry.isDirectory() && depth < maxDepth) {
        if (SCAN_SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
        if (scan(join(dir, entry.name), depth + 1)) return true;
      }
    }

    return false;
  }

  return scan(projectDir, 0);
}

export function hasWebFrontendFiles(projectDir: string, maxDepth = 3): boolean {
  function scan(dir: string, depth: number): boolean {
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return false;
    }

    for (const entry of entries) {
      if (entry.isFile()) {
        if (entry.name.endsWith(".blade.php")) return true;
        const dot = entry.name.lastIndexOf(".");
        if (dot !== -1 && WEB_FRONTEND_EXTENSIONS.has(entry.name.slice(dot))) return true;
      } else if (entry.isDirectory() && depth < maxDepth) {
        if (SCAN_SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
        if (scan(join(dir, entry.name), depth + 1)) return true;
      }
    }

    return false;
  }

  return scan(projectDir, 0);
}

function parsePnpmWorkspaceYaml(content: string): string[] {
  const lines = content.split("\n");
  const patterns: string[] = [];
  let inPackages = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "packages:" || line === "packages :") {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      if (line.startsWith("- ")) {
        patterns.push(line.slice(2).trim().replace(/^['"]|['"]$/g, ""));
      } else if (line !== "" && !line.startsWith("#")) {
        break;
      }
    }
  }

  return patterns;
}

function expandWorkspacePatterns(projectDir: string, patterns: string[]): string[] {
  const dirs: string[] = [];

  for (const pattern of patterns) {
    if (pattern.includes("*")) {
      const parent = join(projectDir, pattern.replace(/\/?\*.*$/, ""));
      let entries: import("node:fs").Dirent[];
      try {
        entries = readdirSync(parent, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (!entry.isDirectory() || SCAN_SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
        const wsDir = join(parent, entry.name);
        if (
          existsSync(join(wsDir, "package.json")) ||
          existsSync(join(wsDir, "deno.json")) ||
          existsSync(join(wsDir, "deno.jsonc"))
        ) {
          dirs.push(wsDir);
        }
      }
    } else {
      const wsDir = join(projectDir, pattern);
      if (
        existsSync(join(wsDir, "package.json")) ||
        existsSync(join(wsDir, "deno.json")) ||
        existsSync(join(wsDir, "deno.jsonc"))
      ) {
        dirs.push(wsDir);
      }
    }
  }

  return dirs;
}

export function resolveWorkspaces(projectDir: string): string[] {
  const pnpmWorkspacePath = join(projectDir, "pnpm-workspace.yaml");
  if (existsSync(pnpmWorkspacePath)) {
    try {
      const content = readFileSync(pnpmWorkspacePath, "utf8");
      const patterns = parsePnpmWorkspaceYaml(content);
      if (patterns.length > 0) {
        return expandWorkspacePatterns(projectDir, patterns).filter((dir) => resolve(dir) !== resolve(projectDir));
      }
    } catch {}
  }

  const pkg = readPackageJson(projectDir);
  if (pkg) {
    const workspaces = pkg.workspaces;
    const patterns = Array.isArray(workspaces)
      ? (workspaces as string[])
      : Array.isArray((workspaces as Record<string, unknown>)?.packages)
        ? ((workspaces as Record<string, string[]>).packages)
        : null;
    if (patterns && patterns.length > 0) {
      return expandWorkspacePatterns(projectDir, patterns).filter((dir) => resolve(dir) !== resolve(projectDir));
    }
  }

  const denoJson = readDenoJson(projectDir);
  const members = Array.isArray(denoJson?.workspace) ? (denoJson.workspace as string[]) : [];
  if (members.length > 0) {
    return expandWorkspacePatterns(projectDir, members).filter((dir) => resolve(dir) !== resolve(projectDir));
  }

  return [];
}

function gradleLayoutCandidatePaths(projectDir: string): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const add = (path: string) => {
    if (!seen.has(path)) {
      seen.add(path);
      candidates.push(path);
    }
  };

  for (const file of GRADLE_SCAN_ROOT_FILES) add(join(projectDir, file));

  try {
    const entries = readdirSync(projectDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || SCAN_SKIP_DIRS.has(entry.name)) continue;
      for (const gradleFile of ["build.gradle.kts", "build.gradle"]) {
        add(join(projectDir, entry.name, gradleFile));
      }
    }
  } catch {}

  for (const settingsFile of ["settings.gradle.kts", "settings.gradle"]) {
    try {
      const content = readFileSync(join(projectDir, settingsFile), "utf8");
      for (const modulePath of parseSettingsGradleModules(content)) {
        for (const gradleFile of ["build.gradle.kts", "build.gradle"]) {
          add(join(projectDir, modulePath, gradleFile));
        }
      }
      break;
    } catch {}
  }

  return candidates;
}

function dotNetLayoutCandidatePaths(projectDir: string): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const add = (path: string) => {
    if (!seen.has(path)) {
      seen.add(path);
      candidates.push(path);
    }
  };

  for (const file of DOTNET_SCAN_ROOT_FILES) add(join(projectDir, file));

  const scan = (dir: string, depth: number): void => {
    if (depth > 2) return;
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isFile()) {
        const lower = entry.name.toLowerCase();
        if (lower.endsWith(".sln") || lower.endsWith(".csproj") || lower.endsWith(".fsproj")) {
          add(join(dir, entry.name));
        }
      } else if (entry.isDirectory() && !entry.name.startsWith(".") && !SCAN_SKIP_DIRS.has(entry.name)) {
        scan(join(dir, entry.name), depth + 1);
      }
    }
  };

  scan(projectDir, 0);
  return candidates;
}

function resolveConfigFileContentPaths(projectDir: string, config: ConfigFileContentBlock): string[] {
  if (config.scanGradleLayout) return gradleLayoutCandidatePaths(projectDir);
  if (config.scanDotNetLayout) return dotNetLayoutCandidatePaths(projectDir);
  return (config.files || []).map((file) => join(projectDir, file));
}

function detectCombos(ids: string[]): ComboRule[] {
  const set = new Set(ids);
  return COMBO_RULES.filter((combo) => combo.requires.every((id) => set.has(id)));
}

function toDetected(rule: TechnologyRule): DetectedTechnology {
  return { id: rule.id, name: rule.name };
}

function detectTechnologiesInDir(projectDir: string, skipFrontendFiles = false): {
  detected: TechnologyRule[];
  isFrontendByPackages: boolean;
  isFrontendByFiles: boolean;
} {
  const pkg = readPackageJson(projectDir);
  const allPackages = getAllPackageNames(pkg);
  const denoJson = readDenoJson(projectDir);
  const denoImports = getDenoImportNames(denoJson);
  const allDeps = new Set([...allPackages, ...denoImports]);
  const allDepsArray = [...allDeps];
  let gemNames: string[] | undefined;
  const detected: TechnologyRule[] = [];
  const fileContentCache = new Map<string, string | null>();
  const existsCache = new Map<string, boolean>();
  const fileExtensionCache = new Map<string, boolean>();

  const cachedRead = (filePath: string): string | null => {
    if (fileContentCache.has(filePath)) return fileContentCache.get(filePath)!;
    let content: string | null = null;
    try {
      content = readFileSync(filePath, "utf8");
    } catch {}
    fileContentCache.set(filePath, content);
    if (content !== null) existsCache.set(filePath, true);
    return content;
  };

  const cachedExists = (filePath: string): boolean => {
    if (existsCache.has(filePath)) return existsCache.get(filePath)!;
    const result = existsSync(filePath);
    existsCache.set(filePath, result);
    return result;
  };

  for (const tech of TECHNOLOGY_RULES) {
    let found = false;

    if (tech.detect.packages) {
      found = tech.detect.packages.some((pkgName) => allDeps.has(pkgName));
    }

    if (!found && tech.detect.packagePatterns) {
      found = tech.detect.packagePatterns.some((pattern) => allDepsArray.some((pkgName) => pattern.test(pkgName)));
    }

    if (!found && tech.detect.configFiles) {
      found = tech.detect.configFiles.some((file) => cachedExists(join(projectDir, file)));
    }

    if (!found && tech.detect.fileExtensions) {
      const key = tech.detect.fileExtensions.join("\0");
      if (!fileExtensionCache.has(key)) {
        fileExtensionCache.set(key, hasFileWithExtension(projectDir, tech.detect.fileExtensions));
      }
      found = fileExtensionCache.get(key)!;
    }

    if (!found && tech.detect.gems) {
      if (gemNames === undefined) gemNames = readGemfile(projectDir);
      found = tech.detect.gems.some((gem) => gemNames!.includes(gem));
    }

    if (!found && tech.detect.configFileContent) {
      const configs = Array.isArray(tech.detect.configFileContent)
        ? tech.detect.configFileContent
        : [tech.detect.configFileContent];
      for (const config of configs) {
        const paths = resolveConfigFileContentPaths(projectDir, config);
        for (const path of paths) {
          const content = cachedRead(path);
          if (content === null) continue;
          if (config.patterns.some((pattern) => content.includes(pattern))) {
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }

    if (found) detected.push(tech);
  }

  const isFrontendByPackages = allDepsArray.some((pkgName) => FRONTEND_PACKAGES.has(pkgName));
  const isFrontendByFiles = isFrontendByPackages || skipFrontendFiles ? false : hasWebFrontendFiles(projectDir);

  return { detected, isFrontendByPackages, isFrontendByFiles };
}

export function detectTechnologies(projectDir: string): DetectResult {
  const root = detectTechnologiesInDir(projectDir);
  const seen = new Map(root.detected.map((rule) => [rule.id, rule]));
  let isFrontend = root.isFrontendByPackages || root.isFrontendByFiles;

  for (const workspaceDir of resolveWorkspaces(projectDir)) {
    const workspace = detectTechnologiesInDir(workspaceDir, isFrontend);
    for (const tech of workspace.detected) {
      if (!seen.has(tech.id)) seen.set(tech.id, tech);
    }
    if (workspace.isFrontendByPackages || workspace.isFrontendByFiles) {
      isFrontend = true;
    }
  }

  const detected = [...seen.values()].map(toDetected);
  const combos = detectCombos(detected.map((entry) => entry.id));
  return { detected, isFrontend, combos };
}
