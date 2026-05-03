import { join, resolve } from "node:path";

import { createInstallPlan, installPlan } from "./install.ts";
import { getDefaultRegistryDir } from "./registry.ts";

interface CliArgs {
  projectDir: string;
  registryDir: string;
  dryRun: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const projectDirFlag = valueAfter(argv, "--project") ?? process.cwd();
  const registryDirFlag = valueAfter(argv, "--registry-dir");

  return {
    projectDir: resolve(projectDirFlag),
    registryDir: resolve(registryDirFlag ?? getDefaultRegistryDir(resolve(projectDirFlag))),
    dryRun: argv.includes("--dry-run"),
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function showHelp(): void {
  console.log(`pi-autoskills\n\nUsage:\n  pi-autoskills\n  pi-autoskills --dry-run\n  pi-autoskills --project /path/to/project\n  pi-autoskills --registry-dir /path/to/registry\n`);
}

function printPlan(plan: ReturnType<typeof createInstallPlan>): void {
  console.log(`Project: ${plan.projectDir}`);
  console.log(`Output:  ${plan.outputDir}`);
  console.log(`Lock:    ${plan.lockfilePath}`);
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
  console.log(`Matched skills (${plan.skills.length}):`);
  for (const skill of plan.skills) {
    console.log(`  - ${skill.registryId}  ← ${skill.reasons.join(", ")}`);
  }
  if (plan.skills.length === 0) console.log("  - none");
}

export async function runCli(argv = process.argv.slice(2)): Promise<number> {
  const args = parseArgs(argv);
  if (args.help) {
    showHelp();
    return 0;
  }

  const plan = createInstallPlan(args.projectDir);
  printPlan(plan);

  if (args.dryRun) return 0;

  const result = installPlan(plan, args.registryDir);
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
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
