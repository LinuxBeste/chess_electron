# Visual Design

## Theme

| Role            | Value        | Usage                           |
|-----------------|--------------|----------------------------------|
| Background      | `#0e0e10`   | App background, deepest layer    |
| Surface         | `#1a1a1f`    | Cards, panels, player bars       |
| Elevated        | `#222228`    | Game cards, modals               |
| Light square    | `#3d3d52`    | Chess board light squares        |
| Dark square     | `#2c2c38`    | Chess board dark squares         |
| Accent          | `#4f8ef7`    | Buttons, highlights, active states|
| Danger          | `rgba(220,80,80,0.7)` | Resign button            |
| Text            | `#e0e0e0`    | Primary text                     |
| Muted text      | `#888`       | Labels, secondary text           |
| Board shadow    | `rgba(0,0,0,0.4)` | Board drop shadow          |

## Typography

- Font: Inter (loaded from Google Fonts)
- Weights: 300 (labels), 500 (body), 700 (headings)
- Letter spacing: tight throughout
- Tabular numbers on clocks for stable width

## Board

- 8×8 grid of absolute-positioned divs
- Algebraic labels in bottom-right corner and top-left corner of edge squares
- Selected square: `rgba(79,142,247,0.25)` overlay
- Legal move dots: 12px circles on empty squares, full-size overlay on capturable squares
- Last move: `rgba(255,200,100,0.15-0.2)` warm tint
- Check: animated red glow via `box-shadow` keyframes (`checkGlow`)
- Drag ghost: `scale(1.08)`, `drop-shadow(0 4px 8px)`, original square at 30% opacity

## Transitions

- Interactive elements: 150ms ease
- Layout changes: 300ms ease
- Piece slide animation: 220ms `cubic-bezier(0.25, 0.46, 0.45, 0.94)`
- Toast: 200ms ease slide-in
- Result modal: 300ms `cubic-bezier(0.34, 1.56, 0.64, 1)` scale-in

## Component Styles

### Cards
- `border-radius: 12px`
- `border: 1px solid rgba(255,255,255,0.06)`
- `box-shadow: 0 4px 16px rgba(0,0,0,0.3)`

### Buttons (primary)
- Background: `#4f8ef7`
- Hover: `#5d9af8`
- Active: `scale(0.98)`

### Buttons (secondary)
- Transparent background with accent border
- Hover fills with accent color

### Input
- Borderless with animated bottom border
- Focus: border transitions from dim to accent blue
- Error: border transitions to red, auto-resets after 2s

### Toast
- Fixed position top-center
- Error background: `rgba(220,50,50,0.95)`
- Info background: `rgba(79,142,247,0.95)`
- Auto-dismiss after 4 seconds

### Scrollbars
- Thin (6px)
- Track: transparent
- Thumb: `rgba(255,255,255,0.1)`, hover: `rgba(255,255,255,0.2)`
