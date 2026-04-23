"use client";

import React from "react";
import type { DesignSystemAdapter, ComponentTemplate } from "./types";
import type { CanvasNode } from "../store/types";
import { registerDesignSystem } from "./registry";

// ── Real shadcn/ui component imports ────────────────────────────────
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";

// ── Component Renderer ──────────────────────────────────────────────

function renderComponent(node: CanvasNode): React.ReactNode {
  const props = node.componentProps || {};
  const p = props as Record<string, any>;

  switch (node.type) {
    case "ShadcnButton": {
      const isInvisibleVariant = p.variant === "ghost" || p.variant === "link";
      const isFullWidth = node.style.width === "100%";
      const classes = [
        isInvisibleVariant ? "ring-1 ring-dashed ring-gray-300" : "",
        isFullWidth ? "w-full" : "",
      ].filter(Boolean).join(" ") || undefined;
      return (
        <Button
          variant={p.variant}
          size={p.size}
          disabled={p.disabled}
          className={classes}
        >
          {p.label || "Button"}
        </Button>
      );
    }

    case "ShadcnInput":
      return (
        <div className="grid w-full gap-1.5">
          {p.label && <Label>{p.label}</Label>}
          <Input type={p.inputType || "text"} placeholder={p.placeholder || ""} readOnly />
          {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
        </div>
      );

    case "ShadcnTextarea":
      return (
        <div className="grid w-full gap-1.5">
          {p.label && <Label>{p.label}</Label>}
          <Textarea placeholder={p.placeholder || ""} readOnly />
        </div>
      );

    case "ShadcnCard":
      return (
        <Card>
          {(p.title || p.description) && (
            <CardHeader>
              {p.title && <CardTitle>{p.title}</CardTitle>}
              {p.description && <CardDescription>{p.description}</CardDescription>}
            </CardHeader>
          )}
          {p.content && <CardContent><p>{p.content}</p></CardContent>}
          {p.footer && <CardFooter><p className="text-sm text-muted-foreground">{p.footer}</p></CardFooter>}
        </Card>
      );

    case "ShadcnBadge":
      return <Badge variant={p.variant}>{p.text || "Badge"}</Badge>;

    case "ShadcnAlert":
      return (
        <Alert variant={p.variant}>
          {p.title && <AlertTitle>{p.title}</AlertTitle>}
          <AlertDescription>{p.description || "Alert description"}</AlertDescription>
        </Alert>
      );

    case "ShadcnAvatar":
      return (
        <Avatar size={p.size}>
          <AvatarFallback>{p.fallback || "CN"}</AvatarFallback>
        </Avatar>
      );

    case "ShadcnCheckbox":
      return (
        <div className="flex items-center gap-2">
          <Checkbox checked={p.checked} id={`chk-${node.id}`} />
          {p.label && <Label htmlFor={`chk-${node.id}`}>{p.label}</Label>}
        </div>
      );

    case "ShadcnSwitch":
      return (
        <div className="flex items-center gap-2">
          <Switch checked={p.checked} id={`sw-${node.id}`} />
          {p.label && <Label htmlFor={`sw-${node.id}`}>{p.label}</Label>}
        </div>
      );

    case "ShadcnProgress":
      return <Progress value={p.value ?? 60} />;

    case "ShadcnTabs": {
      const tabs = p.tabs || ["Account", "Password", "Settings"];
      const defaultVal = tabs[p.activeTab || 0] || tabs[0];
      return (
        <Tabs defaultValue={defaultVal}>
          <TabsList>
            {tabs.map((tab: string) => (
              <TabsTrigger key={tab} value={tab}>{tab}</TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((tab: string) => (
            <TabsContent key={tab} value={tab}>
              <p className="text-sm text-muted-foreground p-2">{tab} content</p>
            </TabsContent>
          ))}
        </Tabs>
      );
    }

    case "ShadcnSeparator":
      return <Separator orientation={p.orientation || "horizontal"} />;

    case "ShadcnSkeleton":
      return (
        <Skeleton
          className={p.shape === "circle" ? "rounded-full" : ""}
          style={{
            width: p.shape === "circle" ? (p.size || 40) : "100%",
            height: p.shape === "circle" ? (p.size || 40) : (p.height || 20),
          }}
        />
      );

    case "ShadcnLabel":
      return <Label>{p.text || "Label"}</Label>;

    default:
      return null;
  }
}

// ── SVG Icons ───────────────────────────────────────────────────────

const S = ({ children, ...p }: React.SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
    {children}
  </svg>
);

let counter = 9000;
function uid() {
  return `shadcn-${++counter}-${Date.now()}`;
}

// ── Catalog ─────────────────────────────────────────────────────────

const catalog: ComponentTemplate[] = [
  {
    type: "Frame", label: "Div", icon: <S><rect x="2" y="2" width="12" height="12" rx="2" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "Frame", name: "Container", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 300, height: 200, backgroundColor: "hsl(var(--card))", borderRadius: 8, border: "1px solid hsl(var(--border))", padding: 16, display: "flex", flexDirection: "column" as const, gap: 8 }, children: [] }),
  },
  {
    type: "Text", label: "Text", icon: <S><path d="M4 3h8M8 3v10M6 13h4" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "Text", name: "Text", text: "Hello World", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, fontSize: 16, color: "hsl(var(--foreground))" }, children: [] }),
  },
  {
    type: "ShadcnButton", label: "Button", icon: <S><rect x="1.5" y="4" width="13" height="8" rx="2" /><path d="M5 8h6" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "ShadcnButton", name: "Button", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20 }, componentProps: { label: "Button", variant: "default", size: "default" }, children: [] }),
  },
  {
    type: "ShadcnInput", label: "Input", icon: <S><rect x="1.5" y="4.5" width="13" height="7" rx="1.5" /><path d="M4 8h1" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "ShadcnInput", name: "Input", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 240 }, componentProps: { label: "Email", placeholder: "you@example.com", inputType: "email" }, children: [] }),
  },
  {
    type: "ShadcnTextarea", label: "Textarea", icon: <S><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" /><path d="M4 5.5h8M4 8h8M4 10.5h5" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "ShadcnTextarea", name: "Textarea", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 240 }, componentProps: { label: "Message", placeholder: "Type your message..." }, children: [] }),
  },
  {
    type: "ShadcnCard", label: "Card", icon: <S><rect x="2" y="2" width="12" height="12" rx="2" /><path d="M2 6h12" /><path d="M5 9h6M5 11h4" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "ShadcnCard", name: "Card", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 320 }, componentProps: { title: "Card Title", description: "Card description here.", content: "Card content with details.", footer: "Last updated 2 hours ago" }, children: [] }),
  },
  {
    type: "ShadcnBadge", label: "Badge", icon: <S><rect x="3" y="5" width="10" height="6" rx="3" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "ShadcnBadge", name: "Badge", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20 }, componentProps: { text: "Badge", variant: "default" }, children: [] }),
  },
  {
    type: "ShadcnAlert", label: "Alert", icon: <S><rect x="1.5" y="3" width="13" height="10" rx="2" /><circle cx="5" cy="8" r="1.2" fill="currentColor" stroke="none" /><path d="M7.5 7h5M7.5 9.5h3.5" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "ShadcnAlert", name: "Alert", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 320 }, componentProps: { title: "Heads up!", description: "You can add components using the cli.", variant: "default" }, children: [] }),
  },
  {
    type: "ShadcnAvatar", label: "Avatar", icon: <S><circle cx="8" cy="6" r="3" /><path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "ShadcnAvatar", name: "Avatar", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20 }, componentProps: { fallback: "CN", size: "default" }, children: [] }),
  },
  {
    type: "ShadcnCheckbox", label: "Checkbox", icon: <S><rect x="3" y="3" width="10" height="10" rx="2" /><path d="M5.5 8l2 2 3-4" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "ShadcnCheckbox", name: "Checkbox", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20 }, componentProps: { label: "Accept terms and conditions", checked: false }, children: [] }),
  },
  {
    type: "ShadcnSwitch", label: "Switch", icon: <S><rect x="1.5" y="4.5" width="13" height="7" rx="3.5" /><circle cx="11" cy="8" r="2.5" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "ShadcnSwitch", name: "Switch", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20 }, componentProps: { label: "Airplane Mode", checked: true }, children: [] }),
  },
  {
    type: "ShadcnProgress", label: "Progress", icon: <S><rect x="1.5" y="6.5" width="13" height="3" rx="1.5" /><rect x="1.5" y="6.5" width="7" height="3" rx="1.5" fill="currentColor" stroke="none" opacity="0.5" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "ShadcnProgress", name: "Progress", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 200 }, componentProps: { value: 66 }, children: [] }),
  },
  {
    type: "ShadcnTabs", label: "Tabs", icon: <S><path d="M2 5h12" /><rect x="2" y="2" width="4" height="3" rx="1" /><rect x="7" y="2" width="4" height="3" rx="1" opacity="0.3" /><rect x="2" y="5" width="12" height="7" rx="0" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "ShadcnTabs", name: "Tabs", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20 }, componentProps: { tabs: ["Account", "Password", "Settings"], activeTab: 0 }, children: [] }),
  },
  {
    type: "ShadcnSeparator", label: "Separator", icon: <S><path d="M2 8h12" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "ShadcnSeparator", name: "Separator", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 200 }, componentProps: { orientation: "horizontal" }, children: [] }),
  },
  {
    type: "ShadcnSkeleton", label: "Skeleton", icon: <S><rect x="2" y="3" width="12" height="4" rx="1" opacity="0.3" fill="currentColor" stroke="none" /><rect x="2" y="9" width="8" height="4" rx="1" opacity="0.15" fill="currentColor" stroke="none" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "ShadcnSkeleton", name: "Skeleton", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 200 }, componentProps: { height: 20, shape: "rectangle" }, children: [] }),
  },
];

