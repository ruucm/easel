"use client";

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import type { CanvasState, CanvasAction, CanvasNode } from "./types";

/** Ensure every node in the tree has a `children` array. */
function normalizeNodes(nodes: unknown): CanvasNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((n: any) => ({
    ...n,
    children: normalizeNodes(n.children),
  }));
}

function findAndUpdate(
  nodes: CanvasNode[],
  id: string,
  updater: (node: CanvasNode) => CanvasNode
): CanvasNode[] {
  return nodes.map((node) => {
    if (node.id === id) return updater(node);
    return { ...node, children: findAndUpdate(node.children, id, updater) };
  });
}

function removeNode(nodes: CanvasNode[], id: string): CanvasNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => ({ ...n, children: removeNode(n.children, id) }));
}

function findNode(nodes: CanvasNode[], id: string): CanvasNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

function addNodeToParent(
  nodes: CanvasNode[],
  node: CanvasNode,
  parentId?: string
): CanvasNode[] {
  if (!parentId) return [...nodes, node];
  return nodes.map((n) => {
    if (n.id === parentId) return { ...n, children: [...n.children, node] };
    return { ...n, children: addNodeToParent(n.children, node, parentId) };
  });
}

function insertNodeAt(
  nodes: CanvasNode[],
  node: CanvasNode,
  parentId: string | null,
  index: number
): CanvasNode[] {
  if (!parentId) {
    const copy = [...nodes];
    copy.splice(index, 0, node);
    return copy;
  }
  return nodes.map((n) => {
    if (n.id === parentId) {
      const children = [...n.children];
      children.splice(index, 0, node);
      return { ...n, children };
    }
    return { ...n, children: insertNodeAt(n.children, node, parentId, index) };
  });
}

function canvasReducer(state: CanvasState, action: CanvasAction): CanvasState {
  switch (action.type) {
    case "SELECT":
      return { ...state, selectedId: action.id };
    case "ADD_NODE": {
      const safeNode = normalizeNodes([action.node])[0];
      return {
        ...state,
        nodes: addNodeToParent(state.nodes, safeNode, action.parentId),
        selectedId: safeNode.id,
      };
    }
    case "MOVE_NODE":
      return {
        ...state,
        nodes: findAndUpdate(state.nodes, action.id, (n) => ({
          ...n,
          style: { ...n.style, left: action.x, top: action.y },
        })),
      };
    case "DELETE_NODE":
      return {
        ...state,
        nodes: removeNode(state.nodes, action.id),
        selectedId:
          state.selectedId === action.id ? null : state.selectedId,
      };
    case "UPDATE_STYLE":
      return {
        ...state,
        nodes: findAndUpdate(state.nodes, action.id, (n) => ({
          ...n,
          style: { ...n.style, ...action.style },
        })),
      };
    case "RENAME_NODE":
      return {
        ...state,
        nodes: findAndUpdate(state.nodes, action.id, (n) => ({
          ...n,
          name: action.name,
        })),
      };
    case "SET_ZOOM":
      return { ...state, zoom: action.zoom };
    case "SET_PAN":
      return { ...state, panX: action.x, panY: action.y };
    case "UPDATE_NODE":
      return {
        ...state,
        nodes: findAndUpdate(state.nodes, action.id, (n) => ({
          ...n,
          ...action.node,
          id: n.id,
          children: action.node.children ?? n.children,
          style: { ...n.style, ...(action.node.style || {}) },
        })),
      };
    case "LOAD_STATE":
      return { ...state, nodes: normalizeNodes(action.nodes), selectedId: null };
    case "REORDER_NODE": {
      const node = findNode(state.nodes, action.id);
      if (!node) return state;
      const without = removeNode(state.nodes, action.id);
      return {
        ...state,
        nodes: insertNodeAt(without, node, action.parentId, action.index),
      };
    }
    default:
      return state;
  }
}

