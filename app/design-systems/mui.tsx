"use client";

import React from "react";
import type { DesignSystemAdapter, ComponentTemplate } from "./types";
import type { CanvasNode } from "../store/types";
import { registerDesignSystem } from "./registry";

import MuiButton from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MuiCheckbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import MuiSwitch from "@mui/material/Switch";
import MuiCard from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Typography from "@mui/material/Typography";
import MuiAlert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import MuiAvatar from "@mui/material/Avatar";
import MuiBadge from "@mui/material/Badge";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Divider from "@mui/material/Divider";
import Skeleton from "@mui/material/Skeleton";
import MuiTabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";

// ── Component Renderer ──────────────────────────────────────────────

function renderComponent(node: CanvasNode): React.ReactNode {
  const p = (node.componentProps || {}) as Record<string, any>;

  switch (node.type) {
    case "MuiButton":
      return (
        <MuiButton variant={p.variant || "contained"} color={p.color || "primary"} size={p.size || "medium"} disabled={p.disabled}>
          {p.label || "Button"}
        </MuiButton>
      );

    case "MuiTextField":
      return (
        <TextField
          label={p.label || "Label"}
          placeholder={p.placeholder}
          variant={p.variant || "outlined"}
          size={p.size || "medium"}
          fullWidth
          slotProps={{ input: { readOnly: true } }}
          type={p.inputType || "text"}
          helperText={p.helperText}
          error={p.error}
        />
      );

    case "MuiCheckbox":
      return (
        <FormControlLabel
          control={<MuiCheckbox checked={p.checked || false} color={p.color || "primary"} />}
          label={p.label || "Checkbox"}
        />
      );

    case "MuiSwitch":
      return (
        <FormControlLabel
          control={<MuiSwitch checked={p.checked || false} color={p.color || "primary"} />}
          label={p.label || "Switch"}
        />
      );

    case "MuiRadioGroup":
      return (
        <RadioGroup value={p.value || "option1"}>
          {(p.options || [{ label: "Option 1", value: "option1" }, { label: "Option 2", value: "option2" }]).map((opt: any) => (
            <FormControlLabel key={opt.value} value={opt.value} control={<Radio />} label={opt.label} />
          ))}
        </RadioGroup>
      );

    case "MuiCard":
      return (
        <MuiCard variant={p.variant || "outlined"}>
          <CardContent>
            {p.title && <Typography variant="h6" gutterBottom>{p.title}</Typography>}
            {p.subtitle && <Typography variant="body2" color="text.secondary" gutterBottom>{p.subtitle}</Typography>}
            {p.content && <Typography variant="body2">{p.content}</Typography>}
          </CardContent>
          {p.actionLabel && (
            <CardActions>
              <MuiButton size="small" color="primary">{p.actionLabel}</MuiButton>
            </CardActions>
          )}
        </MuiCard>
      );

    case "MuiAlert":
      return (
        <MuiAlert severity={p.severity || "info"} variant={p.variant || "standard"}>
          {p.title && <AlertTitle>{p.title}</AlertTitle>}
          {p.message || "This is an alert."}
        </MuiAlert>
      );

    case "MuiAvatar":
      return (
        <MuiAvatar sx={{ width: p.size || 40, height: p.size || 40, bgcolor: p.color || "#1976d2" }}>
          {p.initials || "AB"}
        </MuiAvatar>
      );

    case "MuiBadge":
      return (
        <MuiBadge badgeContent={p.count ?? 4} color={p.color || "primary"}>
          <MuiAvatar sx={{ bgcolor: "#bdbdbd" }}>{p.initials || "U"}</MuiAvatar>
        </MuiBadge>
      );

    case "MuiChip":
      return (
        <Chip
          label={p.label || "Chip"}
          color={p.color || "default"}
          variant={p.variant || "filled"}
          size={p.size || "medium"}
          onDelete={p.deletable ? () => {} : undefined}
        />
      );

    case "MuiProgress":
      return <LinearProgress variant="determinate" value={p.value ?? 60} color={p.color || "primary"} />;

    case "MuiDivider":
      return <Divider orientation={p.orientation || "horizontal"} />;

    case "MuiSkeleton":
      return (
        <Skeleton
          variant={p.variant || "rectangular"}
          width={p.width || "100%"}
          height={p.height || 40}
          animation="wave"
        />
      );

    case "MuiTabs": {
      const tabs = p.tabs || ["Tab 1", "Tab 2", "Tab 3"];
      return (
        <MuiTabs value={p.activeTab || 0} textColor="primary" indicatorColor="primary">
          {tabs.map((label: string, i: number) => (
            <Tab key={i} label={label} />
          ))}
        </MuiTabs>
      );
    }

    case "MuiTypography":
      return (
        <Typography variant={p.variant || "body1"} color={p.color || "text.primary"}>
          {p.text || "Typography"}
        </Typography>
      );

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

let counter = 7000;
function uid() {
  return `mui-${++counter}-${Date.now()}`;
}

// ── Catalog ─────────────────────────────────────────────────────────

const catalog: ComponentTemplate[] = [
  {
    type: "Frame", label: "Box", icon: <S><rect x="2" y="2" width="12" height="12" rx="2" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "Frame", name: "Box", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 300, height: 200, backgroundColor: "#ffffff", borderRadius: 4, border: "1px solid #e0e0e0", padding: 16, display: "flex", flexDirection: "column" as const, gap: 8 }, children: [] }),
  },
  {
    type: "Text", label: "Text", icon: <S><path d="M4 3h8M8 3v10M6 13h4" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "Text", name: "Text", text: "Hello World", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, fontSize: 16, color: "rgba(0,0,0,0.87)" }, children: [] }),
  },
  {
    type: "MuiButton", label: "Button", icon: <S><rect x="1.5" y="4" width="13" height="8" rx="2" /><path d="M5 8h6" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "MuiButton", name: "Button", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20 }, componentProps: { label: "Button", variant: "contained", color: "primary", size: "medium" }, children: [] }),
  },
  {
    type: "MuiTextField", label: "TextField", icon: <S><rect x="1.5" y="4.5" width="13" height="7" rx="1.5" /><path d="M4 8h1" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "MuiTextField", name: "TextField", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 240 }, componentProps: { label: "Email", placeholder: "you@example.com", variant: "outlined" }, children: [] }),
  },
  {
    type: "MuiCard", label: "Card", icon: <S><rect x="2" y="2" width="12" height="12" rx="2" /><path d="M2 6h12" /><path d="M5 9h6M5 11h4" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "MuiCard", name: "Card", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 300 }, componentProps: { title: "Card Title", subtitle: "Card subtitle", content: "Card content goes here.", actionLabel: "Learn More", variant: "outlined" }, children: [] }),
  },
  {
    type: "MuiAlert", label: "Alert", icon: <S><rect x="1.5" y="3" width="13" height="10" rx="2" /><circle cx="5" cy="8" r="1.2" fill="currentColor" stroke="none" /><path d="M7.5 7h5M7.5 9.5h3.5" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "MuiAlert", name: "Alert", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 320 }, componentProps: { severity: "success", title: "Success", message: "Operation completed successfully." }, children: [] }),
  },
  {
    type: "MuiCheckbox", label: "Checkbox", icon: <S><rect x="3" y="3" width="10" height="10" rx="2" /><path d="M5.5 8l2 2 3-4" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "MuiCheckbox", name: "Checkbox", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20 }, componentProps: { label: "Accept terms", checked: false }, children: [] }),
  },
  {
    type: "MuiSwitch", label: "Switch", icon: <S><rect x="1.5" y="4.5" width="13" height="7" rx="3.5" /><circle cx="11" cy="8" r="2.5" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "MuiSwitch", name: "Switch", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20 }, componentProps: { label: "Enable notifications", checked: true }, children: [] }),
  },
  {
    type: "MuiAvatar", label: "Avatar", icon: <S><circle cx="8" cy="6" r="3" /><path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "MuiAvatar", name: "Avatar", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20 }, componentProps: { initials: "JD", size: 40 }, children: [] }),
  },
  {
    type: "MuiBadge", label: "Badge", icon: <S><rect x="3" y="5" width="10" height="6" rx="3" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "MuiBadge", name: "Badge", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20 }, componentProps: { count: 4, initials: "M" }, children: [] }),
  },
  {
    type: "MuiChip", label: "Chip", icon: <S><rect x="2" y="5" width="12" height="6" rx="3" /><path d="M10.5 8l1-1M10.5 8l1 1" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "MuiChip", name: "Chip", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20 }, componentProps: { label: "Chip", color: "primary", variant: "filled" }, children: [] }),
  },
  {
    type: "MuiProgress", label: "Progress", icon: <S><rect x="1.5" y="6.5" width="13" height="3" rx="1.5" /><rect x="1.5" y="6.5" width="7" height="3" rx="1.5" fill="currentColor" stroke="none" opacity="0.5" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "MuiProgress", name: "Progress", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 200 }, componentProps: { value: 60 }, children: [] }),
  },
  {
    type: "MuiTabs", label: "Tabs", icon: <S><path d="M2 5h12" /><rect x="2" y="2" width="4" height="3" rx="1" /><rect x="7" y="2" width="4" height="3" rx="1" opacity="0.3" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "MuiTabs", name: "Tabs", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20 }, componentProps: { tabs: ["General", "Security", "Billing"], activeTab: 0 }, children: [] }),
  },
  {
    type: "MuiRadioGroup", label: "Radio", icon: <S><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="2.5" fill="currentColor" stroke="none" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "MuiRadioGroup", name: "RadioGroup", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20 }, componentProps: { options: [{ label: "Option A", value: "a" }, { label: "Option B", value: "b" }], value: "a" }, children: [] }),
  },
  {
    type: "MuiDivider", label: "Divider", icon: <S><path d="M2 8h12" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "MuiDivider", name: "Divider", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 200 }, componentProps: {}, children: [] }),
  },
  {
    type: "MuiSkeleton", label: "Skeleton", icon: <S><rect x="2" y="3" width="12" height="4" rx="1" opacity="0.3" fill="currentColor" stroke="none" /><rect x="2" y="9" width="8" height="4" rx="1" opacity="0.15" fill="currentColor" stroke="none" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "MuiSkeleton", name: "Skeleton", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20, width: 200 }, componentProps: { variant: "rectangular", height: 40 }, children: [] }),
  },
  {
    type: "MuiTypography", label: "Typo", icon: <S><path d="M3 3h10M8 3v10M5 13h6" /></S>,
    create: (cx, cy) => ({ id: uid(), type: "MuiTypography", name: "Typography", style: { position: "absolute", left: cx + Math.random() * 40 - 20, top: cy + Math.random() * 40 - 20 }, componentProps: { text: "Heading Text", variant: "h5" }, children: [] }),
  },
];

