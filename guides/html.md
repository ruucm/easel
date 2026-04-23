## Generic HTML Design System Rules

### Button Usage
- variant "primary" (blue #2563eb): Main actions
- variant "danger" (red #dc2626): Destructive actions
- No variant (white): Secondary/default actions
- All buttons use inline styles, so visual appearance is always explicit

### Layout Patterns
- Use Frame (div) for all containers with display:"flex" and gap
- HtmlCard for content sections with border and padding
- HtmlDivider for horizontal separators
- HtmlTable for tabular data

### Component Usage
- HtmlHeading: level 1-6 for headings
- HtmlInput: set type "text"|"email"|"password"|"number", add label and placeholder
- HtmlSelect: pass options as string array
- HtmlCheckbox/HtmlRadio: always provide label
- HtmlBadge: color "blue"|"green"|"red"|"yellow" for status
- HtmlAlert: type "info"|"success"|"warning"|"error"
- HtmlProgress: value 0-100
- HtmlAvatar: pass initials and optional color
- HtmlImage: set width/height in style, src is placeholder
- HtmlList: pass items as string array, ordered true/false

### Style Rules
- HTML components use inline styles directly, so backgroundColor/color in style IS expected for Frames and Text
- For components (HtmlButton, HtmlBadge, etc.), use componentProps (variant, color) instead of style
- Use system fonts: -apple-system, BlinkMacSystemFont, system-ui
- Standard border: 1px solid #d1d5db
- Standard border-radius: 6px
