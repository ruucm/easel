"use client";

import React, { useRef, useState, useCallback, useEffect, type MouseEvent } from "react";
import { useCanvas, useCanvasDispatch, useViewport } from "../store/context";
import type { CanvasNode } from "../store/types";
import { useDesignSystem } from "../design-systems/context";

function DSComponent({ node }: { node: CanvasNode }) {
  const { activeDS } = useDesignSystem();

  if (node.type === "Text") {
    return <span>{node.text || "Text"}</span>;
  }
  if (node.type === "Frame") {
    return null;
  }

  const rendered = activeDS.renderComponent(node);
  if (rendered !== null) return <>{rendered}</>;

  // Fallback for unknown types
  return (
    <div style={{ padding: 8, border: "1px dashed #d1d5db", borderRadius: 6, fontSize: 12, color: "#9ca3af" }}>
      {node.type}
    </div>
  );
}

const EDGE_THRESHOLD = 24; // px (screen space)

function isNearParentEdge(el: HTMLElement, clientX: number, clientY: number): boolean {
  const parentEl = el.parentElement;
  if (!parentEl || !parentEl.dataset.canvasNode) return false;
  const r = parentEl.getBoundingClientRect();
  return (
    clientX - r.left < EDGE_THRESHOLD ||
    r.right - clientX < EDGE_THRESHOLD ||
    clientY - r.top < EDGE_THRESHOLD ||
    r.bottom - clientY < EDGE_THRESHOLD
  );
}

const RenderNode = React.memo(function RenderNode({
  node,
  selectedId,
  isPanning,
  onSelect,
  onDragStart,
}: {
  node: CanvasNode;
  selectedId: string | null;
  isPanning: boolean;
  onSelect: (id: string) => void;
  onDragStart: (id: string, e: MouseEvent) => void;
}) {
  const isSelected = selectedId === node.id;
  const [nearParentEdge, setNearParentEdge] = useState(false);

  const handleMouseMove = (e: MouseEvent) => {
    if (isPanning) return;
    const near = isNearParentEdge(e.currentTarget as HTMLElement, e.clientX, e.clientY);
    setNearParentEdge(near);
  };

  const handleMouseLeave = () => {
    if (isPanning) return;
    setNearParentEdge(false);
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (selectedId && selectedId !== node.id) {
      const selectedEl = document.querySelector(`[data-canvas-node="${selectedId}"]`);
      const currentEl = e.currentTarget as HTMLElement;
      if (selectedEl && selectedEl.contains(currentEl)) {
        return;
      }
    }

    if (isNearParentEdge(e.currentTarget as HTMLElement, e.clientX, e.clientY)) {
      return;
    }

    e.stopPropagation();
    onSelect(node.id);
    if (node.style.position === "absolute") {
      onDragStart(node.id, e);
    }
  };

  const hasChildren = (node.children ?? []).length > 0;

  let wrapperStyle: React.CSSProperties;
  let innerStyle: Record<string, unknown> = {};

  if (hasChildren || node.type === "Frame") {
    wrapperStyle = {
      ...node.style,
      width: node.style.width ?? "auto",
      height: node.style.height ?? "auto",
      outline: isSelected ? "2px solid #3b82f6" : undefined,
      outlineOffset: isSelected ? 2 : undefined,
      cursor: nearParentEdge ? "move" : node.style.position === "absolute" ? "move" : "default",
      userSelect: "none",
      boxSizing: "border-box",
    };
  } else {
    const { position, left, top, width, height, ...rest } = node.style;
    // For DS components (not Text), strip ALL visual styles.
    // DS components handle their own look via variant/className props.
    // Only pass through pure layout styles to the wrapper.
    const isDS = node.type !== "Text" && node.type !== "Frame";
    if (isDS) {
      innerStyle = {};
    } else {
      innerStyle = rest;
    }
    wrapperStyle = {
      position,
      left,
      top,
      width: width ?? "auto",
      height: height ?? "auto",
      outline: isSelected ? "2px solid #3b82f6" : undefined,
      outlineOffset: isSelected ? 2 : undefined,
      cursor: nearParentEdge ? "move" : position === "absolute" ? "move" : "default",
      userSelect: "none",
      boxSizing: "border-box",
    };
  }

  return (
    <div
      data-canvas-node={node.id}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={wrapperStyle}
    >
      {Object.keys(innerStyle).length > 0 ? (
        <div style={innerStyle as React.CSSProperties}>
          <DSComponent node={node} />
        </div>
      ) : (
        <DSComponent node={node} />
      )}
      {(node.children ?? []).map((child) => (
        <RenderNode
          key={child.id}
          node={child}
          selectedId={selectedId}
          isPanning={isPanning}
          onSelect={onSelect}
          onDragStart={onDragStart}
        />
      ))}
    </div>
  );
});

