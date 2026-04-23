"use client";

import { useState, useMemo } from "react";
import { useCanvas, useCanvasDispatch, useFindNode } from "../store/context";
import { exportNodeAsViteProject, exportNodeAsHtml, previewNode, generateNodeCode } from "../utils/exportProject";
import { useDesignSystem } from "../design-systems/context";

export default function PropertiesPanel() {
  const { selectedId } = useCanvas();
  const findNode = useFindNode();
  const dispatch = useCanvasDispatch();
  const { activeDS } = useDesignSystem();
  const exportCfg = activeDS.exportConfig;

  if (!selectedId) {
    return (
      <div className="border-t border-gray-200 bg-white px-3 py-4">
        <p className="text-xs text-gray-400 text-center">
          Select a layer to view properties
        </p>
      </div>
    );
  }

  const node = findNode(selectedId);
  if (!node) return null;

  const styleEntries = Object.entries(node.style).filter(
    ([, v]) => v !== undefined && v !== null
  );

  return (
    <div className="border-t border-gray-200 bg-white">
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          Properties
        </span>
        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
          {node.type}
        </span>
      </div>

      {/* Name */}
      <div className="px-3 py-2 border-b border-gray-50">
        <label className="text-[10px] text-gray-400 uppercase tracking-wider">
          Name
        </label>
        <input
          value={node.name}
          onChange={(e) =>
            dispatch({ type: "RENAME_NODE", id: selectedId, name: e.target.value })
          }
          className="w-full text-xs mt-0.5 px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-blue-400"
        />
      </div>

      {/* Position & Size */}
      {node.style.position === "absolute" && (
        <div className="px-3 py-2 border-b border-gray-50">
          <label className="text-[10px] text-gray-400 uppercase tracking-wider">
            Position & Size
          </label>
          <div className="grid grid-cols-2 gap-1.5 mt-1">
            {(["left", "top", "width", "height"] as const).map((prop) => {
              const val = node.style[prop];
              return (
                <div key={prop} className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-400 w-5 uppercase">
                    {prop[0]}
                  </span>
                  <input
                    type="number"
                    value={val !== undefined ? (typeof val === "number" ? val : parseInt(String(val))) : ""}
                    placeholder="auto"
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_STYLE",
                        id: selectedId,
                        style: { [prop]: e.target.value ? Number(e.target.value) : undefined },
                      })
                    }
                    className="w-full text-[11px] px-1.5 py-0.5 border border-gray-200 rounded focus:outline-none focus:border-blue-400 placeholder:text-gray-300"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Preview & Export */}
      <div className="px-3 py-2 border-b border-gray-50 flex gap-1.5">
        <button
          onClick={() => previewNode(selectedId, exportCfg)}
          className="flex-1 text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Preview
        </button>
        <button
          onClick={() => exportNodeAsHtml(selectedId, node.name, exportCfg)}
          className="flex-1 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
          title="Download as a single HTML file — just double-click to open"
        >
          Share
        </button>
        <button
          onClick={() => exportNodeAsViteProject(node, exportCfg)}
          className="flex-1 text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors"
          title="Download as a Vite project (requires npm)"
        >
          Export
        </button>
      </div>

      {/* Code / Styles toggle */}
      <CodeView node={node} styleEntries={styleEntries} selectedId={selectedId} dispatch={dispatch} exportCfg={exportCfg} />
    </div>
  );
}

/* ── Style property classification ── */
const NUMBER_PROPS = new Set([
  "left", "top", "right", "bottom", "width", "height", "minWidth", "minHeight",
  "maxWidth", "maxHeight", "padding", "paddingTop", "paddingRight", "paddingBottom",
  "paddingLeft", "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
  "gap", "rowGap", "columnGap", "borderRadius", "fontSize", "lineHeight",
  "letterSpacing", "opacity", "zIndex", "flexGrow", "flexShrink", "order",
  "borderWidth",
]);

const COLOR_PROPS = new Set([
  "backgroundColor", "color", "borderColor", "outlineColor", "fill", "stroke",
]);

const SELECT_OPTIONS: Record<string, string[]> = {
  position: ["static", "relative", "absolute", "fixed", "sticky"],
  display: ["block", "flex", "grid", "inline", "inline-flex", "inline-block", "none"],
  flexDirection: ["row", "column", "row-reverse", "column-reverse"],
  alignItems: ["stretch", "flex-start", "center", "flex-end", "baseline"],
  justifyContent: ["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"],
  flexWrap: ["nowrap", "wrap", "wrap-reverse"],
  overflow: ["visible", "hidden", "scroll", "auto"],
  overflowX: ["visible", "hidden", "scroll", "auto"],
  overflowY: ["visible", "hidden", "scroll", "auto"],
  textAlign: ["left", "center", "right", "justify"],
  fontWeight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  whiteSpace: ["normal", "nowrap", "pre", "pre-wrap", "pre-line"],
  objectFit: ["contain", "cover", "fill", "none", "scale-down"],
  cursor: ["auto", "default", "pointer", "text", "move", "not-allowed", "grab"],
  boxSizing: ["content-box", "border-box"],
};

const inputClass =
  "w-full text-[10px] font-mono px-1.5 py-0.5 border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white";

function StyleInput({
  propKey,
  value,
  onChange,
}: {
  propKey: string;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const strVal = value === undefined || value === null ? "" : String(value);

  // Color properties → color picker + text
  if (COLOR_PROPS.has(propKey)) {
    return (
      <div className="flex items-center gap-1 w-[110px]">
        <input
          type="color"
          value={strVal.startsWith("#") ? strVal : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="w-5 h-5 p-0 border border-gray-200 rounded cursor-pointer shrink-0"
        />
        <input
          type="text"
          value={strVal}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={inputClass}
        />
      </div>
    );
  }

  // Select properties → dropdown
  if (SELECT_OPTIONS[propKey]) {
    return (
      <select
        value={strVal}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={`${inputClass} w-[110px] appearance-auto`}
      >
        <option value="">—</option>
        {SELECT_OPTIONS[propKey].map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  // Number properties → number input
  if (NUMBER_PROPS.has(propKey)) {
    const numVal = typeof value === "number" ? value : value ? parseFloat(String(value)) : "";
    return (
      <input
        type="number"
        value={isNaN(numVal as number) ? "" : numVal}
        placeholder="auto"
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        className={`${inputClass} w-[110px]`}
      />
    );
  }

  // Everything else → text input
  return (
    <input
      type="text"
      value={strVal}
      onChange={(e) => onChange(e.target.value || undefined)}
      className={`${inputClass} w-[110px]`}
    />
  );
}

function CodeView({
  node,
  styleEntries,
  selectedId,
  dispatch,
  exportCfg,
}: {
  node: import("../store/types").CanvasNode;
  styleEntries: [string, unknown][];
  selectedId: string;
  dispatch: ReturnType<typeof useCanvasDispatch>;
  exportCfg: import("../design-systems/types").ExportConfig;
}) {
  const [tab, setTab] = useState<"code" | "styles">("styles");
  const [copied, setCopied] = useState(false);
  const [newProp, setNewProp] = useState("");

  const code = useMemo(() => generateNodeCode(node, exportCfg), [node, exportCfg]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setTab("styles")}
          className={`flex-1 text-[10px] py-1.5 uppercase tracking-wider font-medium ${
            tab === "styles"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          Styles ({styleEntries.length})
        </button>
        <button
          onClick={() => setTab("code")}
          className={`flex-1 text-[10px] py-1.5 uppercase tracking-wider font-medium ${
            tab === "code"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          Code
        </button>
      </div>

      {tab === "code" ? (
        <div className="relative">
          <button
            onClick={handleCopy}
            className="absolute top-1.5 right-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors z-10"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <pre
            className="px-3 py-2 text-[10px] leading-relaxed font-mono bg-gray-900 overflow-auto max-h-60 whitespace-pre"
            dangerouslySetInnerHTML={{ __html: highlightJsx(code) }}
          />
        </div>
      ) : (
        <div className="px-3 py-2 max-h-60 overflow-y-auto">
          <div className="space-y-1">
            {styleEntries.map(([key, val]) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-gray-500 font-mono shrink-0">{key}</span>
                <StyleInput
                  propKey={key}
                  value={val}
                  onChange={(newVal) =>
                    dispatch({
                      type: "UPDATE_STYLE",
                      id: selectedId,
                      style: { [key]: newVal },
                    })
                  }
                />
              </div>
            ))}
          </div>

          {/* Add new property */}
          <div className="mt-2 pt-2 border-t border-gray-100">
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                const prop = newProp.trim();
                if (prop && node.style[prop as keyof React.CSSProperties] === undefined) {
                  dispatch({
                    type: "UPDATE_STYLE",
                    id: selectedId,
                    style: { [prop]: NUMBER_PROPS.has(prop) ? 0 : "" },
                  });
                  setNewProp("");
                }
              }}
            >
              <input
                type="text"
                value={newProp}
                onChange={(e) => setNewProp(e.target.value)}
                placeholder="+ add property"
                className="flex-1 text-[10px] font-mono px-1.5 py-0.5 border border-dashed border-gray-300 rounded focus:outline-none focus:border-blue-400 placeholder:text-gray-300"
              />
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function highlightJsx(code: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // Tokenize to avoid double-highlighting
  const tokens: { type: string; value: string }[] = [];
  const re = /(\"[^\"]*\"|'[^']*')|(\b(?:import|from|export|default|function|return|const|let)\b)|(<\/?[\w]+)|(\/>|>)|(\b\d+\.?\d*\b)|([\w]+(?==))|([{}()])|([^<>{}"'()\s\d]+|\s+)/g;

  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    if (m[1]) tokens.push({ type: "string", value: m[0] });
    else if (m[2]) tokens.push({ type: "keyword", value: m[0] });
    else if (m[3]) tokens.push({ type: "tag", value: m[0] });
    else if (m[4]) tokens.push({ type: "bracket", value: m[0] });
    else if (m[5]) tokens.push({ type: "number", value: m[0] });
    else if (m[6]) tokens.push({ type: "attr", value: m[0] });
    else if (m[7]) tokens.push({ type: "punct", value: m[0] });
    else tokens.push({ type: "plain", value: m[0] });
  }

  const colors: Record<string, string> = {
    string: "#a5d6ff",
    keyword: "#ff7b72",
    tag: "#7ee787",
    bracket: "#8b949e",
    number: "#79c0ff",
    attr: "#79c0ff",
    punct: "#8b949e",
    plain: "#e6edf3",
  };

  return tokens
    .map(({ type, value }) => {
      const escaped = esc(value);
      const color = colors[type];
      if (type === "tag") {
        // Split bracket from tag name: "<div" → "<" + "div"
        const bracketPart = escaped.startsWith("&lt;/") ? "&lt;/" : "&lt;";
        const namePart = escaped.slice(bracketPart.length);
        return `<span style="color:#8b949e">${bracketPart}</span><span style="color:#7ee787">${namePart}</span>`;
      }
      return `<span style="color:${color}">${escaped}</span>`;
    })
    .join("");
}
