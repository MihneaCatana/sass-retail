---
name: Storeboard Web
description: Calm green workspaces for Romanian SMB owners and their teams.
colors:
  primary: "#163d36"
  primary-hover: "#24564c"
  on-primary: "#ffffff"
  accent: "#d6f86a"
  background: "#f7faf8"
  surface: "#fcfdfd"
  surface-white: "#ffffff"
  surface-muted: "#edf4ef"
  primary-container: "#dceee3"
  ink: "#152333"
  muted: "#526a60"
  border: "#dce7e1"
  outline: "#789488"
  inverse-muted: "#bed5c9"
  inverse-border: "#3d6055"
  error: "#b42318"
  success: "#27713c"
typography:
  headline:
    fontFamily: "system-ui, sans-serif"
    fontSize: "clamp(1.8rem, 3vw, 2.6rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.04em"
  title:
    fontFamily: "system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
  body:
    fontFamily: "system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  control: "8px"
  surface: "12px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
  section: "2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.control}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.primary}"
    rounded: "{rounded.control}"
  field:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  working-surface:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "clamp(1.2rem, 3vw, 2.5rem)"
  navigation:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  navigation-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.primary}"
    rounded: "{rounded.control}"
  status-active:
    backgroundColor: "#dcfce7"
    textColor: "#166534"
---

# Design System: Storeboard Web

## Overview

Storeboard's approved identity is a calm, organized green workspace: a dark
navigation frame, light working surfaces, restrained lime accents, and clear
operational content. This refresh consolidates the accepted Storeboard extension
and supersedes the obsolete blue-only, single-centered-card baseline.

Optimize for owners and staff using the product between customer-facing tasks.
Make the next action, current balance, validation feedback, and recovery path easy
to find. Brand character comes from color, typography, spacing, and dependable
behavior rather than decorative components.

Key characteristics:

- Forest-green navigation and primary actions; lime for selected navigation.
- Neutral working surfaces, thin dividers, and readable quantities.
- Angular Material controls with app-specific shells and shared data components.
- Romanian/English content and responsive, keyboard-accessible operation.

The normative tokens above are evidenced by global styles and recurring component
styles. This document also gives forward guidelines for composing those components;
it does not certify that every existing screen already meets every guideline.
Runtime tokens live in `src/styles.scss`. Preview extensions live in
`../../.impeccable/design.json`. Do not create a second competing design document.

## Colors

### Primary

Forest green carries primary actions, navigation, links, and focus on light
surfaces. Use the deeper hover variant for authored buttons; use Material's
semantic interaction states on Material controls. White is the inverse foreground.

### Secondary

Lime marks the active navigation destination and occasional emphasis already used
in the workspace overview. It is not a universal button fill, an error color, or a
substitute for a selected-state label. Use dark green text on lime.

### Neutral

Use the page background outside working surfaces; white/off-white for forms and
tables; muted green-grey for secondary content; border for surface separators and
outline for field boundaries. On the dark sidebar use inverse-muted text and
inverse-border separators instead of light-surface muted colors.

### Feedback

Use error and success colors with an explicit message or status label. Existing
active/suspended badges also use semantic green/red backgrounds. Color alone must
never distinguish success, failure, reversal, or selection.

**The Semantic Color Rule.** Reuse global `--sb-*` and `--mat-sys-*` roles in new
styles. Adjust shared theme roles when a component needs a systematic change;
do not target private Material DOM/classes.

Known drift, not new design rules: the generated Material palette still originates
from the prior blue seed; explicit green overrides supply the accepted primary
roles. Some global selection styling, comments, and local literals retain older
values. This documentation task does not regenerate the palette or change UI code.

## Typography

Use the installed system UI sans-serif stack for operational screens. Page
headings use the headline role; section and product headings use title; body and
field labels use their corresponding roles. Tables commonly use compact body
text (0.9rem) and secondary metadata (0.85rem).

Use one task-level h1 per routed working page and semantic h2 sections. Long
Romanian labels and product names must wrap without clipping. Use tabular numerals
for balances, deltas, prices, and aligned numeric columns. Monospace is appropriate
for SKU/reference data where helpful, not as a general brand voice.

Auth promotional headings and dashboard titles have larger existing local scales;
do not spread them into inventory forms. Existing decorative overlines, unusually
tight tracking, and duplicated headings are not reusable prescriptions.

