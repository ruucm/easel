import { NextRequest } from "next/server";
import JSZip from "jszip";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import type { DSPackManifest, DSPackInstallRecord } from "../../../design-systems/pack-types";

const pexec = promisify(exec);
const PROJECT_ROOT = process.cwd();
const IMPORTED_DIR = path.join(PROJECT_ROOT, "app/design-systems/imported");
const GUIDES_DIR = path.join(PROJECT_ROOT, "guides");
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");
const INIT_TS = path.join(PROJECT_ROOT, "app/design-systems/init.ts");
const PACKAGE_JSON = path.join(PROJECT_ROOT, "package.json");
const NPMRC = path.join(PROJECT_ROOT, ".npmrc");
const AI_SCHEMAS_DIR = path.join(PROJECT_ROOT, "app/api/ai-edit/imported-schemas");

const ID_RE = /^[a-z][a-z0-9-]{0,40}$/;

/**
 * Rewrite relative imports in an adapter file so it works from
 * app/design-systems/imported/{id}.tsx instead of app/design-systems/{id}.tsx.
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
  if (m.publicAssets && typeof m.publicAssets !== "object") throw new Error(`"publicAssets" must be an object`);

  return {
    id: m.id,
    name: m.name,
    version: m.version,
    description: typeof m.description === "string" ? m.description : undefined,
    author: typeof m.author === "string" ? m.author : undefined,
    entry: typeof m.entry === "string" ? m.entry : "adapter.tsx",
    guide: typeof m.guide === "string" ? m.guide : "guide.md",
    dependencies: (m.dependencies as Record<string, string>) || {},
    publicAssets: (m.publicAssets as Record<string, string>) || undefined,
    npmrc: typeof m.npmrc === "string" ? m.npmrc : undefined,
  };
}

/**
 * Extract the `aiSchema` template literal from an adapter source.
 * The AI edit route uses this string to describe the DS to Claude.
 * Returns null if the adapter has no `aiSchema` const (AI generation
 * will fall back to the built-in HTML schema, which is wrong for DS-specific
 * types, so we try hard to find it).
 */
function extractAiSchema(src: string): string | null {
  // Match:   const aiSchema = `...`  (with optional type annotation)
  // Uses a manual walk because JS regex can't handle nested backticks.
  const startRe = /\bconst\s+aiSchema(?:\s*:\s*string)?\s*=\s*`/;
  const m = startRe.exec(src);
  if (!m) return null;
  const start = m.index + m[0].length;
  // Walk to the matching closing backtick, skipping escapes and ${ ... }.
  let i = start;
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === "$" && src[i + 1] === "{") {
      depth++;
      i += 2;
      continue;
    }
    if (depth > 0) {
      if (c === "}") depth--;
      i++;
      continue;
    }
    if (c === "`") {
      return src.slice(start, i);
    }
    i++;
  }
  return null;
}

/**
 * Reject any path segment that would escape the destination folder.
 * (Prevents zip-slip even though we trust team packs.)
 */
