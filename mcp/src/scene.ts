import fs from "node:fs";
import path from "node:path";

export interface CanvasNode {
  id: string;
  type: string;
  dsId?: string;
  name: string;
  style: Record<string, unknown>;
  children: CanvasNode[];
  text?: string;
  componentProps?: Record<string, unknown>;
}

export interface Scene {
  dsId: string | null;
  nodes: CanvasNode[];
  savedAt: string | null;
}

export class SceneStore {
  readonly root: string;
  readonly file: string;

  constructor(projectRoot: string) {
    this.root = projectRoot;
    this.file = path.join(projectRoot, "saves", "_live.json");
  }

  exists(): boolean {
    return fs.existsSync(this.file);
  }

  read(): Scene {
    if (!fs.existsSync(this.file)) {
      return { dsId: null, nodes: [], savedAt: null };
    }
    const raw = JSON.parse(fs.readFileSync(this.file, "utf-8"));
    return {
      dsId: typeof raw.dsId === "string" ? raw.dsId : null,
      nodes: Array.isArray(raw.nodes) ? normalizeNodes(raw.nodes) : [],
      savedAt: typeof raw.savedAt === "string" ? raw.savedAt : null,
    };
  }

  write(scene: { dsId: string | null; nodes: CanvasNode[] }): Scene {
    const dir = path.dirname(this.file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const payload = {
      name: "_live",
      dsId: scene.dsId,
      nodes: scene.nodes,
      savedAt: new Date().toISOString(),
    };
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2));
    fs.renameSync(tmp, this.file);
    return payload;
  }

  mutate(fn: (scene: Scene) => { dsId: string | null; nodes: CanvasNode[] }): Scene {
    const current = this.read();
    const next = fn(current);
    return this.write(next);
  }
}

// ──────────────────────────────────────────────────────────────────────
// Tree mutation helpers. All operate on an immutable nodes[] and return
// a new tree. Mirrors app/store/context.tsx so the canvas sees the same
// semantics regardless of whether edits come from the UI or the MCP.
// ──────────────────────────────────────────────────────────────────────

export function normalizeNodes(nodes: unknown): CanvasNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((n) => {
    const node = n as Partial<CanvasNode> & Record<string, unknown>;
    return {
      id: String(node.id ?? ""),
      type: String(node.type ?? ""),
      name: String(node.name ?? node.type ?? ""),
      dsId: typeof node.dsId === "string" ? node.dsId : undefined,
      style:
        node.style && typeof node.style === "object"
          ? (node.style as Record<string, unknown>)
          : {},
      children: normalizeNodes(node.children),
      ...(node.text !== undefined ? { text: String(node.text) } : {}),
      ...(node.componentProps && typeof node.componentProps === "object"
        ? { componentProps: node.componentProps as Record<string, unknown> }
        : {}),
    };
  });
}

export function findNode(nodes: CanvasNode[], id: string): CanvasNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

export function findNodePath(
  nodes: CanvasNode[],
  id: string,
  trail: string[] = []
): string[] | null {
  for (const n of nodes) {
    const here = [...trail, n.id];
    if (n.id === id) return here;
    const found = findNodePath(n.children, id, here);
    if (found) return found;
  }
  return null;
}

export function mapNodes(
  nodes: CanvasNode[],
  id: string,
  updater: (n: CanvasNode) => CanvasNode
): CanvasNode[] {
  return nodes.map((n) => {
    if (n.id === id) return updater(n);
    return { ...n, children: mapNodes(n.children, id, updater) };
  });
}

export function removeNode(nodes: CanvasNode[], id: string): CanvasNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => ({ ...n, children: removeNode(n.children, id) }));
}

export function addToParent(
  nodes: CanvasNode[],
  node: CanvasNode,
  parentId?: string | null,
  index?: number
): CanvasNode[] {
  if (!parentId) {
    if (typeof index === "number") {
      const next = [...nodes];
      next.splice(Math.max(0, Math.min(index, next.length)), 0, node);
      return next;
    }
    return [...nodes, node];
  }
  return nodes.map((n) => {
    if (n.id === parentId) {
      const children = [...n.children];
      const at =
        typeof index === "number"
          ? Math.max(0, Math.min(index, children.length))
          : children.length;
      children.splice(at, 0, node);
      return { ...n, children };
    }
    return { ...n, children: addToParent(n.children, node, parentId, index) };
  });
}

export function flatNodeList(nodes: CanvasNode[]): Array<{
  id: string;
  type: string;
  name: string;
  depth: number;
  parentId: string | null;
}> {
  const out: Array<{
    id: string;
    type: string;
    name: string;
    depth: number;
    parentId: string | null;
  }> = [];
  const walk = (arr: CanvasNode[], depth: number, parentId: string | null) => {
    for (const n of arr) {
      out.push({ id: n.id, type: n.type, name: n.name, depth, parentId });
      walk(n.children, depth + 1, n.id);
    }
  };
  walk(nodes, 0, null);
  return out;
}

/** Deep-merge of style and componentProps; replaces other fields. */
export function applyNodePatch(
  node: CanvasNode,
  patch: {
    name?: string;
    type?: string;
    text?: string;
    style?: Record<string, unknown>;
    componentProps?: Record<string, unknown>;
  }
): CanvasNode {
  const next: CanvasNode = {
    ...node,
    name: patch.name ?? node.name,
    type: patch.type ?? node.type,
  };
  if (patch.text !== undefined) next.text = patch.text;
  if (patch.style) next.style = { ...node.style, ...patch.style };
  if (patch.componentProps) {
    next.componentProps = { ...(node.componentProps ?? {}), ...patch.componentProps };
  }
  return next;
}
