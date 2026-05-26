---
name: Energetic Play
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#584238'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#8b7266'
  outline-variant: '#dfc0b3'
  surface-tint: '#9f4200'
  primary: '#9f4200'
  on-primary: '#ffffff'
  primary-container: '#ff7e33'
  on-primary-container: '#632600'
  inverse-primary: '#ffb692'
  secondary: '#0058be'
  on-secondary: '#ffffff'
  secondary-container: '#2170e4'
  on-secondary-container: '#fefcff'
  tertiary: '#795900'
  on-tertiary: '#ffffff'
  tertiary-container: '#ce9a00'
  on-tertiary-container: '#4a3500'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcb'
  primary-fixed-dim: '#ffb692'
  on-primary-fixed: '#341100'
  on-primary-fixed-variant: '#793100'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#ffdf9f'
  tertiary-fixed-dim: '#f9bd22'
  on-tertiary-fixed: '#261a00'
  on-tertiary-fixed-variant: '#5c4300'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-bold:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
  timer-numeric:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 40px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-padding-mobile: 16px
  container-padding-desktop: 32px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
---

## Brand & Style
The design system is engineered to evoke excitement, social connection, and intellectual speed. The target audience is a Gen-Z and Millennial demographic looking for quick, competitive, and visually stimulating entertainment.

The style is **Modern-Playful**, merging the cleanliness of SaaS interfaces with the high-energy aesthetics of casual gaming. It utilizes soft, organic shapes and vibrant gradients to create a "bouncy" and inviting atmosphere. The UI should feel tactile and responsive, encouraging rapid interaction and providing instant visual gratification for every user action.

## Colors
The palette is dominated by **Canlı Turuncu** (Vibrant Orange) to drive energy and **Taze Mavi** (Fresh Blue) to provide a balanced, trustworthy base for functional elements.

- **Primary (Turuncu):** Used for main CTAs, active states, and "Start" actions.
- **Secondary (Mavi):** Used for navigation, informative badges, and secondary buttons.
- **Backgrounds:** A clean `#FFFFFF` base, layered with `#F8FAFC` (Light Grey) for surface containers. 
- **Gradients:** Use linear 135° gradients for large surfaces. Orange (#FF7E33) to Peach (#FFA36F) and Blue (#3B82F6) to Cyan (#60A5FA).
- **Semantic:** Gold (#FBBF24) is strictly reserved for **Liderlik Tablosu** (Leaderboards) and high-tier achievements.

## Typography
This design system utilizes **Plus Jakarta Sans** across all levels to maintain a cohesive, soft, yet modern look. 

- **Headlines:** Use ExtraBold (800) for "Oyun Başladı" style screen titles.
- **Numbers:** Timers and scores use the `timer-numeric` style with tabular figures to prevent horizontal jumping during countdowns.
- **Copy:** All instructional text (e.g., "Soruyu cevaplamak için dokun") uses Medium (500) weight for better legibility on mobile screens.

## Layout & Spacing
The design system follows a **Fluid Grid** model with a mobile-first philosophy.

- **Mobile:** Single column layout with 16px side margins. Cards span the full width.
- **Desktop:** 12-column grid with a max-width of 1200px. Quiz questions are centered in a 6-8 column container to maintain focus.
- **Rhythm:** Use an 8px base grid. Components should use 16px (stack-md) for internal padding and 24px (stack-lg) for vertical separation between sections.

## Elevation & Depth
Depth is created through a combination of **Tonal Layers** and **Soft Shadows**. 

1. **Surface 0 (Base):** Lightest grey background.
2. **Surface 1 (Card):** White background with a 10% opacity primary color shadow (e.g., `#FF7E331A`).
3. **Active State:** Elements use a "Glow" effect—a soft outer shadow using the element's primary color with a 20px blur and 0.3 opacity.

Avoid harsh black shadows; always tint shadows with the primary brand colors (Orange or Blue) to maintain the playful, airy feel.

## Shapes
The shape language is consistently **Rounded**. 

- **Standard Elements:** 16px (1rem) for buttons and cards.
- **Feature Cards:** 24px (1.5rem) for large dashboard widgets.
- **Interactive States:** On press, buttons should visually "squish" (scale down to 0.98) to provide tactile feedback.
- **Icons:** Always use rounded-cap iconography. Avoid sharp corners in any custom illustrations or glyphs.

## Components

### Buttons
- **Primary:** Orange gradient, 16px roundedness, Bold text. "Oyna" (Play).
- **Secondary:** Blue border (2px) or soft blue fill. "Ayarlar" (Settings).
- **Tertiary:** Ghost style for "Vazgeç" (Cancel) or "Geri" (Back).

### Cards
- White background, 24px corner radius, soft orange/blue tinted shadow.
- Header area within the card should have a 5% opacity tint of the category color.

### Input Fields & Selectors
- Large, 16px padding, 12px corner radius.
- **Active state:** 2px Blue border with a soft blue glow.

### Quiz Specifics
- **Option Buttons:** Large, touch-friendly cards. 
- **Correct State:** Green border + "Check" icon.
- **Incorrect State:** Red border + "X" icon + subtle shake animation.
- **Progress Bar:** 12px height, rounded ends, using the Blue-to-Cyan gradient.

### Chips & Badges
- Used for categories (e.g., "Tarih", "Spor"). Pill-shaped (rounded-full), low-contrast background with high-contrast text.