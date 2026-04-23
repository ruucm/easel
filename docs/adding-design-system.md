# Adding a Design System

## Overview

This project manages design systems through an **adapter pattern**. To add a new DS, you only need to create one adapter file and add a single import line to `init.ts`.

## File layout

```
app/design-systems/
├── types.ts        # DesignSystemAdapter interface (do not edit)
├── registry.ts     # Adapter registration / lookup (do not edit)
├── context.tsx     # React Context (do not edit)
├── init.ts         # ★ Add your import here
├── html.tsx        # Generic HTML adapter
├── shadcn.tsx      # shadcn/ui adapter
├── mui.tsx         # Material UI adapter
└── yourds.tsx      # ★ Your new adapter file
```

## Step 1: Create the adapter file

Create `app/design-systems/yourds.tsx`.

```tsx
"use client";

import React from "react";
import type { DesignSystemAdapter, ComponentTemplate } from "./types";
import type { CanvasNode } from "../store/types";
import { registerDesignSystem } from "./registry";

// External library imports (if any)
// import { Button, Input } from "your-design-system";
```

## Step 2: Implement the component renderer

`renderComponent` is the core function that draws each component on the canvas.

```tsx
function renderComponent(node: CanvasNode): React.ReactNode {
  const p = (node.componentProps || {}) as Record<string, any>;

  switch (node.type) {
    case "YourButton":
      return (
        <button style={{ padding: "8px 16px", borderRadius: 6 }}>
          {p.label || "Button"}
        </button>
      );

    case "YourInput":
      return (
        <input
          placeholder={p.placeholder || "Enter text..."}
          style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
        />
      );

    case "YourCard":
      return (
        <div style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 12 }}>
          <h3>{p.title || "Card Title"}</h3>
          <p>{p.content || "Card content"}</p>
        </div>
      );

    default:
      return null; // Frame, Text, etc. are handled by the canvas itself
  }
}
```

**Rules:**
- Branch on `node.type` and return JSX.
- Read props from `node.componentProps`.
- Return `null` for Frame/Text — the canvas handles them directly.
- Always provide fallback defaults (`p.label || "Button"`).

## Step 3: Define the catalog

This is the list of components shown in the left-hand Assets panel.

```tsx
// Icon helper
const S = ({ children, ...p }: React.SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
       stroke="currentColor" strokeWidth="1.5"
       strokeLinecap="round" strokeLinejoin="round" {...p}>
    {children}
  </svg>
);

// Unique ID generator (use a prefix + starting value that won't collide with other DSes)
let counter = 9000;
function uid() {
  return `yourds-${++counter}-${Date.now()}`;
}

const catalog: ComponentTemplate[] = [
  {
    type: "YourButton",
    label: "Button",
    icon: <S><rect x="2" y="4" width="12" height="8" rx="2" /></S>,
    create: (cx, cy) => ({
      id: uid(),
      type: "YourButton",
      name: "Button",
      style: { position: "absolute" as const, left: cx, top: cy },
      componentProps: { label: "Click me", variant: "primary" },
      children: [],
    }),
  },
  {
    type: "YourInput",
    label: "Input",
    icon: <S><rect x="1" y="4" width="14" height="8" rx="2" /><line x1="4" y1="8" x2="4" y2="8" /></S>,
    create: (cx, cy) => ({
      id: uid(),
      type: "YourInput",
      name: "Input",
      style: { position: "absolute" as const, left: cx, top: cy, width: 240 },
      componentProps: { placeholder: "Enter text...", label: "Label" },
      children: [],
    }),
  },
  {
    type: "YourCard",
    label: "Card",
    icon: <S><rect x="1" y="2" width="14" height="12" rx="2" /></S>,
    create: (cx, cy) => ({
      id: uid(),
      type: "YourCard",
      name: "Card",
      style: { position: "absolute" as const, left: cx, top: cy, width: 300 },
      componentProps: { title: "Card Title", content: "Card content goes here." },
      children: [],
    }),
  },
];
```

**Catalog entry fields:**
- `type` — must match a `case` in `renderComponent`.
- `label` — displayed name in the Assets panel.
- `icon` — 16x16 SVG icon.
- `create(cx, cy)` — factory that returns a node when the user adds the component at `(cx, cy)`.

## Step 4: Write the AI schema

This is the schema the AI uses when generating designs.

```tsx
const aiSchema = `Design System: Your Design System

