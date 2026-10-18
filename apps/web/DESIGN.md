---
name: sass-retail Web
description: Bright, organized back-office UI for a multi-tenant retail SaaS — white cards on daylight-grey, one trust-blue voice.
colors:
  primary: "#2563eb"
  primary-hover: "#1d4ed8"
  primary-disabled: "#93c5fd"
  page-bg: "#f5f6f8"
  surface: "#ffffff"
  text-strong: "#111827"
  text-label: "#374151"
  text-muted: "#6b7280"
  border: "#d1d5db"
  error: "#dc2626"
typography:
  headline:
    fontFamily: "system-ui, sans-serif"
    fontSize: "1.4rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  body:
    fontFamily: "system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: "normal"
    letterSpacing: "normal"
  label:
    fontFamily: "system-ui, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  control: "8px"
  card: "12px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1.25rem"
  xl: "2rem"
  2xl: "2.5rem"
components:
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.card}"
    padding: "2rem 2.5rem"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "0.55rem 1.25rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-primary-disabled:
    backgroundColor: "{colors.primary-disabled}"
  button-primary-block:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "0.55rem 1.25rem"
  input-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.control}"
    padding: "0.5rem 0.75rem"
---

# Design System: sass-retail Web

## Overview

**Creative North Star: "The Well-Lit Stockroom"**

This is an organized-clarity system for a retail back office: a bright, evenly lit space where every item is findable and every state is visible. Pages are single-purpose — one centered white card on a quiet daylight-grey floor — with generous whitespace and no ornament. The look is intentionally modest: the incumbent UI is placeholder-grade utility, and this record documents that baseline faithfully rather than dressing it up.

Density is low and language is plain. Color is almost entirely neutral; one blue speaks for every interactive intent (actions, links, focus). There is no motion vocabulary yet — state changes are instant, and the only affordance beyond color is the `wait` cursor on disabled submitting buttons.

**Key characteristics:**

- One card per page, centered both axes, 26rem wide
- Card content left-aligned — the card is centered, its content is not
- A single accent blue used for action, focus, and links
- Soft 8px controls inside softer 12px cards
- One ambient shadow per page, carried by the card only
- Footer meta separated by a 1px hairline divider
- One authored entrance moment — the card rises into place (reduced-motion respected)
- The same system overlays the Keycloak login page (CSS-only theme over stock keycloak.v2 markup)

## Colors

A near-monochrome neutral palette with one trustworthy blue accent; nothing saturated competes for attention.

