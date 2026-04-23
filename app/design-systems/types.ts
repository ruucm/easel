import type { ReactNode } from "react";
import type { CanvasNode } from "../store/types";

/**
 * A component renderer: given a CanvasNode, returns JSX.
 * Return null for types like Frame/Text that are handled by the canvas itself.
 */
export type ComponentRenderer = (node: CanvasNode) => ReactNode;

/** Template shown in the component library panel */
export interface ComponentTemplate {
  type: string;
  label: string;
  icon: ReactNode;
  create: (cx: number, cy: number) => CanvasNode;
}

/** Export configuration for generating downloadable projects */
export interface ExportConfig {
  /** npm package name, e.g. "@mui/material" */
  packageName: string;
  /** npm package version, e.g. "^7.3.9" */
  packageVersion: string;
  /** Additional npm dependencies (besides react/react-dom) */
  extraDependencies?: Record<string, string>;
  /** HTML data-theme attribute value */
  dataTheme?: string;
  /** CSS import statements for the generated App.jsx */
  cssImports?: string[];
  /** Path to fetch theme CSS from (relative to public/) */
  themeCSSPath?: string;
  /** Generate import statement for used component types */
  generateImport: (usedTypes: string[]) => string;
  /** Set of component type strings that need importing (not Frame/Text) */
  importableTypes: Set<string>;
}

/** Full design system adapter */
export interface DesignSystemAdapter {
  /** Unique ID, e.g. "html", "shadcn", "mui" */
  id: string;
  /** Display name, e.g. "Generic HTML", "shadcn/ui" */
  name: string;
  /** Short description */
  description: string;
  /** Accent color for UI (hex) */
  accentColor: string;

  /** Render a component node. Return null for Frame/Text (handled by canvas). */
  renderComponent: ComponentRenderer;

  /** Component templates for the library panel */
  catalog: ComponentTemplate[];

  /** AI schema string describing available types and their props */
  aiSchema: string;

  /** Export configuration */
  exportConfig: ExportConfig;

  /** Default nodes to show when switching to this DS (optional) */
  defaultNodes?: CanvasNode[];

  /** Font family to apply on the canvas when this DS is active */
  fontFamily?: string;

  /** Path to the design guide .md file (relative to project root, e.g. "guides/shadcn.md") */
  guideFile?: string;

  /** Icon loader for design system icons (optional) */
  loadIcon?: (name: string, onLoaded: () => void) => void;
  /** Get a cached icon component (optional) */
  getIcon?: (name: string) => React.ComponentType<React.SVGProps<SVGSVGElement>> | null | undefined;
}
