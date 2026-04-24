import JSZip from "jszip";
import { toPng, toJpeg, toSvg } from "html-to-image";
import type { CanvasNode } from "../store/types";
import type { ExportConfig } from "../design-systems/types";

function collectImportableTypes(node: CanvasNode, importable: Set<string>): Set<string> {
  const types = new Set<string>();
  if (importable.has(node.type)) types.add(node.type);
  for (const child of node.children ?? []) {
    for (const t of collectImportableTypes(child, importable)) types.add(t);
  }
  return types;
}

function styleToJsx(style: React.CSSProperties): string {
  const entries = Object.entries(style).filter(
    ([, v]) => v !== undefined && v !== null
  );
  if (entries.length === 0) return "{}";
  const lines = entries.map(([k, v]) => {
    const val = typeof v === "number" ? String(v) : JSON.stringify(v);
    return `${k}: ${val}`;
  });
  return `{ ${lines.join(", ")} }`;
}

function propsToJsx(props: Record<string, unknown>): string {
  return Object.entries(props)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => {
      if (k === "children") return ""; // handled separately
      if (typeof v === "boolean") return v ? k : `${k}={false}`;
      if (typeof v === "number") return `${k}={${v}}`;
      if (typeof v === "string") return `${k}=${JSON.stringify(v)}`;
      return `${k}={${JSON.stringify(v)}}`;
    })
    .filter(Boolean)
    .join(" ");
}

function nodeToJsx(node: CanvasNode, indent: number): string {
  const pad = "  ".repeat(indent);
  const nodeStyle = node.style ?? {};
  const style = styleToJsx(nodeStyle);
  const hasStyle = Object.keys(nodeStyle).length > 0;

  if (node.type === "Text") {
    if (hasStyle) {
      return `${pad}<span style={${style}}>{${JSON.stringify(node.text || "Text")}}</span>`;
    }
    return `${pad}<span>{${JSON.stringify(node.text || "Text")}}</span>`;
  }

  if (node.type === "Frame") {
    const childrenJsx = (node.children ?? []).map((c) => nodeToJsx(c, indent + 1)).join("\n");
    if (hasStyle) {
      return `${pad}<div style={${style}}>\n${childrenJsx}\n${pad}</div>`;
    }
    return `${pad}<div>\n${childrenJsx}\n${pad}</div>`;
  }

  // Design system component
  const props = node.componentProps || {};
  const propsStr = propsToJsx(props);
  const childLabel = (props as any).children;
  const styleAttr = hasStyle ? ` style={${style}}` : "";

  const needsWrapper = hasStyle;
  const wrapPad = needsWrapper ? pad + "  " : pad;

  let componentJsx: string;

  if (node.type === "Button" && childLabel) {
    const extraProps = propsStr ? ` ${propsStr}` : "";
    componentJsx = `${wrapPad}<Button${extraProps}>{${JSON.stringify(childLabel)}}</Button>`;
  } else if ((node.children ?? []).length > 0) {
    const childrenJsx = (node.children ?? []).map((c) => nodeToJsx(c, indent + (needsWrapper ? 2 : 1))).join("\n");
    const extraProps = propsStr ? ` ${propsStr}` : "";
    componentJsx = `${wrapPad}<${node.type}${extraProps}>\n${childrenJsx}\n${wrapPad}</${node.type}>`;
  } else {
    const extraProps = propsStr ? ` ${propsStr}` : "";
    componentJsx = `${wrapPad}<${node.type}${extraProps} />`;
  }

  if (needsWrapper) {
    return `${pad}<div style={${style}}>\n${componentJsx}\n${pad}</div>`;
  }
  return componentJsx;
}

export function generateNodeCode(node: CanvasNode, exportCfg: ExportConfig): string {
  const cleaned = stripCanvasPosition(node);
  const jsx = nodeToJsx(cleaned, 2);
  const usedTypes = [...collectImportableTypes(node, exportCfg.importableTypes)];
  const imports = exportCfg.generateImport(usedTypes);
  const name = node.name.replace(/[^a-zA-Z0-9]/g, "");

  const lines = [imports, ""].filter((l, i) => i > 0 || l);
  lines.push(`export default function ${name}() {`);
  lines.push(`  return (`);
  lines.push(jsx);
  lines.push(`  );`);
  lines.push(`}`);
  return lines.join("\n");
}

