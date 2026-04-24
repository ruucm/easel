/**
 * End-to-end tests that exercise the real Next.js API + filesystem file watch.
 * These are gated behind `npm run test:e2e` (not the default `npm test`)
 * because they spawn a dev server and take ~15–30s to run.
 *
 * If `EASEL_URL` is already set and reachable, we reuse that server instead
 * of spawning a new one.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createServer } from "../src/server.js";

// test file lives at <PROJECT>/mcp/test/e2e.test.ts — go up two levels.
const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);
const LIVE_FILE = path.join(PROJECT_ROOT, "saves", "_live.json");
const BACKUP_FILE = LIVE_FILE + ".e2e-backup";

let child: ChildProcess | null = null;
let baseUrl: string = process.env.EASEL_URL ?? "http://localhost:3000";

// ─── Helpers ────────────────────────────────────────────────────────────

async function isReady(url: string): Promise<boolean> {
  try {
    const r = await fetch(`${url}/api/design-systems`, {
      signal: AbortSignal.timeout(2000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function waitForReady(url: string, timeoutMs = 45_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isReady(url)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} never became ready within ${timeoutMs}ms`);
}

async function connectClient() {
  const server = createServer({ projectRoot: PROJECT_ROOT, baseUrl });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  const client = new Client({ name: "e2e", version: "0.0.1" });
  await client.connect(ct);
  return client;
}

function textOf(res: unknown): string {
  const r = res as { content?: Array<{ text?: string }> };
  return r.content?.[0]?.text ?? "";
}

function jsonOf<T>(res: unknown): T {
  return JSON.parse(textOf(res)) as T;
}

// ─── Lifecycle ─────────────────────────────────────────────────────────

before(async () => {
  // Back up live scene so tests don't stomp on real work.
  if (fs.existsSync(LIVE_FILE)) {
    fs.copyFileSync(LIVE_FILE, BACKUP_FILE);
  }

  if (await isReady(baseUrl)) {
    process.stderr.write(`[e2e] reusing server at ${baseUrl}\n`);
    return;
  }

  process.stderr.write(`[e2e] spawning next dev...\n`);
  child = spawn("npm", ["run", "dev"], {
    cwd: PROJECT_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: "3456", NODE_ENV: "development" },
    detached: false,
  });
  baseUrl = "http://127.0.0.1:3456";
  child.stdout?.on("data", (b) => process.stderr.write(`[next] ${b.toString()}`));
  child.stderr?.on("data", (b) => process.stderr.write(`[next] ${b.toString()}`));
  await waitForReady(baseUrl, 60_000);
}, { timeout: 70_000 });

after(async () => {
  // Restore backup if we made one.
  try {
    if (fs.existsSync(BACKUP_FILE)) {
      fs.copyFileSync(BACKUP_FILE, LIVE_FILE);
      fs.unlinkSync(BACKUP_FILE);
    } else if (fs.existsSync(LIVE_FILE)) {
      // There was no backup => we created the live file during tests. Remove it.
      fs.unlinkSync(LIVE_FILE);
    }
  } catch {}

  if (child && !child.killed) {
    child.kill("SIGTERM");
    // Give it a moment, then force-kill if needed.
    await new Promise((r) => setTimeout(r, 500));
    if (!child.killed) child.kill("SIGKILL");
  }
});

// ─── Tests ─────────────────────────────────────────────────────────────

test("status reports dev server running", async () => {
  const client = await connectClient();
  const res = await client.callTool({ name: "status", arguments: {} });
  const body = jsonOf<{ devServer: { ok: boolean; model?: string } }>(res);
  assert.equal(body.devServer.ok, true);
  await client.close();
});

test("list_design_systems returns built-ins", async () => {
  const client = await connectClient();
  const res = await client.callTool({
    name: "list_design_systems",
    arguments: {},
  });
  const body = jsonOf<{ systems: Array<{ id: string; source: string }> }>(res);
  const ids = body.systems.map((s) => s.id);
  assert.ok(ids.includes("html"), `html in ${ids.join(",")}`);
  assert.ok(ids.includes("shadcn"), `shadcn in ${ids.join(",")}`);
  assert.ok(ids.includes("mui"), `mui in ${ids.join(",")}`);
  await client.close();
});

test("design_system_schema returns schema text", async () => {
  const client = await connectClient();
  const res = await client.callTool({
    name: "design_system_schema",
    arguments: { dsId: "html" },
  });
  const body = jsonOf<{ dsId: string; schema: string }>(res);
  assert.equal(body.dsId, "html");
  assert.ok(body.schema.includes("HtmlButton"));
  await client.close();
});

test("scene_set_design_system validates dsId via HTTP", async () => {
  const client = await connectClient();
  const good = await client.callTool({
    name: "scene_set_design_system",
    arguments: { dsId: "shadcn" },
  });
  const gb = jsonOf<{ ok: boolean; dsId: string }>(good);
  assert.equal(gb.ok, true);
  assert.equal(gb.dsId, "shadcn");

  const bad = await client.callTool({
    name: "scene_set_design_system",
    arguments: { dsId: "not-a-real-ds" },
  });
  const br = bad as { isError?: boolean };
  assert.equal(br.isError, true);
  await client.close();
});

test("node_add writes to disk and /api/scene reflects it", async () => {
  const client = await connectClient();
  await client.callTool({ name: "scene_clear", arguments: { resetDs: true } });
  const addRes = await client.callTool({
    name: "node_add",
    arguments: {
      id: "e2e-btn",
      type: "HtmlButton",
      name: "E2E CTA",
      componentProps: { label: "Ship it", variant: "primary" },
    },
  });
  const body = jsonOf<{ ok: boolean; node: { id: string } }>(addRes);
  assert.equal(body.ok, true);
  assert.equal(body.node.id, "e2e-btn");

  const r = await fetch(`${baseUrl}/api/scene`);
  const data = (await r.json()) as {
    nodes: Array<{ id: string; type: string }>;
  };
  const match = data.nodes.find((n) => n.id === "e2e-btn");
  assert.ok(match, "expected /api/scene to contain the new node");
  assert.equal(match?.type, "HtmlButton");
  await client.close();
});

test("/api/scene/watch fires when the live file changes", async () => {
  const client = await connectClient();
  await client.callTool({ name: "scene_clear", arguments: {} });

  // Open SSE connection and wait for a change event.
  const ac = new AbortController();
  const gotChange = new Promise<{ type: string; updatedAt: string }>(
    (resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("SSE change event not received in 10s")),
        10_000
      );
      fetch(`${baseUrl}/api/scene/watch`, { signal: ac.signal })
        .then(async (r) => {
          if (!r.body) throw new Error("no body");
          const reader = r.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let idx: number;
            while ((idx = buffer.indexOf("\n\n")) >= 0) {
              const frame = buffer.slice(0, idx);
              buffer = buffer.slice(idx + 2);
              if (!frame.startsWith("data: ")) continue;
              try {
                const evt = JSON.parse(frame.slice(6));
                if (evt.type === "change") {
                  clearTimeout(timer);
                  resolve(evt);
                  ac.abort();
                  return;
                }
              } catch {}
            }
          }
        })
        .catch(reject);
    }
  );

  // Give the SSE a moment to establish, then mutate.
  await new Promise((r) => setTimeout(r, 300));
  await client.callTool({
    name: "node_add",
    arguments: { id: "watch-probe", type: "Frame" },
  });

  const evt = await gotChange;
  assert.equal(evt.type, "change");
  assert.ok(typeof evt.updatedAt === "string");
  await client.close();
});
