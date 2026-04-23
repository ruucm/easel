"use client";

import React from "react";
import type { DesignSystemAdapter, ComponentTemplate } from "./types";
import type { CanvasNode } from "../store/types";
import { registerDesignSystem } from "./registry";

// ── Component renderer ──────────────────────────────────────────────

function renderComponent(node: CanvasNode): React.ReactNode {
  const props = node.componentProps || {};
  const p = props as Record<string, any>;

  switch (node.type) {
    case "HtmlButton":
      return (
        <button
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            background: p.variant === "primary" ? "#2563eb" : p.variant === "danger" ? "#dc2626" : "#ffffff",
            color: p.variant === "primary" || p.variant === "danger" ? "#ffffff" : "#111827",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            ...((p.disabled && { opacity: 0.5 }) || {}),
          }}
          disabled={p.disabled}
        >
          {p.label || "Button"}
        </button>
      );

    case "HtmlInput":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {p.label && <label style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{p.label}</label>}
          <input
            type={p.inputType || "text"}
            placeholder={p.placeholder || ""}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: 14,
              outline: "none",
              width: "100%",
              boxSizing: "border-box",
            }}
            readOnly
          />
          {p.helperText && <span style={{ fontSize: 12, color: "#6b7280" }}>{p.helperText}</span>}
        </div>
      );

    case "HtmlTextarea":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {p.label && <label style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{p.label}</label>}
          <textarea
            placeholder={p.placeholder || ""}
            rows={p.rows || 3}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: 14,
              outline: "none",
              resize: "vertical",
              width: "100%",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
            readOnly
          />
        </div>
      );

    case "HtmlSelect":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {p.label && <label style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{p.label}</label>}
          <select
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: 14,
              background: "#fff",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {(p.options || [{ label: "Option 1", value: "1" }, { label: "Option 2", value: "2" }]).map((opt: any, i: number) => (
              <option key={i} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      );

    case "HtmlCheckbox":
      return (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#374151", cursor: "pointer" }}>
          <input type="checkbox" checked={p.checked || false} readOnly style={{ width: 16, height: 16, accentColor: "#2563eb" }} />
          {p.label || "Checkbox"}
        </label>
      );

    case "HtmlRadio":
      return (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#374151", cursor: "pointer" }}>
          <input type="radio" checked={p.checked || false} readOnly style={{ width: 16, height: 16, accentColor: "#2563eb" }} />
          {p.label || "Radio"}
        </label>
      );

    case "HtmlBadge":
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "2px 10px",
            borderRadius: 9999,
            fontSize: 12,
            fontWeight: 500,
            background: p.color === "red" ? "#fee2e2" : p.color === "green" ? "#dcfce7" : p.color === "yellow" ? "#fef9c3" : "#dbeafe",
            color: p.color === "red" ? "#991b1b" : p.color === "green" ? "#166534" : p.color === "yellow" ? "#854d0e" : "#1e40af",
          }}
        >
          {p.text || "Badge"}
        </span>
      );

    case "HtmlProgress":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {p.label && <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{p.label}</span>}
          <div style={{ width: "100%", height: 8, backgroundColor: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${p.value || 60}%`, height: "100%", backgroundColor: "#2563eb", borderRadius: 4, transition: "width 0.3s" }} />
          </div>
        </div>
      );

    case "HtmlAlert":
      return (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            border: `1px solid ${p.type === "error" ? "#fca5a5" : p.type === "warning" ? "#fde68a" : p.type === "success" ? "#86efac" : "#93c5fd"}`,
            background: p.type === "error" ? "#fef2f2" : p.type === "warning" ? "#fffbeb" : p.type === "success" ? "#f0fdf4" : "#eff6ff",
            fontSize: 14,
            color: "#374151",
          }}
        >
          {p.title && <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.title}</div>}
          <div>{p.message || "Alert message"}</div>
        </div>
      );

    case "HtmlCard":
      return (
        <div
          style={{
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#ffffff",
            overflow: "hidden",
          }}
        >
          {p.title && (
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: 600, fontSize: 14 }}>
              {p.title}
            </div>
          )}
          <div style={{ padding: "16px" }}>
            {p.body || "Card content"}
          </div>
        </div>
      );

    case "HtmlAvatar":
      return (
        <div
          style={{
            width: p.size || 40,
            height: p.size || 40,
            borderRadius: "50%",
            background: "#dbeafe",
            color: "#1e40af",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: (p.size || 40) * 0.4,
            fontWeight: 600,
          }}
        >
          {p.initials || "AB"}
        </div>
      );

    case "HtmlDivider":
      return <hr style={{ border: "none", borderTop: `1px solid ${p.color || "#e5e7eb"}`, margin: "8px 0" }} />;

    case "HtmlLink":
      return (
        <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "#2563eb", fontSize: 14, textDecoration: "underline", cursor: "pointer" }}>
          {p.text || "Link text"}
        </a>
      );

    case "HtmlImage":
      return (
        <div
          style={{
            width: "100%",
            height: p.height || 160,
            borderRadius: 8,
            background: "#f3f4f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#9ca3af",
            fontSize: 13,
            border: "1px dashed #d1d5db",
          }}
        >
          {p.alt || "Image placeholder"}
        </div>
      );

    case "HtmlTable":
      return (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
              {(p.headers || ["Name", "Email", "Role"]).map((h: string, i: number) => (
                <th key={i} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#374151" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(p.rows || [["John", "john@example.com", "Admin"], ["Jane", "jane@example.com", "User"]]).map((row: string[], ri: number) => (
              <tr key={ri} style={{ borderBottom: "1px solid #f3f4f6" }}>
                {row.map((cell: string, ci: number) => (
                  <td key={ci} style={{ padding: "8px 12px", color: "#4b5563" }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );

    case "HtmlList":
      return (
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "#374151", listStyleType: p.ordered ? "decimal" : "disc" }}>
          {(p.items || ["Item 1", "Item 2", "Item 3"]).map((item: string, i: number) => (
            <li key={i} style={{ padding: "2px 0" }}>{item}</li>
          ))}
        </ul>
      );

    case "HtmlHeading": {
      const Tag = (`h${p.level || 2}`) as keyof React.JSX.IntrinsicElements;
      const sizes: Record<number, number> = { 1: 32, 2: 24, 3: 20, 4: 18, 5: 16, 6: 14 };
      return (
        <Tag style={{ fontSize: sizes[p.level || 2] || 24, fontWeight: 700, color: "#111827", margin: 0, lineHeight: 1.3 }}>
          {p.text || "Heading"}
        </Tag>
      );
    }

    default:
      return null;
  }
}

// ── SVG icon helpers ────────────────────────────────────────────────

const S = ({ children, ...p }: React.SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
    {children}
  </svg>
);

let counter = 5000;
function uid() {
  return `html-${++counter}-${Date.now()}`;
}

// ── Catalog ─────────────────────────────────────────────────────────

const catalog: ComponentTemplate[] = [
  {
    type: "Frame", label: "Div", icon: <S><rect x="2" y="2" width="12" height="12" rx="2" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "Frame", name: "Div", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 300, height: 200, backgroundColor: "#ffffff", borderRadius: 8, border: "1px solid #e5e7eb", padding: 16, display: "flex", flexDirection: "column" as const, gap: 8 }, children: [] }),
  },
  {
    type: "Text", label: "Text", icon: <S><path d="M4 3h8M8 3v10M6 13h4" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "Text", name: "Text", text: "Hello World", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, fontSize: 16, color: "#111827" }, children: [] }),
  },
  {
    type: "HtmlHeading", label: "Heading", icon: <S><path d="M3 3v10M13 3v10M3 8h10" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "HtmlHeading", name: "Heading", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20 }, componentProps: { level: 2, text: "Heading" }, children: [] }),
  },
  {
    type: "HtmlButton", label: "Button", icon: <S><rect x="1.5" y="4" width="13" height="8" rx="2" /><path d="M5 8h6" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "HtmlButton", name: "Button", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20 }, componentProps: { label: "Click me", variant: "primary" }, children: [] }),
  },
  {
    type: "HtmlInput", label: "Input", icon: <S><rect x="1.5" y="4.5" width="13" height="7" rx="1.5" /><path d="M4 8h1" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "HtmlInput", name: "Input", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 240 }, componentProps: { label: "Label", placeholder: "Enter text...", inputType: "text" }, children: [] }),
  },
  {
    type: "HtmlTextarea", label: "Textarea", icon: <S><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" /><path d="M4 5.5h8M4 8h8M4 10.5h5" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "HtmlTextarea", name: "Textarea", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 240 }, componentProps: { label: "Description", placeholder: "Type here...", rows: 3 }, children: [] }),
  },
  {
    type: "HtmlSelect", label: "Select", icon: <S><rect x="1.5" y="4.5" width="13" height="7" rx="1.5" /><path d="M10 7l1.5 1.5L13 7" /><path d="M4 8h4" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "HtmlSelect", name: "Select", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 240 }, componentProps: { label: "Select", options: [{ label: "Option 1", value: "1" }, { label: "Option 2", value: "2" }, { label: "Option 3", value: "3" }] }, children: [] }),
  },
  {
    type: "HtmlCheckbox", label: "Checkbox", icon: <S><rect x="3" y="3" width="10" height="10" rx="2" /><path d="M5.5 8l2 2 3-4" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "HtmlCheckbox", name: "Checkbox", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20 }, componentProps: { label: "Check option", checked: false }, children: [] }),
  },
  {
    type: "HtmlRadio", label: "Radio", icon: <S><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="2.5" fill="currentColor" stroke="none" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "HtmlRadio", name: "Radio", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20 }, componentProps: { label: "Radio option", checked: false }, children: [] }),
  },
  {
    type: "HtmlBadge", label: "Badge", icon: <S><rect x="3" y="5" width="10" height="6" rx="3" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "HtmlBadge", name: "Badge", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20 }, componentProps: { text: "Badge", color: "blue" }, children: [] }),
  },
  {
    type: "HtmlProgress", label: "Progress", icon: <S><rect x="1.5" y="6.5" width="13" height="3" rx="1.5" /><rect x="1.5" y="6.5" width="7" height="3" rx="1.5" fill="currentColor" stroke="none" opacity="0.5" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "HtmlProgress", name: "Progress", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 200 }, componentProps: { value: 60, label: "Progress" }, children: [] }),
  },
  {
    type: "HtmlAlert", label: "Alert", icon: <S><rect x="1.5" y="3" width="13" height="10" rx="2" /><circle cx="5" cy="8" r="1.2" fill="currentColor" stroke="none" /><path d="M7.5 7h5M7.5 9.5h3.5" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "HtmlAlert", name: "Alert", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 300 }, componentProps: { type: "info", title: "Info", message: "This is an informational alert." }, children: [] }),
  },
  {
    type: "HtmlCard", label: "Card", icon: <S><rect x="2" y="2" width="12" height="12" rx="2" /><path d="M2 6h12" /><path d="M5 9h6M5 11h4" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "HtmlCard", name: "Card", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 260 }, componentProps: { title: "Card Title", body: "Card content goes here." }, children: [] }),
  },
  {
    type: "HtmlAvatar", label: "Avatar", icon: <S><circle cx="8" cy="6" r="3" /><path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "HtmlAvatar", name: "Avatar", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20 }, componentProps: { initials: "AB", size: 40 }, children: [] }),
  },
  {
    type: "HtmlDivider", label: "Divider", icon: <S><path d="M2 8h12" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "HtmlDivider", name: "Divider", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 200 }, componentProps: {}, children: [] }),
  },
  {
    type: "HtmlLink", label: "Link", icon: <S><path d="M6 10l4-4" /><path d="M7 5h4v4" /><path d="M5 7v4h4" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "HtmlLink", name: "Link", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20 }, componentProps: { text: "Click here" }, children: [] }),
  },
  {
    type: "HtmlImage", label: "Image", icon: <S><rect x="2" y="3" width="12" height="10" rx="2" /><circle cx="5.5" cy="6" r="1.5" /><path d="M2 11l3-3 2 2 3-3 4 4" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "HtmlImage", name: "Image", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 260 }, componentProps: { alt: "Image placeholder", height: 160 }, children: [] }),
  },
  {
    type: "HtmlTable", label: "Table", icon: <S><rect x="1.5" y="2" width="13" height="12" rx="1.5" /><path d="M1.5 5.5h13M1.5 9h13M6 2v12" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "HtmlTable", name: "Table", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 400 }, componentProps: { headers: ["Name", "Email", "Role"], rows: [["John", "john@example.com", "Admin"], ["Jane", "jane@example.com", "User"]] }, children: [] }),
  },
  {
    type: "HtmlList", label: "List", icon: <S><path d="M5 4h8M5 8h8M5 12h8" /><circle cx="2.5" cy="4" r="0.8" fill="currentColor" stroke="none" /><circle cx="2.5" cy="8" r="0.8" fill="currentColor" stroke="none" /><circle cx="2.5" cy="12" r="0.8" fill="currentColor" stroke="none" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "HtmlList", name: "List", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20 }, componentProps: { items: ["Item 1", "Item 2", "Item 3"], ordered: false }, children: [] }),
  },
];

// ── AI Schema ───────────────────────────────────────────────────────

const aiSchema = `Design System: Generic HTML (no external library)

A CanvasNode has this structure:
{
  id: string,
  type: "Frame" | "Text" | "HtmlHeading" | "HtmlButton" | "HtmlInput" | "HtmlTextarea" | "HtmlSelect" | "HtmlCheckbox" | "HtmlRadio" | "HtmlBadge" | "HtmlProgress" | "HtmlAlert" | "HtmlCard" | "HtmlAvatar" | "HtmlDivider" | "HtmlLink" | "HtmlImage" | "HtmlTable" | "HtmlList",
  name: string,
  style: React.CSSProperties,
  children: CanvasNode[],
  text?: string,          // for Text nodes
  componentProps?: {
    // HtmlHeading: { level: 1-6, text: string }
    // HtmlButton: { label: string, variant: "primary"|"danger"|"default", disabled?: boolean }
    // HtmlInput: { label?: string, placeholder?: string, inputType?: "text"|"email"|"password"|"number", helperText?: string }
    // HtmlTextarea: { label?: string, placeholder?: string, rows?: number }
    // HtmlSelect: { label?: string, options: [{label: string, value: string}] }
    // HtmlCheckbox: { label: string, checked?: boolean }
    // HtmlRadio: { label: string, checked?: boolean }
    // HtmlBadge: { text: string, color: "blue"|"green"|"yellow"|"red" }
    // HtmlProgress: { value: number (0-100), label?: string }
    // HtmlAlert: { type: "info"|"success"|"warning"|"error", title?: string, message: string }
    // HtmlCard: { title?: string, body: string }
    // HtmlAvatar: { initials: string, size?: number }
    // HtmlDivider: { color?: string }
    // HtmlLink: { text: string }
    // HtmlImage: { alt: string, height?: number }
    // HtmlTable: { headers: string[], rows: string[][] }
    // HtmlList: { items: string[], ordered?: boolean }
  }
}

IMPORTANT: This design system uses ONLY native HTML elements with inline styles. No external library imports needed. Style everything with CSS properties for a clean, modern look.`;

// ── Export Config ───────────────────────────────────────────────────

const IMPORTABLE = new Set([
  "HtmlHeading", "HtmlButton", "HtmlInput", "HtmlTextarea", "HtmlSelect",
  "HtmlCheckbox", "HtmlRadio", "HtmlBadge", "HtmlProgress", "HtmlAlert",
  "HtmlCard", "HtmlAvatar", "HtmlDivider", "HtmlLink", "HtmlImage",
  "HtmlTable", "HtmlList",
]);

const exportConfig = {
  packageName: "",
  packageVersion: "",
  extraDependencies: {} as Record<string, string>,
  cssImports: [] as string[],
  generateImport: (_usedTypes: string[]) => "",
  importableTypes: IMPORTABLE,
};

// ── Default canvas ──────────────────────────────────────────────────

export const htmlDefaultNodes: CanvasNode[] = [
  { id: "html-label-buttons", type: "Text", name: "Buttons", text: "Buttons", style: { position: "absolute", left: 60, top: 40, fontSize: 12, fontWeight: 700, color: "#9ca3af", letterSpacing: 1 }, children: [] },
  { id: "html-btn-1", type: "HtmlButton", name: "Primary Button", style: { position: "absolute", left: 60, top: 70 }, componentProps: { label: "Create Account", variant: "primary" }, children: [] },
  { id: "html-btn-2", type: "HtmlButton", name: "Danger Button", style: { position: "absolute", left: 60, top: 120 }, componentProps: { label: "Delete", variant: "danger" }, children: [] },
  { id: "html-btn-3", type: "HtmlButton", name: "Default Button", style: { position: "absolute", left: 60, top: 170 }, componentProps: { label: "Cancel", variant: "default" }, children: [] },
  { id: "html-link-1", type: "HtmlLink", name: "Link", style: { position: "absolute", left: 60, top: 220 }, componentProps: { text: "Learn more →" }, children: [] },

  { id: "html-label-forms", type: "Text", name: "Forms", text: "Forms", style: { position: "absolute", left: 240, top: 40, fontSize: 12, fontWeight: 700, color: "#9ca3af", letterSpacing: 1 }, children: [] },
  { id: "html-input-1", type: "HtmlInput", name: "Email Input", style: { position: "absolute", left: 240, top: 70, width: 260 }, componentProps: { label: "Email", placeholder: "you@example.com", inputType: "email" }, children: [] },
  { id: "html-input-2", type: "HtmlInput", name: "Password Input", style: { position: "absolute", left: 240, top: 160, width: 260 }, componentProps: { label: "Password", placeholder: "********", inputType: "password" }, children: [] },
  { id: "html-select-1", type: "HtmlSelect", name: "Select", style: { position: "absolute", left: 240, top: 250, width: 260 }, componentProps: { label: "Country", options: [{ label: "United States", value: "us" }, { label: "United Kingdom", value: "uk" }, { label: "Australia", value: "au" }] }, children: [] },
  { id: "html-textarea-1", type: "HtmlTextarea", name: "Message", style: { position: "absolute", left: 240, top: 340, width: 260 }, componentProps: { label: "Message", placeholder: "Type your message...", rows: 3 }, children: [] },

  { id: "html-label-controls", type: "Text", name: "Controls", text: "Controls", style: { position: "absolute", left: 540, top: 40, fontSize: 12, fontWeight: 700, color: "#9ca3af", letterSpacing: 1 }, children: [] },
  { id: "html-checkbox-1", type: "HtmlCheckbox", name: "Checkbox", style: { position: "absolute", left: 540, top: 70 }, componentProps: { label: "I agree to the terms", checked: true }, children: [] },
  { id: "html-checkbox-2", type: "HtmlCheckbox", name: "Checkbox 2", style: { position: "absolute", left: 540, top: 100 }, componentProps: { label: "Subscribe to newsletter", checked: false }, children: [] },
  { id: "html-radio-1", type: "HtmlRadio", name: "Radio", style: { position: "absolute", left: 540, top: 140 }, componentProps: { label: "Monthly billing", checked: true }, children: [] },
  { id: "html-radio-2", type: "HtmlRadio", name: "Radio 2", style: { position: "absolute", left: 540, top: 170 }, componentProps: { label: "Annual billing (save 20%)", checked: false }, children: [] },
  { id: "html-progress-1", type: "HtmlProgress", name: "Progress", style: { position: "absolute", left: 540, top: 220, width: 240 }, componentProps: { value: 65, label: "Upload progress" }, children: [] },
  { id: "html-divider-1", type: "HtmlDivider", name: "Divider", style: { position: "absolute", left: 540, top: 290, width: 240 }, componentProps: {}, children: [] },
  { id: "html-list-1", type: "HtmlList", name: "List", style: { position: "absolute", left: 540, top: 320 }, componentProps: { items: ["Design tokens", "Component library", "AI generation"], ordered: false }, children: [] },

  { id: "html-label-display", type: "Text", name: "Display", text: "Display", style: { position: "absolute", left: 820, top: 40, fontSize: 12, fontWeight: 700, color: "#9ca3af", letterSpacing: 1 }, children: [] },
  { id: "html-badge-1", type: "HtmlBadge", name: "Badge", style: { position: "absolute", left: 820, top: 70 }, componentProps: { text: "Active", color: "green" }, children: [] },
  { id: "html-badge-2", type: "HtmlBadge", name: "Badge 2", style: { position: "absolute", left: 880, top: 70 }, componentProps: { text: "Pending", color: "yellow" }, children: [] },
  { id: "html-badge-3", type: "HtmlBadge", name: "Badge 3", style: { position: "absolute", left: 950, top: 70 }, componentProps: { text: "Error", color: "red" }, children: [] },
  { id: "html-avatar-1", type: "HtmlAvatar", name: "Avatar", style: { position: "absolute", left: 820, top: 120 }, componentProps: { initials: "JD", size: 40 }, children: [] },
  { id: "html-avatar-2", type: "HtmlAvatar", name: "Avatar 2", style: { position: "absolute", left: 870, top: 120 }, componentProps: { initials: "AK", size: 40 }, children: [] },
  { id: "html-avatar-3", type: "HtmlAvatar", name: "Avatar 3", style: { position: "absolute", left: 920, top: 120 }, componentProps: { initials: "MR", size: 40 }, children: [] },
  { id: "html-alert-1", type: "HtmlAlert", name: "Info Alert", style: { position: "absolute", left: 820, top: 180, width: 280 }, componentProps: { type: "info", title: "Heads up", message: "This is an open-source canvas. Pick any design system from the bottom bar." }, children: [] },
  { id: "html-alert-2", type: "HtmlAlert", name: "Success Alert", style: { position: "absolute", left: 820, top: 290, width: 280 }, componentProps: { type: "success", title: "Saved", message: "Your design has been autosaved." }, children: [] },
];

// ── Adapter ─────────────────────────────────────────────────────────

const htmlAdapter: DesignSystemAdapter = {
  id: "html",
  name: "Generic HTML",
  description: "Native HTML elements with inline styles",
  accentColor: "#e44d26",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  renderComponent,
  catalog,
  aiSchema,
  exportConfig,
  defaultNodes: htmlDefaultNodes,
  guideFile: "guides/html.md",
};

registerDesignSystem(htmlAdapter);

export default htmlAdapter;