function stripCanvasPosition(node: CanvasNode): CanvasNode {
  const { position, left, top, ...rest } = node.style ?? {};
  return { ...node, style: rest };
}

function generateAppJsx(node: CanvasNode, exportCfg: ExportConfig): string {
  const usedTypes = [...collectImportableTypes(node, exportCfg.importableTypes)];
  const importLine = exportCfg.generateImport(usedTypes);
  const cssImportLines = (exportCfg.cssImports || []).join("\n");

  const imports = [importLine, cssImportLines].filter(Boolean).join("\n");

  const exportNode = stripCanvasPosition(node);
  const jsx = nodeToJsx(exportNode, 2);

  return `import "./App.css";
${imports ? imports + "\n" : ""}
export default function App() {
  return (
${jsx}
  );
}
`;
}

function generatePackageJson(name: string, exportCfg: ExportConfig): string {
  const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  const deps: Record<string, string> = {
    react: "^18.3.1",
    "react-dom": "^18.3.1",
  };
  if (exportCfg.packageName) {
    deps[exportCfg.packageName] = exportCfg.packageVersion;
  }
  if (exportCfg.extraDependencies) {
    Object.assign(deps, exportCfg.extraDependencies);
  }
  return JSON.stringify({
    name: safeName,
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
    },
    dependencies: deps,
    devDependencies: {
      "@types/react": "^18.3.0",
      "@types/react-dom": "^18.3.0",
      "@vitejs/plugin-react": "^4.3.0",
      vite: "^5.4.0",
    },
  }, null, 2);
}

const VITE_CONFIG = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`;

function generateIndexHtml(exportCfg: ExportConfig): string {
  const themeAttr = exportCfg.dataTheme ? ` data-theme="${exportCfg.dataTheme}"` : "";
  return `<!doctype html>
<html lang="en"${themeAttr}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Exported Component</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
}

const MAIN_JSX = `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`;

const APP_CSS = `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #f5f5f5;
  display: flex;
  justify-content: center;
  padding: 40px 20px;
}
`;

function captureNodeHtml(nodeId: string, title: string, exportCfg: ExportConfig): string | null {
  const el = document.querySelector(`[data-canvas-node="${nodeId}"]`) as HTMLElement;
  if (!el) return null;

  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.position = "relative";
  clone.style.left = "auto";
  clone.style.top = "auto";
  clone.style.outline = "none";
  clone.style.outlineOffset = "0";
  clone.querySelectorAll("[data-canvas-node]").forEach((child) => {
    (child as HTMLElement).style.outline = "none";
    (child as HTMLElement).style.outlineOffset = "0";
  });

  const styles: string[] = [];
  for (const sheet of document.styleSheets) {
    try {
      const rules = Array.from(sheet.cssRules).map((r) => r.cssText).join("\n");
      styles.push(rules);
    } catch {
      if (sheet.href) {
        styles.push(`@import url("${sheet.href}");`);
      }
    }
  }

  const themeAttr = exportCfg.dataTheme ? ` data-theme="${exportCfg.dataTheme}"` : "";
  return `<!doctype html>
<html lang="en"${themeAttr}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>${styles.join("\n")}</style>
  <style>
    body {
      margin: 0;
      background: #f5f5f5;
      display: flex;
      justify-content: center;
      padding: 40px 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
  </style>
</head>
<body>${clone.outerHTML}</body>
</html>`;
}

export function previewNode(nodeId: string, exportCfg: ExportConfig): void {
  const html = captureNodeHtml(nodeId, "Preview", exportCfg);
  if (!html) return;
  const blob = new Blob([html], { type: "text/html" });
  window.open(URL.createObjectURL(blob), "_blank");
}

export function exportNodeAsHtml(nodeId: string, name: string, exportCfg: ExportConfig): void {
  const html = captureNodeHtml(nodeId, name, exportCfg);
  if (!html) return;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^a-zA-Z0-9 -]/g, "").replace(/ /g, "-")}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function fetchPublicFile(path: string): Promise<string> {
  try {
    const res = await fetch(path);
    if (res.ok) return await res.text();
  } catch {}
  return "";
}

type ImageFormat = "png" | "jpeg" | "svg";

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9 -]/g, "").replace(/ /g, "-") || "export";
}

