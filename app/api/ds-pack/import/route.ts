import { NextRequest } from "next/server";
import JSZip from "jszip";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import type { DSPackManifest } from "../../../design-systems/pack-types";

const pexec = promisify(exec);
const PROJECT_ROOT = process.cwd();
const IMPORTED_DIR = path.join(PROJECT_ROOT, "app/design-systems/imported");
const GUIDES_DIR = path.join(PROJECT_ROOT, "guides");
const INIT_TS = path.join(PROJECT_ROOT, "app/design-systems/init.ts");
const PACKAGE_JSON = path.join(PROJECT_ROOT, "package.json");

const ID_RE = /^[a-z][a-z0-9-]{0,40}$/;

/**
 * Rewrite relative imports in an adapter file so it works from
 * app/design-systems/imported/{id}.tsx instead of app/design-systems/{id}.tsx.
 *
 * Users often copy the adapter template from docs/adding-design-system.md
 * which uses paths relative to app/design-systems/. We silently adjust them
 * so non-devs don't have to think about folder depth.
 */
function rewriteImports(src: string): string {
  return src
    .replace(/from\s+["']\.\/types["']/g, 'from "../types"')
    .replace(/from\s+["']\.\/registry["']/g, 'from "../registry"')
    .replace(/from\s+["']\.\/context["']/g, 'from "../context"')
    .replace(/from\s+["']\.\.\/store\/types["']/g, 'from "../../store/types"')
    .replace(/from\s+["']\.\.\/store\/context["']/g, 'from "../../store/context"');
}

function validateManifest(raw: unknown): DSPackManifest {
  if (!raw || typeof raw !== "object") throw new Error("manifest.json is not a JSON object");
  const m = raw as Record<string, unknown>;
  if (typeof m.id !== "string" || !ID_RE.test(m.id)) {
    throw new Error(`Invalid "id": must match ${ID_RE} (lowercase letters, numbers, hyphens; start with a letter)`);
  }
  if (typeof m.name !== "string" || !m.name.trim()) throw new Error(`"name" is required`);
  if (typeof m.version !== "string" || !m.version.trim()) throw new Error(`"version" is required`);
  if (m.dependencies && typeof m.dependencies !== "object") throw new Error(`"dependencies" must be an object`);
  return {
    id: m.id,
    name: m.name,
    version: m.version,
    description: typeof m.description === "string" ? m.description : undefined,
    author: typeof m.author === "string" ? m.author : undefined,
    entry: typeof m.entry === "string" ? m.entry : "adapter.tsx",
    guide: typeof m.guide === "string" ? m.guide : "guide.md",
    dependencies: (m.dependencies as Record<string, string>) || {},
  };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("pack");
    if (!file || typeof file === "string") {
      return Response.json({ error: "No file uploaded (field name: 'pack')" }, { status: 400 });
    }

    // ── 1. Unzip ───────────────────────────────────────────────────────
    const buffer = Buffer.from(await (file as Blob).arrayBuffer());
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(buffer);
    } catch {
      return Response.json({ error: "File is not a valid .zip" }, { status: 400 });
    }

    // ── 2. Validate manifest ───────────────────────────────────────────
    const manifestEntry = zip.file("manifest.json");
    if (!manifestEntry) {
      return Response.json({ error: "manifest.json missing from the pack" }, { status: 400 });
    }
    let manifest: DSPackManifest;
    try {
      manifest = validateManifest(JSON.parse(await manifestEntry.async("string")));
    } catch (err) {
      return Response.json({ error: `manifest.json: ${(err as Error).message}` }, { status: 400 });
    }

    // ── 3. Read adapter + guide ────────────────────────────────────────
    const entryName = manifest.entry || "adapter.tsx";
    const adapterEntry = zip.file(entryName);
    if (!adapterEntry) {
      return Response.json({ error: `Adapter file "${entryName}" missing from the pack` }, { status: 400 });
    }
    const adapterSrcRaw = await adapterEntry.async("string");
    const adapterSrc = rewriteImports(adapterSrcRaw);

    let guideContent: string | null = null;
    if (manifest.guide) {
      const guideEntry = zip.file(manifest.guide);
      if (guideEntry) guideContent = await guideEntry.async("string");
    }

    // ── 4. Write files ─────────────────────────────────────────────────
    if (!existsSync(IMPORTED_DIR)) await mkdir(IMPORTED_DIR, { recursive: true });
    await writeFile(path.join(IMPORTED_DIR, `${manifest.id}.tsx`), adapterSrc, "utf-8");

    if (guideContent !== null) {
      if (!existsSync(GUIDES_DIR)) await mkdir(GUIDES_DIR, { recursive: true });
      await writeFile(path.join(GUIDES_DIR, `${manifest.id}.md`), guideContent, "utf-8");
    }

    // ── 5. Merge dependencies ──────────────────────────────────────────
    let depsChanged = false;
    const changedDeps: Record<string, string> = {};
    if (manifest.dependencies && Object.keys(manifest.dependencies).length > 0) {
      const pkg = JSON.parse(await readFile(PACKAGE_JSON, "utf-8"));
      pkg.dependencies = pkg.dependencies || {};
      for (const [name, ver] of Object.entries(manifest.dependencies)) {
        if (pkg.dependencies[name] !== ver) {
          pkg.dependencies[name] = ver;
          changedDeps[name] = ver;
          depsChanged = true;
        }
      }
      if (depsChanged) {
        await writeFile(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
      }
    }

    // ── 6. Update init.ts ──────────────────────────────────────────────
    const importLine = `import "./imported/${manifest.id}";`;
    let initContent = await readFile(INIT_TS, "utf-8");
    if (!initContent.includes(importLine)) {
      initContent = initContent.trimEnd() + "\n" + importLine + "\n";
      await writeFile(INIT_TS, initContent, "utf-8");
    }

    // ── 7. Run npm install (if deps changed) ───────────────────────────
    let installError: string | undefined;
    if (depsChanged) {
      try {
        await pexec("npm install --no-audit --no-fund", {
          cwd: PROJECT_ROOT,
          timeout: 180_000,
          maxBuffer: 10 * 1024 * 1024,
        });
      } catch (err) {
        const e = err as { stderr?: string; message?: string };
        installError = (e.stderr || e.message || "npm install failed").toString().slice(-800);
      }
    }

    return Response.json({
      ok: !installError,
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      depsChanged,
      changedDeps,
      guideWritten: guideContent !== null,
      installError,
      message: installError
        ? `Installed files, but npm install failed. Run "npm install" manually, then restart the dev server.`
        : depsChanged
        ? `Installed "${manifest.name}" and ran npm install. New packages loaded — if the DS doesn't appear within a few seconds, restart the dev server.`
        : `Installed "${manifest.name}". It should appear in the design-system dropdown shortly.`,
    });
  } catch (err) {
    return Response.json(
      { error: (err as Error).message || "Import failed" },
      { status: 500 }
    );
  }
}
