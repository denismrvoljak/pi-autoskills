import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { createInstallPlan, installPlan } from "../src/install.ts";
import { getDefaultRegistryDir } from "../src/registry.ts";

export default function autoskillsExtension(pi: ExtensionAPI) {
  pi.registerCommand("autoskills", {
    description: "Detect project stack and install audited local skills",
    handler: async (args, ctx) => {
      const plan = createInstallPlan(ctx.cwd);
      const registryDir = getDefaultRegistryDir(ctx.cwd);

      if (plan.technologies.length === 0) {
        ctx.ui.notify("No matching technologies detected.", "info");
        return;
      }

      const summary = [
        `Detected: ${plan.technologies.map((tech) => tech.name).join(", ")}`,
        `Skills: ${plan.skills.map((skill) => skill.registryId).join(", ") || "none"}`,
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
      const lines = [
        `Installed: ${result.installed.join(", ") || "none"}`,
        `Skipped: ${result.skipped.join(", ") || "none"}`,
      ];
      if (result.warnings.length > 0) {
        lines.push(`Warnings: ${result.warnings.join(" | ")}`);
      }
      ctx.ui.notify(lines.join("\n"), result.skipped.length > 0 ? "warning" : "success");
    },
  });
}
