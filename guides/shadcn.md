## shadcn/ui Design System Rules

### Button Variants
- "default" (black bg, white text): Primary CTA — use for the main action
- "outline" (border, no fill): Secondary CTA — use for cancel, back, or less important actions
- "secondary" (gray bg): Tertiary actions
- "destructive" (red): Danger/delete actions only
- NEVER use "ghost" or "link" for action buttons — they look like plain text. Use "outline" instead.

### Layout Patterns
- Always wrap designs in a root Frame with display:"flex", flexDirection:"column"
- Use Frame for layout containers with display:"flex" and gap for spacing
- Use Separator between logical sections
- Cards should use ShadcnCard with title, description, content, footer props

### Component Usage
- Badge: for labels/tags, not for buttons. Variants: "default", "secondary", "outline", "destructive"
- Tabs: for switching content views. Pass tabs as string array
- Checkbox: always add a label prop
- Switch: always add a label prop
- Input: set inputType for email/password fields, add label and placeholder
- Progress: value 0-100

### Style Rules
- DO NOT set backgroundColor, color, border, borderRadius, padding, fontSize, or fontWeight in node.style for components — let the component variant handle it
- For ShadcnButton: only set width:"100%" in style if you want full-width. Never set background/color/border/padding in style.
- Only set layout styles in node.style: position, width, height, display, flex, gap, margin, alignItems, justifyContent
- Text color via style is only allowed on Text nodes
- Keep designs clean and minimal with generous whitespace
