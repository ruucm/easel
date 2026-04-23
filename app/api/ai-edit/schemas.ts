/**
 * Server-side AI schema registry.
 * Each design system's schema describes its available component types and props
 * so the AI can generate valid CanvasNode JSON.
 *
 * To add a new design system, add its schema string here with its adapter ID as key.
 */

export const dsSchemas: Record<string, string> = {
  html: `Design System: Generic HTML (no external library)

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

IMPORTANT: This design system uses ONLY native HTML elements with inline styles. No external library imports needed. Style everything with CSS properties for a clean, modern look.`,

  shadcn: `Design System: shadcn/ui

A CanvasNode has this structure:
{
  id: string,
  type: "Frame" | "Text" | "ShadcnButton" | "ShadcnInput" | "ShadcnTextarea" | "ShadcnSelect" | "ShadcnCard" | "ShadcnBadge" | "ShadcnAlert" | "ShadcnAvatar" | "ShadcnCheckbox" | "ShadcnSwitch" | "ShadcnRadioGroup" | "ShadcnProgress" | "ShadcnTabs" | "ShadcnSeparator" | "ShadcnSkeleton" | "ShadcnTable" | "ShadcnTooltip",
  name: string,
  style: React.CSSProperties,
  children: CanvasNode[],
  text?: string,
  componentProps?: {
    // ShadcnButton: { label: string, variant: "default"|"secondary"|"destructive"|"outline"|"ghost"|"link", size: "default"|"sm"|"lg"|"icon", disabled?: boolean }
    // ShadcnInput: { label?: string, placeholder?: string, inputType?: "text"|"email"|"password"|"number", description?: string }
    // ShadcnTextarea: { label?: string, placeholder?: string, rows?: number }
    // ShadcnSelect: { label?: string, placeholder?: string, value?: string }
    // ShadcnCard: { title?: string, description?: string, content?: string, footer?: string }
    // ShadcnBadge: { text: string, variant: "default"|"secondary"|"destructive"|"outline" }
    // ShadcnAlert: { title?: string, description: string, variant: "default"|"destructive" }
    // ShadcnAvatar: { fallback: string, size?: number }
    // ShadcnCheckbox: { label?: string, checked?: boolean }
    // ShadcnSwitch: { label?: string, checked?: boolean }
    // ShadcnRadioGroup: { items: [{label: string, value: string}], value?: string }
    // ShadcnProgress: { value: number (0-100) }
    // ShadcnTabs: { tabs: string[], activeTab?: number }
    // ShadcnSeparator: { orientation?: "horizontal"|"vertical" }
    // ShadcnSkeleton: { height?: number, shape?: "rectangle"|"circle", size?: number }
    // ShadcnTable: { headers: string[], rows: string[][] }
    // ShadcnTooltip: { content: string, trigger: string }
  }
}

The design should follow shadcn/ui aesthetics: clean, minimal, neutral gray palette, rounded corners (6px), subtle borders, excellent typography.`,

  mui: `Design System: Material UI (MUI v6)

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

Follow Material Design 3 aesthetics: rounded corners, elevated surfaces, vibrant but balanced colors.`,
};