function safeRelative(p: string): string {
  const normalized = path.normalize(p);
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
    throw new Error(`Unsafe path in manifest: "${p}"`);
  }
  return normalized;
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

    // ── 4. Write core files ────────────────────────────────────────────
    const installedFiles: string[] = [];
    if (!existsSync(IMPORTED_DIR)) await mkdir(IMPORTED_DIR, { recursive: true });
    const adapterDest = path.join(IMPORTED_DIR, `${manifest.id}.tsx`);
    await writeFile(adapterDest, adapterSrc, "utf-8");
    installedFiles.push(path.relative(PROJECT_ROOT, adapterDest));

    if (guideContent !== null) {
      if (!existsSync(GUIDES_DIR)) await mkdir(GUIDES_DIR, { recursive: true });
      const guideDest = path.join(GUIDES_DIR, `${manifest.id}.md`);
      await writeFile(guideDest, guideContent, "utf-8");
      installedFiles.push(path.relative(PROJECT_ROOT, guideDest));
    }

    // Extract aiSchema for the server-side AI route — the client-side
    // registry can't be read by server code, so we persist the schema
    // to a file the AI edit route will pick up.
    const aiSchema = extractAiSchema(adapterSrc);
    let aiSchemaWritten = false;
    if (aiSchema) {
      if (!existsSync(AI_SCHEMAS_DIR)) await mkdir(AI_SCHEMAS_DIR, { recursive: true });
      const schemaDest = path.join(AI_SCHEMAS_DIR, `${manifest.id}.txt`);
      await writeFile(schemaDest, aiSchema, "utf-8");
      installedFiles.push(path.relative(PROJECT_ROOT, schemaDest));
      aiSchemaWritten = true;
    }

    // ── 5. Copy publicAssets to project public/ ────────────────────────
    const missingAssets: string[] = [];
    if (manifest.publicAssets) {
      for (const [zipPath, destPath] of Object.entries(manifest.publicAssets)) {
        const assetEntry = zip.file(zipPath);
        if (!assetEntry) {
          missingAssets.push(zipPath);
          continue;
        }
        const safeDest = safeRelative(destPath);
        const fullDest = path.join(PUBLIC_DIR, safeDest);
        await mkdir(path.dirname(fullDest), { recursive: true });
        const content = await assetEntry.async("nodebuffer");
        await writeFile(fullDest, content);
        installedFiles.push(path.relative(PROJECT_ROOT, fullDest));
      }
    }
    if (missingAssets.length > 0) {
      return Response.json(
        { error: `publicAssets referenced files missing from zip: ${missingAssets.join(", ")}` },
        { status: 400 }
      );
    }

    // ── 6. .npmrc (only write if project doesn't have one) ─────────────
    let npmrcWritten = false;
    if (manifest.npmrc) {
      const npmrcEntry = zip.file(manifest.npmrc);
      if (!npmrcEntry) {
        return Response.json(
          { error: `manifest.npmrc references "${manifest.npmrc}" but it's missing from the zip` },
          { status: 400 }
        );
      }
      if (!existsSync(NPMRC)) {
        const content = await npmrcEntry.async("string");
        await writeFile(NPMRC, content, "utf-8");
        installedFiles.push(".npmrc");
        npmrcWritten = true;
      }
    }

    // ── 7. Merge dependencies ──────────────────────────────────────────
    const changedDeps: Record<string, string> = {};
    let depsChanged = false;
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

    // ── 8. Install record ──────────────────────────────────────────────
    const record: DSPackInstallRecord = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      installedFiles,
      addedDependencies: Object.keys(changedDeps),
      installedAt: new Date().toISOString(),
    };
    const recordPath = path.join(IMPORTED_DIR, `${manifest.id}.meta.json`);
    await writeFile(recordPath, JSON.stringify(record, null, 2) + "\n", "utf-8");

    // ── 9. Run npm install (if deps changed) ──────────────────────────
    // Must complete BEFORE updating init.ts — otherwise Turbopack tries to
    // compile the new adapter before its deps exist and logs errors.
    let installError: string | undefined;
    let installedWithLegacyPeerDeps = false;
    if (depsChanged) {
      const runInstall = (legacy: boolean) =>
        pexec(
          `npm install --no-audit --no-fund --prefer-offline${legacy ? " --legacy-peer-deps" : ""}`,
          {
            cwd: PROJECT_ROOT,
            timeout: 10 * 60_000, // 10 min — big DS packs can have 100+ peer deps
            maxBuffer: 20 * 1024 * 1024,
          }
        );
      try {
        await runInstall(false);
      } catch (err) {
        // ERESOLVE is common for DS packs with rich peer-dep trees
        // (charts, lottie, etc.). Retry once with --legacy-peer-deps,
        // which matches how team members typically install these manually.
        const msg = (err as { stderr?: string; message?: string }).stderr || "";
        if (/ERESOLVE|peer dep/i.test(msg)) {
          try {
            await runInstall(true);
            installedWithLegacyPeerDeps = true;
          } catch (err2) {
            const e = err2 as { stderr?: string; message?: string };
            installError = (e.stderr || e.message || "npm install failed").toString().slice(-800);
          }
        } else {
          const e = err as { stderr?: string; message?: string };
          installError = (e.stderr || e.message || "npm install failed").toString().slice(-800);
        }
      }
    }

    // ── 10. Update init.ts (last — triggers HMR once deps are ready) ───
    if (!installError) {
      const importLine = `import "./imported/${manifest.id}";`;
      let initContent = await readFile(INIT_TS, "utf-8");
      if (!initContent.includes(importLine)) {
        initContent = initContent.trimEnd() + "\n" + importLine + "\n";
        await writeFile(INIT_TS, initContent, "utf-8");
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
      aiSchemaWritten,
      npmrcWritten,
      publicAssets: manifest.publicAssets ? Object.keys(manifest.publicAssets).length : 0,
      installedWithLegacyPeerDeps,
      installError,
      message: installError
        ? `Files installed, but npm install failed. Run "npm install --legacy-peer-deps" manually, then restart the dev server.`
        : depsChanged
        ? `Installed "${manifest.name}" and ran npm install${installedWithLegacyPeerDeps ? " (with --legacy-peer-deps)" : ""}. If the DS doesn't appear within a few seconds, restart the dev server.`
        : `Installed "${manifest.name}". It should appear in the design-system dropdown shortly.`,
    });
  } catch (err) {
    return Response.json(
      { error: (err as Error).message || "Import failed" },
      { status: 500 }
    );
  }
}
