import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { COMBO_RULES, FRONTEND_BONUS_SKILLS, TECHNOLOGY_RULES } from "./maps.ts";
import { loadPolicy, repoAllowed } from "./policy.ts";
import type { InstallPlan, MatchResult, SkillSource } from "./types.ts";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const DEFAULT_AUTOSKILLS_CATALOG_INDEX = "/Users/denis/programming_personal/autoskills/packages/autoskills/skills-registry/index.json";

const repoSourceType = new Map<string, SkillSource["source"]>();
for (const source of [...TECHNOLOGY_RULES, ...COMBO_RULES].flatMap((rule) => rule.skills)) {
  repoSourceType.set(source.sourceRepo, source.source);
}
for (const source of FRONTEND_BONUS_SKILLS) repoSourceType.set(source.sourceRepo, source.source);

const treeCache = new Map<string, Promise<Array<{ path: string; type: string }>>>();
const catalogCache = new Map<string, CatalogEntry[]>();

interface CatalogEntry {
  registryId: string;
  sourceRepo: string;
  sourcePath: string;
  source: SkillSource["source"];
  files?: string[];
  bundleHash?: string;
}

interface RankedCandidate extends MatchResult {
  score: number;
  reasonsDetailed: string[];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function expandIdTokens(id: string): string[] {
  const tokens = new Set(tokenize(id));
  if (id === "nextjs") tokens.add("next");
  if (id === "nodejs") tokens.add("node");
  if (id === "typescript") tokens.add("ts");
  if (id === "react-hook-form") {
    tokens.add("rhf");
    tokens.add("react");
    tokens.add("form");
  }
  if (id === "tailwind") tokens.add("tailwindcss");
  return [...tokens];
}

function buildDiscoveryTokens(plan: InstallPlan): string[] {
  const tokens = new Set<string>();
  for (const tech of plan.technologies) {
    for (const token of [...expandIdTokens(tech.id), ...tokenize(tech.name)]) tokens.add(token);
  }
  for (const combo of plan.combos) {
    for (const token of tokenize(combo.id)) tokens.add(token);
    for (const token of tokenize(combo.name)) tokens.add(token);
  }
  return [...tokens];
}

function relevantSourceRepos(plan: InstallPlan): string[] {
  const ids = new Set(plan.technologies.map((tech) => tech.id));
  const repos = new Set<string>();

  for (const rule of TECHNOLOGY_RULES) {
    if (!ids.has(rule.id)) continue;
    for (const skill of rule.skills) {
      if (skill.source !== "pi") repos.add(skill.sourceRepo);
    }
  }

  for (const combo of COMBO_RULES) {
    if (!combo.requires.every((id) => ids.has(id))) continue;
    for (const skill of combo.skills) {
      if (skill.source !== "pi") repos.add(skill.sourceRepo);
    }
  }

  for (const matched of plan.matchedSkills) {
    if (matched.source !== "pi") repos.add(matched.sourceRepo);
  }

  return [...repos].sort();
}

async function ghFetchJson(url: string): Promise<any> {
  const headers: Record<string, string> = {
    "User-Agent": "pi-autoskills-discovery",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub ${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function fetchRepoTree(repo: string): Promise<Array<{ path: string; type: string }>> {
  const cached = treeCache.get(repo);
  if (cached) return cached;

  const promise = (async () => {
    const body = await ghFetchJson(`https://api.github.com/repos/${repo}`);
    const branch = body.default_branch as string;
    const branchData = await ghFetchJson(`https://api.github.com/repos/${repo}/branches/${branch}`);
    const sha = branchData.commit.sha as string;
    const tree = await ghFetchJson(`https://api.github.com/repos/${repo}/git/trees/${sha}?recursive=1`);
    return (tree.tree || []) as Array<{ path: string; type: string }>;
  })();

  treeCache.set(repo, promise);
  return promise;
}

function sourceTrust(repo: string): number {
  if (/^(vercel|clerk|supabase|angular|sveltejs|denoland|wordpress|astro|better-auth|Kotlin|microsoft|github|cloudflare)\//i.test(repo)) return 5;
  if (repo.includes("/skills") || repo.includes("agent-skills") || repo.includes("agents")) return 3;
  return 1;
}

function scoreCandidateDetailed(
  candidate: CatalogEntry,
  tokens: string[],
  techIds: Set<string>,
  comboTokens: string[],
): { score: number; reasonsDetailed: string[] } {
  const haystack = `${candidate.registryId} ${candidate.sourcePath}`.toLowerCase();
  const candidateTokens = new Set(tokenize(haystack));
  const reasons: string[] = [];
  let score = 0;
  let matchedTokens = 0;
  let exactTechMatches = 0;

  for (const techId of techIds) {
    if (haystack.includes(techId.toLowerCase())) {
      score += 6;
      exactTechMatches += 1;
    }
  }
  if (exactTechMatches > 0) reasons.push(`tech:${exactTechMatches}`);

  for (const token of tokens) {
    if (candidateTokens.has(token)) {
      score += token.length >= 5 ? 3 : 2;
      matchedTokens += 1;
    } else if (haystack.includes(token)) {
      score += 1;
      matchedTokens += 1;
    }
  }
  if (matchedTokens >= 2) {
    score += 4;
    reasons.push(`token-overlap:${matchedTokens}`);
  }

  const comboMatches = comboTokens.filter((token) => candidateTokens.has(token) || haystack.includes(token)).length;
  if (comboMatches > 0) {
    score += comboMatches * 2;
    reasons.push(`combo:${comboMatches}`);
  }

  const trust = sourceTrust(candidate.sourceRepo);
  score += trust;
  reasons.push(`trust:${trust}`);

  const fileCount = candidate.files?.length ?? 1;
  if (fileCount >= 2 && fileCount <= 20) {
    score += 2;
    reasons.push(`docs-density:${fileCount}`);
  } else if (fileCount > 20) {
    score -= 1;
    reasons.push(`size-penalty:${fileCount}`);
  }

  if (/pattern|practice|guide|testing|seo|accessibility|upgrade|auth|form|cache/.test(haystack)) {
    score += 1;
    reasons.push("topic-bonus");
  }

  return { score, reasonsDetailed: reasons };
}

function loadAutoskillsCatalog(): CatalogEntry[] {
  const path = resolve(process.env.PI_AUTOSKILLS_CATALOG_INDEX || DEFAULT_AUTOSKILLS_CATALOG_INDEX);
  const cached = catalogCache.get(path);
  if (cached) return cached;
  if (!existsSync(path)) {
    catalogCache.set(path, []);
    return [];
  }

  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as { skills?: Record<string, any> };
    const entries = Object.entries(raw.skills || {}).map(([registryId, entry]) => ({
      registryId,
      sourceRepo: String(entry.source || ""),
      sourcePath: typeof entry.skillPath === "string"
        ? entry.skillPath.replace(/^[^/]+\/[^/]+\//, "") + "/SKILL.md"
        : `${registryId}/SKILL.md`,
      source: repoSourceType.get(String(entry.source || "")) ?? "upstream",
      files: Array.isArray(entry.files) ? entry.files.map(String) : undefined,
      bundleHash: typeof entry.bundleHash === "string" ? entry.bundleHash : undefined,
    })).filter((entry) => entry.sourceRepo);
    catalogCache.set(path, entries);
    return entries;
  } catch {
    catalogCache.set(path, []);
    return [];
  }
}

async function collectCatalogCandidates(plan: InstallPlan): Promise<CatalogEntry[]> {
  const repos = new Set(relevantSourceRepos(plan));
  const catalog = loadAutoskillsCatalog();
  return catalog.filter((entry) => repos.has(entry.sourceRepo));
}

async function collectRepoTreeCandidates(plan: InstallPlan): Promise<CatalogEntry[]> {
  const out: CatalogEntry[] = [];
  for (const repo of relevantSourceRepos(plan)) {
    let tree: Array<{ path: string; type: string }>;
    try {
      tree = await fetchRepoTree(repo);
    } catch {
      continue;
    }

    for (const entry of tree) {
      if (entry.type !== "blob" || !entry.path.endsWith("/SKILL.md")) continue;
      const registryId = entry.path.split("/").at(-2);
      if (!registryId) continue;
      out.push({
        registryId,
        source: repoSourceType.get(repo) ?? "upstream",
        sourceRepo: repo,
        sourcePath: entry.path,
      });
    }
  }
  return out;
}

export async function discoverSkills(plan: InstallPlan): Promise<MatchResult[]> {
  const policy = loadPolicy(plan.projectDir);
  const seen = new Set(plan.matchedSkills.map((skill) => skill.registryId));
  const tokens = buildDiscoveryTokens(plan);
  const techIds = new Set(plan.technologies.map((tech) => tech.id));
  const comboTokens = plan.combos.flatMap((combo) => tokenize(combo.id));
  const candidates = new Map<string, RankedCandidate>();

  const catalogCandidates = await collectCatalogCandidates(plan);
  const fallbackCandidates = catalogCandidates.length > 0 ? [] : await collectRepoTreeCandidates(plan);

  for (const candidate of [...catalogCandidates, ...fallbackCandidates]) {
    if (seen.has(candidate.registryId)) continue;
    if (!repoAllowed(candidate.sourceRepo, policy)) continue;

    const ranked = scoreCandidateDetailed(candidate, tokens, techIds, comboTokens);
    if (ranked.score < policy.minDiscoveryScore) continue;

    const existing = candidates.get(candidate.registryId);
    if (existing && existing.score >= ranked.score) continue;

    candidates.set(candidate.registryId, {
      registryId: candidate.registryId,
      source: candidate.source,
      sourceRepo: candidate.sourceRepo,
      sourcePath: candidate.sourcePath,
      reasons: [
        "Discovery",
        ...ranked.reasonsDetailed,
        catalogCandidates.includes(candidate) ? "catalog:autoskills" : "catalog:github-tree",
      ],
      score: ranked.score,
      reasonsDetailed: ranked.reasonsDetailed,
    });
  }

  return [...candidates.values()]
    .sort((a, b) => b.score - a.score || a.registryId.localeCompare(b.registryId))
    .slice(0, policy.maxDiscoveredSkills)
    .map(({ score: _score, reasonsDetailed: _reasonsDetailed, ...skill }) => skill);
}