## Layout

The desktop app shell uses a navigation column (15rem) and a flexible
`minmax(0, 1fr)` content column. The sidebar stays at the viewport top and fills
the viewport height. Page padding is fluid (1rem to 2.5rem); working surfaces are
left aligned and grow up to 75rem. Product metadata forms have a narrower maximum
width (42rem). Do not center every operational page inside a 26rem auth card.

Use tight spacing within related controls and more separation between sections.
Working-surface padding is fluid (1.2rem to 2.5rem). A stock form uses two columns
for action and quantity, with reason/helper copy spanning the row.

Observed responsive boundaries:

| Width | Composition |
| --- | --- |
| At or below 720px | Sidebar becomes a compact brand bar with hamburger disclosure |
| At or below 620px | Stock summary/form/history stack; action rows and pagination wrap |
| At or below 800px | Auth task precedes its supporting brand content |
| At or below 900px | Workspace overview simplifies its feature grid |

Mobile navigation is a disclosure, not a modal: open content stays in page flow,
contains section links, language controls, and sign out. Hidden content must be
absent from keyboard navigation. Selecting a section closes it; Escape closes and
returns focus to the toggle. Use expanded state, translated accessible names, and
a controls relationship. Desktop navigation remains visible without a toggle.

For tables, scroll the table region horizontally when necessary; do not create
page-level horizontal overflow or shrink text to fit. Test at 390px and 1440px,
plus the user's actual viewport when relevant. Test 200% zoom and long content
for changed components.

## Elevation & Depth

Operational surfaces use a hairline border and tonal separation, usually without
a shadow. Avoid nested decorated cards for every group. A tinted inline form can
group a reversal without introducing a second elevation layer.

Auth previews and the Keycloak login retain existing ambient shadows. They are
surface-specific treatments, not a reason to add hover lifts to operational rows.
Keep framework overlays at their native elevation.

**The Working Surface Rule.** Group by task, separate by whitespace or a divider,
and reserve a decorated surface for a real working boundary.

## Shapes

Controls use the established control radius; working surfaces use the surface
radius. Separators are single-pixel hairlines. Existing pills are limited to
compact language/status controls; do not make every action a pill.

Focus must be visible on both backgrounds: primary outline on light surfaces and
lime outline on dark navigation. Existing authored focus rings use 2px with
2-3px offset. Standard controls retain Material focus behavior. Aim for at least
44px touch targets on mobile while preserving readable text and spacing.

Motion is optional, brief, and purposeful. Existing entrance easing is
`cubic-bezier(0.16, 1, 0.3, 1)`; the sidebar disclosure needs no entrance animation.
Respect reduced motion and keep essential content visible while it settles.

## Components

### Library and reuse policy

Use Angular Material for new standard controls; reuse the shared app components
before introducing variants. Hand-authored layout shells, navigation, ledger rows,
language switcher, and status badge are established exceptions. Auth currently
contains bespoke fields/buttons: preserve their behavior when refining them and
migrate in a deliberate task rather than copying them into new feature forms.

| Pattern | Implementation/reference |
| --- | --- |
| Main action | `button matButton="filled"` |
| Secondary action | `button matButton="outlined"` |
| Inline action / cancel | `button matButton="text"` |
| Icon-only toggle | `button matIconButton`, SVG, translated accessible name |
| Text / numeric field | `mat-form-field appearance="outline"`, `mat-label`, `input matInput` |
| Select | `select matNativeControl` inside a Material field |
| Results table | `shared/components/data-table` plus `MatPaginator` |
| Shell and navigation | `features/app-layout`, `shared/components/sidebar`, `nav-item` |
| Language / status | `shared/components/language-switcher`, `status-badge` |
| Stock workflow | `features/products/product-stock.*` |
| Theme | `src/styles.scss` and `src/_theme-colors.scss` |

### Buttons and links

Prefer one primary action per task region, such as Save movement. Use outlined
actions for secondary tasks and text actions for Cancel/Refresh. Navigation uses
links; submissions and state changes use buttons. Default non-submit form buttons
to `type="button"`. Icon-only controls require a translated accessible name.

