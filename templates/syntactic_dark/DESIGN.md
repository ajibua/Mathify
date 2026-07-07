---
name: Syntactic Dark
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#bac9cd'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#859397'
  outline-variant: '#3b494c'
  surface-tint: '#00daf8'
  primary: '#baf2ff'
  on-primary: '#00363f'
  primary-container: '#00e0ff'
  on-primary-container: '#005f6d'
  inverse-primary: '#006877'
  secondary: '#ffffff'
  on-secondary: '#223600'
  secondary-container: '#a9f900'
  on-secondary-container: '#496f00'
  tertiary: '#efe4ff'
  on-tertiary: '#3c0090'
  tertiary-container: '#d6c3ff'
  on-tertiary-container: '#6900f1'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#a5eeff'
  primary-fixed-dim: '#00daf8'
  on-primary-fixed: '#001f25'
  on-primary-fixed-variant: '#004e5a'
  secondary-fixed: '#a9f900'
  secondary-fixed-dim: '#94db00'
  on-secondary-fixed: '#121f00'
  on-secondary-fixed-variant: '#334f00'
  tertiary-fixed: '#e9ddff'
  tertiary-fixed-dim: '#d1bcff'
  on-tertiary-fixed: '#23005b'
  on-tertiary-fixed-variant: '#5700c9'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.2'
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
  math-display:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style

The design system is engineered for a high-energy, intellectual social ecosystem where mathematical precision meets modern digital aesthetics. It targets a demographic that values logic, discovery, and rapid information exchange. 

The visual style is a hybrid of **High-Contrast Minimalism** and **Glassmorphism**. It utilizes a "True Black" foundation to allow vibrant, neon-soaked accents to vibrate against the canvas, mirroring the intensity of a late-night coding or theorem-solving session. The interface feels fast, technical, and premium, using light and transparency to signify hierarchy rather than traditional skeuomorphism.

## Colors

The palette is anchored in a dual-tone dark mode. The **Pitch Black (#000000)** base is used for the primary background to maximize OLED contrast, while **Deep Charcoal (#121212)** defines elevated surfaces like cards and headers.

**Electric Blue** serves as the primary action color, used for high-priority calls to action and active navigation states. **Lime Green** is reserved for success states, mathematical highlights, and progress indicators, providing a high-visibility counterpoint to the blue. All interactive elements must maintain a high contrast ratio against the charcoal surfaces to ensure legibility during high-energy use.

## Typography

This design system uses a technical typographic pairing to balance social energy with academic rigor. **Space Grotesk** is used for headlines; its geometric quirks and wide apertures feel futuristic and bold. **Geist** handles all body copy and UI labels, providing a highly legible, monospaced-adjacent aesthetic that feels right at home with mathematical notation and LaTeX rendering.

Mathematical formulas should be rendered using the `math-display` token, which provides extra horizontal breathing room. For complex LaTeX strings, use a subtle `secondary_color_hex` tint to distinguish variables from plain text.

## Layout & Spacing

The layout follows a rigid 12-column fluid grid system. Given the mathematical nature of the content, the spacing rhythm is strictly based on a **4px baseline grid**. 

- **Desktop:** 12 columns with a maximum content width of 1200px.
- **Mobile:** 4 columns with 16px side margins.
- **Content Density:** Elements are packed with tight gutters (16px) to maintain a high-information density suitable for technical discussions, while using large `xl` vertical padding between distinct "proofs" or social posts to prevent visual clutter.

## Elevation & Depth

Depth is achieved through **Tonal Layering** and **Backdrop Blurs** rather than traditional drop shadows.

1.  **Level 0 (Base):** Pitch Black (#000000). Used for the main background.
2.  **Level 1 (Surface):** Deep Charcoal (#121212). Used for cards and feed items.
3.  **Level 2 (Overlay):** Glassmorphic surfaces with a 20px backdrop blur and a 10% white border. Used for navigation bars and floating action menus.

To emphasize active mathematical proofs or highlighted content, use a "Neon Glow"—a soft, 15px outer blur utilizing the `primary_color_hex` at 20% opacity.

## Shapes

The design system utilizes **Level 2 (Rounded)** shapes to soften the technical edge of the typography. 

- **Standard Elements:** 0.5rem (8px) radius for buttons and input fields.
- **Content Cards:** 1rem (16px) radius to create clear containment for complex formulas.
- **Active Indicators:** Pill-shaped (3rem) for tags, chips, and progress bar caps to provide a modern, "Spotify-inspired" kinetic energy.

## Components

### Buttons
- **Primary:** Electric Blue fill with Pitch Black text. Bold weight. No border.
- **Secondary:** Transparent fill with a 1px Electric Blue border and Electric Blue text.
- **Ghost:** White text with no background, used for secondary actions within cards.

### Cards
Cards use the `background_surface_hex` (#121212). They should not have shadows; instead, use a subtle 1px border of #282828 to separate them from the black background.

### Mathematical LaTeX Blocks
Inline math uses a slight Lime Green text color. Block-level math is housed in an inset container with a slightly darker-than-surface background and a left-accent border using the Lime Green highlight.

### Progress Bars
Ultra-slim (4px height). The track is #282828, and the indicator is a gradient from Electric Blue to Lime Green, suggesting movement and energy.

### Navigation Overlays
Bottom navigation and top headers use glassmorphism. Ensure the `backdrop-filter: blur(20px)` is applied to maintain legibility of the content scrolling underneath.