A CanvasNode has this structure:
{
  id: string,
  type: "Frame" | "Text" | "YourButton" | "YourInput" | "YourCard",
  name: string (descriptive layer name),
  style: React.CSSProperties,
  children: CanvasNode[],
  text?: string (only for Text nodes),
  componentProps?: {
    // YourButton: { label: string, variant?: "primary" | "secondary" | "danger", disabled?: boolean }
    // YourInput: { placeholder?: string, label?: string, type?: "text" | "email" | "password" }
    // YourCard: { title: string, content?: string }
  }
}

Rules:
- Use Frame (type: "Frame") for layout containers. Give it display: "flex", flexDirection, gap, padding, etc.
- Use Text (type: "Text") for any text. Set the "text" field and style fontSize, fontWeight, color.
- Generate unique IDs like "yourds-N-timestamp".
- Always wrap designs in a root Frame with proper layout styles.
`;
```

**The better this is written, the more accurate the AI's output.** Document every component's props exhaustively.

## Step 5: Export config

Configuration used when exporting a design as a Vite project.

```tsx
const IMPORTABLE = new Set(["YourButton", "YourInput", "YourCard"]);

const exportConfig = {
  // npm package info (if you use an external library)
  packageName: "your-design-system",    // or "" if none
  packageVersion: "^1.0.0",             // or ""

  // Extra dependencies
  extraDependencies: {
    // "@emotion/react": "^11.0.0",     // if needed
  },

  // HTML data-theme attribute (for theme switching)
  dataTheme: undefined,                  // or "your-theme"

  // CSS imports
  cssImports: [
    // "import 'your-design-system/styles.css';",
  ],

  // Path to a theme CSS file under public/
  themeCSSPath: undefined,               // or "/your-theme.css"

  // Import statement generator
  generateImport: (usedTypes: string[]) => {
    if (usedTypes.length === 0) return "";
    return `import { ${usedTypes.join(", ")} } from "your-design-system";`;
  },

  // Types that require imports (excluding Frame/Text)
  importableTypes: IMPORTABLE,
};
```

## Step 6: Assemble and register the adapter

```tsx
const yourdsAdapter: DesignSystemAdapter = {
  id: "yourds",
  name: "Your Design System",
  description: "My awesome design system",
  accentColor: "#7c3aed",  // UI accent color (hex)
  fontFamily: "var(--font-inter), Inter, sans-serif",  // Canvas font

  renderComponent,
  catalog,
  aiSchema,
  exportConfig,

  // (optional) Default nodes to show when this DS is selected
  // defaultNodes: [...],
};

// Register (runs automatically when the module is imported)
registerDesignSystem(yourdsAdapter);

export default yourdsAdapter;
```

## Step 7: Register in init.ts

Add a single import line to `app/design-systems/init.ts`:

```ts
import "./html";
import "./shadcn";
import "./mui";
import "./yourds";  // ← add this
```

## Step 8: Wire up the AI guide (recommended)

Write a markdown file with **style rules** the AI should follow when generating or editing designs. Create `{adapterId}.md` under the project's `guides/` directory, then point the adapter's `guideFile` at it.

**1) Create the guide file** — `guides/yourds.md`:

```markdown
## Your DS Design System Rules

### Button Variants
- "primary": use for the main CTA only
- "secondary": use for cancel, back, or less important actions
- "danger": reserved for destructive actions (delete, etc.)

### Layout Patterns
- Always wrap designs in a root Frame (display:"flex", flexDirection:"column")
- Use generous whitespace between sections

### Style Rules
- Let component variants control color, border, padding — don't override in node.style
- node.style should only hold layout properties: position, width, height, display, gap, margin
```

Where `aiSchema` teaches the AI about **structure (types and props)**, `guides/*.md` teaches **style judgement (which variant to use when)**. See `guides/shadcn.md`, `guides/mui.md`, and `guides/html.md` for reference.

**2) Link it from the adapter** — add `guideFile` to your adapter object in `yourds.tsx`:

```tsx
const yourdsAdapter: DesignSystemAdapter = {
  id: "yourds",
  // ... (other fields)
  guideFile: "guides/yourds.md",  // ← add this
};
```

## Step 9: Add a font (optional)

If your DS needs a specific Google Font, add it in `app/layout.tsx`:

```tsx
import { Geist, Geist_Mono, Inter, Roboto, YourFont } from "next/font/google";

const yourFont = YourFont({
  variable: "--font-yourfont",
  subsets: ["latin"],
});
```

Add `${yourFont.variable}` to the `<html>` tag's className, then set the adapter's `fontFamily` to `"var(--font-yourfont), YourFont, sans-serif"`.

---

## Minimal full template

