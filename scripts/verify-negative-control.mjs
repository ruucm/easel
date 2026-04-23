#!/usr/bin/env node
// Negative control: run the SAME payloads through the OLD (broken) reducer
// to confirm they actually reproduce the original crash. If this script
// shows failures and verify-style-fix.mjs shows none, the fix is validated.

function oldNormalizeNodes(nodes) {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((n) => ({
    ...n,
    children: oldNormalizeNodes(n.children),
    // NOTE: no style guarantee — this is the bug
  }));
}

function findAndUpdate(nodes, id, updater) {
  return nodes.map((node) => {
    if (node.id === id) return updater(node);
    return { ...node, children: findAndUpdate(node.children ?? [], id, updater) };
  });
}

function addNodeToParent(nodes, node, parentId) {
  if (!parentId) return [...nodes, node];
  return nodes.map((n) => {
    if (n.id === parentId) return { ...n, children: [...n.children, node] };
    return { ...n, children: addNodeToParent(n.children, node, parentId) };
  });
}

function oldReducer(state, action) {
  switch (action.type) {
    case "ADD_NODE": {
      const safeNode = oldNormalizeNodes([action.node])[0];
      return { ...state, nodes: addNodeToParent(state.nodes, safeNode, action.parentId), selectedId: safeNode.id };
    }
    case "UPDATE_NODE":
      return {
        ...state,
        nodes: findAndUpdate(state.nodes, action.id, (n) => ({
          ...n,
          ...action.node,
          id: n.id,
          children: action.node.children ?? n.children, // old: no normalization
          style: { ...n.style, ...(action.node.style || {}) },
        })),
      };
    case "LOAD_STATE":
      return { ...state, nodes: oldNormalizeNodes(action.nodes), selectedId: null };
    default:
      return state;
  }
}

// Matches CanvasRenderer.tsx:107 *before* the defensive fallback
function simulateRender(node) {
  const hasChildren = (node.children ?? []).length > 0;
  if (hasChildren || node.type === "Frame") {
    void { ...node.style, width: node.style.width ?? "auto" };
  } else {
    const { position, left, top, width, height, ...rest } = node.style;
    void { position, left, top, width, height, rest };
  }
  for (const child of node.children ?? []) simulateRender(child);
}
function simulateRenderAll(nodes) { for (const n of nodes) simulateRender(n); }

const payload = {
  id: "root", type: "Frame", name: "r",
  style: { position: "absolute", left: 0, top: 0 },
  children: [{ id: "btn", type: "HtmlButton", name: "btn", componentProps: { label: "X" } }],
};

let crashed = 0;
const runs = [
  { name: "UPDATE_NODE", run: () => oldReducer({ nodes: oldNormalizeNodes([{ id: "root", type: "Frame", name: "r", style: {}, children: [] }]), selectedId: "root" }, { type: "UPDATE_NODE", id: "root", node: payload }) },
  { name: "ADD_NODE",    run: () => oldReducer({ nodes: [], selectedId: null }, { type: "ADD_NODE", node: payload }) },
  { name: "LOAD_STATE",  run: () => oldReducer({ nodes: [], selectedId: null }, { type: "LOAD_STATE", nodes: [payload] }) },
];

for (const { name, run } of runs) {
  try {
    simulateRenderAll(run().nodes);
    console.log(`  \x1b[33m?\x1b[0m ${name}: did NOT crash (unexpected)`);
  } catch (err) {
    crashed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}: reproduced crash — "${err.message}"`);
  }
}

console.log(`\n${crashed}/3 paths reproduce the original error under the old reducer.`);
if (crashed === 3) {
  console.log("\x1b[32mNegative control confirms: the harness catches the exact bug.\x1b[0m");
  process.exit(0);
}
process.exit(1);
