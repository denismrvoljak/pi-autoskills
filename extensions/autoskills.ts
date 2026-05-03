import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { createInstallPlanWithDiscovery, installPlan } from "../src/install.ts";
import { getDefaultCacheRegistryDir, getDefaultRegistryDir } from "../src/registry.ts";

export default function autoskillsExtension(pi: ExtensionAPI) {
  pi.registerCommand("autoskills", {
    description: "Detect project stack and install audited local skills",
    handler: async (args, ctx) => {
      const previousReviewer = process.env.PI_AUTOSKILLS_REVIEWER;
      if (!previousReviewer) process.env.PI_AUTOSKILLS_REVIEWER = "pi";

      try {
        const registryDir = getDefaultRegistryDir(ctx.cwd);
        const cacheRegistryDir = getDefaultCacheRegistryDir(ctx.cwd);
        const plan = await createInstallPlanWithDiscovery(ctx.cwd, registryDir, undefined, cacheRegistryDir);

        if (plan.technologies.length === 0) {
          ctx.ui.notify("No matching technologies detected.", "info");
          return;
        }

        const summary = [
          `Detected: ${plan.technologies.map((tech) => tech.name).join(", ")}`,
          `Available local skills: ${plan.skills.map((skill) => skill.registryId).join(", ") || "none"}`,
          `Discovered skills: ${plan.discoveredSkills.map((skill) => skill.registryId).join(", ") || "none"}`,
          `Deferred matches: ${plan.unavailableSkills.map((skill) => `${skill.registryId} (${skill.availability}: ${skill.detail})`).join(", ") || "none"}`,
        ].join("\n");

        if (args.trim() === "detect") {
          ctx.ui.notify(summary, "info");
          return;
        }

        const ok = args.trim() === "install"
          ? true
          : await ctx.ui.confirm("Install audited skills?", summary);
        if (!ok) return;

        const result = await installPlan(plan, registryDir, cacheRegistryDir);
        const lines = [
          `Installed: ${result.installed.join(", ") || "none"}`,
          `Skipped: ${result.skipped.join(", ") || "none"}`,
        ];
        if (result.warnings.length > 0) {
          lines.push(`Warnings: ${result.warnings.join(" | ")}`);
        }
        ctx.ui.notify(lines.join("\n"), result.skipped.length > 0 ? "warning" : "info");
      } finally {
        if (!previousReviewer) delete process.env.PI_AUTOSKILLS_REVIEWER;
      }
    },
  });
}
