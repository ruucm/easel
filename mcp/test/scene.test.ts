import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  SceneStore,
  addToParent,
  applyNodePatch,
  findNode,
  findNodePath,
  flatNodeList,
  mapNodes,
  normalizeNodes,
  removeNode,
  type CanvasNode,
} from "../src/scene.js";

function tmpProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "easel-mcp-scene-"));
  fs.mkdirSync(path.join(dir, "saves"), { recursive: true });
  return dir;
}

function n(id: string, type = "Frame", children: CanvasNode[] = []): CanvasNode {
  return { id, type, name: id, style: {}, children };
}

test("SceneStore returns empty scene when file missing", () => {
  const root = tmpProject();
  const store = new SceneStore(root);
  const scene = store.read();
  assert.equal(scene.dsId, null);
  assert.deepEqual(scene.nodes, []);
  assert.equal(scene.savedAt, null);
});

test("SceneStore round-trips a scene via atomic write", () => {
  const root = tmpProject();
  const store = new SceneStore(root);
  store.write({ dsId: "html", nodes: [n("a"), n("b")] });

  const raw = JSON.parse(fs.readFileSync(store.file, "utf-8"));
  assert.equal(raw.name, "_live");
  assert.equal(raw.dsId, "html");
  assert.equal(raw.nodes.length, 2);
  assert.ok(typeof raw.savedAt === "string");

  const scene = store.read();
  assert.equal(scene.dsId, "html");
  assert.equal(scene.nodes.length, 2);
  assert.equal(scene.nodes[0].id, "a");
});

test("SceneStore mutate applies a reducer and persists", () => {
  const root = tmpProject();
  const store = new SceneStore(root);
  store.write({ dsId: "html", nodes: [n("a")] });
  store.mutate((s) => ({
    dsId: s.dsId,
    nodes: [...s.nodes, n("b")],
  }));
  const scene = store.read();
  assert.deepEqual(
    scene.nodes.map((x) => x.id),
    ["a", "b"]
  );
});

test("normalizeNodes defaults style and children", () => {
  const cleaned = normalizeNodes([
    { id: "a", type: "Frame", name: "A" } as unknown,
    { id: "b", type: "Text", text: "hi" } as unknown,
  ]);
  assert.deepEqual(cleaned[0].style, {});
  assert.deepEqual(cleaned[0].children, []);
  assert.equal(cleaned[1].text, "hi");
});

test("addToParent appends to root when parentId is missing", () => {
  const tree = [n("a"), n("b")];
  const next = addToParent(tree, n("c"));
  assert.deepEqual(next.map((x) => x.id), ["a", "b", "c"]);
});

test("addToParent inserts at a specific index under a parent", () => {
  const tree = [n("root", "Frame", [n("c1"), n("c2")])];
  const next = addToParent(tree, n("mid"), "root", 1);
  assert.deepEqual(next[0].children.map((x) => x.id), ["c1", "mid", "c2"]);
});

test("removeNode deletes deeply and preserves siblings", () => {
  const tree = [n("root", "Frame", [n("c1"), n("c2", "Frame", [n("gc")])])];
  const next = removeNode(tree, "gc");
  assert.deepEqual(findNode(next, "gc"), null);
  assert.ok(findNode(next, "c1"));
});

test("mapNodes updates a specific node", () => {
  const tree = [n("a"), n("b", "Frame", [n("c")])];
  const next = mapNodes(tree, "c", (x) => ({ ...x, name: "renamed" }));
  assert.equal(findNode(next, "c")?.name, "renamed");
  assert.equal(findNode(next, "a")?.name, "a");
});

test("applyNodePatch shallow-merges style and componentProps", () => {
  const node: CanvasNode = {
    id: "a",
    type: "HtmlButton",
    name: "A",
    style: { left: 10, top: 10, color: "red" },
    children: [],
    componentProps: { label: "Go", variant: "primary" },
  };
  const patched = applyNodePatch(node, {
    style: { left: 50 },
    componentProps: { variant: "danger" },
  });
  assert.deepEqual(patched.style, { left: 50, top: 10, color: "red" });
  assert.deepEqual(patched.componentProps, { label: "Go", variant: "danger" });
});

test("flatNodeList produces depth + parentId info", () => {
  const tree = [n("root", "Frame", [n("a"), n("b", "Frame", [n("c")])])];
  const flat = flatNodeList(tree);
  assert.deepEqual(
    flat.map((x) => `${x.id}@${x.depth}<-${x.parentId ?? ""}`),
    ["root@0<-", "a@1<-root", "b@1<-root", "c@2<-b"]
  );
});

test("findNodePath returns the ancestor chain", () => {
  const tree = [n("r", "Frame", [n("a", "Frame", [n("b")])])];
  assert.deepEqual(findNodePath(tree, "b"), ["r", "a", "b"]);
  assert.equal(findNodePath(tree, "missing"), null);
});
