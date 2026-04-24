import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const OUT_DIR = path.join(process.cwd(), "test-exports");

function ensureDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 403 });
  }
  const { name, dataUrl } = (await req.json()) as { name?: string; dataUrl?: string };
  if (!name || !dataUrl) {
    return NextResponse.json({ error: "missing name or dataUrl" }, { status: 400 });
  }

  const match = /^data:(image\/(?:png|jpeg|svg\+xml));base64,(.*)$/.exec(dataUrl);
  if (!match) return NextResponse.json({ error: "bad dataUrl" }, { status: 400 });

  const mime = match[1];
  const b64 = match[2];
  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/svg+xml" ? "svg" : "png";
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(OUT_DIR, `${safe}.${ext}`);

  ensureDir();
  fs.writeFileSync(filePath, Buffer.from(b64, "base64"));
  return NextResponse.json({ ok: true, path: filePath, size: Buffer.byteLength(b64, "base64") });
}
