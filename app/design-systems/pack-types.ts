/**
 * Shared manifest format for .dspack.zip bundles.
 *
 * A .dspack.zip contains:
 *   manifest.json   — this shape
 *   adapter.tsx     — the DesignSystemAdapter source
 *   guide.md        — optional AI guide content
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
}