// ── AI Schema ───────────────────────────────────────────────────────

const aiSchema = `Design System: Material UI (MUI v6)

A CanvasNode has this structure:
{
  id: string,
  type: "Frame" | "Text" | "MuiButton" | "MuiTextField" | "MuiCard" | "MuiAlert" | "MuiCheckbox" | "MuiSwitch" | "MuiRadioGroup" | "MuiAvatar" | "MuiBadge" | "MuiChip" | "MuiProgress" | "MuiTabs" | "MuiDivider" | "MuiSkeleton" | "MuiTypography",
  name: string,
  style: React.CSSProperties,
  children: CanvasNode[],
  text?: string,
  componentProps?: {
    // MuiButton: { label: string, variant: "contained"|"outlined"|"text", color: "primary"|"secondary"|"error"|"warning"|"info"|"success", size: "small"|"medium"|"large", disabled?: boolean }
    // MuiTextField: { label: string, placeholder?: string, variant: "outlined"|"filled"|"standard", size?: "small"|"medium", inputType?: string, helperText?: string, error?: boolean }
    // MuiCard: { title?: string, subtitle?: string, content?: string, actionLabel?: string, variant?: "outlined"|"elevation" }
    // MuiAlert: { severity: "success"|"info"|"warning"|"error", title?: string, message: string, variant?: "standard"|"filled"|"outlined" }
    // MuiCheckbox: { label: string, checked?: boolean, color?: "primary"|"secondary" }
    // MuiSwitch: { label: string, checked?: boolean, color?: "primary"|"secondary" }
    // MuiRadioGroup: { options: [{label: string, value: string}], value?: string }
    // MuiAvatar: { initials: string, size?: number, color?: string }
    // MuiBadge: { count: number, initials?: string, color?: "primary"|"secondary"|"error" }
    // MuiChip: { label: string, color?: "default"|"primary"|"secondary"|"error"|"warning"|"info"|"success", variant?: "filled"|"outlined", size?: "small"|"medium", deletable?: boolean }
    // MuiProgress: { value: number (0-100), color?: "primary"|"secondary" }
    // MuiTabs: { tabs: string[], activeTab?: number }
    // MuiDivider: { orientation?: "horizontal"|"vertical" }
    // MuiSkeleton: { variant?: "text"|"rectangular"|"circular"|"rounded", width?: number|string, height?: number }
    // MuiTypography: { text: string, variant: "h1"|"h2"|"h3"|"h4"|"h5"|"h6"|"subtitle1"|"subtitle2"|"body1"|"body2"|"caption"|"overline", color?: string }
  }
}

Follow Material Design 3 aesthetics: rounded corners, elevated surfaces, vibrant but balanced colors.`;

