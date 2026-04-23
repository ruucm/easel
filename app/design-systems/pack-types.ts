/**
 * Shared manifest format for .dspack.zip bundles.
 *
 * A .dspack.zip contains:
 *   manifest.json   — this shape
 *   adapter.tsx     — the DesignSystemAdapter source
 *   guide.md        — optional AI guide content
 *   .npmrc          — optional, for private npm registries
 *   <asset files>   — optional static files (CSS, fonts, etc.) copied to public/
 */
export interface DSPackManifest {
  /** Unique id — lowercase, alphanumeric + hyphens (used as filename and registry key). */
  id: string;
  /** Display name shown in the DS picker. */
  name: string;
  /** Pack version (semver). Informational. */
  version: string;
  /** Short description. */
  description?: string;
  /** Author / team name. */
  author?: string;
  /** File inside the zip that holds the adapter source. Default: "adapter.tsx". */
  entry?: string;
  /** File inside the zip that holds the AI guide markdown. Default: "guide.md". */
  guide?: string;
  /** npm packages this adapter needs. Merged into the project's package.json on import. */
  dependencies?: Record<string, string>;

  /**
   * Files inside the zip to copy into the project's `public/` folder.
   * Keys are zip-relative paths, values are destination paths under public/.
   * Example: { "bds.css": "ds-packs/bds/bds.css" } — served at /ds-packs/bds/bds.css
   */
  publicAssets?: Record<string, string>;

  /**
   * Filename inside the zip to copy to the project's root as `.npmrc`.
   * Needed for private npm registries. Only copied if the project doesn't
   * already have a `.npmrc` (so we never clobber an existing config).
   */
  npmrc?: string;
}

/**
 * Sidecar metadata saved at `app/design-systems/imported/{id}.meta.json`
 * so uninstall can clean up publicAssets and any other files we wrote.
 * Not shipped inside the pack — generated at import time.
 */
export interface DSPackInstallRecord {
  id: string;
  name: string;
  version: string;
  /** Absolute project-relative paths of files written by the import (for cleanup). */
  installedFiles: string[];
  /** Package names added to package.json (not removed on uninstall — may be shared). */
  addedDependencies: string[];
  installedAt: string;
}
