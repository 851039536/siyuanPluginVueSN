## Context
The WordQueryPanel component currently uses a generic UI design with gradients, shadows, and colorful styling. This document outlines the adoption of GitHub's design system to create a more professional, clean, and familiar interface for developers.

## Goals / Non-Goals
- Goals:
  - Adopt GitHub's minimalist design language
  - Improve readability and visual hierarchy
  - Create a consistent experience with developer tools
  - Maintain all existing functionality without changes
  - Ensure accessibility standards are met

- Non-Goals:
  - No changes to component functionality or behavior
  - No new features - only UI/UX improvements
  - No changes to responsive layout behavior

## Decisions

### Color Palette
Adopt GitHub's color variables:
- Primary: `#0969da` (GitHub blue)
- Success: `#1a7f37` (green)
- Danger: `#cf222e` (red)
- Warning: `#9a6700` (yellow)
- Background: `#ffffff` (light) / `#0d1117` (dark)
- Border: `#d0d7de` (light) / `#30363d` (dark)
- Text: `#24292f` (light) / `#f0f6fc` (dark)

### Typography
- Font: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif
- Sizes: 12px (small), 14px (base), 16px (medium)
- Weights: 400 (normal), 500 (medium), 600 (semibold)

### Spacing
- Base unit: 8px
- Padding: 8px, 16px, 24px
- Margins: 8px, 16px, 32px
- Border radius: 6px (default), 8px (large)

### Component Styles

#### Buttons
- Default: `#f6f8fa` background, `#24292f` text, `#d0d7de` border
- Hover: `#f3f4f6` background
- Active: `#d0d7de` background
- Primary: `#0969da` background, white text
- No gradients or shadows

#### Input Fields
- Background: `#ffffff`
- Border: `#d0d7de`
- Focus border: `#0969da`
- Padding: 8px 12px
- Border radius: 6px

#### Tabs
- Underline style indicator
- Default: transparent background
- Active: `#0969da` text color with underline
- Hover: `#24292f` text color

#### Cards/Containers
- Background: `#ffffff`
- Border: `#d0d7de`
- Border radius: 6px
- Padding: 16px
- No shadows

#### Loading States
- Use CSS animations similar to GitHub's spinner
- Color: `#0969da`

### Alternatives considered
1. **Material Design**: More playful, but doesn't match developer tooling aesthetic
2. **Fluent Design**: Microsoft-focused, not as widely recognized in web development
3. **Ant Design**: Good component library, but GitHub's style is more minimal and recognizable

## Risks / Trade-offs
- Risk: Users accustomed to current colorful UI may find GitHub style too plain
  - Mitigation: Maintain good contrast and visual hierarchy
- Trade-off: Less visual distinction between elements
  - Mitigation: Use GitHub's established patterns for clear differentiation

## Migration Plan
1. Update SCSS variables to use GitHub color palette
2. Modify component classes to match GitHub styling patterns
3. Test with both light and dark SiYuan themes
4. Verify all animations and transitions remain smooth
5. Ensure accessibility (contrast ratios) are maintained

## Open Questions
- Should we adopt GitHub's dark mode colors for SiYuan dark themes?
- How to handle theming - should we follow SiYuan theme or GitHub theme?