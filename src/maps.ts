import type { ComboRule, SkillSource, TechnologyRule } from "./types.ts";

function claude(registryId: string, sourceRepo: string, sourcePath = `${registryId}/SKILL.md`): SkillSource {
  return { registryId, source: "claude", sourceRepo, sourcePath };
}

function codex(registryId: string, sourceRepo: string, sourcePath = `${registryId}/SKILL.md`): SkillSource {
  return { registryId, source: "codex", sourceRepo, sourcePath };
}

function pi(registryId: string, sourcePath = `${registryId}/SKILL.md`): SkillSource {
  return { registryId, source: "pi", sourceRepo: "pi-autoskills/registry", sourcePath };
}

export const WEB_FRONTEND_EXTENSIONS = new Set([
  ".html",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".jsx",
  ".tsx",
  ".vue",
  ".svelte",
  ".astro",
  ".twig",
  ".php",
]);

export const FRONTEND_PACKAGES = new Set([
  "react",
  "react-dom",
  "next",
  "vue",
  "nuxt",
  "svelte",
  "@sveltejs/kit",
  "astro",
  "@angular/core",
  "tailwindcss",
]);

export const FRONTEND_BONUS_SKILLS: SkillSource[] = [
  pi("frontend-accessibility-basics"),
  pi("frontend-seo-basics"),
];

