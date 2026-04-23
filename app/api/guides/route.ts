import { NextRequest } from "next/server";
import { readFile, writeFile } from "fs/promises";
import path from "path";

const GUIDES_DIR = path.join(process.cwd(), "guides");

function safeName(name: string): string {
  return String(name).replace(/[^a-zA-Z0-9_-]/g, "");
}

// GET /api/guides?dsId=shadcn
export async function GET(req: NextRequest) {
  const dsId = safeName(req.nextUrl.searchParams.get("dsId") || "");
  if (!dsId) {
    return Response.json({ error: "Missing dsId" }, { status: 400 });
  }

  const filePath = path.join(GUIDES_DIR, `${dsId}.md`);
  try {
    const content = await readFile(filePath, "utf-8");
    return Response.json({ dsId, content });
  } catch {
    return Response.json({ dsId, content: "" });
  }
}

// POST /api/guides  { dsId, content }
export async function POST(req: NextRequest) {
  const { dsId, content } = await req.json();
  const safe = safeName(dsId || "");
  if (!safe) {
    return Response.json({ error: "Missing dsId" }, { status: 400 });
  }

  const filePath = path.join(GUIDES_DIR, `${safe}.md`);
  await writeFile(filePath, content || "", "utf-8");
  return Response.json({ ok: true, dsId: safe });
}