```tsx
"use client";

import React from "react";
import type { DesignSystemAdapter, ComponentTemplate } from "./types";
import type { CanvasNode } from "../store/types";
import { registerDesignSystem } from "./registry";

// ── Renderer ──
function renderComponent(node: CanvasNode): React.ReactNode {
  const p = (node.componentProps || {}) as Record<string, any>;
  switch (node.type) {
    case "MyButton":
      return <button>{p.label || "Button"}</button>;
    default:
      return null;
  }
}

// ── Helpers ──
const S = ({ children, ...p }: React.SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
       stroke="currentColor" strokeWidth="1.5" {...p}>{children}</svg>
);

let counter = 9000;
function uid() { return `myds-${++counter}-${Date.now()}`; }

// ── Catalog ──
const catalog: ComponentTemplate[] = [
  {
    type: "MyButton",
    label: "Button",
    icon: <S><rect x="2" y="4" width="12" height="8" rx="2" /></S>,
    create: (cx, cy) => ({
      id: uid(), type: "MyButton", name: "Button",
      style: { position: "absolute" as const, left: cx, top: cy },
      componentProps: { label: "Click me" },
      children: [],
    }),
  },
];

// ── AI Schema ──
const aiSchema = `Design System: My DS
{ type: "MyButton", componentProps: { label: string } }`;

// ── Export ──
const exportConfig = {
  packageName: "", packageVersion: "",
  generateImport: () => "",
  importableTypes: new Set<string>(),
};

// ── Adapter ──
const mydsAdapter: DesignSystemAdapter = {
  id: "myds",
  name: "My DS",
  description: "My design system",
  accentColor: "#7c3aed",
  renderComponent, catalog, aiSchema, exportConfig,
  guideFile: "guides/myds.md", // optional but recommended
};

registerDesignSystem(mydsAdapter);
export default mydsAdapter;
```

---

## Verifying it works

To confirm your new adapter is wired up correctly:

```bash
npm run dev
```

1. Open http://localhost:3000 and click the **design-system dropdown** in the bottom bar — your adapter's `name` should appear.
2. Select it. The canvas accent color should switch to your `accentColor`, and the left-hand Assets panel should show the components from your `catalog`.
3. Drag a component from Assets onto the canvas — you should see the JSX from `renderComponent`.
4. Type something like "stack three buttons vertically" into the AI prompt bar — the AI uses your `aiSchema` + `guideFile` to generate a new design.
5. Click **Export** in the toolbar. Check the downloaded zip — the `package.json` and `App.jsx` should reflect your `exportConfig`.

To catch build errors in one shot:

```bash
npx next build
```

## Common mistakes

| Symptom | Cause |
|---------|-------|
| New DS doesn't appear in the dropdown | Missing `import "./yourds";` in `init.ts` |
| Canvas renders nothing | `renderComponent` missing a `case` for that `node.type` — it's falling through to `null` |
| Nodes collide by ID | `uid()` counter starts at a value that overlaps another adapter's — give each adapter a unique prefix + starting offset (`html-`, `shadcn-`, `mui-`, `yourds-`, ...) |
| AI generates the wrong types | `aiSchema` doesn't list all types + `componentProps` explicitly |
| AI picks weird variants or styles | `guides/yourds.md` missing or too vague — see Step 8 |
| Exported project has import errors | Missing type in `exportConfig.importableTypes`, or wrong `packageName` / version |
| "use client" warning in the console | Forgot `"use client";` at the top of your adapter file |

## Checklist

| # | Task | File |
|---|------|------|
| 1 | Create adapter file | `app/design-systems/yourds.tsx` |
| 2 | Implement `renderComponent` | same file |
| 3 | Define `catalog` | same file |
| 4 | Write `aiSchema` | same file |
| 5 | Configure `exportConfig` | same file |
| 6 | Call `registerDesignSystem()` | bottom of the same file |
| 7 | Add import to `init.ts` | `app/design-systems/init.ts` |
| 8 | Wire up AI guide | `guides/yourds.md` + adapter's `guideFile` |
| 9 | (Optional) Add font | `app/layout.tsx` |
| 10 | Verify with `npm run dev` | — |
| 11 | Verify build with `npx next build` | — |

## Reference adapters

| Adapter | Complexity | Notes | Good reference for |
|---------|-----------|-------|--------------------|
| `html.tsx` | Low | No external deps, inline styles | Understanding the basic structure |
| `shadcn.tsx` | Medium | Imports local components | Tailwind-based DSes |
| `mui.tsx` | High | Uses an external npm package | Library-based DSes |
