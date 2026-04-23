import { NextRequest } from "next/server";
import { readFile, writeFile, unlink, stat } from "fs/promises";
import path from "path";

const PROJECT_ROOT = process.cwd();
const IMPORTED_DIR = path.join(PROJECT_ROOT, "app/design-systems/imported");
const GUIDES_DIR = path.join(PROJECT_ROOT, "guides");
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

  // Only allow removal of adapters that live in imported/ — never built-ins.
  const adapterPath = path.join(IMPORTED_DIR, `${dsId}.tsx`);
  const guidePath = path.join(GUIDES_DIR, `${dsId}.md`);

  const adapterRemoved = await tryUnlink(adapterPath);
  if (!adapterRemoved) {
    return Response.json(
      {
        error: `No imported DS found with id="${dsId}". Built-in design systems cannot be uninstalled.`,
      },
      { status: 404 }
    );
  }
  const guideRemoved = await tryUnlink(guidePath);

  // Remove the import line from init.ts
  const importLine = `import "./imported/${dsId}";`;
  const initContent = await readFile(INIT_TS, "utf-8");
  const lines = initContent.split("\n").filter((l) => l.trim() !== importLine);
  await writeFile(INIT_TS, lines.join("\n"), "utf-8");

  return Response.json({
    ok: true,
    id: dsId,
    adapterRemoved,
    guideRemoved,
    message: `Uninstalled "${dsId}". The DS picker will update shortly. npm packages are kept — remove them manually from package.json if unused.`,
  });
}

// GET /api/ds-pack/uninstall — list imported DSes so the UI can show Uninstall controls.
export async function GET() {
  const { readdir } = await import("fs/promises");
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
