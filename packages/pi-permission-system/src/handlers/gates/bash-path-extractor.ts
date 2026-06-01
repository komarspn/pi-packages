import { BashProgram } from "./bash-program";

/**
 * Extract paths from a bash command string that resolve outside CWD.
 *
 * Thin facade over {@link BashProgram.externalPaths}; parses the command and
 * returns the cd-aware external paths. See `BashProgram` for the parsing and
 * resolution semantics.
 */
export async function extractExternalPathsFromBashCommand(
  command: string,
  cwd: string,
): Promise<string[]> {
  return (await BashProgram.parse(command)).externalPaths(cwd);
}

/**
 * Extract tokens from a bash command that may be file paths, using the broader
 * filter suitable for cross-cutting `path` permission rules.
 *
 * Thin facade over {@link BashProgram.pathTokens}.
 */
export async function extractTokensForPathRules(
  command: string,
): Promise<string[]> {
  return (await BashProgram.parse(command)).pathTokens();
}
