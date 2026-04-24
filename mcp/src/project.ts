import fs from "node:fs";
import path from "node:path";

/**
 * Locate the Easel project root. Resolution order:
 *   1. EASEL_DIR env var (if set)
 *   2. Walk up from process.cwd() looking for a package.json with name "easel"
 *   3. process.cwd()
 */
export function resolveProjectRoot(): string {
  const fromEnv = process.env.EASEL_DIR;
  if (fromEnv) {
    if (!fs.existsSync(fromEnv)) {
      throw new Error(`EASEL_DIR points to missing path: ${fromEnv}`);
    }
    return path.resolve(fromEnv);
  }

  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        if (pkg?.name === "easel") return dir;
      } catch {}
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export function resolveBaseUrl(): string {
  return process.env.EASEL_URL ?? "http://localhost:3000";
}
