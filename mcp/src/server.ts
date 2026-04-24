import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

import {
  SceneStore,
  addToParent,
  applyNodePatch,
  findNode,
  flatNodeList,
  mapNodes,
  normalizeNodes,
  removeNode,
  type CanvasNode,
} from "./scene.js";
import { HttpClient } from "./http.js";
import { collectIds, uniqueId } from "./ids.js";

export interface ServerDeps {
  projectRoot: string;
  baseUrl: string;
}

type ToolText = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

const ok = (payload: unknown): ToolText => ({
  content: [
    { type: "text" as const, text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2) },
  ],
});

const fail = (msg: string): ToolText => ({
  content: [{ type: "text" as const, text: msg }],
  isError: true,
});

export function createServer(deps: ServerDeps): McpServer {
  const scene = new SceneStore(deps.projectRoot);
  const http = new HttpClient(deps.baseUrl);

  const server = new McpServer({
    name: "easel-mcp",
    version: "0.1.0",
  });

  // ────────────────────────────────────────────────────────────────
  // Scene / environment
  // ────────────────────────────────────────────────────────────────

  server.registerTool(
    "status",
    {
      description:
        "Report MCP server state: project root, scene file path, whether the Easel dev server is running, current dsId and node count.",
      inputSchema: {},
    },
    async () => {
      const current = scene.read();
      const ping = await http.ping();
      return ok({
        projectRoot: deps.projectRoot,
        sceneFile: scene.file,
        sceneExists: scene.exists(),
        baseUrl: deps.baseUrl,
        devServer: ping,
        dsId: current.dsId,
        rootNodeCount: current.nodes.length,
        totalNodeCount: flatNodeList(current.nodes).length,
        savedAt: current.savedAt,
      });
    }
  );

  server.registerTool(
    "scene_get",
    {
      description:
        "Return the full current canvas scene (dsId, complete node tree). Use when you need the exact state; use node_list for a compact tree view.",
      inputSchema: {},
    },
    async () => ok(scene.read())
  );

  server.registerTool(
    "scene_clear",
    {
      description:
        "Remove all nodes from the live scene. Does not change the active design system unless `resetDs: true`.",
      inputSchema: {
        resetDs: z.boolean().optional(),
      },
    },
    async ({ resetDs }) => {
      const current = scene.read();
      scene.write({ dsId: resetDs ? null : current.dsId, nodes: [] });
      return ok({ ok: true, dsId: resetDs ? null : current.dsId, nodeCount: 0 });
    }
  );

  server.registerTool(
    "scene_set_design_system",
    {
      description:
        "Switch the active design system (e.g. 'html', 'shadcn', 'mui', or a `.dspack` id). Easel re-renders existing nodes through the new adapter. Validates the dsId against the registered schemas if the dev server is running.",
      inputSchema: {
        dsId: z.string().min(1),
      },
    },
    async ({ dsId }) => {
      try {
        await http.getDesignSystemSchema(dsId);
      } catch (e) {
        return fail(
          `Unknown or unavailable dsId '${dsId}'. Make sure the dev server is running and the design system is registered. ${(e as Error).message}`
        );
      }
      const current = scene.read();
      scene.write({
        dsId,
        nodes: current.nodes.map((n) => stampDsId(n, dsId)),
      });
      return ok({ ok: true, dsId });
    }
  );

  // ────────────────────────────────────────────────────────────────
  // Node listing / reading
  // ────────────────────────────────────────────────────────────────

  server.registerTool(
    "node_list",
    {
      description:
        "Return a flat list of every node in the scene with id, type, name, depth, and parentId. Good for getting an overview before making edits.",
      inputSchema: {},
    },
    async () => {
      const s = scene.read();
      return ok({ dsId: s.dsId, nodes: flatNodeList(s.nodes) });
    }
  );

  server.registerTool(
    "node_get",
    {
      description: "Return a single node and its descendants by id.",
      inputSchema: {
        id: z.string().min(1),
      },
    },
    async ({ id }) => {
      const s = scene.read();
      const node = findNode(s.nodes, id);
      if (!node) return fail(`Node not found: ${id}`);
      return ok(node);
    }
  );

  // ────────────────────────────────────────────────────────────────
  // Node mutations
  // ────────────────────────────────────────────────────────────────

  server.registerTool(
    "node_add",
    {
      description:
        "Create a new node and insert it into the tree. `type` must match the active design system's schema (e.g. 'HtmlButton', 'ShadcnCard', 'Frame', 'Text'). Returns the created node.",
      inputSchema: {
        type: z.string().min(1),
        parentId: z.string().optional(),
        index: z.number().int().nonnegative().optional(),
        name: z.string().optional(),
        text: z.string().optional(),
        style: z.record(z.string(), z.unknown()).optional(),
        componentProps: z.record(z.string(), z.unknown()).optional(),
        id: z.string().optional(),
        dsId: z.string().optional(),
      },
    },
    async (input) => {
      const s = scene.read();
      const taken = collectIds(s.nodes);
      const id = input.id && !taken.has(input.id) ? input.id : uniqueId("mcp", taken);

      const style = { ...(input.style ?? {}) } as Record<string, unknown>;
      if (!input.parentId && style.position === undefined) {
        style.position = "absolute";
        if (style.left === undefined) style.left = 80;
        if (style.top === undefined) style.top = 80;
      }

      const node: CanvasNode = {
        id,
        type: input.type,
        name: input.name ?? input.type,
        dsId: input.dsId ?? s.dsId ?? undefined,
        style,
        children: [],
        ...(input.text !== undefined ? { text: input.text } : {}),
        ...(input.componentProps ? { componentProps: input.componentProps } : {}),
      };

      if (input.parentId && !findNode(s.nodes, input.parentId)) {
        return fail(`Parent not found: ${input.parentId}`);
      }

      const next = addToParent(s.nodes, node, input.parentId ?? null, input.index);
      scene.write({ dsId: s.dsId, nodes: next });
      return ok({ ok: true, node });
    }
  );

  server.registerTool(
    "node_update",
    {
      description:
        "Patch a node's fields. Provided `style` and `componentProps` are shallow-merged onto existing values; `name`, `type`, `text` are replaced.",
      inputSchema: {
        id: z.string().min(1),
        name: z.string().optional(),
        type: z.string().optional(),
        text: z.string().optional(),
        style: z.record(z.string(), z.unknown()).optional(),
        componentProps: z.record(z.string(), z.unknown()).optional(),
      },
    },
    async ({ id, ...patch }) => {
      const s = scene.read();
      if (!findNode(s.nodes, id)) return fail(`Node not found: ${id}`);
      const next = mapNodes(s.nodes, id, (n) => applyNodePatch(n, patch));
      scene.write({ dsId: s.dsId, nodes: next });
      return ok({ ok: true, node: findNode(next, id) });
    }
  );

  server.registerTool(
    "node_delete",
    {
      description: "Remove a node (and all its children) from the scene.",
      inputSchema: { id: z.string().min(1) },
    },
    async ({ id }) => {
      const s = scene.read();
      if (!findNode(s.nodes, id)) return fail(`Node not found: ${id}`);
      const next = removeNode(s.nodes, id);
      scene.write({ dsId: s.dsId, nodes: next });
      return ok({ ok: true, id });
    }
  );

  server.registerTool(
    "node_move",
    {
      description:
        "Set absolute position of a node. Use on root-level nodes (children of a flex Frame ignore left/top).",
      inputSchema: {
        id: z.string().min(1),
        left: z.number().optional(),
        top: z.number().optional(),
      },
    },
    async ({ id, left, top }) => {
      const s = scene.read();
      if (!findNode(s.nodes, id)) return fail(`Node not found: ${id}`);
      const next = mapNodes(s.nodes, id, (n) => ({
        ...n,
        style: {
          ...n.style,
          ...(left !== undefined ? { left } : {}),
          ...(top !== undefined ? { top } : {}),
        },
      }));
      scene.write({ dsId: s.dsId, nodes: next });
      return ok({ ok: true, id, left, top });
    }
  );

  server.registerTool(
    "node_resize",
    {
      description: "Set width and/or height on a node's style.",
      inputSchema: {
        id: z.string().min(1),
        width: z.number().optional(),
        height: z.number().optional(),
      },
    },
    async ({ id, width, height }) => {
      const s = scene.read();
      if (!findNode(s.nodes, id)) return fail(`Node not found: ${id}`);
      const next = mapNodes(s.nodes, id, (n) => ({
        ...n,
        style: {
          ...n.style,
          ...(width !== undefined ? { width } : {}),
          ...(height !== undefined ? { height } : {}),
        },
      }));
      scene.write({ dsId: s.dsId, nodes: next });
      return ok({ ok: true, id, width, height });
    }
  );

  server.registerTool(
    "node_reorder",
    {
      description:
        "Move a node to a different parent and/or index within the tree. Use parentId: null (or omit) to move to the root.",
      inputSchema: {
        id: z.string().min(1),
        parentId: z.string().nullable().optional(),
        index: z.number().int().nonnegative().optional(),
      },
    },
    async ({ id, parentId, index }) => {
      const s = scene.read();
      const node = findNode(s.nodes, id);
      if (!node) return fail(`Node not found: ${id}`);
      if (parentId && !findNode(s.nodes, parentId)) {
        return fail(`Parent not found: ${parentId}`);
      }
      if (parentId === id) return fail("Cannot reparent a node to itself");
      const without = removeNode(s.nodes, id);
      const next = addToParent(without, node, parentId ?? null, index);
      scene.write({ dsId: s.dsId, nodes: next });
      return ok({ ok: true, id, parentId: parentId ?? null, index });
    }
  );

  server.registerTool(
    "node_duplicate",
    {
      description:
        "Deep-copy a node (with fresh ids for itself and every descendant) and insert the copy as a sibling or under the given parent.",
      inputSchema: {
        id: z.string().min(1),
        parentId: z.string().nullable().optional(),
        offset: z
          .object({ left: z.number().optional(), top: z.number().optional() })
          .optional(),
      },
    },
    async ({ id, parentId, offset }) => {
      const s = scene.read();
      const node = findNode(s.nodes, id);
      if (!node) return fail(`Node not found: ${id}`);
      const taken = collectIds(s.nodes);
      const copy = cloneWithNewIds(node, taken);
      if (offset && (offset.left !== undefined || offset.top !== undefined)) {
        copy.style = {
          ...copy.style,
          ...(offset.left !== undefined
            ? {
                left:
                  (typeof copy.style.left === "number" ? copy.style.left : 0) +
                  offset.left,
              }
            : {}),
          ...(offset.top !== undefined
            ? {
                top:
                  (typeof copy.style.top === "number" ? copy.style.top : 0) +
                  offset.top,
              }
            : {}),
        };
      }
      const next = addToParent(s.nodes, copy, parentId ?? null);
      scene.write({ dsId: s.dsId, nodes: next });
      return ok({ ok: true, node: copy });
    }
  );

  // ────────────────────────────────────────────────────────────────
  // Saves
  // ────────────────────────────────────────────────────────────────

  server.registerTool(
    "save_scene",
    {
      description:
        "Persist the current live scene to a named save (saves/<name>.json). Matches the format produced by the Save manager in the UI.",
      inputSchema: {
        name: z
          .string()
          .min(1)
          .regex(
            /^[a-zA-Z0-9_-]+$/,
            "Save names may only contain letters, digits, dashes, underscores"
          ),
      },
    },
    async ({ name }) => {
      if (name.startsWith("_")) {
        return fail("Save names starting with '_' are reserved.");
      }
      const s = scene.read();
      const savesDir = path.join(deps.projectRoot, "saves");
      if (!fs.existsSync(savesDir)) fs.mkdirSync(savesDir, { recursive: true });
      const filePath = path.join(savesDir, `${name}.json`);
      const payload = {
        name,
        nodes: s.nodes,
        savedAt: new Date().toISOString(),
      };
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
      return ok({ ok: true, name, path: filePath, nodeCount: s.nodes.length });
    }
  );

  server.registerTool(
    "load_scene",
    {
      description:
        "Load a saved design (saves/<name>.json) into the live scene. Overwrites the current scene.",
      inputSchema: {
        name: z.string().min(1),
      },
    },
    async ({ name }) => {
      const safe = name.replace(/[^a-zA-Z0-9_-]/g, "");
      const filePath = path.join(deps.projectRoot, "saves", `${safe}.json`);
      if (!fs.existsSync(filePath)) return fail(`Save not found: ${safe}`);
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const nodes = normalizeNodes(raw.nodes);
        const current = scene.read();
        const dsId = typeof raw.dsId === "string" ? raw.dsId : current.dsId;
        scene.write({ dsId, nodes });
        return ok({ ok: true, name: safe, dsId, nodeCount: nodes.length });
      } catch (e) {
        return fail(`Failed to load save '${safe}': ${(e as Error).message}`);
      }
    }
  );

  server.registerTool(
    "list_saves",
    {
      description: "List all saved designs in saves/ (excluding the _live buffer).",
      inputSchema: {},
    },
    async () => {
      const savesDir = path.join(deps.projectRoot, "saves");
      if (!fs.existsSync(savesDir)) return ok({ saves: [] });
      const files = fs
        .readdirSync(savesDir)
        .filter((f) => f.endsWith(".json") && !f.startsWith("_"));
      const saves = files.map((f) => {
        const stat = fs.statSync(path.join(savesDir, f));
        return {
          name: f.replace(/\.json$/, ""),
          updatedAt: stat.mtime.toISOString(),
          size: stat.size,
        };
      });
      saves.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      return ok({ saves });
    }
  );

  // ────────────────────────────────────────────────────────────────
  // Catalog / design-system info (requires dev server for schemas)
  // ────────────────────────────────────────────────────────────────

  server.registerTool(
    "list_design_systems",
    {
      description:
        "List every registered design system (built-in + imported .dspack) with id, source, and whether it has a usage guide. Requires the Easel dev server running.",
      inputSchema: {},
    },
    async () => {
      try {
        const systems = await http.listDesignSystems();
        return ok({ systems });
      } catch (e) {
        return fail(
          `Failed to list design systems. Is the Easel dev server running at ${deps.baseUrl}? ${(e as Error).message}`
        );
      }
    }
  );

  server.registerTool(
    "design_system_schema",
    {
      description:
        "Return the AI-facing schema for a design system — describes available component types and their componentProps shapes. Use before calling node_add or ai_generate to know which types are valid.",
      inputSchema: {
        dsId: z.string().min(1),
      },
    },
    async ({ dsId }) => {
      try {
        const result = await http.getDesignSystemSchema(dsId);
        return ok(result);
      } catch (e) {
        return fail(
          `Failed to fetch schema for '${dsId}': ${(e as Error).message}`
        );
      }
    }
  );

  server.registerTool(
    "get_guide",
    {
      description:
        "Fetch the AI style guide for a design system (free-form markdown that the AI is told to follow).",
      inputSchema: { dsId: z.string().min(1) },
    },
    async ({ dsId }) => {
      try {
        const content = await http.getGuide(dsId);
        return ok({ dsId, content: content ?? "" });
      } catch (e) {
        return fail(
          `Failed to fetch guide for '${dsId}': ${(e as Error).message}`
        );
      }
    }
  );

  server.registerTool(
    "set_guide",
    {
      description:
        "Write the AI style guide for a design system. Overwrites existing content.",
      inputSchema: {
        dsId: z.string().min(1),
        content: z.string(),
      },
    },
    async ({ dsId, content }) => {
      try {
        await http.setGuide(dsId, content);
        return ok({ ok: true, dsId, bytes: content.length });
      } catch (e) {
        return fail(
          `Failed to set guide for '${dsId}': ${(e as Error).message}`
        );
      }
    }
  );

  // ────────────────────────────────────────────────────────────────
  // AI generation / editing
  // ────────────────────────────────────────────────────────────────

  server.registerTool(
    "ai_generate",
    {
      description:
        "Use the Easel AI to generate a new sub-tree from a natural-language prompt. The generated root Frame is inserted at the given position (defaults to 120,120). The AI is constrained by the active design system's schema and guide. Requires the Easel dev server running and an Anthropic token configured.",
      inputSchema: {
        prompt: z.string().min(1),
        dsId: z.string().optional(),
        parentId: z.string().optional(),
        position: z
          .object({ left: z.number().optional(), top: z.number().optional() })
          .optional(),
      },
    },
    async ({ prompt, dsId, parentId, position }) => {
      const s = scene.read();
      const effectiveDs = dsId ?? s.dsId ?? "html";

      let guide: string | null = null;
      try {
        guide = await http.getGuide(effectiveDs);
      } catch {}

      let result: Awaited<ReturnType<HttpClient["aiEdit"]>>;
      try {
        result = await http.aiEdit({
          mode: "create",
          prompt,
          dsId: effectiveDs,
          designGuide: guide || undefined,
        });
      } catch (e) {
        return fail(`AI generate failed: ${(e as Error).message}`);
      }

      if (!result.json || typeof result.json !== "object") {
        return fail(`AI did not return a node. Raw: ${result.raw.slice(0, 200)}`);
      }

      const generated = normalizeNodes([result.json])[0];
      if (!generated || !generated.type) {
        return fail("AI returned invalid node JSON (missing type)");
      }

      // Re-id so we don't collide with anything already on the canvas.
      const taken = collectIds(s.nodes);
      const reIded = cloneWithNewIds(generated, taken, "ai");

      // Position the root at the requested location when adding at root.
      if (!parentId) {
        reIded.style = {
          ...reIded.style,
          position: "absolute",
          left: position?.left ?? 120,
          top: position?.top ?? 120,
        };
      }
      if (effectiveDs) reIded.dsId = effectiveDs;

      if (parentId && !findNode(s.nodes, parentId)) {
        return fail(`Parent not found: ${parentId}`);
      }

      const next = addToParent(s.nodes, reIded, parentId ?? null);
      scene.write({ dsId: s.dsId ?? effectiveDs, nodes: next });
      return ok({
        ok: true,
        explanation: result.explanation,
        rootId: reIded.id,
        type: reIded.type,
        name: reIded.name,
        childCount: reIded.children.length,
      });
    }
  );

  server.registerTool(
    "ai_edit_node",
    {
      description:
        "Use the Easel AI to modify an existing node. The AI sees the node's current JSON plus the prompt, and is expected to return an updated node. The update is merged in place (style shallow-merged, componentProps shallow-merged, children replaced if returned).",
      inputSchema: {
        id: z.string().min(1),
        prompt: z.string().min(1),
        dsId: z.string().optional(),
      },
    },
    async ({ id, prompt, dsId }) => {
      const s = scene.read();
      const node = findNode(s.nodes, id);
      if (!node) return fail(`Node not found: ${id}`);
      const effectiveDs = dsId ?? node.dsId ?? s.dsId ?? "html";

      let guide: string | null = null;
      try {
        guide = await http.getGuide(effectiveDs);
      } catch {}

      let result: Awaited<ReturnType<HttpClient["aiEdit"]>>;
      try {
        result = await http.aiEdit({
          mode: "edit",
          prompt,
          node,
          dsId: effectiveDs,
          designGuide: guide || undefined,
        });
      } catch (e) {
        return fail(`AI edit failed: ${(e as Error).message}`);
      }

      if (!result.json || typeof result.json !== "object") {
        return fail(`AI did not return JSON. Raw: ${result.raw.slice(0, 200)}`);
      }

      const updated = result.json as Partial<CanvasNode>;
      const next = mapNodes(s.nodes, id, (original) => ({
        ...original,
        name: updated.name ?? original.name,
        type: updated.type ?? original.type,
        ...(updated.text !== undefined ? { text: updated.text } : {}),
        style: { ...original.style, ...(updated.style ?? {}) },
        componentProps: updated.componentProps
          ? { ...(original.componentProps ?? {}), ...updated.componentProps }
          : original.componentProps,
        children: updated.children
          ? normalizeNodes(updated.children)
          : original.children,
      }));
      scene.write({ dsId: s.dsId, nodes: next });
      return ok({
        ok: true,
        explanation: result.explanation,
        id,
        node: findNode(next, id),
      });
    }
  );

  return server;
}

// ────────────────────────────────────────────────────────────────
// Helpers that are too small to live in scene.ts
// ────────────────────────────────────────────────────────────────

function stampDsId(node: CanvasNode, dsId: string): CanvasNode {
  return {
    ...node,
    dsId,
    children: node.children.map((c) => stampDsId(c, dsId)),
  };
}

function cloneWithNewIds(
  node: CanvasNode,
  taken: Set<string>,
  prefix = "mcp"
): CanvasNode {
  const newId = uniqueId(prefix, taken);
  return {
    ...node,
    id: newId,
    style: { ...node.style },
    componentProps: node.componentProps ? { ...node.componentProps } : undefined,
    children: node.children.map((c) => cloneWithNewIds(c, taken, prefix)),
  };
}
