import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { createInstallPlan, installPlan } from "../src/install.ts";
import { getDefaultRegistryDir } from "../src/registry.ts";

export default function autoskillsExtension(pi: ExtensionAPI) {
  pi.registerCommand("autoskills", {
    description: "Detect project stack and install audited local skills",
    handler: async (args, ctx) => {
      const registryDir = getDefaultRegistryDir(ctx.cwd);
      const plan = createInstallPlan(ctx.cwd, registryDir);

      if (plan.technologies.length === 0) {
        ctx.ui.notify("No matching technologies detected.", "info");
        return;
      }

      const summary = [
        `Detected: ${plan.technologies.map((tech) => tech.name).join(", ")}`,
        `Available skills: ${plan.skills.map((skill) => skill.registryId).join(", ") || "none"}`,
        `Unavailable matches: ${plan.unavailableSkills.map((skill) => `${skill.registryId} (${skill.detail})`).join(", ") || "none"}`,
      ].join("\n");

      if (args.trim() === "detect") {
        ctx.ui.notify(summary, "info");
        return;
      }

      const ok = args.trim() === "install"
        ? true
        : await ctx.ui.confirm("Install audited skills?", summary);
      if (!ok) return;

      const result = installPlan(plan, registryDir);
      for (const skill of plan.unavailableSkills) {
        result.warnings.push(`Unavailable ${skill.registryId}: ${skill.detail}`);
      }
      const lines = [
        `Installed: ${result.installed.join(", ") || "none"}`,
        `Skipped: ${result.skipped.join(", ") || "none"}`,
      ];
      if (result.warnings.length > 0) {
        lines.push(`Warnings: ${result.warnings.join(" | ")}`);
      }
      ctx.ui.notify(lines.join("\n"), result.skipped.length > 0 ? "warning" : "info");
    },
  });
}
