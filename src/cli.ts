import { resolve } from "node:path";

import { createInstallPlanWithDiscovery, installPlan } from "./install.ts";
import { getDefaultCacheRegistryDir, getDefaultRegistryDir } from "./registry.ts";
import type { InstallPlan } from "./types.ts";

interface CliArgs {
  projectDir: string;
  registryDir: string;
  cacheRegistryDir: string;
  reviewer?: "auto" | "static" | "pi" | "none";
  dryRun: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const projectDirFlag = valueAfter(argv, "--project") ?? process.cwd();
  const registryDirFlag = valueAfter(argv, "--registry-dir");
  const cacheRegistryDirFlag = valueAfter(argv, "--cache-registry-dir");
  const reviewerFlag = valueAfter(argv, "--reviewer");
  const projectDir = resolve(projectDirFlag);

  return {
    projectDir,
    registryDir: resolve(registryDirFlag ?? getDefaultRegistryDir(projectDir)),
    cacheRegistryDir: resolve(cacheRegistryDirFlag ?? getDefaultCacheRegistryDir(projectDir)),
    reviewer: reviewerFlag === "auto" || reviewerFlag === "static" || reviewerFlag === "pi" || reviewerFlag === "none"
      ? reviewerFlag
      : undefined,
    dryRun: argv.includes("--dry-run"),
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function showHelp(): void {
  console.log(`pi-autoskills\n\nUsage:\n  pi-autoskills\n  pi-autoskills --dry-run\n  pi-autoskills --project /path/to/project\n  pi-autoskills --registry-dir /path/to/registry\n  pi-autoskills --cache-registry-dir /path/to/cache-registry\n  pi-autoskills --reviewer auto|static|pi|none\n`);
}

function printPlan(plan: InstallPlan): void {
  console.log(`Project: ${plan.projectDir}`);
  console.log(`Output:  ${plan.outputDir}`);
  console.log(`Lock:    ${plan.lockfilePath}`);
  console.log(`Cache:   ${plan.cacheRegistryDir}`);
  console.log("");
  console.log(`Detected technologies (${plan.technologies.length}):`);
  for (const tech of plan.technologies) console.log(`  - ${tech.name}`);
  if (plan.technologies.length === 0) console.log("  - none");
  console.log(`Frontend signals: ${plan.isFrontend ? "yes" : "no"}`);
  if (plan.combos.length > 0) {
    console.log("Detected combos:");
    for (const combo of plan.combos) console.log(`  - ${combo.name}`);
  }
  console.log("");
  console.log(`Available local skills (${plan.skills.length}):`);
  for (const skill of plan.skills) {
    console.log(`  - ${skill.registryId}  ← ${skill.reasons.join(", ")}`);
  }
  if (plan.skills.length === 0) console.log("  - none");

  if (plan.discoveredSkills.length > 0) {
    console.log("");
    console.log(`Discovered skills (${plan.discoveredSkills.length}):`);
    for (const skill of plan.discoveredSkills) {
      console.log(`  - ${skill.registryId}  ← ${skill.reasons.join(", ")}`);
    }
  }

  if (plan.unavailableSkills.length > 0) {
    console.log("");
    console.log(`Deferred matches (${plan.unavailableSkills.length}):`);
    for (const skill of plan.unavailableSkills) {
      console.log(`  - ${skill.registryId}  ← ${skill.reasons.join(", ")} (${skill.availability}: ${skill.detail})`);
    }
  }
}

export async function runCli(argv = process.argv.slice(2)): Promise<number> {
  const args = parseArgs(argv);
  if (args.help) {
    showHelp();
    return 0;
  }

  const previousReviewer = process.env.PI_AUTOSKILLS_REVIEWER;
  if (args.reviewer) process.env.PI_AUTOSKILLS_REVIEWER = args.reviewer;

  try {
    const plan = await createInstallPlanWithDiscovery(args.projectDir, args.registryDir, undefined, args.cacheRegistryDir);
    printPlan(plan);

    if (args.dryRun) return 0;

    const result = await installPlan(plan, args.registryDir, args.cacheRegistryDir);
    console.log("");
    console.log(`Installed: ${result.installed.length}`);
    for (const name of result.installed) console.log(`  ✓ ${name}`);
    if (result.skipped.length > 0) {
      console.log(`Skipped: ${result.skipped.length}`);
      for (const name of result.skipped) console.log(`  - ${name}`);
    }
    if (result.warnings.length > 0) {
      console.log("Warnings:");
      for (const warning of result.warnings) console.log(`  ! ${warning}`);
    }
    console.log(`Lockfile: ${result.lockfilePath}`);
    return result.skipped.length > 0 ? 1 : 0;
  } finally {
    if (args.reviewer) {
      if (previousReviewer === undefined) delete process.env.PI_AUTOSKILLS_REVIEWER;
      else process.env.PI_AUTOSKILLS_REVIEWER = previousReviewer;
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
