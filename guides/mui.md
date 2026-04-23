## Material UI (MUI) Design System Rules

### Button Usage
- variant "contained": Primary CTA (filled, elevated) — main actions like "Save", "Submit"
- variant "outlined": Secondary actions — "Cancel", "Back"
- variant "text": Tertiary/inline actions
- color "primary" (blue), "error" (red), "success" (green), "inherit" (neutral)
- size "small", "medium", "large"

### Layout Patterns
- Use Frame containers with display:"flex" for layout, not MUI Box
- Cards: always use MuiCard with CardContent wrapper. Add Typography for titles
- Forms: use MuiTextField with label prop. Prefer variant "outlined"
- Use MuiDivider between sections

### Component Usage
- Typography: use variant prop (h1-h6, subtitle1/2, body1/2, caption, overline). Set via componentProps, not style
- Chip: for tags/filters. Use variant "filled" or "outlined", color "primary"/"default"/"error"
- Switch/Checkbox: wrap with FormControlLabel using label prop
- Alert: severity "success"|"info"|"warning"|"error". Include AlertTitle for emphasis
- Tabs: pass tabs as string array, use for view switching
- Avatar: pass initials prop for text avatars

### Style Rules
- DO NOT set backgroundColor, color, border, or borderRadius in node.style for MUI components — the component theme handles it
- Only set layout styles: position, width, height, display, flex, gap, padding, margin, alignItems, justifyContent
- Material Design uses 8px grid: prefer padding/margin multiples of 8
- Elevation via boxShadow on Frame containers, not on components
