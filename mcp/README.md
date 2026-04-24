# easel-mcp

An MCP server that lets Claude Code (or any MCP client) drive the Easel
canvas — create, edit, arrange, and AI-generate design-system components
while you watch them appear live in the browser.

## How it works

```
┌────────────────────┐        stdio        ┌────────────────────┐
│   Claude Code /    │ ←─────────────────→ │    easel-mcp       │
│   MCP client       │                     │  (Node process)    │
└────────────────────┘                     └─────────┬──────────┘
                                                     │
                            saves/_live.json  ───────┤── direct FS
                                   ▲                 │
                                   │                 ├── HTTP for AI,
                                   │                 │   schemas, guides
                      ┌────────────┴─────────┐       │
                      │  Easel (Next.js)     │ ←─────┘  http://localhost:3000
                      │  LiveSync component  │
                      │  subscribes to       │
                      │  /api/scene/watch    │
                      └──────────────────────┘
```

1. The MCP server reads/writes `saves/_live.json` — this is the "live scene"
   source of truth that both MCP and the browser canvas share.
2. When Easel is running, the `<LiveSync>` component in `app/page.tsx`:
   - Mirrors every local canvas edit into `_live.json` (debounced 400 ms).
   - Subscribes to `/api/scene/watch` SSE and reloads the canvas whenever
     something (e.g. the MCP) changes `_live.json`.
3. Operations that need model inference or dsId validation (`ai_generate`,
   `list_design_systems`, etc.) call Easel's HTTP API, which reuses the same
   Anthropic credentials Easel already manages (env → Keychain → file).

**Keep Easel open while using the MCP.** Anything written while the browser
is closed will be overwritten by the current session on next load. For
persistence across sessions, use `save_scene` to write a named file.

## Installation (for Claude Code)

```bash
cd mcp
npm install
```

Register the server with Claude Code (run from anywhere):

```bash
claude mcp add easel -- npx tsx /absolute/path/to/easel/mcp/src/index.ts
```

Or edit `~/.claude/settings.json` directly:

```jsonc
{
  "mcpServers": {
    "easel": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/easel/mcp/src/index.ts"],
      "env": {
        "EASEL_DIR": "/absolute/path/to/easel",
        "EASEL_URL": "http://localhost:3000"
      }
    }
  }
}
```

`EASEL_DIR` and `EASEL_URL` are both optional. The server auto-detects the
project root by walking up for a `package.json` with `"name": "easel"`.

Restart Claude Code, and `/mcp` should show `easel` as connected.

## Environment variables

| Var         | Default                  | Purpose                                |
| ----------- | ------------------------ | -------------------------------------- |
| `EASEL_DIR` | auto-detected            | Project root (where `saves/` lives)    |
| `EASEL_URL` | `http://localhost:3000`  | Easel dev server (for AI + schema ops) |

## Tools

### Inspection
- **`status`** — project + dev-server + scene overview.
- **`scene_get`** — full current scene (dsId + node tree).
- **`node_list`** — flat list of every node with depth + parentId.
- **`node_get { id }`** — single node and its descendants.

### Scene
- **`scene_clear { resetDs? }`** — remove all nodes; keep dsId unless `resetDs: true`.
- **`scene_set_design_system { dsId }`** — switch design system (html / shadcn / mui / imported). Validates against the registered schemas.

### Node mutation
- **`node_add { type, parentId?, index?, style?, componentProps?, text?, name?, id? }`** — create a node. If no parent, it's positioned absolutely at (80, 80) by default.
- **`node_update { id, name?, type?, text?, style?, componentProps? }`** — patch. `style` / `componentProps` are shallow-merged.
- **`node_delete { id }`** — remove node + descendants.
- **`node_move { id, left?, top? }`** — absolute position.
- **`node_resize { id, width?, height? }`**.
- **`node_reorder { id, parentId?, index? }`** — move in tree.
- **`node_duplicate { id, parentId?, offset? }`** — deep clone with fresh ids.

### Saves
- **`save_scene { name }`** — persist live → `saves/<name>.json`.
- **`load_scene { name }`** — copy `saves/<name>.json` → live.
- **`list_saves`** — list all saves (excludes the `_live` buffer).

### Design-system catalog (requires dev server)
- **`list_design_systems`** — id + source + hasGuide.
- **`design_system_schema { dsId }`** — AI-facing component schema text.
- **`get_guide { dsId }`** / **`set_guide { dsId, content }`** — per-DS style guide markdown.

### AI (requires dev server + Anthropic token)
- **`ai_generate { prompt, dsId?, parentId?, position? }`** — generate a new subtree from natural language.
- **`ai_edit_node { id, prompt, dsId? }`** — modify an existing node via the AI.

## Example prompts (for Claude Code)

```
"Switch to shadcn/ui and generate a pricing page with three tiers."
"Add a red Delete button to the right of the primary CTA."
"Move the hero frame down by 40px and make it 960px wide."
"Take the selected card and turn it into a sign-in form."
"Save the current design as 'landing-v2'."
```

## Running tests

```bash
cd mcp
npm install           # once
npm test              # unit + server (no dev server needed)
npm run test:e2e      # spawns next dev on port 3456
```

The e2e test backs up and restores `saves/_live.json`, so it's safe to run
while you have Easel open.

## File layout

```
mcp/
├── src/
│   ├── index.ts      # stdio entry
│   ├── server.ts     # McpServer + tool registrations
│   ├── scene.ts      # SceneStore + tree mutation helpers
│   ├── http.ts       # HTTP client for /api/* routes
│   ├── ids.ts        # id generation + uniqueness
│   └── project.ts    # root + baseUrl resolution
└── test/
    ├── scene.test.ts   # 11 tree-mutation tests
    ├── server.test.ts  # 19 in-process MCP client tests
    └── e2e.test.ts     # 6 tests against a real next dev server
```

## Troubleshooting

- **"dev server down"** when calling AI/catalog tools: start Easel with
  `npm run dev`.
- **Changes don't appear in the canvas**: check the `<LiveSync>` component
  is mounted (it's in `app/page.tsx`) and the tab is focused — `fs.watch`
  events only propagate while the SSE connection is open.
- **`save_scene` rejects your name**: save names must match `[a-zA-Z0-9_-]+`
  and can't start with `_` (reserved for internal buffers).
- **MCP and Easel fighting over `_live.json`**: echo suppression uses
  content hashing, so rapid back-and-forth is safe. If you see a loop,
  check that `LiveSync` is mounted exactly once.
