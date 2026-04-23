import { NextRequest } from "next/server";
import { readFile, writeFile, unlink, stat, readdir } from "fs/promises";
import path from "path";
import type { DSPackInstallRecord } from "../../../design-systems/pack-types";

const PROJECT_ROOT = process.cwd();
const IMPORTED_DIR = path.join(PROJECT_ROOT, "app/design-systems/imported");
const INIT_TS = path.join(PROJECT_ROOT, "app/design-systems/init.ts");

const ID_RE = /^[a-z][a-z0-9-]{0,40}$/;

async function tryUnlink(p: string): Promise<boolean> {
  try {
    await stat(p);
    await unlink(p);
    return true;
  } catch {
    return false;
  }
}

// POST /api/ds-pack/uninstall  { dsId }
export async function POST(req: NextRequest) {
  let body: { dsId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const dsId = body.dsId || "";
  if (!ID_RE.test(dsId)) {
    return Response.json({ error: "Invalid or missing dsId" }, { status: 400 });
  }

  const adapterPath = path.join(IMPORTED_DIR, `${dsId}.tsx`);
  const metaPath = path.join(IMPORTED_DIR, `${dsId}.meta.json`);

  // The adapter file MUST exist — built-in DSes don't live in imported/.
  try {
    await stat(adapterPath);
  } catch {
    return Response.json(
      {
        error: `No imported DS found with id="${dsId}". Built-in design systems cannot be uninstalled.`,
      },
      { status: 404 }
    );
  }

  // Read install record for accurate cleanup.
  let record: DSPackInstallRecord | null = null;
  try {
    record = JSON.parse(await readFile(metaPath, "utf-8"));
  } catch {
    record = null;
  }

  const removed: string[] = [];
  const kept: string[] = [];

  if (record && Array.isArray(record.installedFiles)) {
    for (const relPath of record.installedFiles) {
      // Never unlink .npmrc via uninstall — other packs may rely on it.
      if (relPath === ".npmrc") {
        kept.push(relPath);
        continue;
      }
      const full = path.join(PROJECT_ROOT, relPath);
      if (await tryUnlink(full)) removed.push(relPath);
    }
  } else {
    // Fallback: legacy cleanup (adapter + guide only).
    if (await tryUnlink(adapterPath)) removed.push(path.relative(PROJECT_ROOT, adapterPath));
    const legacyGuide = path.join(PROJECT_ROOT, "guides", `${dsId}.md`);
    if (await tryUnlink(legacyGuide)) removed.push(path.relative(PROJECT_ROOT, legacyGuide));
  }

  // Always remove the meta file itself.
  await tryUnlink(metaPath);

  // Remove the import line from init.ts.
  const importLine = `import "./imported/${dsId}";`;
  const initContent = await readFile(INIT_TS, "utf-8");
  const lines = initContent.split("\n").filter((l) => l.trim() !== importLine);
  await writeFile(INIT_TS, lines.join("\n"), "utf-8");

  return Response.json({
    ok: true,
    id: dsId,
    removed,
    kept,
    message:
      `Uninstalled "${dsId}". ` +
      `npm packages are kept in package.json — remove manually if no other DS uses them.` +
      (kept.length > 0 ? ` Kept shared files: ${kept.join(", ")}.` : ""),
  });
}

// GET /api/ds-pack/uninstall — list imported DSes so the UI can show Uninstall controls.
export async function GET() {
  try {
    const files = await readdir(IMPORTED_DIR);
    const ids = files
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => f.replace(/\.tsx$/, ""))
      .filter((id) => ID_RE.test(id));
    return Response.json({ imported: ids });
  } catch {
    return Response.json({ imported: [] });
  }
}
