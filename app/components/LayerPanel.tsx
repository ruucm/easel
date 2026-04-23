"use client";

import { useState, useRef, useEffect } from "react";
import { useCanvas, useCanvasDispatch } from "../store/context";
import type { CanvasNode } from "../store/types";

const typeIcons: Record<string, string> = {
  Frame: "[ ]",
  Text: "T",
  Button: "[B]",
  Input: "[_]",
  Image: "img",
  Card: "[ ]",
};

function LayerItem({
  node,
  depth,
  selectedId,
}: {
  node: CanvasNode;
  depth: number;
  selectedId: string | null;
}) {
  const dispatch = useCanvasDispatch();
  const [expanded, setExpanded] = useState(true);
  const isSelected = selectedId === node.id;
  const hasChildren = (node.children ?? []).length > 0;
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSelected && itemRef.current) {
      itemRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isSelected]);

  return (
    <div>
      <div
        ref={itemRef}
        onClick={(e) => {
          e.stopPropagation();
          dispatch({ type: "SELECT", id: node.id });
        }}
        className="flex items-center gap-1 py-1 px-2 text-xs cursor-pointer transition-colors group"
        style={{
          paddingLeft: depth * 16 + 8,
          backgroundColor: isSelected ? "#eff6ff" : "transparent",
          color: isSelected ? "#1d4ed8" : "#374151",
          borderLeft: isSelected ? "2px solid #3b82f6" : "2px solid transparent",
        }}
      >
        {/* Expand toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="w-4 h-4 flex items-center justify-center text-[10px] text-gray-400 hover:text-gray-700 flex-shrink-0"
        >
          {hasChildren ? (expanded ? "▼" : "▶") : ""}
        </button>

        {/* Type icon */}
        <span
          className="w-5 text-center flex-shrink-0 font-mono text-[10px]"
          style={{ color: isSelected ? "#3b82f6" : "#9ca3af" }}
        >
          {typeIcons[node.type] || "?"}
        </span>

        {/* Name */}
        <span
          className="truncate flex-1 font-medium"
          style={{ fontSize: 11 }}
        >
          {node.name}
        </span>

        {/* Type badge */}
        <span
          className="text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            backgroundColor: isSelected ? "#dbeafe" : "#f3f4f6",
            color: isSelected ? "#1d4ed8" : "#6b7280",
          }}
        >
          {node.type}
        </span>
      </div>

      {/* Children */}
      {expanded &&
        hasChildren &&
        (node.children ?? []).map((child) => (
          <LayerItem
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
          />
        ))}
    </div>
  );
}

export default function LayerPanel() {
  const { nodes, selectedId } = useCanvas();
  const dispatch = useCanvasDispatch();

  return (
    <div
      className="flex flex-col h-full bg-white"
      onClick={() => dispatch({ type: "SELECT", id: null })}
    >
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-[10px] text-gray-400">{nodes.length} root</span>
      </div>

      {/* Layer tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {nodes.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-gray-400">
            No layers yet. Add components from the library.
          </div>
        ) : (
          nodes.map((node) => (
            <LayerItem
              key={node.id}
              node={node}
              depth={0}
              selectedId={selectedId}
            />
          ))
        )}
      </div>
    </div>
  );
}