function prepareForCapture(el: HTMLElement): void {
  // Remove canvas selection chrome — outline, offset, and hover cursors would
  // bleed into the image otherwise.
  el.style.outline = "none";
  el.style.outlineOffset = "0";
  el.style.cursor = "default";
  el.querySelectorAll<HTMLElement>("[data-canvas-node]").forEach((child) => {
    child.style.outline = "none";
    child.style.outlineOffset = "0";
    child.style.cursor = "default";
  });
}

/**
 * Build an off-screen container, append the already-prepared clone, and return
 * a cleanup function. Kept off-screen via `left: -99999px` so layout is real
 * (fonts, webkit-specific rendering) while the user never sees it flash.
 */
function mountOffscreen(node: HTMLElement, extraStyles: Partial<CSSStyleDeclaration> = {}): () => void {
  const host = document.createElement("div");
  Object.assign(host.style, {
    position: "fixed",
    left: "-99999px",
    top: "0",
    pointerEvents: "none",
    // Inherit fontFamily from body so DS fonts apply.
    fontFamily: getComputedStyle(document.body).fontFamily,
    ...extraStyles,
  } as CSSStyleDeclaration);
  host.appendChild(node);
  document.body.appendChild(host);
  return () => document.body.removeChild(host);
}

async function renderToDataUrl(
  el: HTMLElement,
  opts: { format: ImageFormat; backgroundColor?: string; width?: number; height?: number }
): Promise<string> {
  const commonOptions = {
    pixelRatio: 2,
    backgroundColor: opts.backgroundColor ?? "#ffffff",
    cacheBust: true,
    width: opts.width,
    height: opts.height,
    style: {
      // html-to-image respects these as overrides on the root during capture.
      margin: "0",
    },
  };
  if (opts.format === "jpeg") return toJpeg(el, { ...commonOptions, quality: 0.95 });
  if (opts.format === "svg") return toSvg(el, commonOptions);
  return toPng(el, commonOptions);
}

function triggerDownload(dataUrl: string, fileName: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Export a single selected node as an image. */
export async function exportNodeAsImage(
  nodeId: string,
  name: string,
  format: ImageFormat = "png",
  { returnDataUrl = false }: { returnDataUrl?: boolean } = {}
): Promise<string | void> {
  const source = document.querySelector<HTMLElement>(`[data-canvas-node="${nodeId}"]`);
  if (!source) return;

  const clone = source.cloneNode(true) as HTMLElement;
  // Release from absolute positioning so the capture starts at (0,0).
  clone.style.position = "relative";
  clone.style.left = "auto";
  clone.style.top = "auto";
  // If the original didn't have an explicit width/height, carry over the
  // rendered size so the clone matches what the user sees.
  const rect = source.getBoundingClientRect();
  const parentScale = getAncestorScale(source);
  const naturalWidth = rect.width / parentScale;
  const naturalHeight = rect.height / parentScale;
  if (!clone.style.width) clone.style.width = `${naturalWidth}px`;
  if (!clone.style.height) clone.style.height = `${naturalHeight}px`;
  prepareForCapture(clone);

  const cleanup = mountOffscreen(clone);
  try {
    const dataUrl = await renderToDataUrl(clone, {
      format,
      width: naturalWidth,
      height: naturalHeight,
      backgroundColor: format === "jpeg" ? "#ffffff" : undefined,
    });
    if (returnDataUrl) return dataUrl;
    const ext = format === "jpeg" ? "jpg" : format;
    triggerDownload(dataUrl, `${safeFileName(name)}.${ext}`);
  } finally {
    cleanup();
  }
}

/** Accumulated scale factor of all transform: scale() ancestors (e.g. the pan/zoom grid). */
function getAncestorScale(el: HTMLElement): number {
  let scale = 1;
  let cur: HTMLElement | null = el.parentElement;
  while (cur) {
    const t = getComputedStyle(cur).transform;
    if (t && t !== "none") {
      const match = t.match(/matrix\(([^)]+)\)/);
      if (match) {
        const parts = match[1].split(",").map((s) => parseFloat(s.trim()));
        // matrix(a, b, c, d, e, f): a == scaleX, d == scaleY for scale-only.
        if (parts.length >= 4 && !isNaN(parts[0])) scale *= parts[0];
      }
    }
    cur = cur.parentElement;
  }
  return scale;
}

/**
 * Export the full canvas (all top-level nodes) as a single image, trimmed to
 * the bounding box of the content with a small padding.
 */
