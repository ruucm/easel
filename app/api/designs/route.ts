import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DESIGNS_DIR = path.join(process.cwd(), "designs");

function ensureUserDir(userId: string) {
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  const dir = path.join(DESIGNS_DIR, safeUserId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return { dir, safeUserId };
}

function getUserId(req: NextRequest): string | null {
  return req.headers.get("x-user-id") || req.nextUrl.searchParams.get("userId");
}

/** GET /api/designs?userId=xxx - list all, or GET /api/designs?userId=xxx&name=foo - load one */
export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const { dir } = ensureUserDir(userId);
  const name = req.nextUrl.searchParams.get("name");

  if (name) {
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "");
    const filePath = path.join(dir, `${safeName}.md`);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const content = fs.readFileSync(filePath, "utf-8");
    const stat = fs.statSync(filePath);
    return NextResponse.json({ name: safeName, content, updatedAt: stat.mtime.toISOString() });
  }

  // List all design files for this user
  if (!fs.existsSync(dir)) return NextResponse.json({ designs: [] });
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  const designs = files.map((f) => {
    const stat = fs.statSync(path.join(dir, f));
    return {
      name: f.replace(/\.md$/, ""),
      updatedAt: stat.mtime.toISOString(),
      size: stat.size,
    };
  });
  designs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return NextResponse.json({ designs });
}

/** POST /api/designs - save design brief */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const userId = body.userId || getUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const { name, content } = body;
  if (!name || content == null) {
    return NextResponse.json({ error: "name and content required" }, { status: 400 });
  }

  const { dir } = ensureUserDir(userId);
  const safeName = String(name).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeName) return NextResponse.json({ error: "Invalid name" }, { status: 400 });

  const filePath = path.join(dir, `${safeName}.md`);
  fs.writeFileSync(filePath, content, "utf-8");

  return NextResponse.json({ ok: true, name: safeName, savedAt: new Date().toISOString() });
}

/** DELETE /api/designs?userId=xxx&name=foo */
export async function DELETE(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const { dir } = ensureUserDir(userId);
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "");
  const filePath = path.join(dir, `${safeName}.md`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  return NextResponse.json({ ok: true });
}
