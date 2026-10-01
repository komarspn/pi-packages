#!/usr/bin/env node
// The words a session pays for unconditionally.
//
// Pi loads AGENTS.md into every session. It also loads each skill's
// frontmatter `description:` into every session — that is how the agent knows
// the skill exists — but a skill's body is paid for only when a session reads
// it. pi-subagents likewise lists every .pi/agents/*.md `description:` in the
// `subagent` tool's description, while an agent's body is paid only per
// dispatch. So the always-loaded corpus is the root AGENTS.md plus the skill
// and agent descriptions, and that is the number an admission test for
// AGENTS.md is measured against.
//
// doc-growth.mjs cannot report this directly: its agents_md bucket matches
// packages/*/AGENTS.md too, which is right for the pre-consolidation history
// (those were real files then) and wrong as an always-loaded figure now (they
// are ~45-word sentinels that fire only from a package subdirectory).
//
// Usage: node scripts/agent-docs/always-loaded.mjs [--root DIR]

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { countWords } from "./doc-growth.mjs";
import { frontmatterDescription } from "./frontmatter.mjs";

/**
 * @param {{ agentsMd: string, skillDescriptions: string[], agentDescriptions: string[] }} corpus
 */
export function alwaysLoadedWords({
  agentsMd,
  skillDescriptions,
  agentDescriptions,
}) {
  const agentsMdWords = countWords(agentsMd);
  const descriptions = sumWords(skillDescriptions);
  const agentDescriptionWords = sumWords(agentDescriptions);
  return {
    agentsMd: agentsMdWords,
    descriptions,
    agentDescriptions: agentDescriptionWords,
    total: agentsMdWords + descriptions + agentDescriptionWords,
  };
}

function sumWords(texts) {
  return texts.reduce((sum, text) => sum + countWords(text), 0);
}

function parseArgs(argv) {
  const options = { root: process.cwd() };
  for (let i = 0; i < argv.length; i += 2) {
    if (argv[i] === "--root") options.root = argv[i + 1];
    else throw new Error(`unknown option: ${argv[i]}`);
  }
  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { root } = parseArgs(process.argv.slice(2));
  const skillsDir = path.join(root, ".pi", "skills");
  const skillDescriptions = readdirSync(skillsDir)
    .map((name) => path.join(skillsDir, name, "SKILL.md"))
    .map((file) => frontmatterDescription(readFileSync(file, "utf8")));
  const agentsDir = path.join(root, ".pi", "agents");
  const agentDescriptions = readdirSync(agentsDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => path.join(agentsDir, name))
    .map((file) => frontmatterDescription(readFileSync(file, "utf8")));
  const result = alwaysLoadedWords({
    agentsMd: readFileSync(path.join(root, "AGENTS.md"), "utf8"),
    skillDescriptions,
    agentDescriptions,
  });
  process.stdout.write(
    `agentsMd=${result.agentsMd} descriptions=${result.descriptions} agentDescriptions=${result.agentDescriptions} total=${result.total}\n`,
  );
}
