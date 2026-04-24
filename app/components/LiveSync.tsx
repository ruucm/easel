"use client";

import { useEffect, useRef, useState } from "react";
import { useCanvas, useCanvasDispatch } from "../store/context";
import { useDesignSystem } from "../design-systems/context";
import type { CanvasNode } from "../store/types";

/**
 * Keeps saves/_live.json in sync with the current canvas so external tools
 * (e.g. the MCP server) can read and drive the canvas in real time.
 *
 * - On local edits: debounced write to /api/scene
 * - On external edits: /api/scene/watch SSE fires -> refetch + LOAD_STATE
 * - Echo suppression via content hash comparison
 *
 * This component intentionally does NOT restore the scene file on mount —
 * SaveManager already handles session restoration via its own autosave.
 * LiveSync's job is to mirror the current session into _live.json so MCP
 * always sees what the user sees.
 */
export default function LiveSync() {
  const { nodes } = useCanvas();
  const dispatch = useCanvasDispatch();
  const { activeDSId, setActiveDSId } = useDesignSystem();

  // Hashes used to avoid echo-loops between writes and SSE-triggered reads.
  const lastWrittenHashRef = useRef<string | null>(null);
  const lastAppliedHashRef = useRef<string | null>(null);
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [externalAt, setExternalAt] = useState<string | null>(null);

  // Debounced write on local changes.
  useEffect(() => {
    const serialized = JSON.stringify({ dsId: activeDSId, nodes });
    if (serialized === lastWrittenHashRef.current) return;
    if (serialized === lastAppliedHashRef.current) return;

    if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    writeTimerRef.current = setTimeout(() => {
      lastWrittenHashRef.current = serialized;
      fetch("/api/scene", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dsId: activeDSId, nodes }),
      }).catch(() => {
        // If the write fails we'll try again on the next change.
      });
    }, 400);

    return () => {
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    };
  }, [nodes, activeDSId]);

  // Subscribe to external changes.
  useEffect(() => {
    const es = new EventSource("/api/scene/watch");
    es.onmessage = async (ev) => {
      let msg: { type?: string; updatedAt?: string } | null = null;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (!msg || msg.type !== "change") return;

      try {
        const r = await fetch("/api/scene");
        const data = (await r.json()) as {
          dsId: string | null;
          nodes: CanvasNode[];
          updatedAt: string | null;
        };
        const serialized = JSON.stringify({ dsId: data.dsId, nodes: data.nodes });
        if (serialized === lastWrittenHashRef.current) return; // our own write echo
        if (serialized === lastAppliedHashRef.current) return; // already applied

        lastAppliedHashRef.current = serialized;
        lastWrittenHashRef.current = serialized;
        dispatch({ type: "LOAD_STATE", nodes: data.nodes });
        if (data.dsId && data.dsId !== activeDSId) {
          setActiveDSId(data.dsId);
        }
        if (data.updatedAt) setExternalAt(data.updatedAt);
      } catch {}
    };
    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do.
    };
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!externalAt) return null;
  const time = new Date(externalAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return (
    <div
      style={{
        position: "fixed",
        bottom: 60,
        right: 16,
        background: "rgba(17,24,39,0.88)",
        color: "#e5e7eb",
        fontSize: 10,
        fontWeight: 500,
        padding: "4px 8px",
        borderRadius: 6,
        pointerEvents: "none",
        zIndex: 40,
        letterSpacing: 0.2,
      }}
    >
      MCP sync · {time}
    </div>
  );
}
