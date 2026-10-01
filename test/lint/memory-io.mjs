/**
 * An in-memory stand-in for `readFileSync`/`writeFileSync`.
 *
 * `files` is the tree after any writes, and `writes` names each path written,
 * in order, so a test can assert that an unchanged file was not rewritten.
 *
 * @param {Record<string, Buffer>} tree
 */
export function memoryIo(tree) {
  const files = { ...tree };
  const writes = [];
  return {
    files,
    writes,
    readFile: (path) => files[path],
    writeFile: (path, text) => {
      files[path] = Buffer.from(text, "utf8");
      writes.push(path);
    },
  };
}
