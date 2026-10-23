// @ts-check
// Dependency helpers for dependency-aware impact analysis (READINESS-2): a package.json or
// package-lock.json change maps to the source files that import the changed package, so a
// dependency bump scopes regression to the suites that cover those importers.

/**
 * @typedef {object} PackageManifest
 * @property {Record<string, string>} [dependencies]
 * @property {Record<string, string>} [devDependencies]
 */

/**
 * Resolves an import specifier to the package it comes from.
 * @param {string} specifier
 * @returns {string | null} null for relative imports and `node:` builtins
 */
export function packageName(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('node:')) return null;
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/**
 * Every dependency a manifest declares, runtime and dev.
 * @param {PackageManifest} manifest
 * @returns {Record<string, string>}
 */
export function dependencyVersions(manifest) {
  return { ...manifest.dependencies, ...manifest.devDependencies };
}

/**
 * Names of the dependencies added, removed, or re-versioned between two manifests.
 * @param {PackageManifest} before
 * @param {PackageManifest} after
 * @returns {string[]} sorted
 */
export function diffDependencies(before, after) {
  const oldVersions = dependencyVersions(before);
  const newVersions = dependencyVersions(after);
  const names = new Set([...Object.keys(oldVersions), ...Object.keys(newVersions)]);
  return [...names].filter((name) => oldVersions[name] !== newVersions[name]).sort();
}
