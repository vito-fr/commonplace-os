# UI Principles

The durable design philosophy for the archive. When a screen, component, or interaction needs to be designed, this document is the first reference. When this document conflicts with `UI_ARCHITECTURE.md`, the architecture document wins until amended.

---

## The product

A visual research instrument with campaign memory underneath. Editorial in pacing, dense in information, quiet in chrome, unmistakably non-corporate.

The reference frame is editorial publishing — magazines, portfolios, research notebooks. Not SaaS, not productivity software, not "AI tools."

## The core loop test

Every screen, component, action, and pixel must serve at least one of seven verbs:

1. **Capture** — bringing material into the archive
2. **Inspect** — examining a single item in depth
3. **Connect** — relating items to one another in the graph
4. **Retrieve** — finding what you've captured
5. **Reuse** — attaching items to active work
6. **Retire** — taking items out of active rotation
7. **Campaign memory** — remembering how items were used over time

If a UI element does not support one of these verbs, it does not ship. This is the design review test.

## Visual identity

**Editorial typography.** A real serif for editorial surfaces (titles, briefs, descriptions, empty-state hero copy) paired with a strong neutral sans for system text and dense UI. Type is the primary structural device.

**Restrained palette.** Near-monochrome base — paper white or warm off-white in light mode, deep ink in dark — with a single structural accent color used sparingly for state.

**Lines and space, not shadows.** Hierarchy comes from rules, dividers, and whitespace. Soft drop-shadows on cards are forbidden.

**Square geometry.** Corner radii 0–4px maximum. Pill shapes only for chips and tags.

**No generic AI-startup visual language.** No purple glow, no glassmorphism, no gradients, no floating orbs, no generative décor. The product's visual identity is its own.

## Calm density

The central design tension: information-rich but quiet.

Density without hierarchy is noise. Minimalism without status is opacity. The discipline is to render a lot of meaningful information in a way that does not clamor.

Cards are tight, not lonely. Detail views breathe but never sparse to the point of hiding metadata. Filter rails are dense but type-driven, not icon soup.

When in doubt: more information, quieter rendering.

## Editorial pacing

Whitespace is a design element, not negative space. Typography carries identity. Sections are deliberate, not stacked.

The campaign page is the most editorial surface. The archive is more contact-sheet than magazine spread. The inbox is utilitarian. Pacing varies; identity is consistent.

## Status, provenance, and source are always visible

The data model carefully separates lifecycle state, AI provenance, and source origin. The UI must render these distinctions at all times.

- Every item card carries type, status, source, and (when relevant) usage signal.
- Every AI-rendered string carries provenance — model name, version, confidence, review status.
- Every campaign and item shows its lifecycle status prominently.

These are never hover-only. Never collapsed by default. Never visually equivalent to human-authored canonical content.

## Drift and work, braided

The interface supports two modes simultaneously:

- **Drift** — browsing, discovering, surfacing. Image-first, masonry-laid, low-friction.
- **Work** — triaging, retiring, attaching, approving. Dense, kinetic, deliberate.

No screen abandons one for the other. Every drift surface preserves enough work-mode affordance to act without leaving. Every work surface preserves enough drift-mode pacing to feel like research, not data entry.

## Desktop primary, mobile focused

Desktop is the primary surface — research happens at a desk. Density, multi-column layouts, comprehensive keyboard navigation, drag-and-drop, bulk operations.

Mobile serves two jobs: **capture** (the polished primary) and **browse** (a focused subset). Triage is supported but minimal. Deep editing on campaigns and complex graph operations prompt the user to open on desktop.

When a tradeoff exists between mobile elegance and desktop density, desktop wins.

## Lifecycle visibility

The lifecycle (`inbox` → `triaged` → `active` → `archived` → `retired`) is the spine of the data model. The UI surfaces it at all times.

- Inbox debt is visible in the nav whenever items have been quarantined longer than the configured threshold
- Hygiene flags surface in the default home view
- Status is rendered on every card, every detail page, every search result
- Retired items are hidden by default in archive views, opt-in to surface

Without persistent lifecycle visibility, the archive degrades silently. The UI's job is to make that degradation visible work.

## AI-rendered content is visually distinct

The data model separates canonical (human-authored) from `ai_annotations` (AI-suggested). The UI renders this separation at every level.

- Pending AI tags use distinct chip styling (dashed outline)
- AI-suggested descriptions and summaries appear in a separate panel from canonical text
- Every AI-rendered string carries a provenance mark (model, version, confidence)
- Approved annotations may be promoted to canonical only by explicit user action

Promotion to canonical is never automatic. The button reads "Promote to canonical description," not "Save."

## Empty states teach

Every empty state has three required parts: title, one-paragraph why, concrete next action. No aesthetic-only emptiness.

The empty state is the product's first onboarding surface and its most-encountered teaching opportunity. Treat it as documentation in disguise.

## What this product is not

- Not a Pinterest clone — no infinite feed, no engagement-optimized scrolling
- Not a Notion / Airtable workspace — tables are tools, not the home
- Not a SaaS dashboard — no KPI cards, no insight widgets, no welcome banners
- Not an AI assistant — AI is a labeled utility with provenance, not a brand
- Not a generic content management system — every element serves the core loop or it doesn't ship

## The design review test

Before any UI element ships, it passes through these checks:

1. Does it serve at least one of the seven core loop verbs?
2. Does it render type, status, source, and provenance where applicable?
3. Does it survive deep linking and browser back? (No core surfaces in modals.)
4. Does it work on keyboard and on touch?
5. Does it visually distinguish AI-rendered content from human-authored content?
6. If it has an empty state, does the empty state teach a next action?
7. Does it look like the product, or like a default shadcn / SaaS / AI-startup template?

A failing answer on any of these is a stop-and-ask, not a ship.
