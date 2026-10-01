// YAML frontmatter parsing for the agent-facing markdown this repo authors:
// skills, prompt templates, and subagent definitions. Only the shapes those
// files actually use are handled — this is not a YAML parser.

/**
 * The `description:` value from a markdown file's YAML frontmatter, dedented,
 * or "" when the file has no frontmatter or no description.
 *
 * Handles the three forms the repo uses: a literal block (`|`), a folded
 * block (`>-`), and a single-line value. Block bodies end at the closing
 * `---` or at the next unindented key.
 *
 * @param {string} markdown
 */
export function frontmatterDescription(markdown) {
  const { frontmatter } = splitFrontmatter(markdown);
  const start = frontmatter.findIndex((line) =>
    line.startsWith("description:"),
  );
  if (start === -1) return "";

  const inline = frontmatter[start].slice("description:".length).trim();
  if (inline !== "" && !/^[|>]/.test(inline)) return inline;

  const body = [];
  for (const line of frontmatter.slice(start + 1)) {
    if (!/^\s/.test(line)) break;
    body.push(line.trim());
  }
  return body.join("\n");
}

/**
 * The markdown after the closing frontmatter fence — what Pi sends to the
 * model for a prompt template or subagent definition — or the whole text when
 * there is no frontmatter.
 *
 * @param {string} markdown
 */
export function markdownBody(markdown) {
  return splitFrontmatter(markdown).body.join("\n");
}

/**
 * The frontmatter lines (between the opening and closing `---`) and the body
 * lines after the closing fence. A file that does not open with `---` has no
 * frontmatter; an unclosed fence makes the rest of the file frontmatter.
 *
 * @param {string} markdown
 * @returns {{ frontmatter: string[], body: string[] }}
 */
function splitFrontmatter(markdown) {
  const lines = markdown.split("\n");
  if (lines[0] !== "---") return { frontmatter: [], body: lines };

  const close = lines.indexOf("---", 1);
  if (close === -1) return { frontmatter: lines.slice(1), body: [] };
  return { frontmatter: lines.slice(1, close), body: lines.slice(close + 1) };
}
