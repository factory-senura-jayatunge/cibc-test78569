// @ts-check

/**
 * Returns the value that follows `name` on the command line, for example `--base origin/main`.
 * @param {string} name
 * @returns {string | undefined}
 */
export function flagValue(name) {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}
