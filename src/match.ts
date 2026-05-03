import { COMBO_RULES, FRONTEND_BONUS_SKILLS, TECHNOLOGY_RULES } from "./maps.ts";
import type { DetectResult, MatchResult, SkillSource } from "./types.ts";

function addMatch(store: Map<string, MatchResult>, skill: SkillSource, reason: string): void {
  const existing = store.get(skill.registryId);
  if (existing) {
    if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
    return;
  }

  store.set(skill.registryId, {
    registryId: skill.registryId,
    source: skill.source,
    sourceRepo: skill.sourceRepo,
    sourcePath: skill.sourcePath,
    reasons: [reason],
  });
}

export function matchSkills(result: DetectResult): MatchResult[] {
  const ids = new Set(result.detected.map((tech) => tech.id));
  const matches = new Map<string, MatchResult>();

  for (const rule of TECHNOLOGY_RULES) {
    if (!ids.has(rule.id)) continue;
    for (const skill of rule.skills) addMatch(matches, skill, rule.name);
  }

  for (const combo of COMBO_RULES) {
    if (!combo.requires.every((id) => ids.has(id))) continue;
    for (const skill of combo.skills) addMatch(matches, skill, combo.name);
  }

  if (result.isFrontend) {
    for (const skill of FRONTEND_BONUS_SKILLS) addMatch(matches, skill, "Frontend");
  }

  return [...matches.values()].sort((a, b) => a.registryId.localeCompare(b.registryId));
}
