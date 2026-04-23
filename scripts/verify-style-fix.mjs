#!/usr/bin/env node
// Verification harness for the "Cannot destructure property 'position' of 'node.style'" fix.
//
// Replicates the reducer's `normalizeNodes` + relevant cases from `canvasReducer`,
// plus the CanvasRenderer destructuring that originally crashed. Runs many
// AI-shaped payloads through the whole flow and fails loudly if any one
// throws a TypeError.

// ────────────────────────────────────────────────────────────────────────────
// Logic copied from app/store/context.tsx (kept in sync by hand)
// ────────────────────────────────────────────────────────────────────────────

function normalizeNodes(nodes) {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((n) => ({
    ...n,
    style: n && typeof n.style === "object" && n.style !== null ? n.style : {},
    children: normalizeNodes(n.children),
  }));
}

function findAndUpdate(nodes, id, updater) {
  return nodes.map((node) => {
    if (node.id === id) return updater(node);
    return { ...node, children: findAndUpdate(node.children, id, updater) };
  });
}

function addNodeToParent(nodes, node, parentId) {
  if (!parentId) return [...nodes, node];
  return nodes.map((n) => {
    if (n.id === parentId) return { ...n, children: [...n.children, node] };
    return { ...n, children: addNodeToParent(n.children, node, parentId) };
  });
}