// ── AI Schema ───────────────────────────────────────────────────────

const aiSchema = `Design System: shadcn/ui (real components)

A CanvasNode has this structure:
{
  id: string,
  type: "Frame" | "Text" | "ShadcnButton" | "ShadcnInput" | "ShadcnTextarea" | "ShadcnCard" | "ShadcnBadge" | "ShadcnAlert" | "ShadcnAvatar" | "ShadcnCheckbox" | "ShadcnSwitch" | "ShadcnProgress" | "ShadcnTabs" | "ShadcnSeparator" | "ShadcnSkeleton" | "ShadcnLabel",
  name: string,
  style: React.CSSProperties,
  children: CanvasNode[],
  text?: string,
  componentProps?: {
    // ShadcnButton: { label: string, variant: "default"|"secondary"|"destructive"|"outline"|"ghost"|"link", size: "default"|"xs"|"sm"|"lg"|"icon", disabled?: boolean }
    //   IMPORTANT: Prefer "default" for primary CTA, "outline" or "secondary" for secondary CTA. Avoid "ghost" and "link" variants as they appear as plain text without background/border.
    // ShadcnInput: { label?: string, placeholder?: string, inputType?: "text"|"email"|"password"|"number", description?: string }
    // ShadcnTextarea: { label?: string, placeholder?: string }
    // ShadcnCard: { title?: string, description?: string, content?: string, footer?: string }
    // ShadcnBadge: { text: string, variant: "default"|"secondary"|"destructive"|"outline" }
    // ShadcnAlert: { title?: string, description: string, variant: "default"|"destructive" }
    // ShadcnAvatar: { fallback: string, size?: "default"|"sm"|"lg" }
    // ShadcnCheckbox: { label?: string, checked?: boolean }
    // ShadcnSwitch: { label?: string, checked?: boolean }
    // ShadcnProgress: { value: number (0-100) }
    // ShadcnTabs: { tabs: string[], activeTab?: number }
    // ShadcnSeparator: { orientation?: "horizontal"|"vertical" }
    // ShadcnSkeleton: { height?: number, shape?: "rectangle"|"circle", size?: number }
    // ShadcnLabel: { text: string }
  }
}

The design should follow shadcn/ui aesthetics: clean, minimal, neutral palette, subtle borders.`;