export default function CanvasRenderer() {
  const { nodes, selectedId } = useCanvas();
  const { zoom, panX, panY } = useViewport();
  const dispatch = useCanvasDispatch();
  const { activeDS } = useDesignSystem();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<{
    id: string;
    startX: number;
    startY: number;
    nodeX: number;
    nodeY: number;
  } | null>(null);

  // Keep latest viewport in a ref so the wheel listener can read fresh
  // values without re-attaching on every pan/zoom tick.
  const viewportRef = useRef({ zoom, panX, panY });
  viewportRef.current = { zoom, panX, panY };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom: z, panX: px, panY: py } = viewportRef.current;
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(5, z * delta));
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const newPanX = mx - (mx - px) * (newZoom / z);
        const newPanY = my - (my - py) * (newZoom / z);
        dispatch({ type: "SET_ZOOM", zoom: newZoom });
        dispatch({ type: "SET_PAN", x: newPanX, y: newPanY });
      } else {
        dispatch({ type: "SET_PAN", x: px - e.deltaX, y: py - e.deltaY });
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [dispatch]);

  const handleCanvasMouseDown = (e: MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.canvasGrid) {
      dispatch({ type: "SELECT", id: null });
      if (e.button === 1 || e.altKey) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
      }
    }
  };

  const handleNodeDragStart = useCallback((id: string, e: MouseEvent) => {
    const el = document.querySelector(`[data-canvas-node="${id}"]`) as HTMLElement;
    if (!el) return;
    setDragState({
      id,
      startX: e.clientX,
      startY: e.clientY,
      nodeX: parseFloat(String(el.style.left)) || 0,
      nodeY: parseFloat(String(el.style.top)) || 0,
    });
  }, []);

  const handleNodeSelect = useCallback((id: string) => {
    dispatch({ type: "SELECT", id });
  }, [dispatch]);

  const rafRef = useRef<number>(0);

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!isPanning && !dragState) return;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (isPanning) {
          dispatch({
            type: "SET_PAN",
            x: e.clientX - panStart.x,
            y: e.clientY - panStart.y,
          });
        }
        if (dragState) {
          const dx = (e.clientX - dragState.startX) / zoom;
          const dy = (e.clientY - dragState.startY) / zoom;
          dispatch({
            type: "MOVE_NODE",
            id: dragState.id,
            x: Math.round(dragState.nodeX + dx),
            y: Math.round(dragState.nodeY + dy),
          });
        }
      });
    };

    const handleMouseUp = () => {
      cancelAnimationFrame(rafRef.current);
      setIsPanning(false);
      setDragState(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isPanning, panStart, dragState, zoom, dispatch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (
          selectedId &&
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA"
        ) {
          e.preventDefault();
          dispatch({ type: "DELETE_NODE", id: selectedId });
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, dispatch]);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleCanvasMouseDown}
      className="absolute inset-0 overflow-hidden"
      style={{
        backgroundColor: "#f1f5f9",
        backgroundImage:
          "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
        backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
        backgroundPosition: `${panX}px ${panY}px`,
        cursor: isPanning ? "grabbing" : "default",
      }}
    >
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 bg-white/90 backdrop-blur rounded-lg px-3 py-1.5 text-xs text-gray-500 shadow-sm border border-gray-200">
        <button
          onClick={() =>
            dispatch({ type: "SET_ZOOM", zoom: Math.max(0.1, zoom - 0.1) })
          }
          className="hover:text-gray-900 px-1"
        >
          -
        </button>
        <span className="w-12 text-center font-medium">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() =>
            dispatch({ type: "SET_ZOOM", zoom: Math.min(5, zoom + 0.1) })
          }
          className="hover:text-gray-900 px-1"
        >
          +
        </button>
      </div>

      <div
        data-canvas-grid="true"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: "0 0",
          width: "100%",
          height: "100%",
          position: "absolute",
          fontFamily: activeDS.fontFamily,
        }}
      >
        {nodes.map((node) => (
          <RenderNode
            key={node.id}
            node={node}
            selectedId={selectedId}
            isPanning={isPanning}
            onSelect={handleNodeSelect}
            onDragStart={handleNodeDragStart}
          />
        ))}
      </div>
    </div>
  );
}
