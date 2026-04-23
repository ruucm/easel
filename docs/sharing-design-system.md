# Sharing design systems (`.dspack`)

Design systems can be **exported as a single `.dspack.zip` file** and installed by teammates with one click — no manual file editing, no dev-server wrangling.

## For teammates installing a pack

1. Open Design System Canvas (`npm run dev`).
2. In the **left sidebar**, click **Import pack**.
3. Pick the `.dspack.zip` a teammate shared (Slack, Drive, email — whatever).
4. A dialog shows progress: uploading → installing packages → done.
5. Click **Reload & use** — the new DS appears in the picker.

If the pack adds new npm packages, `npm install` runs automatically (30–90s).

## For the person creating a pack

You have two options.

### Option A — Export an existing DS
If the DS already exists in this project (built-in or previously imported), just:

1. Pick it in the left-sidebar dropdown.
2. Click **Export** — a `.dspack.zip` downloads.
3. Share the zip.

Export auto-detects the npm packages the adapter imports and includes them in `manifest.json`.

### Option B — Author a pack from scratch
A `.dspack.zip` is any zip with this layout:

```
manifest.json      ← required
adapter.tsx        ← required (the DesignSystemAdapter source)
guide.md           ← optional (AI guide content)
README.md          ← optional
```

**`manifest.json`** shape:

```jsonc
{
  "id": "ourteam-ds",              // lowercase, a-z/0-9/-; used as filename
  "name": "Our Team DS",           // shown in the picker
  "version": "1.0.0",
  "description": "Internal design system",
  "author": "Design Team",
  "entry": "adapter.tsx",          // optional, defaults to "adapter.tsx"
  "guide": "guide.md",             // optional, defaults to "guide.md"
  "dependencies": {                // npm packages installed on import
    "@chakra-ui/react": "^2.8.0"
  }
}
```

**`adapter.tsx`** is the same file format documented in [`adding-design-system.md`](./adding-design-system.md) — copy the template, fill in `renderComponent`, `catalog`, `aiSchema`, `exportConfig`, and `registerDesignSystem(adapter)` at the bottom.

Import paths work automatically whether you write them as:

- `from "./types"` / `from "../store/types"` — the classic form from the adapter docs, OR
- `from "@/app/design-systems/types"` — absolute aliases

The importer adjusts relative paths at install time.

**`guide.md`** is plain markdown — style rules the AI reads when generating designs with this DS. See `guides/shadcn.md` for an example.

## What happens on import

1. `manifest.json` is validated (`id` must be lowercase slug).
2. `adapter.tsx` → `app/design-systems/imported/{id}.tsx` (relative imports are rewritten for the new folder depth).
3. `guide.md` → `guides/{id}.md`.
4. `dependencies` are merged into the root `package.json`.
5. `import "./imported/{id}";` appended to `app/design-systems/init.ts`.
6. `npm install` runs if any dependency was added or changed.
7. The UI reloads so Next.js picks up the new import.

## Uninstalling

With an imported DS selected, a trash-can button appears next to **Export**. Clicking it:

- Deletes `app/design-systems/imported/{id}.tsx` and `guides/{id}.md`.
- Removes the `import` line from `init.ts`.
- Leaves the npm packages in `package.json` (another DS may depend on them — remove manually if unused).

Built-in design systems (`html`, `shadcn`, `mui`) cannot be uninstalled.

## Limitations

- **Local component imports** (e.g. shadcn's `@/components/ui/button`) aren't bundled into the pack. If your adapter imports from `@/components/ui/*`, the receiving project needs those files too. Prefer npm packages or inline the component code inside `adapter.tsx`.
- **Trust**: the pack installs arbitrary TypeScript — only import packs from people you trust.
- **One pack per `id`**: importing the same `id` twice overwrites the previous copy. Bump the `version` when iterating.
