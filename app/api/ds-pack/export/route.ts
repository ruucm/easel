import { NextRequest } from "next/server";
import JSZip from "jszip";
import { readFile, stat } from "fs/promises";
import path from "path";
import type { DSPackManifest, DSPackInstallRecord } from "../../../design-systems/pack-types";

const PROJECT_ROOT = process.cwd();
const DS_DIR = path.join(PROJECT_ROOT, "app/design-systems");
const IMPORTED_DIR = path.join(DS_DIR, "imported");
const GUIDES_DIR = path.join(PROJECT_ROOT, "guides");
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");
const PACKAGE_JSON = path.join(PROJECT_ROOT, "package.json");

const ID_RE = /^[a-z][a-z0-9-]{0,40}$/;

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function findAdapterPath(id: string): Promise<string | null> {
  const candidates = [
    path.join(DS_DIR, `${id}.tsx`),
    path.join(IMPORTED_DIR, `${id}.tsx`),
  ];
  for (const p of candidates) {
    if (await exists(p)) return p;
  }
  return null;
}

async function readInstallRecord(id: string): Promise<DSPackInstallRecord | null> {
  try {
    const raw = await readFile(path.join(IMPORTED_DIR, `${id}.meta.json`), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Inverse of the import-time path rewrite — produces source that can be
 * re-imported cleanly by any machine.
 */
function normalizeImports(src: string): string {
  return src
    .replace(/from\s+["']\.\.\/types["']/g, 'from "./types"')
    .replace(/from\s+["']\.\.\/registry["']/g, 'from "./registry"')
    .replace(/from\s+["']\.\.\/context["']/g, 'from "./context"')
    .replace(/from\s+["']\.\.\/\.\.\/store\/types["']/g, 'from "../store/types"')
    .replace(/from\s+["']\.\.\/\.\.\/store\/context["']/g, 'from "../store/context"');
}

function extractExternalImports(src: string): Set<string> {
  const packages = new Set<string>();
  const re = /(?:import|from)\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const spec = m[1];
    if (spec.startsWith(".") || spec.startsWith("@/")) continue;
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

  // Re-include publicAssets / .npmrc if this DS was originally imported
  // (info comes from the install record written during import).
  const record = await readInstallRecord(dsId);
  const publicAssets: Record<string, string> = {};
  const publicAssetBuffers: Record<string, Buffer> = {};
  let npmrcBuffer: Buffer | null = null;

  if (record?.installedFiles) {
    for (const rel of record.installedFiles) {
      // Public assets — remap public/foo/bar.css ↔ zip path basename
      if (rel.startsWith("public/")) {
        const afterPublic = rel.slice("public/".length);
        const zipPath = path.basename(afterPublic);
        try {
          const content = await readFile(path.join(PROJECT_ROOT, rel));
          publicAssetBuffers[zipPath] = content;
          publicAssets[zipPath] = afterPublic;
        } catch {}
      }
    }
  }

  // Always include .npmrc for re-exports of imported packs — private
  // registry tokens are commonly needed, and install-time logic skips
  // writing it if the receiver already has one, so no harm in shipping it.
  if (record) {
    const npmrcPath = path.join(PROJECT_ROOT, ".npmrc");
    if (await exists(npmrcPath)) {
      npmrcBuffer = await readFile(npmrcPath);
    }
  }

  const manifest: DSPackManifest = {
    id: dsId,
    name: record?.name || dsId,
    version: record?.version || "1.0.0",
    description: `Design system pack for ${dsId}`,
    entry: "adapter.tsx",
    guide: guideContent !== null ? "guide.md" : undefined,
    dependencies,
    publicAssets: Object.keys(publicAssets).length > 0 ? publicAssets : undefined,
    npmrc: npmrcBuffer ? ".npmrc" : undefined,
  };

  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(manifest, null, 2) + "\n");
  zip.file("adapter.tsx", adapterSrc);
  if (guideContent !== null) zip.file("guide.md", guideContent);
  for (const [zipPath, buf] of Object.entries(publicAssetBuffers)) {
    zip.file(zipPath, buf);
  }
  if (npmrcBuffer) zip.file(".npmrc", npmrcBuffer);

  const assetsNote =
    Object.keys(publicAssets).length > 0
      ? `\n- **publicAssets**: ${Object.keys(publicAssets).join(", ")}`
      : "";
  const npmrcNote = npmrcBuffer ? `\n- **.npmrc**: included (private registry auth)` : "";
  zip.file(
    "README.md",
    `# ${manifest.name} design system pack\n\n` +
      `Import this pack via the "Import pack" button in Easel.\n\n` +
      `- **id**: \`${dsId}\`\n` +
      `- **dependencies**: ${
        Object.keys(dependencies).length === 0
          ? "none"
          : Object.entries(dependencies).map(([k, v]) => `\`${k}@${v}\``).join(", ")
      }` +
      assetsNote +
      npmrcNote +
      `\n`
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
