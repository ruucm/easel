import { NextRequest } from "next/server";
import JSZip from "jszip";
import { readFile, stat } from "fs/promises";
import path from "path";
import type { DSPackManifest } from "../../../design-systems/pack-types";

const PROJECT_ROOT = process.cwd();
const DS_DIR = path.join(PROJECT_ROOT, "app/design-systems");
const GUIDES_DIR = path.join(PROJECT_ROOT, "guides");
const PACKAGE_JSON = path.join(PROJECT_ROOT, "package.json");

const ID_RE = /^[a-z][a-z0-9-]{0,40}$/;

/**
 * Find the adapter source file for a DS id.
 * Looks in both app/design-systems/{id}.tsx (built-in)
 * and app/design-systems/imported/{id}.tsx (previously imported).
 */
async function findAdapterPath(id: string): Promise<string | null> {
  const candidates = [
    path.join(DS_DIR, `${id}.tsx`),
    path.join(DS_DIR, "imported", `${id}.tsx`),
  ];
  for (const p of candidates) {
    try {
      await stat(p);
      return p;
    } catch {}
  }
  return null;
}

/**
 * Inverse of the import-time path rewrite: normalize an imported adapter's
 * paths back to the "standard" form (as if it lived in app/design-systems/)
 * so the exported pack re-imports cleanly on other machines.
 */
function normalizeImports(src: string): string {
  return src
    .replace(/from\s+["']\.\.\/types["']/g, 'from "./types"')
    .replace(/from\s+["']\.\.\/registry["']/g, 'from "./registry"')
    .replace(/from\s+["']\.\.\/context["']/g, 'from "./context"')
    .replace(/from\s+["']\.\.\/\.\.\/store\/types["']/g, 'from "../store/types"')
    .replace(/from\s+["']\.\.\/\.\.\/store\/context["']/g, 'from "../store/context"');
}

/**
 * Extract external npm package names from the adapter source.
 * Ignores relative imports and `@/` aliases (those are internal).
 */
function extractExternalImports(src: string): Set<string> {
  const packages = new Set<string>();
  const re = /(?:import|from)\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const spec = m[1];
    if (spec.startsWith(".") || spec.startsWith("@/")) continue;
    // Scoped: @scope/name or @scope/name/sub
    if (spec.startsWith("@")) {
      const parts = spec.split("/");
      if (parts.length >= 2) packages.add(`${parts[0]}/${parts[1]}`);
    } else {
      packages.add(spec.split("/")[0]);
    }
  }
  return packages;
}

// GET /api/ds-pack/export?dsId=mui
export async function GET(req: NextRequest) {
  const dsId = req.nextUrl.searchParams.get("dsId") || "";
  if (!ID_RE.test(dsId)) {
    return Response.json({ error: "Invalid or missing dsId" }, { status: 400 });
  }

  const adapterPath = await findAdapterPath(dsId);
  if (!adapterPath) {
    return Response.json({ error: `No adapter found for dsId="${dsId}"` }, { status: 404 });
  }

  // Adapter source (normalized)
  const adapterRaw = await readFile(adapterPath, "utf-8");
  const adapterSrc = normalizeImports(adapterRaw);

  // Guide (optional)
  let guideContent: string | null = null;
  try {
    guideContent = await readFile(path.join(GUIDES_DIR, `${dsId}.md`), "utf-8");
  } catch {}

  // Dependency detection
  const pkg = JSON.parse(await readFile(PACKAGE_JSON, "utf-8"));
  const rootDeps: Record<string, string> = { ...(pkg.dependencies || {}) };
  const ignored = new Set(["react", "react-dom", "next"]);
  const externalPkgs = extractExternalImports(adapterSrc);
  const dependencies: Record<string, string> = {};
  for (const p of externalPkgs) {
    if (ignored.has(p)) continue;
    if (rootDeps[p]) dependencies[p] = rootDeps[p];
  }

  const manifest: DSPackManifest = {
    id: dsId,
    name: dsId,
    version: "1.0.0",
    description: `Design system pack for ${dsId}`,
    entry: "adapter.tsx",
    guide: guideContent !== null ? "guide.md" : undefined,
    dependencies,
  };

  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(manifest, null, 2) + "\n");
  zip.file("adapter.tsx", adapterSrc);
  if (guideContent !== null) zip.file("guide.md", guideContent);
  zip.file(
    "README.md",
    `# ${dsId} design system pack\n\n` +
      `Import this pack via the "Import DS" button in Design System Canvas.\n\n` +
      `- **id**: \`${dsId}\`\n` +
      `- **dependencies**: ${
        Object.keys(dependencies).length === 0
          ? "none"
          : Object.entries(dependencies).map(([k, v]) => `\`${k}@${v}\``).join(", ")
      }\n`
  );

  const buf = await zip.generateAsync({ type: "nodebuffer" });

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${dsId}.dspack.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