Keep labels specific to the operation. While submitting, prevent duplicate
activation, use a localized progress label, and preserve focus and input on
failure. Do not communicate pending state using opacity alone. Destructive or
reversal actions need clear consequences and a deliberate confirmation flow;
the ledger's inline reason/confirmation form is the current reversal pattern.

### Fields, validation, and selectors

Labels remain visible after entry; placeholders never replace them. Show units in
the quantity label and explain allowed precision near the control. Price uses RON
and locale-aware formatting; quantities distinguish whole pieces from measured
units and services from tracked inventory. Do not silently round business data.

Use existing Signal Forms patterns. Native selects remain the established
interop choice; verify any replacement before adopting it. Existing validation
uses explicit helper/error spans: associate feedback with its input through
`aria-describedby` and invalid state when extending forms. Do not assume
`mat-error` automatically understands Signal Forms in this version.

Provide default, hover, focus, invalid, disabled/read-only, and submitting states
where applicable. Read-only stock must look like a current balance, not a field
that promises direct editing.

### Working surfaces and page headers

Start with the task title, a short relevant description, and the primary action.
Keep headers flexible for long names and translated actions. Sections within a
surface use spacing and dividers; do not introduce a card for each label/value.
Metadata editing and stock-changing actions stay visibly distinct.

### Tables, search, and pagination

Use semantic table headers. Align quantities/prices right, labels left; keep
units attached to quantities. Text can wrap; only compact identifiers and dates
need deliberate non-wrapping. Preserve row actions on mobile via table-region
scrolling or a purposeful stacked representation.

Keep search wording accurate to the backend's actual search fields. Distinguish
loading, empty catalog, no search matches, and load failure with retry. Pagination
must use the active language, current server total, disabled bounds, and a visible
loading state when changing pages. Never present a partial page as the full stock.

### Stock summary and movement history

Show product name, SKU, balance plus unit, and stock applicability. A service
displays a localized not-tracked value rather than an invented inventory balance.
The movement form places action and quantity before reason and submit.

A history row carries movement kind, localized time, actor, signed delta, before/
after balance, reason, and reversal status/reference where relevant. Use tabular
numerals and explicit signs; color supplements meaning. Wrap reasons and long
references. Keep the mobile reading order coherent when columns stack.

Reversal is a distinct action with reason and confirmation. Do not imply that
the original entry is deleted. API business errors must explain recovery in the
active language without exposing internal stack traces or implying a failed
operation succeeded. System-origin records are labeled as system activity.

### Feedback, empty states, and permissions

Use nearby inline feedback. Errors use `role="alert"`; non-urgent saved
confirmations use `role="status"`. Loading must settle into data, an empty state,
or an actionable error. Hide unavailable mutation controls for read-only users,
while preserving discoverable read/history flows; server authorization remains
the enforcement layer.

An empty state explains what is missing and offers an appropriate permitted next
action. A no-results state offers search recovery. Never turn a network error into
an empty-state claim.

### Language switcher, status badges, and browser surfaces

Preserve EN/RO selection semantics, persistence, and translated accessibility
labels. Every new user-facing string, hint, error, and accessible name belongs in
`core/i18n/translations.ts`. User-authored names and SKUs are not translated.
Use Romanian diacritics and active-locale number formatting. Display calendar
dates as `dd/MM/yyyy` and timestamps as `dd/MM/yyyy HH:mm` in
`Europe/Bucharest`. Keep date input values in ISO `yyyy-MM-dd` form.

Badges carry a textual state and a semantic tone; do not style them as buttons
unless interactive. Maintain contrast (4.5:1 for normal text, 3:1 for large text).
Selection, caret, autofill, focus, and scrollbars should match the shared palette.

## Do's and Don'ts

### Do

- Do reuse semantic tokens and established Material/shared component APIs.
- Do prioritize the operator's next task, current state, and recovery path.
- Do show quantities with units and prices with their currency context.
- Do verify mobile, keyboard, translated content, and async failure states.
- Do distinguish observed implementation from forward guidance and known drift.

### Don't

- Don't restore the superseded blue-only theme or fixed-width auth layout.
- Don't clone bespoke controls or override private Material implementation classes.
- Don't hide essential meaning in color, hover, an icon, or a tooltip alone.
- Don't round stock for visual convenience or present services as physical stock.
- Don't treat old literals, decorative overlines, or existing accessibility gaps as reusable rules.



