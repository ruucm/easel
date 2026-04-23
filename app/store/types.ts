export interface CanvasNodeProps {
  [key: string]: unknown;
}

export interface CanvasNode {
  id: string;
  /** Component type string — defined by the active design system adapter */
  type: string;
  /** Which design system this node belongs to (e.g. "html", "shadcn", "mui") */
  dsId?: string;
  name: string;
  style: React.CSSProperties;
  children: CanvasNode[];
  text?: string;
  componentProps?: CanvasNodeProps;
}

export interface CanvasState {
  nodes: CanvasNode[];
  selectedId: string | null;
  zoom: number;
  panX: number;
  panY: number;
}

export type CanvasAction =
  | { type: "SELECT"; id: string | null }
  | { type: "ADD_NODE"; node: CanvasNode; parentId?: string }
  | { type: "MOVE_NODE"; id: string; x: number; y: number }
  | { type: "DELETE_NODE"; id: string }
  | { type: "UPDATE_STYLE"; id: string; style: React.CSSProperties }
  | { type: "RENAME_NODE"; id: string; name: string }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "SET_PAN"; x: number; y: number }
  | { type: "REORDER_NODE"; id: string; parentId: string | null; index: number }
  | { type: "UPDATE_NODE"; id: string; node: Partial<Omit<CanvasNode, "id">> }
  | { type: "LOAD_STATE"; nodes: CanvasNode[] };
