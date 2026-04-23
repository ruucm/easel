import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const SAVES_DIR = path.join(process.cwd(), "saves");

function ensureDir() {
  if (!fs.existsSync(SAVES_DIR)) fs.mkdirSync(SAVES_DIR, { recursive: true });
}

/** GET /api/saves - list saves, or GET /api/saves?name=foo - load specific */
export async function GET(req: NextRequest) {
  ensureDir();
  const name = req.nextUrl.searchParams.get("name");

  if (name) {
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "");
    const filePath = path.join(SAVES_DIR, `${safeName}.json`);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return NextResponse.json(data);
  }

  // List all saves
  const files = fs.readdirSync(SAVES_DIR).filter((f) => f.endsWith(".json"));
  const saves = files.map((f) => {
    const stat = fs.statSync(path.join(SAVES_DIR, f));
    return {
      name: f.replace(/\.json$/, ""),
      updatedAt: stat.mtime.toISOString(),
      size: stat.size,
    };
  });
  saves.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return NextResponse.json({ saves });
}

/** POST /api/saves - save design */
export async function POST(req: NextRequest) {
  ensureDir();
  const body = await req.json();
  const { name, nodes } = body;

  if (!name || !nodes) {
    return NextResponse.json({ error: "name and nodes required" }, { status: 400 });
  }

  const safeName = String(name).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeName) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const filePath = path.join(SAVES_DIR, `${safeName}.json`);
  const data = { name: safeName, nodes, savedAt: new Date().toISOString() };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  return NextResponse.json({ ok: true, name: safeName, savedAt: data.savedAt });
}

/** DELETE /api/saves?name=foo */
export async function DELETE(req: NextRequest) {
  ensureDir();
  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "");
  const filePath = path.join(SAVES_DIR, `${safeName}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  return NextResponse.json({ ok: true });
}