function reducer(state, action) {
  switch (action.type) {
    case "ADD_NODE": {
      const safeNode = normalizeNodes([action.node])[0];
      return {
        ...state,
        nodes: addNodeToParent(state.nodes, safeNode, action.parentId),
        selectedId: safeNode.id,
      };
    }
    case "UPDATE_NODE":
      return {
        ...state,
        nodes: findAndUpdate(state.nodes, action.id, (n) => ({
          ...n,
          ...action.node,
          id: n.id,
          children: action.node.children ? normalizeNodes(action.node.children) : n.children,
          style: { ...n.style, ...(action.node.style || {}) },
        })),
      };
    case "LOAD_STATE":
      return { ...state, nodes: normalizeNodes(action.nodes), selectedId: null };
    default:
      return state;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Renderer's crashing destructure — exactly what caused the original error.
// Walk the full tree and exercise every path that touches node.style.
// ────────────────────────────────────────────────────────────────────────────

function simulateRender(node) {
  const hasChildren = (node.children ?? []).length > 0;
  if (hasChildren || node.type === "Frame") {
    void {
      ...node.style,
      width: node.style.width ?? "auto",
      height: node.style.height ?? "auto",
    };
  } else {
    // THE line that used to crash (CanvasRenderer.tsx:107)
    const { position, left, top, width, height, ...rest } = node.style;
    void { position, left, top, width, height, rest };
  }
  for (const child of node.children ?? []) simulateRender(child);
}

function simulateRenderAll(nodes) {
  for (const n of nodes) simulateRender(n);
}

// ────────────────────────────────────────────────────────────────────────────
// Test helpers
// ────────────────────────────────────────────────────────────────────────────

let pass = 0, fail = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    fail++;
    failures.push({ name, err });
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    ${err.message}`);
  }
}

const baseState = {
  nodes: [
    { id: "root", type: "Frame", name: "root", style: { position: "absolute", left: 0, top: 0, width: 400 }, children: [] },
  ],
  selectedId: null,
};

// ────────────────────────────────────────────────────────────────────────────
// Problematic AI payloads — each case is a realistic "bad" AI response
// ────────────────────────────────────────────────────────────────────────────

const aiPayloads = {
  // Case 1: AI returns root with style but nested child missing style entirely
  "nested child missing style": {
    id: "root",
    type: "Frame",
    name: "Card",
    style: { position: "absolute", left: 100, top: 100, width: 300 },
    children: [
      { id: "c1", type: "HtmlButton", name: "btn", componentProps: { label: "Go" } },
    ],
  },

  // Case 2: Deeply nested — only leaves are missing style
  "deeply nested leaves missing style": {
    id: "root",
    type: "Frame",
    name: "Hero",
    style: { position: "absolute", left: 0, top: 0, width: 800 },
    children: [
      {
        id: "row",
        type: "Frame",
        name: "row",
        style: { display: "flex", gap: 12 },
        children: [
          { id: "btn1", type: "HtmlButton", name: "a" },
          { id: "btn2", type: "HtmlButton", name: "b" },
        ],
      },
    ],
  },

  // Case 3: style is explicitly null (LLMs sometimes emit "style": null)
  "style: null on child": {
    id: "root",
    type: "Frame",
    name: "r",
    style: { position: "absolute", left: 0, top: 0 },
    children: [{ id: "c", type: "Text", name: "t", text: "hi", style: null }],
  },

  // Case 4: style is an empty string (malformed streaming output)
  "style: '' on child": {
    id: "root",
    type: "Frame",
    name: "r",
    style: { position: "absolute", left: 0, top: 0 },
    children: [{ id: "c", type: "Text", name: "t", text: "hi", style: "" }],
  },

  // Case 5: root itself has no style (edit mode returning partial update)
  "root missing style": {
    id: "root",
    type: "Frame",
    name: "r",
    children: [{ id: "c", type: "Text", name: "t", text: "hi", style: {} }],
  },

  // Case 6: children key missing (regression check — normalizeNodes must still work)
  "no children field": {
    id: "root",
    type: "Frame",
    name: "r",
    style: { position: "absolute", left: 0, top: 0 },
  },

  // Case 7: grandchildren missing style
  "grandchildren missing style": {
    id: "root",
    type: "Frame",
    name: "r",
    style: { position: "absolute", left: 0, top: 0 },
    children: [
      {
        id: "mid",
        type: "Frame",
        name: "m",
        style: { display: "flex" },
        children: [
          { id: "gc1", type: "HtmlButton", name: "gc1" },
          { id: "gc2", type: "HtmlInput", name: "gc2" },
        ],
      },
    ],
  },

  // Case 8: mixed — some siblings have style, others don't
  "mixed siblings": {
    id: "root",
    type: "Frame",
    name: "r",
    style: { position: "absolute", left: 0, top: 0 },
    children: [
      { id: "c1", type: "Text", name: "a", text: "a", style: { color: "red" } },
      { id: "c2", type: "Text", name: "b", text: "b" },
      { id: "c3", type: "Text", name: "c", text: "c", style: {} },
    ],
  },

  // Case 9: Text node without style
  "Text without style": {
    id: "root",
    type: "Frame",
    name: "r",
    style: { position: "absolute", left: 0, top: 0 },
    children: [{ id: "t", type: "Text", name: "t", text: "hello" }],
  },

  // Case 10: DS component without style (the exact path that fails at line 107)
  "DS component without style, no children": {
    id: "root",
    type: "Frame",
    name: "r",
    style: { position: "absolute", left: 0, top: 0 },
    children: [
      { id: "btn", type: "HtmlButton", name: "btn", componentProps: { label: "X" } },
    ],
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Run tests
// ────────────────────────────────────────────────────────────────────────────

console.log("\n\x1b[1mUPDATE_NODE (AI edit mode):\x1b[0m");
for (const [name, payload] of Object.entries(aiPayloads)) {
  test(name, () => {
    // Seed state with the target node
    const seed = {
      nodes: normalizeNodes([{ id: "root", type: "Frame", name: "root", style: {}, children: [] }]),
      selectedId: "root",
    };
    const next = reducer(seed, { type: "UPDATE_NODE", id: "root", node: payload });
    simulateRenderAll(next.nodes);
  });
}

console.log("\n\x1b[1mADD_NODE (AI create mode):\x1b[0m");
for (const [name, payload] of Object.entries(aiPayloads)) {
  test(name, () => {
    const seed = { nodes: [], selectedId: null };
    const next = reducer(seed, { type: "ADD_NODE", node: payload });
    simulateRenderAll(next.nodes);
  });
}

console.log("\n\x1b[1mLOAD_STATE (saved file):\x1b[0m");
for (const [name, payload] of Object.entries(aiPayloads)) {
  test(name, () => {
    const seed = { nodes: [], selectedId: null };
    const next = reducer(seed, { type: "LOAD_STATE", nodes: [payload] });
    simulateRenderAll(next.nodes);
  });
}

// Fuzz — 500 randomly generated trees
console.log("\n\x1b[1mFuzz (500 random trees):\x1b[0m");
function rand(n) { return Math.floor(Math.random() * n); }
function randomNode(depth = 0) {
  const id = `n-${Math.random().toString(36).slice(2, 8)}`;
  const includeStyle = Math.random() > 0.4; // 60% have style
  const styleValue = Math.random() > 0.9 ? null : Math.random() > 0.9 ? "" : { left: rand(500), top: rand(500) };
  const types = ["Frame", "Text", "HtmlButton", "HtmlInput", "HtmlBadge"];
  const n = {
    id,
    type: types[rand(types.length)],
    name: id,
  };
  if (includeStyle) n.style = styleValue;
  if (Math.random() > 0.5) n.text = "txt";
  if (depth < 3 && Math.random() > 0.4) {
    const kidCount = rand(4);
    n.children = Array.from({ length: kidCount }, () => randomNode(depth + 1));
  } else if (Math.random() > 0.5) {
    n.children = [];
  }
  return n;
}

let fuzzPass = 0, fuzzFail = 0;
for (let i = 0; i < 500; i++) {
  try {
    const tree = Array.from({ length: 1 + rand(3) }, () => randomNode());
    const seed = { nodes: [], selectedId: null };
    let state = reducer(seed, { type: "LOAD_STATE", nodes: tree });
    // Then also run an UPDATE_NODE against the first root
    if (state.nodes[0]) {
      state = reducer(state, { type: "UPDATE_NODE", id: state.nodes[0].id, node: randomNode() });
    }
    simulateRenderAll(state.nodes);
    fuzzPass++;
  } catch (err) {
    fuzzFail++;
    if (fuzzFail <= 3) console.log(`  \x1b[31m✗\x1b[0m fuzz case ${i}: ${err.message}`);
  }
}
console.log(`  ${fuzzPass === 500 ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${fuzzPass}/500 fuzz cases passed`);

// ────────────────────────────────────────────────────────────────────────────
// Summary
// ────────────────────────────────────────────────────────────────────────────

console.log(`\n\x1b[1mResults:\x1b[0m ${pass} passed, ${fail} failed + fuzz ${fuzzPass}/500`);
if (fail > 0 || fuzzFail > 0) {
  console.log("\n\x1b[31mFAILED\x1b[0m");
  process.exit(1);
}
console.log("\x1b[32mAll tests passed\x1b[0m");