const defaultNodes: CanvasNode[] = [
  // === Column 1: Headings + Buttons (x: 60) ===
  {
    id: "label-buttons",
    type: "Text",
    name: "Buttons",
    text: "Buttons",
    style: { position: "absolute", left: 60, top: 40, fontSize: 12, fontWeight: 700, color: "#9ca3af", letterSpacing: 1, whiteSpace: "nowrap" as unknown as string },
    children: [],
  },
  {
    id: "btn-primary",
    type: "HtmlButton",
    name: "Primary Button",
    style: { position: "absolute", left: 60, top: 70 },
    componentProps: { label: "Create Account", variant: "primary" },
    children: [],
  },
  {
    id: "btn-danger",
    type: "HtmlButton",
    name: "Danger Button",
    style: { position: "absolute", left: 60, top: 120 },
    componentProps: { label: "Delete", variant: "danger" },
    children: [],
  },
  {
    id: "btn-default",
    type: "HtmlButton",
    name: "Default Button",
    style: { position: "absolute", left: 60, top: 170 },
    componentProps: { label: "Cancel", variant: "default" },
    children: [],
  },
  {
    id: "link-1",
    type: "HtmlLink",
    name: "Link",
    style: { position: "absolute", left: 60, top: 220 },
    componentProps: { text: "Learn more →" },
    children: [],
  },

  // === Column 2: Form Elements (x: 240) ===
  {
    id: "label-forms",
    type: "Text",
    name: "Forms",
    text: "Forms",
    style: { position: "absolute", left: 240, top: 40, fontSize: 12, fontWeight: 700, color: "#9ca3af", letterSpacing: 1, whiteSpace: "nowrap" as unknown as string },
    children: [],
  },
  {
    id: "input-email",
    type: "HtmlInput",
    name: "Email Input",
    style: { position: "absolute", left: 240, top: 70, width: 260 },
    componentProps: { label: "Email", placeholder: "you@example.com", inputType: "email" },
    children: [],
  },
  {
    id: "input-password",
    type: "HtmlInput",
    name: "Password Input",
    style: { position: "absolute", left: 240, top: 160, width: 260 },
    componentProps: { label: "Password", placeholder: "********", inputType: "password" },
    children: [],
  },
  {
    id: "select-country",
    type: "HtmlSelect",
    name: "Select",
    style: { position: "absolute", left: 240, top: 250, width: 260 },
    componentProps: { label: "Country", options: [{ label: "United States", value: "us" }, { label: "United Kingdom", value: "uk" }, { label: "Australia", value: "au" }] },
    children: [],
  },
  {
    id: "textarea-msg",
    type: "HtmlTextarea",
    name: "Message",
    style: { position: "absolute", left: 240, top: 340, width: 260 },
    componentProps: { label: "Message", placeholder: "Type your message...", rows: 3 },
    children: [],
  },

  // === Column 3: Controls (x: 540) ===
  {
    id: "label-controls",
    type: "Text",
    name: "Controls",
    text: "Controls",
    style: { position: "absolute", left: 540, top: 40, fontSize: 12, fontWeight: 700, color: "#9ca3af", letterSpacing: 1, whiteSpace: "nowrap" as unknown as string },
    children: [],
  },
  {
    id: "checkbox-1",
    type: "HtmlCheckbox",
    name: "Checkbox",
    style: { position: "absolute", left: 540, top: 70 },
    componentProps: { label: "I agree to the terms", checked: true },
    children: [],
  },
  {
    id: "checkbox-2",
    type: "HtmlCheckbox",
    name: "Checkbox 2",
    style: { position: "absolute", left: 540, top: 100 },
    componentProps: { label: "Subscribe to newsletter", checked: false },
    children: [],
  },
  {
    id: "radio-1",
    type: "HtmlRadio",
    name: "Radio",
    style: { position: "absolute", left: 540, top: 140 },
    componentProps: { label: "Monthly billing", checked: true },
    children: [],
  },
  {
    id: "radio-2",
    type: "HtmlRadio",
    name: "Radio 2",
    style: { position: "absolute", left: 540, top: 170 },
    componentProps: { label: "Annual billing (save 20%)", checked: false },
    children: [],
  },
  {
    id: "progress-1",
    type: "HtmlProgress",
    name: "Progress",
    style: { position: "absolute", left: 540, top: 220, width: 240 },
    componentProps: { value: 65, label: "Upload progress" },
    children: [],
  },
  {
    id: "divider-1",
    type: "HtmlDivider",
    name: "Divider",
    style: { position: "absolute", left: 540, top: 290, width: 240 },
    componentProps: {},
    children: [],
  },
  {
    id: "list-1",
    type: "HtmlList",
    name: "List",
    style: { position: "absolute", left: 540, top: 320 },
    componentProps: { items: ["Design tokens", "Component library", "AI generation"], ordered: false },
    children: [],
  },

  // === Column 4: Display + Feedback (x: 820) ===
  {
    id: "label-display",
    type: "Text",
    name: "Display",
    text: "Display",
    style: { position: "absolute", left: 820, top: 40, fontSize: 12, fontWeight: 700, color: "#9ca3af", letterSpacing: 1, whiteSpace: "nowrap" as unknown as string },
    children: [],
  },
  {
    id: "badge-1",
    type: "HtmlBadge",
    name: "Badge",
    style: { position: "absolute", left: 820, top: 70 },
    componentProps: { text: "Active", color: "green" },
    children: [],
  },
  {
    id: "badge-2",
    type: "HtmlBadge",
    name: "Badge 2",
    style: { position: "absolute", left: 880, top: 70 },
    componentProps: { text: "Pending", color: "yellow" },
    children: [],
  },
  {
    id: "badge-3",
    type: "HtmlBadge",
    name: "Badge 3",
    style: { position: "absolute", left: 950, top: 70 },
    componentProps: { text: "Error", color: "red" },
    children: [],
  },
  {
    id: "avatar-1",
    type: "HtmlAvatar",
    name: "Avatar",
    style: { position: "absolute", left: 820, top: 120 },
    componentProps: { initials: "JD", size: 40 },
    children: [],
  },
  {
    id: "avatar-2",
    type: "HtmlAvatar",
    name: "Avatar 2",
    style: { position: "absolute", left: 870, top: 120 },
    componentProps: { initials: "AK", size: 40 },
    children: [],
  },
  {
    id: "avatar-3",
    type: "HtmlAvatar",
    name: "Avatar 3",
    style: { position: "absolute", left: 920, top: 120 },
    componentProps: { initials: "MR", size: 40 },
    children: [],
  },
  {
    id: "alert-info",
    type: "HtmlAlert",
    name: "Info Alert",
    style: { position: "absolute", left: 820, top: 180, width: 280 },
    componentProps: { type: "info", title: "Heads up", message: "This is an open-source canvas. Pick any design system from the bottom bar." },
    children: [],
  },
  {
    id: "alert-success",
    type: "HtmlAlert",
    name: "Success Alert",
    style: { position: "absolute", left: 820, top: 290, width: 280 },
    componentProps: { type: "success", title: "Saved", message: "Your design has been autosaved." },
    children: [],
  },

  // === Hero Section (HTML) ===
  {
    id: "hero-frame",
    type: "Frame",
    name: "Hero Section",
    style: {
      position: "absolute",
      left: 60,
      top: 460,
      width: 1040,
      backgroundColor: "#ffffff",
      borderRadius: 16,
      border: "1px solid #e5e7eb",
      padding: 0,
    },
    children: [
      {
        id: "hero-nav",
        type: "Frame",
        name: "Navigation Bar",
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 32px",
          borderBottom: "1px solid #f3f4f6",
        },
        children: [
          {
            id: "hero-logo",
            type: "Text",
            name: "Logo",
            text: "Design System Canvas",
            style: { fontSize: 18, fontWeight: 700, color: "#111827" },
            children: [],
          },
          {
            id: "hero-nav-cta",
            type: "HtmlButton",
            name: "Nav CTA",
            style: {},
            componentProps: { label: "Get Started", variant: "primary" },
            children: [],
          },
        ],
      },
      {
        id: "hero-content",
        type: "Frame",
        name: "Hero Content",
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "60px 40px",
          gap: 20,
          textAlign: "center" as const,
        },
        children: [
          {
            id: "hero-badge",
            type: "HtmlBadge",
            name: "Hero Badge",
            style: {},
            componentProps: { text: "Open Source", color: "blue" },
            children: [],
          },
          {
            id: "hero-title",
            type: "HtmlHeading",
            name: "Hero Title",
            style: { maxWidth: 700 },
            componentProps: { level: 1, text: "Design with React components on a Framer-like canvas" },
            children: [],
          },
          {
            id: "hero-subtitle",
            type: "Text",
            name: "Hero Subtitle",
            text: "Switch between HTML, shadcn/ui and MUI design systems. Generate layouts with AI, then export the React project.",
            style: { fontSize: 16, color: "#6b7280", lineHeight: 1.6, maxWidth: 600 },
            children: [],
          },
          {
            id: "hero-cta-row",
            type: "Frame",
            name: "CTA Row",
            style: { display: "flex", gap: 12 },
            children: [
              {
                id: "hero-cta-primary",
                type: "HtmlButton",
                name: "Hero CTA Primary",
                style: {},
                componentProps: { label: "Open in Browser", variant: "primary" },
                children: [],
              },
              {
                id: "hero-cta-secondary",
                type: "HtmlButton",
                name: "Hero CTA Secondary",
                style: {},
                componentProps: { label: "View on GitHub", variant: "default" },
                children: [],
              },
            ],
          },
        ],
      },
    ],
  },
];

