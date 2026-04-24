import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createServer } from "../src/server.js";

// ─── Helpers ────────────────────────────────────────────────────────────

function tmpProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "easel-mcp-srv-"));
  fs.mkdirSync(path.join(dir, "saves"), { recursive: true });
  return dir;
}

async function connectClient(projectRoot: string, baseUrl = "http://127.0.0.1:65535") {
  const server = createServer({ projectRoot, baseUrl });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await server.connect(serverT);
  const client = new Client({ name: "easel-mcp-test", version: "0.0.1" });
  await client.connect(clientT);
  return { client, server };
}

function textContent(result: unknown): string {
  const r = result as { content?: Array<{ type: string; text?: string }> };
  const first = r.content?.[0];
  if (!first || first.type !== "text" || typeof first.text !== "string") {
    throw new Error("Expected text content");
  }
  return first.text;
}

function jsonContent<T>(result: unknown): T {
  return JSON.parse(textContent(result)) as T;
}

function readLive(projectRoot: string): { dsId: string | null; nodes: unknown[] } {
  const file = path.join(projectRoot, "saves", "_live.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
  return { dsId: raw.dsId ?? null, nodes: raw.nodes ?? [] };
}

// ─── Tests ─────────────────────────────────────────────────────────────

test("tools/list returns every registered tool", async () => {
  const root = tmpProject();
  const { client } = await connectClient(root);
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  assert.ok(names.includes("status"));
  assert.ok(names.includes("scene_get"));
  assert.ok(names.includes("node_add"));
  assert.ok(names.includes("node_update"));
  assert.ok(names.includes("ai_generate"));
  assert.equal(names.length, 22);
  await client.close();
});

test("status reports project + dev-server down", async () => {
  const root = tmpProject();
  const { client } = await connectClient(root);
  const res = await client.callTool({ name: "status", arguments: {} });
  const data = jsonContent<{
    projectRoot: string;
    sceneExists: boolean;
    devServer: { ok: boolean };
    rootNodeCount: number;
  }>(res);
  assert.equal(data.projectRoot, root);
  assert.equal(data.devServer.ok, false);
  assert.equal(data.rootNodeCount, 0);
  await client.close();
});

test("scene_get on empty project returns {dsId:null, nodes:[]}", async () => {
  const root = tmpProject();
  const { client } = await connectClient(root);
  const res = await client.callTool({ name: "scene_get", arguments: {} });
  const scene = jsonContent<{ dsId: string | null; nodes: unknown[] }>(res);
  assert.equal(scene.dsId, null);
  assert.deepEqual(scene.nodes, []);
  await client.close();
});

test("node_add writes a new node to _live.json", async () => {
  const root = tmpProject();
  const { client } = await connectClient(root);
  const res = await client.callTool({
    name: "node_add",
    arguments: {
      type: "HtmlButton",
      name: "Primary CTA",
      componentProps: { label: "Go", variant: "primary" },
    },
  });
  const body = jsonContent<{ ok: boolean; node: { id: string; style: any } }>(res);
  assert.equal(body.ok, true);
  assert.equal(body.node.style.position, "absolute");
  assert.equal(body.node.style.left, 80);

  const live = readLive(root);
  assert.equal(live.nodes.length, 1);
  const only = live.nodes[0] as { id: string; type: string };
  assert.equal(only.id, body.node.id);
  assert.equal(only.type, "HtmlButton");
  await client.close();
});

test("node_add with explicit id and parent inserts under parent", async () => {
  const root = tmpProject();
  const { client } = await connectClient(root);

  const parent = await client.callTool({
    name: "node_add",
    arguments: {
      type: "Frame",
      id: "frame-1",
      name: "Hero",
      style: { display: "flex", padding: 16 },
    },
  });
  assert.equal(jsonContent<{ node: { id: string } }>(parent).node.id, "frame-1");

  const child = await client.callTool({
    name: "node_add",
    arguments: {
      type: "Text",
      id: "txt-1",
      parentId: "frame-1",
      text: "Hello",
    },
  });
  assert.equal(jsonContent<{ node: { id: string } }>(child).node.id, "txt-1");

  const live = readLive(root);
  const frame = live.nodes[0] as { id: string; children: Array<{ id: string }> };
  assert.equal(frame.id, "frame-1");
  assert.equal(frame.children.length, 1);
  assert.equal(frame.children[0].id, "txt-1");
  await client.close();
});

test("node_update merges style and componentProps; replaces name", async () => {
  const root = tmpProject();
  const { client } = await connectClient(root);
  await client.callTool({
    name: "node_add",
    arguments: {
      id: "btn",
      type: "HtmlButton",
      name: "CTA",
      style: { left: 10, top: 10, color: "red" },
      componentProps: { label: "Go", variant: "primary" },
    },
  });
  await client.callTool({
    name: "node_update",
    arguments: {
      id: "btn",
      name: "Danger CTA",
      style: { left: 50 },
      componentProps: { variant: "danger" },
    },
  });

  const live = readLive(root);
  const node = live.nodes[0] as any;
  assert.equal(node.name, "Danger CTA");
  assert.deepEqual(node.style, { left: 50, top: 10, color: "red", position: "absolute" });
  assert.deepEqual(node.componentProps, { label: "Go", variant: "danger" });
  await client.close();
});

test("node_move sets absolute position", async () => {
  const root = tmpProject();
  const { client } = await connectClient(root);
  await client.callTool({
    name: "node_add",
    arguments: { id: "x", type: "Frame" },
  });
  await client.callTool({
    name: "node_move",
    arguments: { id: "x", left: 300, top: 200 },
  });
  const live = readLive(root);
  const node = live.nodes[0] as any;
  assert.equal(node.style.left, 300);
  assert.equal(node.style.top, 200);
  await client.close();
});

test("node_resize sets width/height", async () => {
  const root = tmpProject();
  const { client } = await connectClient(root);
  await client.callTool({
    name: "node_add",
    arguments: { id: "x", type: "Frame" },
  });
  await client.callTool({
    name: "node_resize",
    arguments: { id: "x", width: 400, height: 300 },
  });
  const node = readLive(root).nodes[0] as any;
  assert.equal(node.style.width, 400);
  assert.equal(node.style.height, 300);
  await client.close();
});

test("node_delete removes the node", async () => {
  const root = tmpProject();
  const { client } = await connectClient(root);
  await client.callTool({ name: "node_add", arguments: { id: "a", type: "Frame" } });
  await client.callTool({ name: "node_add", arguments: { id: "b", type: "Frame" } });
  await client.callTool({ name: "node_delete", arguments: { id: "a" } });
  const live = readLive(root);
  assert.equal(live.nodes.length, 1);
  assert.equal((live.nodes[0] as any).id, "b");
  await client.close();
});

test("node_reorder moves a node under a new parent at an index", async () => {
  const root = tmpProject();
  const { client } = await connectClient(root);
  await client.callTool({ name: "node_add", arguments: { id: "r1", type: "Frame" } });
  await client.callTool({ name: "node_add", arguments: { id: "r2", type: "Frame" } });
  await client.callTool({
    name: "node_add",
    arguments: { id: "c1", type: "Text", parentId: "r1" },
  });

  await client.callTool({
    name: "node_reorder",
    arguments: { id: "c1", parentId: "r2", index: 0 },
  });
  const live = readLive(root);
  const r1 = live.nodes.find((x: any) => x.id === "r1") as any;
  const r2 = live.nodes.find((x: any) => x.id === "r2") as any;
  assert.equal(r1.children.length, 0);
  assert.equal(r2.children.length, 1);
  assert.equal(r2.children[0].id, "c1");
  await client.close();
});

test("node_duplicate deep-copies with fresh ids", async () => {
  const root = tmpProject();
  const { client } = await connectClient(root);
  await client.callTool({
    name: "node_add",
    arguments: { id: "root-a", type: "Frame" },
  });
  await client.callTool({
    name: "node_add",
    arguments: { id: "child-a", type: "Text", parentId: "root-a", text: "hi" },
  });

  const dup = await client.callTool({
    name: "node_duplicate",
    arguments: { id: "root-a", offset: { left: 50, top: 0 } },
  });
  const body = jsonContent<{ node: { id: string; children: Array<{ id: string }> } }>(dup);
  assert.notEqual(body.node.id, "root-a");
  assert.notEqual(body.node.children[0].id, "child-a");

  const live = readLive(root);
  assert.equal(live.nodes.length, 2);
  await client.close();
});

test("node_get returns the node subtree", async () => {
  const root = tmpProject();
  const { client } = await connectClient(root);
  await client.callTool({
    name: "node_add",
    arguments: { id: "g", type: "Frame", name: "Group" },
  });
  const res = await client.callTool({ name: "node_get", arguments: { id: "g" } });
  const node = jsonContent<{ id: string; name: string }>(res);
  assert.equal(node.id, "g");
  assert.equal(node.name, "Group");
  await client.close();
});

test("node_list returns a flat tree overview", async () => {
  const root = tmpProject();
  const { client } = await connectClient(root);
  await client.callTool({ name: "node_add", arguments: { id: "a", type: "Frame" } });
  await client.callTool({
    name: "node_add",
    arguments: { id: "b", type: "Text", parentId: "a" },
  });
  const res = await client.callTool({ name: "node_list", arguments: {} });
  const body = jsonContent<{
    nodes: Array<{ id: string; depth: number; parentId: string | null }>;
  }>(res);
  assert.deepEqual(
    body.nodes.map((n) => `${n.id}@${n.depth}`),
    ["a@0", "b@1"]
  );
  await client.close();
});

test("scene_clear empties the tree but can preserve dsId", async () => {
  const root = tmpProject();
  const { client } = await connectClient(root);
  await client.callTool({ name: "node_add", arguments: { id: "z", type: "Frame" } });
  // seed a dsId
  fs.writeFileSync(
    path.join(root, "saves", "_live.json"),
    JSON.stringify({
      name: "_live",
      dsId: "shadcn",
      nodes: [{ id: "z", type: "Frame", name: "Z", style: {}, children: [] }],
      savedAt: new Date().toISOString(),
    })
  );
  await client.callTool({ name: "scene_clear", arguments: {} });
  const live = readLive(root);
  assert.equal(live.dsId, "shadcn");
  assert.deepEqual(live.nodes, []);

  await client.callTool({ name: "scene_clear", arguments: { resetDs: true } });
  const live2 = readLive(root);
  assert.equal(live2.dsId, null);
  await client.close();
});

test("save_scene + load_scene round-trip a named save", async () => {
  const root = tmpProject();
  const { client } = await connectClient(root);
  await client.callTool({
    name: "node_add",
    arguments: { id: "hero", type: "Frame", name: "Hero" },
  });
  const saved = await client.callTool({
    name: "save_scene",
    arguments: { name: "my-design" },
  });
  const body = jsonContent<{ ok: boolean; path: string }>(saved);
  assert.ok(body.ok);
  assert.ok(fs.existsSync(path.join(root, "saves", "my-design.json")));

  // wipe live, then reload from save
  await client.callTool({ name: "scene_clear", arguments: {} });
  await client.callTool({ name: "load_scene", arguments: { name: "my-design" } });
  const live = readLive(root);
  assert.equal(live.nodes.length, 1);
  assert.equal((live.nodes[0] as any).id, "hero");
  await client.close();
});

test("save_scene rejects invalid and reserved names", async () => {
  const root = tmpProject();
  const { client } = await connectClient(root);
  const bad = await client.callTool({
    name: "save_scene",
    arguments: { name: "has spaces" },
  });
  const br = bad as { isError?: boolean };
  assert.equal(br.isError, true);

  const reserved = await client.callTool({
    name: "save_scene",
    arguments: { name: "_live" },
  });
  const rr = reserved as { isError?: boolean };
  assert.equal(rr.isError, true);
  await client.close();
});

test("list_saves excludes the _live buffer", async () => {
  const root = tmpProject();
  const savesDir = path.join(root, "saves");
  fs.writeFileSync(
    path.join(savesDir, "_live.json"),
    JSON.stringify({ name: "_live", nodes: [], savedAt: "x" })
  );
  fs.writeFileSync(
    path.join(savesDir, "my-thing.json"),
    JSON.stringify({ name: "my-thing", nodes: [], savedAt: "x" })
  );
  const { client } = await connectClient(root);
  const res = await client.callTool({ name: "list_saves", arguments: {} });
  const body = jsonContent<{ saves: Array<{ name: string }> }>(res);
  assert.deepEqual(body.saves.map((s) => s.name), ["my-thing"]);
  await client.close();
});

test("node_update on missing id returns isError", async () => {
  const root = tmpProject();
  const { client } = await connectClient(root);
  const res = await client.callTool({
    name: "node_update",
    arguments: { id: "nope", name: "x" },
  });
  const r = res as { isError?: boolean };
  assert.equal(r.isError, true);
  await client.close();
});

test("dev-server-gated tools surface a clear error when server is down", async () => {
  const root = tmpProject();
  const { client } = await connectClient(root);
  const res = await client.callTool({ name: "list_design_systems", arguments: {} });
  const r = res as { isError?: boolean; content?: Array<{ text?: string }> };
  assert.equal(r.isError, true);
  const msg = r.content?.[0]?.text ?? "";
  assert.ok(/dev server/i.test(msg), `message mentions dev server: ${msg}`);
  await client.close();
});