### Primary
- **Daylight Blue** (#2563eb): the single voice of interactivity — submit buttons, links, and the input focus ring all share it. Chosen for plain trustworthiness, not vibrancy.
- **Deep Water Blue** (#1d4ed8): hover state of Daylight Blue on primary buttons; darker, never lighter, so hovering always signals "pressing in".
- **Faded Sky Blue** (#93c5fd): disabled/pending primary buttons. The same blue drained of commitment while the workspace is created.

### Neutral
- **Stockroom Floor** (#f5f6f8): full-page background. Just off-white and cool, so white cards lift without a visible edge.
- **White** (#ffffff): card surfaces and all button text on blue.
- **Ink** (#111827): implied default text color (browser default on white); headings and input values.
- **Slate Label** (#374151): form labels — one step softer than Ink so labels guide without shouting.
- **Shelf Grey** (#6b7280): secondary/muted text — helper lines, footnotes, inactive hints.
- **Wire Grey** (#d1d5db): input borders. The quietest border that still reads as a field.

### Tertiary
- **Ledger Red** (#dc2626): error text only — API failures and validation problems. Never used decoratively.

### Named Rules
**The Single Voice Rule.** Daylight Blue is the only accent on any screen, shared by buttons, links, and focus rings. If a second hue appears for decoration, the system is broken.

**The Shadow-As-Structure Rule.** Shadow exists to lift the one working card off the Stockroom Floor — never as hover garnish or depth theater.

## Typography

**Body Font:** system-ui (native sans-serif stack)
**Headline Font:** system-ui, bold (700) — same stack as body, differentiated by size and weight only

**Character:** Native and unbranded: the OS's own UI voice. Personality comes from scale restraint — a modest 1.4rem headline tops even page-level cards.

### Hierarchy
- **Headline** (1.4rem / 700): the single h1 per card — the task title ("Create your workspace").
- **Body** (0.95rem / 400): paragraphs, form feedback, and button text (compact contexts drop to 0.85rem).
- **Label** (0.85rem / 400): field labels, helper/muted text, error text — the smallest voice in the system.

## Layout

Centered single-column layouts. The page is a full-viewport grid that centers its card both vertically and horizontally, with 1rem breathing room so small viewports never touch the edges.

- **Shell**: `min-height: 100vh; display: grid; padding: 1rem;` — the card centers itself with `margin: auto` (never `place-items: center`, which clips a card taller than the viewport and overflows the shell).
- **Card widths**: 26rem on all current screens (sign-in, signup, confirmation states).
- **Rhythm inside cards**: 0.75rem between form fields; 0.25rem between a label and its input (or its helper hint); 1.5rem above the primary action; 1.25rem + 1rem padding above the footer divider.
- **Alignment**: cards center themselves; their content is left-aligned — title, helper, form, action, and footer read as one column. Footer meta (alternate paths) sits under a 1px hairline divider.
- **Motion**: one authored moment per page — the card rises 6px into place over 240ms with an exponential ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`); `prefers-reduced-motion` disables it entirely.
- **No breakpoints yet** — the fixed max-width plus shell padding is the entire responsive strategy, adequate for the auth surfaces.

## Elevation & Depth

Depth is two layers only: the Stockroom Floor (page) and the card above it.

- **Card ambient** (`0 2px 12px rgb(0 0 0 / 8%)`): one soft, diffuse shadow per page, reserved for the working card. Its role is structural — it says "this is the surface you work in."
- Nothing else casts shadow: no hover lifts, no nested shadows, no dropdowns yet. When new surfaces arrive, a shadow means a working layer, nothing less.

## Shapes

Rounded everything, gently — a friendly stockroom, not a rounded-toy app.

- **Cards**: 12px radius — the softest container edge in the system.
- **Controls** (buttons, inputs): 8px radius — consistently softer than their container.
- **Borders**: 1px solid Wire Grey on inputs; buttons and cards are borderless, carried by fill and shadow respectively.
- **Focus**: 2px solid Daylight Blue outline with a transparent border — the focus ring replaces the border rather than sitting beside it.

## Components

Only components that exist are documented; no invented variants.

### Card
The page's single working surface: white, 12px radius, 2rem × 2.5rem padding, left-aligned content, 26rem max-width, one ambient shadow, one entrance rise. Every screen is built around exactly one.

### Primary Button
Daylight Blue fill, white text, 8px radius, 0.55rem × 1.25rem padding, weight 500, no border. In single-action cards it spans the full card width (block variant). Hover deepens to Deep Water Blue; disabled/pending fades to Faded Sky Blue with a `wait` cursor. The submitting state swaps the label text ("Creating…") rather than adding a spinner.

### Text Input
White field, 1px Wire Grey border, 8px radius, 0.5rem × 0.75rem padding, 0.95rem text. Label sits stacked above (0.85rem Slate Label) with an optional persistent helper hint; focus is the Daylight Blue ring replacing the border. Each field carries a concrete placeholder ("Acme Retail", "you@company.com").

### Hairline Divider
A 1px Wire Grey rule that separates footer meta (alternate paths like "New here?") from the main content above — the quietest separation that still reads as a group boundary.

### Link
Daylight Blue, no underline by default, embedded in muted helper text ("New here? Create your workspace"). Link and primary button share the same blue — same action voice.

### Muted & Error Text
Shelf Grey at 0.85rem for helper lines and confirmations; Ledger Red at 0.85rem for errors, always inside the card near the action it explains, announced via `role="alert"`.

### Keycloak Login Pages
The stock `keycloak.v2` login markup is overlaid CSS-only with these exact tokens (see `infrastructure/keycloak/themes/retail/login/resources/css/custom.css`): Stockroom Floor shell, wordmark row above the card, the same card/title/input/button/alert treatment, blue caret and themed autofill. Verb case matches the SPA ("Sign in"); headings are task-focused ("Sign in to your workspace").

## Do's and Don'ts

**Do** reuse the one card + one blue voice for every new screen until a real second component proves necessary.
**Do** keep all sizing in the existing rem scale (0.25–2.5rem steps) and radii at 8px/12px.
**Do** show state through the established channels: disabled fill for pending, Ledger Red text for failure, swapped label text for progress.
**Do** theme the browser surfaces (selection, caret, autofill, focus rings) from the palette on every new surface — they are part of the design, not leftovers.
**Don't** add a second accent hue, a webfont, or a hover shadow — the Single Voice and Shadow-As-Structure Rules forbid all three.
**Don't** invent elevation layers, gradients, or a second motion moment; the entrance rise is the page's one authored movement.
**Don't** exceed the 26rem card width or stack a second card on a page without revisiting this document first.



