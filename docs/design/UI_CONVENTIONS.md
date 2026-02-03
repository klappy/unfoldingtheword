# UI/UX Conventions

## Color System

Resource types have consistent color coding throughout the app:

| Type | Color | Tailwind Class |
|------|-------|----------------|
| Scripture | Amber | `text-amber-400`, `bg-amber-400/10` |
| Notes | Emerald | `text-emerald-400`, `bg-emerald-400/10` |
| Questions | Violet | `text-violet-400`, `bg-violet-400/10` |
| Words | Rose | `text-rose-400`, `bg-rose-400/10` |
| Academy | Sky | `text-sky-400`, `bg-sky-400/10` |

## Icons

Use Lucide icons consistently:

- `BookMarked` - Scripture
- `FileText` - Notes
- `HelpCircle` - Questions
- `BookOpen` - Words
- `GraduationCap` - Academy
- `Search` - Search
- `X` - Close/Clear

## Card Patterns

### Glass Cards
Use `glass-card` class for elevated content areas with backdrop blur.

### Result Cards
- Max width: `max-w-xl mx-auto` for readability
- Rounded corners: `rounded-xl` or `rounded-lg`
- Border: `border border-border/30`

## Interactive Elements

### Buttons
- Filter badges: `px-2 py-1 rounded-md` with hover states
- Touch targets: Minimum 44x44px for mobile accessibility

### Expand/Collapse
- Use `ChevronDown`/`ChevronUp` icons
- Animate with `framer-motion` for content reveal
- Progressive rendering: Show 10 items initially, "Show more" for rest

## Animations

### Verse Highlight
When navigating to a verse, apply `animate-verse-highlight` keyframe that fades primary background in/out over 1.5s.

### Fade In
Use `animate-fade-in` for new content appearing.

## Accessibility

- All interactive elements need `aria-label` when icon-only
- Keyboard navigation: `tabIndex={0}` and `onKeyDown` for Enter key
- Screen reader text for counts: "Filter to X scripture results"