// ── Export Config ───────────────────────────────────────────────────

const IMPORTABLE = new Set([
  "ShadcnButton", "ShadcnInput", "ShadcnTextarea", "ShadcnCard",
  "ShadcnBadge", "ShadcnAlert", "ShadcnAvatar", "ShadcnCheckbox", "ShadcnSwitch",
  "ShadcnProgress", "ShadcnTabs", "ShadcnSeparator", "ShadcnSkeleton", "ShadcnLabel",
]);

const exportConfig = {
  packageName: "",
  packageVersion: "",
  extraDependencies: {} as Record<string, string>,
  cssImports: [] as string[],
  generateImport: (_usedTypes: string[]) => "// shadcn/ui components",
  importableTypes: IMPORTABLE,
};

// ── Default canvas ──────────────────────────────────────────────────

const defaultNodes: CanvasNode[] = [
  { id: "sc-label-buttons", type: "Text", name: "Buttons", text: "Buttons", style: { position: "absolute", left: 60, top: 40, fontSize: 12, fontWeight: 700, color: "#9ca3af", letterSpacing: 1 }, children: [] },
  { id: "sc-btn-1", type: "ShadcnButton", name: "Default Button", style: { position: "absolute", left: 60, top: 70 }, componentProps: { label: "Create Account", variant: "default", size: "default" }, children: [] },
  { id: "sc-btn-2", type: "ShadcnButton", name: "Outline Button", style: { position: "absolute", left: 60, top: 120 }, componentProps: { label: "Cancel", variant: "outline", size: "default" }, children: [] },
  { id: "sc-btn-3", type: "ShadcnButton", name: "Destructive Button", style: { position: "absolute", left: 60, top: 170 }, componentProps: { label: "Delete", variant: "destructive", size: "default" }, children: [] },
  { id: "sc-btn-4", type: "ShadcnButton", name: "Ghost Button", style: { position: "absolute", left: 60, top: 220 }, componentProps: { label: "Learn more", variant: "ghost", size: "default" }, children: [] },

  { id: "sc-label-forms", type: "Text", name: "Forms", text: "Forms", style: { position: "absolute", left: 240, top: 40, fontSize: 12, fontWeight: 700, color: "#9ca3af", letterSpacing: 1 }, children: [] },
  { id: "sc-input-1", type: "ShadcnInput", name: "Email Input", style: { position: "absolute", left: 240, top: 70, width: 260 }, componentProps: { label: "Email", placeholder: "you@example.com", inputType: "email" }, children: [] },
  { id: "sc-input-2", type: "ShadcnInput", name: "Password Input", style: { position: "absolute", left: 240, top: 160, width: 260 }, componentProps: { label: "Password", placeholder: "********", inputType: "password" }, children: [] },
  { id: "sc-textarea-1", type: "ShadcnTextarea", name: "Message", style: { position: "absolute", left: 240, top: 250, width: 260 }, componentProps: { label: "Message", placeholder: "Type here...", rows: 3 }, children: [] },

  { id: "sc-label-controls", type: "Text", name: "Controls", text: "Controls", style: { position: "absolute", left: 540, top: 40, fontSize: 12, fontWeight: 700, color: "#9ca3af", letterSpacing: 1 }, children: [] },
  { id: "sc-checkbox-1", type: "ShadcnCheckbox", name: "Checkbox", style: { position: "absolute", left: 540, top: 70 }, componentProps: { label: "Accept terms and conditions", checked: true }, children: [] },
  { id: "sc-switch-1", type: "ShadcnSwitch", name: "Switch", style: { position: "absolute", left: 540, top: 110 }, componentProps: { label: "Email notifications", checked: true }, children: [] },
  { id: "sc-progress-1", type: "ShadcnProgress", name: "Progress", style: { position: "absolute", left: 540, top: 160, width: 260 }, componentProps: { value: 60 }, children: [] },
  { id: "sc-separator-1", type: "ShadcnSeparator", name: "Separator", style: { position: "absolute", left: 540, top: 210, width: 260 }, componentProps: { orientation: "horizontal" }, children: [] },
  { id: "sc-tabs-1", type: "ShadcnTabs", name: "Tabs", style: { position: "absolute", left: 540, top: 240, width: 260 }, componentProps: { tabs: ["Account", "Password", "Team"], activeTab: 0 }, children: [] },

  { id: "sc-label-display", type: "Text", name: "Display", text: "Display", style: { position: "absolute", left: 840, top: 40, fontSize: 12, fontWeight: 700, color: "#9ca3af", letterSpacing: 1 }, children: [] },
  { id: "sc-badge-1", type: "ShadcnBadge", name: "Badge", style: { position: "absolute", left: 840, top: 70 }, componentProps: { text: "New", variant: "default" }, children: [] },
  { id: "sc-badge-2", type: "ShadcnBadge", name: "Badge 2", style: { position: "absolute", left: 890, top: 70 }, componentProps: { text: "Beta", variant: "secondary" }, children: [] },
  { id: "sc-badge-3", type: "ShadcnBadge", name: "Badge 3", style: { position: "absolute", left: 950, top: 70 }, componentProps: { text: "Error", variant: "destructive" }, children: [] },
  { id: "sc-avatar-1", type: "ShadcnAvatar", name: "Avatar", style: { position: "absolute", left: 840, top: 110 }, componentProps: { fallback: "JD", size: 40 }, children: [] },
  { id: "sc-avatar-2", type: "ShadcnAvatar", name: "Avatar 2", style: { position: "absolute", left: 890, top: 110 }, componentProps: { fallback: "AK", size: 40 }, children: [] },
  { id: "sc-avatar-3", type: "ShadcnAvatar", name: "Avatar 3", style: { position: "absolute", left: 940, top: 110 }, componentProps: { fallback: "MR", size: 40 }, children: [] },
  { id: "sc-alert-1", type: "ShadcnAlert", name: "Alert", style: { position: "absolute", left: 840, top: 170, width: 280 }, componentProps: { title: "Heads up", description: "shadcn/ui components, rendered live on the canvas." }, children: [] },
  { id: "sc-alert-2", type: "ShadcnAlert", name: "Alert", style: { position: "absolute", left: 840, top: 270, width: 280 }, componentProps: { title: "Error", description: "Something went wrong with your request.", variant: "destructive" }, children: [] },
  { id: "sc-card-1", type: "ShadcnCard", name: "Card", style: { position: "absolute", left: 60, top: 320, width: 320 }, componentProps: { title: "Project Settings", description: "Manage your team's project configuration.", content: "Update permissions, invite collaborators, or rotate API keys.", footer: "Last updated 2 hours ago" }, children: [] },
];

// ── Adapter ─────────────────────────────────────────────────────────

const shadcnAdapter: DesignSystemAdapter = {
  id: "shadcn",
  name: "shadcn/ui",
  description: "Beautifully designed components by shadcn",
  accentColor: "#0a0a0a",
  fontFamily: "var(--font-inter), Inter, sans-serif",
  renderComponent,
  catalog,
  aiSchema,
  exportConfig,
  defaultNodes,
  guideFile: "guides/shadcn.md",
};

registerDesignSystem(shadcnAdapter);

export default shadcnAdapter;
