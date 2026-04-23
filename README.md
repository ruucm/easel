# Easel

> **Drop your design system on Easel.**
> A canvas for **real React components** — not mocks, not Figma approximations. Prop up any design system, drag components around, edit props, generate layouts with AI, and export the result as a runnable Vite + React project.

![Easel — HTML](docs/screenshots/html.png)

The same canvas, switched to **shadcn/ui** and **MUI**:

| shadcn/ui | Material UI |
|---|---|
| ![shadcn/ui](docs/screenshots/shadcn.png) | ![Material UI](docs/screenshots/mui.png) |

## Why an easel?

A painter's easel doesn't paint for you — it just holds the surface steady so you can work. Easel does the same for a design system: it's the surface you place your components on and work against. The components are real (your production `<Button>`, not a sketch of one), so what you see is what ships.

- **It's your actual design system.** No Figma component library to keep in sync, no screenshot drift. The same npm package your app imports is the one rendering on the canvas.
- **Easy to swap.** Share a `.dspack` file with a teammate and they're working on the same easel in seconds — including private-registry packages.
- **AI that knows your tokens.** The prompt carries your DS's component schema + style guide, so generated designs use *your* Button intents, *your* spacing, *your* colors.

## Features

- **Live component canvas** — drag, resize, zoom, pan, layers, inspector — the basics you expect
- **Swap design systems with one click** — every node re-renders through the new adapter
- **AI generate & edit** — natural-language prompts create new layouts or modify the selected node, constrained by a per-DS style guide
- **`.dspack` sharing** — export the current DS as a single `.zip` file; teammates import with one click (handles npm install, private registries, global CSS, the lot). See [`docs/sharing-design-system.md`](docs/sharing-design-system.md).
- **Pluggable adapter API** — add a new design system in a single file. See [`docs/adding-design-system.md`](docs/adding-design-system.md).
- **Save / load** designs to local JSON
- **Export** any node (or the whole canvas) as a downloadable Vite + React project

## Bundled design systems

| ID | Name | Notes |
|---|---|---|
| `html` | Generic HTML | Native elements with inline styles, zero deps |
| `shadcn` | shadcn/ui | Local components in `components/ui/`, Tailwind-based |
| `mui` | Material UI | `@mui/material` v7 |

Keep these, swap them, or bring your own via a `.dspack`.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. Use the dropdown in the left sidebar to switch design systems, prompt the AI from the bottom bar, save, and export.

## AI edit (optional)

The AI features call the Anthropic API. The server route auto-detects credentials in this order:

1. `ANTHROPIC_API_KEY` env var
2. macOS Keychain (`Claude Code-credentials`) — for users of [Claude Code](https://github.com/anthropics/claude-code)
3. `~/.claude/.credentials.json`

Without any of those, the canvas still works — only the AI prompt bar is disabled.

To override the model, set `CLAUDE_MODEL` (or `CLAUDE_CODE_MODEL` / `ANTHROPIC_MODEL` / `ANTHROPIC_DEFAULT_MODEL`). Defaults to `claude-sonnet-4-20250514`. See `.env.example`.

## Sharing a design system

Team-internal DSes? Private npm packages? Both work:

1. Pick the DS in the dropdown, click **Export** — a `{id}.dspack.zip` downloads.
2. Share the file (Slack, Drive, email — whatever).
3. Teammates click **Import pack**, pick the zip, and Easel handles `npm install`, `.npmrc`, global CSS, and AI schema wiring automatically.

Full format reference: [`docs/sharing-design-system.md`](docs/sharing-design-system.md).

## Adding a design system from scratch

The adapter pattern is documented in [`docs/adding-design-system.md`](docs/adding-design-system.md). Short version:

1. Create `app/design-systems/yourds.tsx` exporting a `DesignSystemAdapter`
2. Add `import "./yourds";` to `app/design-systems/init.ts`
3. (Optional) Drop a `guides/yourds.md` style guide for the AI to follow

Each adapter declares:
- `renderComponent(node)` — how to render each component type
- `catalog` — items shown in the left Assets panel
- `aiSchema` — describes available types and props to the AI
- `exportConfig` — import statements + `package.json` deps for the Vite export

## Project layout

```
app/
├── api/                # AI edit, saves, designs, guides, ds-pack routes
├── components/         # Canvas UI: Sidebar, Renderer, Properties, BottomBar
├── design-systems/     # Adapters: html, shadcn, mui (+ registry, context)
│   └── imported/       # .dspack-installed adapters land here
├── store/              # Canvas state reducer & context
├── utils/exportProject.ts  # Vite project zip generator
├── globals.css
├── layout.tsx
└── page.tsx
components/ui/          # shadcn primitives used by the shadcn adapter
guides/                 # AI usage guides per design system
docs/                   # Developer docs + screenshots
```

## Tech stack

- Next.js 16 (App Router) + React 19
- Tailwind CSS v4
- shadcn/ui primitives, MUI v7
- Anthropic SDK via fetch (streaming) for AI edits
- JSZip for project export + `.dspack` share format

## License

MIT
