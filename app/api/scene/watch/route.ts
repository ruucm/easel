import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

const SAVES_DIR = path.join(process.cwd(), "saves");
const LIVE_FILE = path.join(SAVES_DIR, "_live.json");

export const dynamic = "force-dynamic";

function ensureLive() {
  if (!fs.existsSync(SAVES_DIR)) fs.mkdirSync(SAVES_DIR, { recursive: true });
  if (!fs.existsSync(LIVE_FILE)) {
    const payload = {
      name: "_live",
      dsId: null,
      nodes: [],
      savedAt: new Date().toISOString(),
    };
    fs.writeFileSync(LIVE_FILE, JSON.stringify(payload, null, 2));
  }
}

function getUpdatedAt(): string | null {
  try {
    return fs.statSync(LIVE_FILE).mtime.toISOString();
  } catch {
    return null;
  }
}

/**
 * GET /api/scene/watch — SSE endpoint that fires a "change" event whenever
 * saves/_live.json is modified. Used by the LiveSync component and any
 * external client that wants to react to MCP-driven edits in real time.
 */
export async function GET(req: NextRequest) {
  ensureLive();
  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let debounce: NodeJS.Timeout | null = null;
      let lastSeen: string | null = getUpdatedAt();

      const send = (payload: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {}
      };

      // Initial hello with current mtime so clients can decide whether to refetch.
      send({ type: "hello", updatedAt: lastSeen });

      const emitChange = () => {
        if (closed) return;
        const mtime = getUpdatedAt();
        if (!mtime || mtime === lastSeen) return;
        lastSeen = mtime;
        send({ type: "change", updatedAt: mtime });
      };

      const watcher = fs.watch(SAVES_DIR, (_eventType, filename) => {
        if (filename !== "_live.json") return;
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(emitChange, 30);
      });

      // Polling fallback: fs.watch can miss events on some filesystems.
      const poll = setInterval(() => {
        if (closed) return;
        const mtime = getUpdatedAt();
        if (mtime && mtime !== lastSeen) emitChange();
      }, 1000);

      // Keep connection alive through proxies.
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {}
      }, 25_000);

      cleanup = () => {
        if (closed) return;
        closed = true;
        if (debounce) clearTimeout(debounce);
        clearInterval(poll);
        clearInterval(heartbeat);
        try {
          watcher.close();
        } catch {}
        try {
          controller.close();
        } catch {}
      };

      // Abort on client disconnect.
      req.signal.addEventListener("abort", () => cleanup?.());
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