export async function exportCanvasAsImage(
  name: string = "canvas",
  format: ImageFormat = "png",
  { returnDataUrl = false, padding = 40, backgroundColor = "#f1f5f9" }:
    { returnDataUrl?: boolean; padding?: number; backgroundColor?: string } = {}
): Promise<string | void> {
  const grid = document.querySelector<HTMLElement>('[data-canvas-grid="true"]');
  if (!grid) return;

  // Snapshot the children's natural bounds using their own style left/top/width/height.
  // We can't use getBoundingClientRect because the grid is transformed (zoom+pan).
  const topNodes = Array.from(grid.children).filter(
    (c) => c instanceof HTMLElement && c.dataset.canvasNode
  ) as HTMLElement[];
  if (topNodes.length === 0) return;

  let minLeft = Infinity;
  let minTop = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;

  // Use offsetWidth/offsetHeight which reflect rendered size regardless of inline style.
  for (const child of topNodes) {
    const left = parseFloat(child.style.left || "0") || 0;
    const top = parseFloat(child.style.top || "0") || 0;
    const width = child.offsetWidth;
    const height = child.offsetHeight;
    minLeft = Math.min(minLeft, left);
    minTop = Math.min(minTop, top);
    maxRight = Math.max(maxRight, left + width);
    maxBottom = Math.max(maxBottom, top + height);
  }

  if (!isFinite(minLeft)) return;

  const contentWidth = maxRight - minLeft + padding * 2;
  const contentHeight = maxBottom - minTop + padding * 2;

  // Clone children into a clean container with no transform. Offset each by
  // -minLeft + padding so the content sits snug with uniform margin.
  const container = document.createElement("div");
  Object.assign(container.style, {
    position: "relative",
    width: `${contentWidth}px`,
    height: `${contentHeight}px`,
    background: backgroundColor,
    backgroundImage: "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
    backgroundSize: "20px 20px",
    fontFamily: getComputedStyle(grid).fontFamily,
  } as CSSStyleDeclaration);

  for (const original of topNodes) {
    const clone = original.cloneNode(true) as HTMLElement;
    const left = parseFloat(original.style.left || "0") || 0;
    const top = parseFloat(original.style.top || "0") || 0;
    clone.style.left = `${left - minLeft + padding}px`;
    clone.style.top = `${top - minTop + padding}px`;
    prepareForCapture(clone);
    container.appendChild(clone);
  }

  const cleanup = mountOffscreen(container);
  try {
    const dataUrl = await renderToDataUrl(container, {
      format,
      width: contentWidth,
      height: contentHeight,
      backgroundColor,
    });
    if (returnDataUrl) return dataUrl;
    const ext = format === "jpeg" ? "jpg" : format;
    triggerDownload(dataUrl, `${safeFileName(name)}.${ext}`);
  } finally {
    cleanup();
  }
}

// Dev-only bridge so end-to-end tests (Playwright) can drive image exports
// and grab the returned data URL without fighting browser download flows.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __easelImageExport?: unknown }).__easelImageExport = {
    exportNodeAsImage,
    exportCanvasAsImage,
  };
}

export async function exportNodeAsViteProject(node: CanvasNode, exportCfg: ExportConfig): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder(node.name.replace(/[^a-zA-Z0-9 -]/g, "").replace(/ /g, "-"))!;

  folder.file("package.json", generatePackageJson(node.name, exportCfg));
  folder.file("vite.config.js", VITE_CONFIG);
  folder.file("index.html", generateIndexHtml(exportCfg));

  const src = folder.folder("src")!;
  src.file("main.jsx", MAIN_JSX);
  src.file("App.jsx", generateAppJsx(node, exportCfg));
  src.file("App.css", APP_CSS);

  // Fetch theme CSS if the design system specifies one
  if (exportCfg.themeCSSPath) {
    const themeCss = await fetchPublicFile(exportCfg.themeCSSPath);
    if (themeCss) {
      const fileName = exportCfg.themeCSSPath.split("/").pop() || "theme.css";
      src.file(fileName, themeCss);
    }
  }

  const npmrc = await fetchPublicFile("/npmrc.txt");
  if (npmrc) folder.file(".npmrc", npmrc);

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${node.name.replace(/[^a-zA-Z0-9 -]/g, "").replace(/ /g, "-")}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
