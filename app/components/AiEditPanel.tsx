"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useCanvas, useCanvasDispatch, useFindNode } from "../store/context";

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

export default function AiEditPanel() {
  const { selectedId } = useCanvas();
  const findNode = useFindNode();
  const dispatch = useCanvasDispatch();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamText, setStreamText] = useState("");
  const [meta, setMeta] = useState<MetaInfo | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const prevSelectedId = useRef<string | null>(null);

  useEffect(() => {
    fetch("/api/ai-edit")
      .then((r) => r.json())
      .then((d) => d.model && setMeta(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, streamText]);

  useEffect(() => {
    if (selectedId !== prevSelectedId.current) {
      prevSelectedId.current = selectedId;
      setMessages([]);
      setStreamText("");
      setPrompt("");
    }
  }, [selectedId]);

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim() || loading || !selectedId) return;
    const node = findNode(selectedId);
    if (!node) return;

    const userPrompt = prompt.trim();
    setPrompt("");
    setLoading(true);
    setStreamText("");
    setMessages((prev) => [...prev, { role: "user", text: userPrompt }]);

    try {
      const res = await fetch("/api/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node, prompt: userPrompt }),
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
            if (ev.type === "meta") setMeta(ev);
            else if (ev.type === "delta") { fullText += ev.text; setStreamText(fullText); }
            else if (ev.type === "error") setMessages((p) => [...p, { role: "system", text: ev.text }]);
            else if (ev.type === "done") {
              const sep = fullText.indexOf("---JSON---");
              let explanation = "";
              let jsonStr = fullText;
              if (sep !== -1) { explanation = fullText.slice(0, sep).trim(); jsonStr = fullText.slice(sep + 10).trim(); }
              if (jsonStr.startsWith("```")) jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
              if (explanation) setMessages((p) => [...p, { role: "assistant", text: explanation }]);

              try {
                const updated = JSON.parse(jsonStr);
                dispatch({ type: "UPDATE_NODE", id: selectedId, node: updated });
                setMessages((p) => [...p, { role: "system", text: "Changes applied" }]);
              } catch {
                try {
                  let fb = fullText.trim();
                  if (fb.startsWith("```")) fb = fb.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
                  dispatch({ type: "UPDATE_NODE", id: selectedId, node: JSON.parse(fb) });
                  setMessages((p) => [...p, { role: "system", text: "Changes applied" }]);
                } catch {
                  setMessages((p) => [...p, { role: "assistant", text: fullText }, { role: "system", text: "Failed to parse response" }]);
                }
              }
              setStreamText("");
            }
          } catch {}
        }
      }
    } catch (err) {
      setMessages((p) => [...p, { role: "system", text: `Network error: ${err instanceof Error ? err.message : String(err)}` }]);
    } finally {
      setLoading(false);
    }
  }, [prompt, loading, selectedId, findNode, dispatch]);

  if (!selectedId) return null;
  const node = findNode(selectedId);
  if (!node) return null;

  const hasLog = messages.length > 0 || streamText;
  const modelShort = meta?.model.replace("claude-", "").replace(/-\d{8}$/, "").replace(/-0$/, "") || null;

  return (
    <div className="border-t border-gray-200 bg-white flex flex-col" style={{ maxHeight: 400 }}>
      {/* Header */}
      <div className="px-3 py-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              AI Edit
            </span>
            <span className="text-[10px] text-gray-400">/</span>
            <span className="text-[10px] text-gray-600 font-medium truncate max-w-[90px]">
              {node.name}
            </span>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); setStreamText(""); }}
              className="text-[9px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              clear
            </button>
          )}
        </div>

        {/* Meta bar */}
        {meta && (
          <div
            className="flex items-center gap-1 mt-1.5 text-[9px] font-mono text-gray-400"
            title={`${meta.model} | token: ${meta.tokenPreview} (${meta.tokenSource})`}
          >
            <span className="text-gray-600">{modelShort}</span>
            {meta.modelSource !== "default" && (
              <span className="text-gray-300">({meta.modelSource})</span>
            )}
            <span className="text-gray-300 mx-0.5">|</span>
            <span className="text-gray-400">
              {TOKEN_LABELS[meta.tokenSource] || meta.tokenSource}
            </span>
            <span className="text-gray-300 truncate max-w-[80px]">
              {meta.tokenPreview}
            </span>
          </div>
        )}
      </div>

      {/* Conversation Log */}
      {hasLog && (
        <div
          ref={logRef}
          className="flex-1 overflow-y-auto px-3 pb-2 space-y-1 min-h-0"
          style={{ maxHeight: 180 }}
        >
          {messages.map((msg, i) => (
            <div key={i} className="flex gap-1.5 items-start">
              <span
                className="text-[9px] font-medium uppercase flex-shrink-0 mt-px w-6 text-right"
                style={{
                  color: msg.role === "user" ? "#8b5cf6" : msg.role === "assistant" ? "#10b981" : "#d1d5db",
                }}
              >
                {msg.role === "user" ? "you" : msg.role === "assistant" ? "ai" : "sys"}
              </span>
              <span
                className="text-[11px] leading-snug break-words min-w-0"
                style={{
                  color: msg.role === "system"
                    ? (msg.text.startsWith("Error") || msg.text.startsWith("Failed") || msg.text.startsWith("Network") ? "#f87171" : "#9ca3af")
                    : msg.role === "assistant" ? "#374151" : "#374151",
                }}
              >
                {msg.text}
              </span>
            </div>
          ))}

          {streamText && (
            <div className="flex gap-1.5 items-start">
              <span className="text-[9px] font-medium uppercase flex-shrink-0 mt-px w-6 text-right text-emerald-500">
                ai
              </span>
              <span className="text-[11px] leading-snug text-gray-700 break-words min-w-0">
                {streamText.includes("---JSON---")
                  ? streamText.slice(0, streamText.indexOf("---JSON---"))
                  : streamText}
                <span className="inline-block w-1 h-3 bg-gray-400 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
              </span>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-2 flex-shrink-0">
        <div className="flex gap-1.5">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSubmit(); } }}
            placeholder="Describe changes..."
            disabled={loading}
            rows={1}
            className="flex-1 text-[11px] px-2 py-1.5 border border-gray-200 rounded-md resize-none focus:outline-none focus:border-gray-400 placeholder:text-gray-300 disabled:opacity-50"
            style={{ minHeight: 32, maxHeight: 64 }}
          />
          <button
            onClick={handleSubmit}
            disabled={!prompt.trim() || loading}
            className="px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all disabled:opacity-30"
            style={{
              backgroundColor: loading ? "#f3f4f6" : "#111827",
              color: loading ? "#9ca3af" : "#ffffff",
            }}
          >
            {loading ? (
              <span className="inline-block w-3 h-3 border-[1.5px] border-gray-300 border-t-gray-500 rounded-full animate-spin" />
            ) : (
              "Go"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