function stampDsId(nodes: CanvasNode[], dsId: string): CanvasNode[] {
  return nodes.map((n) => ({ ...n, dsId, children: stampDsId(n.children, dsId) }));
}

const initialState: CanvasState = {
  nodes: stampDsId(defaultNodes, "html"),
  selectedId: null,
  zoom: 1,
  panX: 0,
  panY: 0,
};

interface CanvasSlice {
  nodes: CanvasNode[];
  selectedId: string | null;
}

interface ViewportSlice {
  zoom: number;
  panX: number;
  panY: number;
}

const CanvasContext = createContext<CanvasSlice>({
  nodes: initialState.nodes,
  selectedId: initialState.selectedId,
});
const ViewportContext = createContext<ViewportSlice>({
  zoom: initialState.zoom,
  panX: initialState.panX,
  panY: initialState.panY,
});
const CanvasDispatchContext = createContext<Dispatch<CanvasAction>>(() => {});

export function CanvasProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(canvasReducer, initialState);

  // Split state into two slices so that panning (which changes ~60x/sec)
  // does not re-render components that only care about nodes/selection.
  const canvasValue = useMemo<CanvasSlice>(
    () => ({ nodes: state.nodes, selectedId: state.selectedId }),
    [state.nodes, state.selectedId]
  );

  const viewportValue = useMemo<ViewportSlice>(
    () => ({ zoom: state.zoom, panX: state.panX, panY: state.panY }),
    [state.zoom, state.panX, state.panY]
  );

  return (
    <CanvasContext.Provider value={canvasValue}>
      <ViewportContext.Provider value={viewportValue}>
        <CanvasDispatchContext.Provider value={dispatch}>
          {children}
        </CanvasDispatchContext.Provider>
      </ViewportContext.Provider>
    </CanvasContext.Provider>
  );
}

export function useCanvas() {
  return useContext(CanvasContext);
}

export function useViewport() {
  return useContext(ViewportContext);
}

export function useCanvasDispatch() {
  return useContext(CanvasDispatchContext);
}

export function useFindNode() {
  const { nodes } = useCanvas();
  return (id: string) => findNode(nodes, id);
}
