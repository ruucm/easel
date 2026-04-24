import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const SAVES_DIR = path.join(process.cwd(), "saves");
const LIVE_FILE = path.join(SAVES_DIR, "_live.json");

function ensureDir() {
  if (!fs.existsSync(SAVES_DIR)) fs.mkdirSync(SAVES_DIR, { recursive: true });
}

function readLive(): { dsId: string | null; nodes: unknown[]; savedAt: string | null } {
  if (!fs.existsSync(LIVE_FILE)) {
    return { dsId: null, nodes: [], savedAt: null };
  }
  const raw = JSON.parse(fs.readFileSync(LIVE_FILE, "utf-8"));
  return {
    dsId: typeof raw.dsId === "string" ? raw.dsId : null,
    nodes: Array.isArray(raw.nodes) ? raw.nodes : [],
    savedAt: typeof raw.savedAt === "string" ? raw.savedAt : null,
  };
}

function writeLiveAtomic(data: { dsId: string | null; nodes: unknown[] }) {
  const payload = {
    name: "_live",
    dsId: data.dsId,
    nodes: data.nodes,
    savedAt: new Date().toISOString(),
  };
  const tmp = LIVE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2));
  fs.renameSync(tmp, LIVE_FILE);
  return payload;
}

function getUpdatedAt(): string | null {
  try {
    return fs.statSync(LIVE_FILE).mtime.toISOString();
  } catch {
    return null;
  }
}

/** GET /api/scene — read the live scene */
export async function GET() {
  ensureDir();
  try {
    const scene = readLive();
    return NextResponse.json({
      dsId: scene.dsId,
      nodes: scene.nodes,
      updatedAt: getUpdatedAt(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to read scene: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}

/** PUT /api/scene — replace the live scene. Body: { dsId?, nodes } */
export async function PUT(req: NextRequest) {
  ensureDir();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { dsId, nodes } = (body ?? {}) as { dsId?: unknown; nodes?: unknown };
  if (!Array.isArray(nodes)) {
    return NextResponse.json(
      { error: "`nodes` must be an array" },
      { status: 400 }
    );
  }

  const saved = writeLiveAtomic({
    dsId: typeof dsId === "string" ? dsId : null,
    nodes,
  });

  return NextResponse.json({
    ok: true,
    dsId: saved.dsId,
    nodes: saved.nodes,
    updatedAt: getUpdatedAt(),
  });
}

/** DELETE /api/scene — clear the live scene (keeps empty file for watchers) */
export async function DELETE() {
  ensureDir();
  writeLiveAtomic({ dsId: null, nodes: [] });
  return NextResponse.json({ ok: true, updatedAt: getUpdatedAt() });
}
