"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useCanvas, useCanvasDispatch, useFindNode } from "../store/context";
import type { CanvasNode } from "../store/types";
import { useDesignSystem } from "../design-systems/context";

interface Message {
  role: "user" | "assistant" | "system";
  text: string;
}

interface MetaInfo {
  model: string;
  modelSource: string;
  tokenSource: string;
  tokenPreview: string;
}



const TOKEN_LABELS: Record<string, string> = {
  env: "env",
  keychain: "keychain",
  "credentials-file": "file",
};

export default function BottomBar() {
  const { selectedId, zoom, panX, panY } = useCanvas();
  const findNode = useFindNode();
  const dispatch = useCanvasDispatch();
  const { activeDS, activeDSId } = useDesignSystem();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamText, setStreamText] = useState("");
  const [meta, setMeta] = useState<MetaInfo | null>(null);
  const [guideContent, setGuideContent] = useState<string>("");
  const [showGuideEditor, setShowGuideEditor] = useState(false);
  const [editingGuide, setEditingGuide] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevSelectedId = useRef<string | null>(null);

  useEffect(() => {
    fetch("/api/ai-edit")
      .then((r) => r.json())
      .then((d) => d.model && setMeta(d))
      .catch(() => {});
  }, []);

  // Load guide file when DS changes
  useEffect(() => {
    if (!activeDSId) return;
    fetch(`/api/guides?dsId=${activeDSId}`)
      .then((r) => r.json())
      .then((d) => setGuideContent(d.content || ""))
      .catch(() => setGuideContent(""));
  }, [activeDSId]);

  const node = selectedId ? findNode(selectedId) : null;
  const isCreateMode = !selectedId;

  useEffect(() => {
    if (selectedId !== prevSelectedId.current) {
      prevSelectedId.current = selectedId;
      setMessages([]);
      setStreamText("");
    }
  }, [selectedId]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, streamText]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 100) + "px";
  }, [prompt]);

  /** Calculate canvas center coordinates for placing new nodes */
  const getCanvasCenter = useCallback(() => {
    const parent = containerRef.current?.parentElement;
    if (!parent) return { x: 200, y: 200 };
    const rect = parent.getBoundingClientRect();
    const cx = (rect.width / 2 - panX) / zoom;
    const cy = (rect.height / 2 - panY) / zoom;
    return { x: Math.round(cx), y: Math.round(cy) };
  }, [zoom, panX, panY]);

  const parseResponse = useCallback((fullText: string) => {
    const sep = fullText.indexOf("---JSON---");
    let explanation = "";
    let jsonStr = fullText;
    if (sep !== -1) {
      explanation = fullText.slice(0, sep).trim();
      jsonStr = fullText.slice(sep + 10).trim();
    }
    if (jsonStr.startsWith("```")) jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    return { explanation, jsonStr };
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim() || loading) return;

    const userPrompt = prompt.trim();
    setPrompt("");
    setLoading(true);
    setStreamText("");
    setMessages((prev) => [...prev, { role: "user", text: userPrompt }]);

    // Build request body
    const body: Record<string, unknown> = { prompt: userPrompt, dsId: activeDSId };
    if (guideContent) body.designGuide = guideContent;
    if (isCreateMode) {
      body.mode = "create";
    } else {
      const targetNode = findNode(selectedId!);
      if (!targetNode) { setLoading(false); return; }
      body.node = targetNode;
      body.mode = "edit";
    }

    try {
      const res = await fetch("/api/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages((p) => [...p, { role: "system", text: err.error || res.statusText }]);
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setLoading(false); return; }

      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "meta") {
              setMeta(ev);
            } else if (ev.type === "delta") {
              fullText += ev.text;
              setStreamText(fullText);
            } else if (ev.type === "error") {
              setMessages((p) => [...p, { role: "system", text: ev.text }]);
            } else if (ev.type === "done") {
              const { explanation, jsonStr } = parseResponse(fullText);
              if (explanation) setMessages((p) => [...p, { role: "assistant", text: explanation }]);

              const repairJSON = (str: string): string => {
                let s = str.trim();
                // Count open/close braces and brackets
                let braces = 0, brackets = 0;
                let inString = false, escape = false;
                for (let i = 0; i < s.length; i++) {
                  const c = s[i];
                  if (escape) { escape = false; continue; }
                  if (c === '\\') { escape = true; continue; }
                  if (c === '"') { inString = !inString; continue; }
                  if (inString) continue;
                  if (c === '{') braces++;
                  else if (c === '}') braces--;
                  else if (c === '[') brackets++;
                  else if (c === ']') brackets--;
                }
                // Remove trailing comma or incomplete key/value
                s = s.replace(/,\s*$/, "");
                // Close unclosed strings (if odd number of unescaped quotes)
                let quoteCount = 0;
                escape = false;
                for (let i = 0; i < s.length; i++) {
                  if (escape) { escape = false; continue; }
                  if (s[i] === '\\') { escape = true; continue; }
                  if (s[i] === '"') quoteCount++;
                }
                if (quoteCount % 2 !== 0) s += '"';
                // Remove trailing incomplete key-value like `"key":` or `"key`
                s = s.replace(/,?\s*"[^"]*":\s*$/, "");
                s = s.replace(/,?\s*"[^"]*$/, "");
                // Append missing closing brackets and braces
                while (brackets > 0) { s += "]"; brackets--; }
                while (braces > 0) { s += "}"; braces--; }
                return s;
              };

              const tryParse = (str: string): CanvasNode | null => {
                try { return JSON.parse(str); } catch { return null; }
              };

              const raw = fullText.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
              const parsed = tryParse(jsonStr) || tryParse(raw) || tryParse(repairJSON(jsonStr)) || tryParse(repairJSON(raw));

              if (parsed) {
                if (isCreateMode) {
                  // Place at canvas center
                  const center = getCanvasCenter();
                  const newNode: CanvasNode = {
                    ...parsed,
                    style: {
                      ...parsed.style,
                      position: "absolute",
                      left: center.x - ((parsed.style?.width as number) || 200) / 2,
                      top: center.y - 100,
                    },
                  };
                  dispatch({ type: "ADD_NODE", node: newNode });
                  setMessages((p) => [...p, { role: "system", text: "Design created" }]);
                } else {
                  dispatch({ type: "UPDATE_NODE", id: selectedId!, node: parsed });
                  setMessages((p) => [...p, { role: "system", text: "Changes applied" }]);
                }
              } else {
                const isTruncated = jsonStr.length > 0 && !jsonStr.trimEnd().endsWith("}");
                const errorMsg = isTruncated
                  ? "Response too long — JSON was truncated. Try a simpler request."
                  : "Failed to parse response";
                setMessages((p) => [...p, { role: "assistant", text: fullText }, { role: "system", text: errorMsg }]);
              }
              setStreamText("");
            }
          } catch {}
        }
      }
    } catch (err) {
      setMessages((p) => [...p, { role: "system", text: `Error: ${err instanceof Error ? err.message : String(err)}` }]);
    } finally {
      setLoading(false);
    }
  }, [prompt, loading, selectedId, isCreateMode, findNode, dispatch, getCanvasCenter, parseResponse, activeDSId]);

  const handleDeselect = () => {
    dispatch({ type: "SELECT", id: null });
  };

  const hasActivity = messages.length > 0 || streamText;

  return (
    <div
      ref={containerRef}
      suppressHydrationWarning
      style={{
        position: "absolute",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20,
        width: "100%",
        maxWidth: 520,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderRadius: 16,
          border: "1px solid #e2e5e9",
          boxShadow: "0 2px 16px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.02)",
          padding: "14px 16px 10px",
        }}
      >
        {/* Activity log */}
        {hasActivity && (
          <div
            ref={logRef}
            style={{
              maxHeight: 100,
              overflowY: "auto",
              marginBottom: 10,
              paddingBottom: 10,
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            {messages.map((msg, i) => (
              <div key={i} style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 2 }}>
                <span style={{
                  color: msg.role === "user" ? "#374151" : msg.role === "assistant" ? "#4b5563" : "#9ca3af",
                  fontWeight: msg.role === "user" ? 500 : 400,
                }}>
                  {msg.text}
                </span>
              </div>
            ))}
            {streamText && (
              <div style={{ fontSize: 12, lineHeight: 1.5, color: "#4b5563" }}>
                {streamText.includes("---JSON---")
                  ? streamText.slice(0, streamText.indexOf("---JSON---"))
                  : streamText}
                <span style={{
                  display: "inline-block",
                  width: 4,
                  height: 12,
                  background: "#9ca3af",
                  marginLeft: 2,
                  borderRadius: 1,
                  verticalAlign: "text-bottom",
                  animation: "pulse 1s infinite",
                }} />
              </div>
            )}
          </div>
        )}

        {/* Selected layer chip */}
        {node && (
          <div style={{ marginBottom: 8 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "#f4f5f7",
                borderRadius: 8,
                padding: "4px 10px 4px 6px",
                border: "1px solid #e8eaed",
                maxWidth: 260,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  background: "#e8eaed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="#8b8f96" strokeWidth="1.2" />
                  <rect x="3" y="3" width="2.5" height="2.5" rx="0.5" fill="#8b8f96" opacity="0.5" />
                  <rect x="3" y="7" width="6" height="1" rx="0.5" fill="#8b8f96" opacity="0.35" />
                </svg>
              </div>
              <span style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#3c4149",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {node.name}
              </span>
              <button
                onClick={handleDeselect}
                style={{
                  flexShrink: 0,
                  width: 16,
                  height: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#8b8f96",
                  padding: 0,
                  borderRadius: 4,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#3c4149")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#8b8f96")}
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 1.5L6.5 6.5M6.5 1.5L1.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={isCreateMode
            ? `Create with ${activeDS.name}...`
            : `Edit with ${activeDS.name}...`}
          disabled={loading}
          rows={1}
          style={{
            width: "100%",
            fontSize: 14,
            lineHeight: "20px",
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            color: "#1a1d21",
            minHeight: 20,
            maxHeight: 100,
            fontFamily: "inherit",
            padding: "0 2px",
            opacity: loading ? 0.5 : 1,
          }}
        />

        {/* Bottom row: design picker + meta + send */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Active design system indicator */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: `${activeDS.accentColor}10`,
                borderRadius: 5,
                padding: "2px 7px",
                border: `1px solid ${activeDS.accentColor}30`,
                fontSize: 10,
                fontWeight: 500,
                color: activeDS.accentColor,
                userSelect: "none",
              }}
            >
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: activeDS.accentColor }} />
              {activeDS.name}
            </div>

            {/* Guide edit button */}
            <button
              onClick={() => {
                setEditingGuide(guideContent);
                setShowGuideEditor(true);
              }}
              title="Design Guide"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                padding: "2px 7px",
                borderRadius: 5,
                border: "1px solid #e5e7eb",
                background: "#f9fafb",
                cursor: "pointer",
                fontSize: 10,
                fontWeight: 500,
                color: "#6b7280",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 1h6a1 1 0 011 1v6a1 1 0 01-1 1H2a1 1 0 01-1-1V2a1 1 0 011-1z" stroke="currentColor" strokeWidth="0.9" />
                <path d="M3 3.5h4M3 5.5h3M3 7.5h2" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" />
              </svg>
              Guide
            </button>

            {/* Meta info */}
            {meta ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 10,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  color: "#b0b5bc",
                  userSelect: "none",
                }}
                title={`${meta.model} | token: ${meta.tokenPreview} (${meta.tokenSource})`}
              >
                <span style={{ color: "#8b8f96" }}>
                  {meta.model.replace("claude-", "").replace(/-\d{8}$/, "").replace(/-0$/, "")}
                </span>
                <span style={{ color: "#d1d5db" }}>|</span>
                <span>{TOKEN_LABELS[meta.tokenSource] || meta.tokenSource}</span>
                <span style={{ maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {meta.tokenPreview}
                </span>
              </div>
            ) : (
              <div />
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading || !prompt.trim()}
            style={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 7,
              border: "none",
              background: !prompt.trim() ? "#e5e7eb" : "#1a1d21",
              cursor: (loading || !prompt.trim()) ? "default" : "pointer",
              color: !prompt.trim() ? "#9ca3af" : "#fff",
              padding: 0,
              opacity: loading ? 0.6 : 1,
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {loading ? (
              <svg width="14" height="14" viewBox="0 0 14 14" style={{ animation: "spin 0.8s linear infinite" }}>
                <circle cx="7" cy="7" r="5.5" stroke="#666" strokeWidth="1.5" fill="none" strokeDasharray="20 12" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 11V3M3.5 6.5L7 3L10.5 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Guide editor modal */}
      {showGuideEditor && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowGuideEditor(false); }}
        >
          <div style={{
            width: 560,
            maxHeight: "80vh",
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                  Design Guide
                </span>
                <span style={{
                  fontSize: 11,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: `${activeDS.accentColor}15`,
                  color: activeDS.accentColor,
                  fontWeight: 500,
                }}>
                  {activeDS.name}
                </span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>
                  guides/{activeDSId}.md
                </span>
              </div>
              <button
                onClick={() => setShowGuideEditor(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 4 }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div style={{ padding: "12px 20px", flex: 1, minHeight: 0 }}>
              <textarea
                value={editingGuide}
                onChange={(e) => setEditingGuide(e.target.value)}
                style={{
                  width: "100%",
                  height: 360,
                  fontSize: 12,
                  lineHeight: 1.7,
                  padding: "12px 14px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  color: "#111827",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{
              padding: "12px 20px 16px",
              borderTop: "1px solid #f0f0f0",
              display: "flex",
              justifyContent: "space-between",
            }}>
              <button
                onClick={() => {
                  // Reset to default from file (re-fetch)
                  fetch(`/api/guides?dsId=${activeDSId}`)
                    .then((r) => r.json())
                    .then((d) => setEditingGuide(d.content || ""));
                }}
                style={{
                  padding: "7px 12px",
                  fontSize: 12,
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  cursor: "pointer",
                  color: "#6b7280",
                }}
              >
                Reload from file
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setShowGuideEditor(false)}
                  style={{
                    padding: "7px 16px",
                    fontSize: 13,
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                    cursor: "pointer",
                    color: "#374151",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    fetch("/api/guides", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ dsId: activeDSId, content: editingGuide }),
                    }).then(() => {
                      setGuideContent(editingGuide);
                      setShowGuideEditor(false);
                    });
                  }}
                  style={{
                    padding: "7px 16px",
                    fontSize: 13,
                    fontWeight: 500,
                    borderRadius: 6,
                    border: "none",
                    background: "#6366f1",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}