export const TECHNOLOGY_RULES: TechnologyRule[] = [
  {
    id: "react",
    name: "React",
    detect: { packages: ["react", "react-dom"] },
    skills: [
      claude("react-best-practices", "vercel-labs/agent-skills"),
      claude("composition-patterns", "vercel-labs/agent-skills"),
    ],
  },
  {
    id: "nextjs",
    name: "Next.js",
    detect: {
      packages: ["next"],
      configFiles: ["next.config.js", "next.config.mjs", "next.config.ts"],
    },
    skills: [
      claude("next-best-practices", "vercel-labs/next-skills"),
      claude("next-cache-components", "vercel-labs/next-skills"),
      claude("next-upgrade", "vercel-labs/next-skills"),
    ],
  },
  {
    id: "vue",
    name: "Vue",
    detect: { packages: ["vue"] },
    skills: [
      claude("vue-debug-guides", "hyf0/vue-skills"),
      codex("vue", "antfu/skills"),
      codex("vue-best-practices", "antfu/skills"),
    ],
  },
  {
    id: "nuxt",
    name: "Nuxt",
    detect: {
      packages: ["nuxt"],
      configFiles: ["nuxt.config.js", "nuxt.config.ts"],
    },
    skills: [codex("nuxt", "antfu/skills")],
  },
  {
    id: "svelte",
    name: "Svelte",
    detect: {
      packages: ["svelte", "@sveltejs/kit"],
      configFiles: ["svelte.config.js"],
    },
    skills: [
      claude("svelte5-best-practices", "ejirocodes/agent-skills"),
      claude("svelte-code-writer", "sveltejs/ai-tools"),
    ],
  },
  {
    id: "angular",
    name: "Angular",
    detect: {
      packages: ["@angular/core"],
      configFiles: ["angular.json"],
    },
    skills: [
      claude("angular-developer", "angular/skills"),
      claude("reference-core", "angular/angular"),
      claude("reference-signal-forms", "angular/angular"),
    ],
  },
  {
    id: "astro",
    name: "Astro",
    detect: {
      packages: ["astro"],
      configFiles: ["astro.config.mjs", "astro.config.js", "astro.config.ts"],
    },
    skills: [claude("astro", "astrolicious/agent-skills")],
  },
  {
    id: "tailwind",
    name: "Tailwind CSS",
    detect: {
      packages: ["tailwindcss", "@tailwindcss/vite"],
      configFiles: ["tailwind.config.js", "tailwind.config.ts", "tailwind.config.cjs"],
    },
    skills: [codex("tailwind-css-patterns", "giuseppe-trisciuoglio/developer-kit")],
  },
  {
    id: "shadcn",
    name: "shadcn/ui",
    detect: { configFiles: ["components.json"] },
    skills: [claude("shadcn", "shadcn/ui")],
  },
  {
    id: "typescript",
    name: "TypeScript",
    detect: {
      packages: ["typescript"],
      configFiles: ["tsconfig.json"],
    },
    skills: [codex("typescript-advanced-types", "wshobson/agents")],
  },
  {
    id: "vite",
    name: "Vite",
    detect: {
      packages: ["vite"],
      configFiles: ["vite.config.js", "vite.config.ts", "vite.config.mjs"],
    },
    skills: [codex("vite", "antfu/skills")],
  },
  {
    id: "playwright",
    name: "Playwright",
    detect: {
      packages: ["@playwright/test", "playwright"],
      configFiles: ["playwright.config.ts", "playwright.config.js"],
    },
    skills: [claude("playwright-best-practices", "currents-dev/playwright-best-practices-skill")],
  },
  {
    id: "vitest",
    name: "Vitest",
    detect: {
      packages: ["vitest"],
      configFiles: ["vitest.config.ts", "vitest.config.js", "vitest.config.mjs"],
    },
    skills: [pi("vitest-testing-patterns")],
  },
  {
    id: "react-hook-form",
    name: "React Hook Form",
    detect: { packages: ["react-hook-form"] },
    skills: [codex("react-hook-form", "pproenca/dot-skills")],
  },
  {
    id: "zod",
    name: "Zod",
    detect: { packages: ["zod"] },
    skills: [codex("zod", "pproenca/dot-skills")],
  },
  {
    id: "prisma",
    name: "Prisma",
    detect: { packages: ["prisma", "@prisma/client"] },
    skills: [pi("prisma-patterns")],
  },
  {
    id: "drizzle",
    name: "Drizzle ORM",
    detect: { packages: ["drizzle-orm", "drizzle-kit"] },
    skills: [pi("drizzle-patterns")],
  },
  {
    id: "supabase",
    name: "Supabase",
    detect: { packages: ["@supabase/supabase-js", "@supabase/ssr"] },
    skills: [claude("supabase-postgres-best-practices", "supabase/agent-skills")],
  },
  {
    id: "nodejs",
    name: "Node.js",
    detect: {
      configFiles: ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", ".nvmrc"],
    },
    skills: [],
  },
  {
    id: "express",
    name: "Express",
    detect: { packages: ["express"] },
    skills: [pi("node-express-patterns")],
  },
  {
    id: "clerk",
    name: "Clerk",
    detect: {
      packagePatterns: [/^@clerk\//],
    },
    skills: [
      claude("clerk", "clerk/skills"),
      claude("clerk-setup", "clerk/skills"),
    ],
  },
  {
    id: "better-auth",
    name: "Better Auth",
    detect: { packages: ["better-auth"] },
    skills: [
      claude("best-practices", "better-auth/skills"),
      claude("emailAndPassword", "better-auth/skills"),
    ],
  },
  {
    id: "go",
    name: "Go",
    detect: { configFiles: ["go.mod", "go.work"] },
    skills: [pi("go-project-patterns")],
  },
  {
    id: "deno",
    name: "Deno",
    detect: { configFiles: ["deno.json", "deno.jsonc", "deno.lock"] },
    skills: [pi("deno-patterns")],
  },
  {
    id: "aws",
    name: "AWS",
    detect: { packagePatterns: [/^@aws-sdk\//, /^aws-cdk/] },
    skills: [pi("aws-patterns")],
  },
  {
    id: "azure",
    name: "Azure",
    detect: { packagePatterns: [/^@azure\//] },
    skills: [pi("azure-patterns")],
  },
  {
    id: "wordpress",
    name: "WordPress",
    detect: {
      configFiles: ["wp-config.php"],
      gems: ["wordpress"],
      fileExtensions: ["blade.php"],
    },
    skills: [pi("wordpress-patterns")],
  },
];

export const COMBO_RULES: ComboRule[] = [
  {
    id: "nextjs-playwright",
    name: "Next.js + Playwright",
    requires: ["nextjs", "playwright"],
    skills: [pi("next-playwright-testing")],
  },
  {
    id: "react-tailwind",
    name: "React + Tailwind CSS",
    requires: ["react", "tailwind"],
    skills: [pi("react-tailwind-ui-patterns")],
  },
  {
    id: "react-shadcn",
    name: "React + shadcn/ui",
    requires: ["react", "shadcn"],
    skills: [pi("react-shadcn-patterns")],
  },
  {
    id: "rhf-zod",
    name: "React Hook Form + Zod",
    requires: ["react-hook-form", "zod"],
    skills: [pi("react-hook-form-zod-patterns")],
  },
  {
    id: "node-express",
    name: "Node.js + Express",
    requires: ["nodejs", "express"],
    skills: [pi("node-express-patterns")],
  },
];
