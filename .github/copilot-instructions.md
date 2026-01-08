# Video Uploader - Copilot UI Guidelines

## Design System

### Theme: Dark Mode (ClickUp-inspired)

This project uses a modern dark theme inspired by ClickUp's UI design. All components should follow these design principles.

---

## Color Palette

### Primary Colors

- **Background**: `hsl(220 20% 10%)` - Deep dark blue-gray (#181b20)
- **Card/Surface**: `hsl(220 18% 13%)` - Slightly lighter surface (#1e2127)
- **Sidebar**: `hsl(220 20% 12%)` - Sidebar background (#1a1e24)

### Accent Colors

- **Primary**: `hsl(160 84% 39%)` - Teal/Green accent (#00b37e)
- **Primary Foreground**: `hsl(210 40% 98%)` - White text on primary

### Text Colors

- **Foreground**: `hsl(210 40% 98%)` - Primary text (white/light)
- **Muted Foreground**: `hsl(215 20% 55%)` - Secondary text (gray)

### Border & Input

- **Border**: `hsl(220 14% 20%)` - Subtle borders (#2d3139)
- **Input**: `hsl(220 14% 18%)` - Input backgrounds

### Status Colors

- **Success/Primary**: Teal/Green `#00b37e`
- **Destructive**: `hsl(0 72% 51%)` - Red for errors
- **Android**: Emerald `#10b981`
- **iOS**: Blue `#3b82f6`
- **Web**: Purple `#8b5cf6`

---

## Component Guidelines

### Cards

```jsx
// Use translucent backgrounds with subtle borders
className =
  "bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl shadow-lg";
```

### Buttons

```jsx
// Primary buttons
className =
  "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/25";

// Secondary/Ghost buttons
className = "bg-secondary hover:bg-secondary/80 text-foreground";
```

### Navigation Items

```jsx
// Active state
className = "bg-primary text-primary-foreground shadow-md shadow-primary/25";

// Inactive state
className = "text-muted-foreground hover:bg-secondary hover:text-foreground";
```

### Form Inputs

```jsx
className =
  "bg-input border-border/50 focus:border-primary focus:ring-primary/20";
```

### Badges

```jsx
// Use semi-transparent backgrounds
className = "bg-primary/20 text-primary border border-primary/30";
```

---

## Spacing & Layout

### Border Radius

- Small elements: `rounded-lg` (0.5rem)
- Cards/Modals: `rounded-xl` (0.75rem)
- Buttons: `rounded-lg`
- Full round: `rounded-full` (pills, avatars)

### Shadows

- Use colored shadows for primary elements: `shadow-primary/25`
- Use subtle shadows for cards: `shadow-lg`
- Avoid harsh black shadows

### Spacing Scale

- Compact: `p-2`, `gap-2`
- Standard: `p-4`, `gap-4`
- Spacious: `p-6`, `gap-6`

---

## Animation & Transitions

### Standard Transition

```jsx
className = "transition-all duration-200";
```

### Hover Effects

- Subtle background color changes
- No aggressive scale transforms
- Smooth opacity transitions

### Loading States

- Use `animate-pulse` for skeleton loading
- Use `animate-spin` for spinners

---

## Typography

### Headings

- `text-lg font-bold` - Page titles
- `text-base font-semibold` - Section headers
- `text-sm font-medium` - Labels

### Body Text

- `text-sm` - Standard body text
- `text-xs` - Small/secondary text
- `text-muted-foreground` - Subdued text

---

## Icons

Use **Lucide React** for all icons:

```jsx
import {
  Upload,
  Clock,
  Video,
  Menu,
  X,
  FolderUp,
  Settings,
} from "lucide-react";
```

### Icon Sizes

- Navigation: `h-5 w-5`
- Buttons: `h-4 w-4`
- Large decorative: `h-6 w-6` or larger

---

## Best Practices

1. **Always use theme variables** - Never hardcode colors
2. **Use opacity modifiers** - `/80`, `/50`, `/20` for subtle variations
3. **Backdrop blur** - Use `backdrop-blur-sm` on overlays and modals
4. **Border opacity** - Use `border-border/50` or `border-border/30` for subtle borders
5. **Gradient accents** - `bg-gradient-to-br from-primary to-primary/70` for branded elements
6. **Consistent spacing** - Follow the spacing scale
7. **Mobile-first** - Design for mobile, enhance for desktop

---

## File Structure

```
src/
├── components/
│   ├── ui/           # Reusable UI primitives (button, card, badge, etc.)
│   ├── Layout.jsx    # Main layout with sidebar
│   └── *.jsx         # Feature components
├── pages/            # Route pages
├── context/          # React context providers
├── lib/              # Utilities and helpers
└── index.css         # Theme configuration
```

---

## Example Component

```jsx
const ExampleCard = ({ title, children }) => (
  <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-lg">
    <h3 className="text-base font-semibold text-foreground mb-4">{title}</h3>
    <div className="text-sm text-muted-foreground">{children}</div>
  </div>
);
```
