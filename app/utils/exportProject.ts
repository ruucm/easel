import JSZip from "jszip";
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
  const style = styleToJsx(node.style);
  const hasStyle = Object.keys(node.style).length > 0;

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
  const { position, left, top, ...rest } = node.style;
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