// ── Export Config ───────────────────────────────────────────────────

const IMPORTABLE = new Set([
  "MuiButton", "MuiTextField", "MuiCard", "MuiAlert", "MuiCheckbox", "MuiSwitch",
  "MuiRadioGroup", "MuiAvatar", "MuiBadge", "MuiChip", "MuiProgress", "MuiTabs",
  "MuiDivider", "MuiSkeleton", "MuiTypography",
]);

const exportConfig = {
  packageName: "@mui/material",
  packageVersion: "^6.0.0",
  extraDependencies: { "@emotion/react": "^11.0.0", "@emotion/styled": "^11.0.0" },
  cssImports: [] as string[],
  generateImport: (usedTypes: string[]) =>
    usedTypes.length > 0 ? `// MUI components used: ${usedTypes.join(", ")}` : "",
  importableTypes: IMPORTABLE,
};

// ── Default canvas ──────────────────────────────────────────────────

const defaultNodes: CanvasNode[] = [
  { id: "mui-label-buttons", type: "Text", name: "Buttons", text: "Buttons", style: { position: "absolute", left: 60, top: 40, fontSize: 12, fontWeight: 700, color: "#9ca3af", letterSpacing: 1 }, children: [] },
  { id: "mui-btn-1", type: "MuiButton", name: "Contained", style: { position: "absolute", left: 60, top: 70 }, componentProps: { label: "Create Account", variant: "contained", color: "primary", size: "medium" }, children: [] },
  { id: "mui-btn-2", type: "MuiButton", name: "Outlined", style: { position: "absolute", left: 60, top: 120 }, componentProps: { label: "Cancel", variant: "outlined", color: "primary", size: "medium" }, children: [] },
  { id: "mui-btn-3", type: "MuiButton", name: "Error", style: { position: "absolute", left: 60, top: 170 }, componentProps: { label: "Delete", variant: "contained", color: "error", size: "medium" }, children: [] },
  { id: "mui-btn-4", type: "MuiButton", name: "Text", style: { position: "absolute", left: 60, top: 220 }, componentProps: { label: "Learn more", variant: "text", color: "primary", size: "medium" }, children: [] },

  { id: "mui-label-forms", type: "Text", name: "Forms", text: "Forms", style: { position: "absolute", left: 240, top: 40, fontSize: 12, fontWeight: 700, color: "#9ca3af", letterSpacing: 1 }, children: [] },
  { id: "mui-tf-1", type: "MuiTextField", name: "Email Field", style: { position: "absolute", left: 240, top: 70, width: 260 }, componentProps: { label: "Email", placeholder: "you@example.com", variant: "outlined", inputType: "email" }, children: [] },
  { id: "mui-tf-2", type: "MuiTextField", name: "Password Field", style: { position: "absolute", left: 240, top: 160, width: 260 }, componentProps: { label: "Password", placeholder: "********", variant: "outlined", inputType: "password" }, children: [] },
  { id: "mui-tf-3", type: "MuiTextField", name: "Filled Field", style: { position: "absolute", left: 240, top: 250, width: 260 }, componentProps: { label: "Company", placeholder: "Acme Inc.", variant: "filled" }, children: [] },

  { id: "mui-label-controls", type: "Text", name: "Controls", text: "Controls", style: { position: "absolute", left: 540, top: 40, fontSize: 12, fontWeight: 700, color: "#9ca3af", letterSpacing: 1 }, children: [] },
  { id: "mui-checkbox-1", type: "MuiCheckbox", name: "Checkbox", style: { position: "absolute", left: 540, top: 70 }, componentProps: { label: "I agree to the terms", checked: true }, children: [] },
  { id: "mui-switch-1", type: "MuiSwitch", name: "Switch", style: { position: "absolute", left: 540, top: 110 }, componentProps: { label: "Enable notifications", checked: true }, children: [] },
  { id: "mui-radio-1", type: "MuiRadioGroup", name: "Radio Group", style: { position: "absolute", left: 540, top: 160, width: 260 }, componentProps: { options: [{ label: "Monthly", value: "m" }, { label: "Annual (save 20%)", value: "a" }], value: "m" }, children: [] },
  { id: "mui-progress-1", type: "MuiProgress", name: "Progress", style: { position: "absolute", left: 540, top: 260, width: 260 }, componentProps: { value: 60 }, children: [] },
  { id: "mui-tabs-1", type: "MuiTabs", name: "Tabs", style: { position: "absolute", left: 540, top: 300, width: 260 }, componentProps: { tabs: ["Inbox", "Sent", "Drafts"], activeTab: 0 }, children: [] },

  { id: "mui-label-display", type: "Text", name: "Display", text: "Display", style: { position: "absolute", left: 840, top: 40, fontSize: 12, fontWeight: 700, color: "#9ca3af", letterSpacing: 1 }, children: [] },
  { id: "mui-chip-1", type: "MuiChip", name: "Chip", style: { position: "absolute", left: 840, top: 70 }, componentProps: { label: "Active", color: "success", variant: "filled", size: "small" }, children: [] },
  { id: "mui-chip-2", type: "MuiChip", name: "Chip 2", style: { position: "absolute", left: 905, top: 70 }, componentProps: { label: "Pending", color: "warning", variant: "filled", size: "small" }, children: [] },
  { id: "mui-chip-3", type: "MuiChip", name: "Chip 3", style: { position: "absolute", left: 980, top: 70 }, componentProps: { label: "Error", color: "error", variant: "filled", size: "small" }, children: [] },
  { id: "mui-avatar-1", type: "MuiAvatar", name: "Avatar", style: { position: "absolute", left: 840, top: 110 }, componentProps: { initials: "JD", size: 40 }, children: [] },
  { id: "mui-avatar-2", type: "MuiAvatar", name: "Avatar 2", style: { position: "absolute", left: 890, top: 110 }, componentProps: { initials: "AK", size: 40, color: "#1976d2" }, children: [] },
  { id: "mui-avatar-3", type: "MuiAvatar", name: "Avatar 3", style: { position: "absolute", left: 940, top: 110 }, componentProps: { initials: "MR", size: 40, color: "#9c27b0" }, children: [] },
  { id: "mui-alert-1", type: "MuiAlert", name: "Alert", style: { position: "absolute", left: 840, top: 170, width: 280 }, componentProps: { severity: "info", title: "Heads up", message: "Material UI components on a Framer-like canvas." }, children: [] },
  { id: "mui-alert-2", type: "MuiAlert", name: "Alert", style: { position: "absolute", left: 840, top: 270, width: 280 }, componentProps: { severity: "success", title: "Saved", message: "Your design has been autosaved." }, children: [] },
  { id: "mui-card-1", type: "MuiCard", name: "Card", style: { position: "absolute", left: 60, top: 320, width: 320 }, componentProps: { title: "Material Design", subtitle: "Built with MUI v7", content: "Switch design systems instantly. Every node re-renders through the active adapter.", actionLabel: "Learn more", variant: "outlined" }, children: [] },
];

// ── Adapter ─────────────────────────────────────────────────────────

const muiAdapter: DesignSystemAdapter = {
  id: "mui",
  name: "Material UI",
  description: "Google's Material Design components (MUI)",
  accentColor: "#1976d2",
  fontFamily: "var(--font-roboto), Roboto, sans-serif",
  renderComponent,
  catalog,
  aiSchema,
  exportConfig,
  defaultNodes,
  guideFile: "guides/mui.md",
};

registerDesignSystem(muiAdapter);

export default muiAdapter;
