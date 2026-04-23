"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useCanvas, useCanvasDispatch } from "../store/context";
import type { CanvasNode } from "../store/types";

const AUTO_SAVE_INTERVAL = 10_000; // 10 seconds
const DEVICE_ID_KEY = "design-canvas-device-id";

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2, 8);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function getAutoSaveName(): string {
  return `autosave-${getDeviceId()}`;
}

interface SaveEntry {
  name: string;
  updatedAt: string;
  size: number;
}

export default function SaveManager() {
  const { nodes } = useCanvas();
  const dispatch = useCanvasDispatch();
  const [saves, setSaves] = useState<SaveEntry[]>([]);
  const [showList, setShowList] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const prevNodesRef = useRef<string>("");
  const loadedRef = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showList) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowList(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showList]);

  const fetchSaves = useCallback(async () => {
    try {
      const res = await fetch("/api/saves");
      const data = await res.json();
      setSaves(data.saves || []);
    } catch {}
  }, []);

  const saveDesign = useCallback(async (name: string, nodesToSave?: CanvasNode[]) => {
    setSaving(true);
    try {
      const res = await fetch("/api/saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, nodes: nodesToSave || nodes }),
      });
      const data = await res.json();
      if (data.ok) {
        setLastSaved(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        setDirty(false);
        fetchSaves();
      }
    } catch {} finally {
      setSaving(false);
    }
  }, [nodes, fetchSaves]);

  const loadDesign = useCallback(async (name: string) => {
    try {
      const res = await fetch(`/api/saves?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data.nodes) {
        dispatch({ type: "LOAD_STATE", nodes: data.nodes as CanvasNode[] });
        setShowList(false);
        setLastSaved(null);
      }
    } catch {}
  }, [dispatch]);

  const deleteDesign = useCallback(async (name: string) => {
    try {
      await fetch(`/api/saves?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      fetchSaves();
    } catch {}
  }, [fetchSaves]);

  const handleManualSave = () => {
    const name = saveName.trim() || `design-${Date.now()}`;
    saveDesign(name.replace(/[^a-zA-Z0-9_-]/g, "-"));
    setSaveName("");
  };

  // Track dirty state when nodes change
  useEffect(() => {
    if (!loadedRef.current) return;
    const current = JSON.stringify(nodes);
    if (current !== prevNodesRef.current) {
      setDirty(true);
      prevNodesRef.current = current;
    }
  }, [nodes]);

  // Auto-save every 30s if nodes changed
  useEffect(() => {
    const interval = setInterval(() => {
      if (dirty && nodes.length > 0) {
        saveDesign(getAutoSaveName());
      }
    }, AUTO_SAVE_INTERVAL);
    return () => clearInterval(interval);
  }, [dirty, nodes, saveDesign]);

  // Load autosave on mount
  useEffect(() => {
    const autoName = getAutoSaveName();
    fetch(`/api/saves?name=${encodeURIComponent(autoName)}`)
      .then((r) => { if (r.ok) return r.json(); throw new Error(); })
      .then((data) => {
        if (data.nodes?.length) {
          dispatch({ type: "LOAD_STATE", nodes: data.nodes as CanvasNode[] });
          prevNodesRef.current = JSON.stringify(data.nodes);
          setLastSaved("restored");
        }
      })
      .catch(() => {
        prevNodesRef.current = JSON.stringify(nodes);
      })
      .finally(() => {
        loadedRef.current = true;
      });
    fetchSaves();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Save on page hide (tab close / navigate away)
  useEffect(() => {
    const handler = () => {
      if (dirty && nodes.length > 0) {
        const body = JSON.stringify({ name: getAutoSaveName(), nodes });
        navigator.sendBeacon("/api/saves", new Blob([body], { type: "application/json" }));
      }
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") handler();
    });
    return () => document.removeEventListener("visibilitychange", handler);
  }, [dirty, nodes]);

  // Export as JSON file download
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ nodes }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `design-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import from JSON file
  const importJson = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        const loadedNodes = data.nodes || data;
        if (Array.isArray(loadedNodes)) {
          dispatch({ type: "LOAD_STATE", nodes: loadedNodes as CanvasNode[] });
        }
      } catch {}
    };
    input.click();
  };

  return (
    <div style={{ padding: "6px 8px", borderBottom: "1px solid #e5e7eb" }} ref={dropdownRef}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {/* Save button */}
        <button
          onClick={handleManualSave}
          disabled={saving}
          title="Save"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26, borderRadius: 6, border: "1px solid #e5e7eb",
            background: saving ? "#f3f4f6" : "#fff", cursor: "pointer", flexShrink: 0,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M13 15H3a2 2 0 01-2-2V3a2 2 0 012-2h7l4 4v8a2 2 0 01-2 2z" stroke="#6b7280" strokeWidth="1.4" fill="none"/>
            <path d="M11 15V9H5v6M5 1v4h5" stroke="#6b7280" strokeWidth="1.4" fill="none"/>
          </svg>
        </button>

        {/* Save name input */}
        <input
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleManualSave()}
          placeholder="save name..."
          style={{
            flex: 1, fontSize: 11, padding: "4px 6px", border: "1px solid #e5e7eb",
            borderRadius: 6, outline: "none", minWidth: 0, background: "#fafafa",
          }}
        />

        {/* Load dropdown button */}
        <button
          onClick={() => { setShowList(!showList); if (!showList) fetchSaves(); }}
          title="Load"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26, borderRadius: 6, border: "1px solid #e5e7eb",
            background: showList ? "#f3f4f6" : "#fff", cursor: "pointer", flexShrink: 0,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M1 4h14M1 4v9a2 2 0 002 2h10a2 2 0 002-2V4M1 4l2-3h10l2 3" stroke="#6b7280" strokeWidth="1.4" fill="none"/>
            <path d="M6 8l2 2 2-2" stroke="#6b7280" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
        </button>

        {/* Export JSON */}
        <button
          onClick={exportJson}
          title="Export JSON"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26, borderRadius: 6, border: "1px solid #e5e7eb",
            background: "#fff", cursor: "pointer", flexShrink: 0,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v8M5 7l3 3 3-3" stroke="#6b7280" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 11v2a2 2 0 002 2h8a2 2 0 002-2v-2" stroke="#6b7280" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Import JSON */}
        <button
          onClick={importJson}
          title="Import JSON"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26, borderRadius: 6, border: "1px solid #e5e7eb",
            background: "#fff", cursor: "pointer", flexShrink: 0,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M8 10V2M5 5l3-3 3 3" stroke="#6b7280" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 11v2a2 2 0 002 2h8a2 2 0 002-2v-2" stroke="#6b7280" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Last saved indicator */}
      {lastSaved && (
        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3, paddingLeft: 2 }}>
          Saved at {lastSaved}
        </div>
      )}

      {/* Save list dropdown */}
      {showList && (
        <div style={{
          marginTop: 6, border: "1px solid #e5e7eb", borderRadius: 8,
          background: "#fff", maxHeight: 200, overflowY: "auto",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        }}>
          {saves.length === 0 ? (
            <div style={{ padding: "12px 10px", fontSize: 11, color: "#9ca3af", textAlign: "center" }}>
              No saved designs
            </div>
          ) : saves.map((s) => (
            <div
              key={s.name}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "7px 10px", borderBottom: "1px solid #f3f4f6",
                cursor: "pointer", fontSize: 11,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              <div
                style={{ flex: 1, minWidth: 0 }}
                onClick={() => loadDesign(s.name)}
              >
                <div style={{ fontWeight: 500, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.name}
                  {s.name.startsWith("autosave-") && (
                    <span style={{ color: "#9ca3af", fontWeight: 400 }}> (auto)</span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>
                  {new Date(s.updatedAt).toLocaleString("ko-KR")}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteDesign(s.name); }}
                title="Delete"
                style={{
                  width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center",
                  background: "none", border: "none", cursor: "pointer", color: "#d1d5db",
                  borderRadius: 4, flexShrink: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#d1d5db")}
              >
                <svg width="10" height="10" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 1.5L6.5 6.5M6.5 1.5L1.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
