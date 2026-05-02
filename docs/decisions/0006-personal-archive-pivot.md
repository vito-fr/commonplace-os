# ADR 0006: Pivot to Personal Archive — drop campaigns, simplify lifecycle, AI to canonical

**Status:** Accepted
**Date:** 2026-05-01
**Supersedes:** parts of ADR 0002 (Campaigns as Items), parts of ADR 0003 (AI Metadata), CONSTITUTION sections 6 (Lifecycle) and 8 (Hard Rules #1–#2)

---

## Context

The system was originally framed as a personal-first, business-extensible archive for creative-marketing work. The marketing framing carried three load-bearing concepts:

1. **Campaigns as a first-class item type**, with rights warnings, attachment roles, and a `campaign_profiles` extension table.
2. **A five-stage lifecycle** (`inbox → triaged → active → archived → retired`) where `triaged` was the gate between AI-suggested metadata and canonical fields.
3. **A hard separation between AI annotations and canonical fields** (Hard Rule #1), enforced by the `ai_annotations` table and a human "promote to canonical" action.

In practice, the user is a single individual using this as a personal archive of visual and textual reference material. The marketing framing creates ceremony that does not match how the product is actually used. Specifically:

- Campaigns are not part of the user's mental model. The category was a holdover from the business framing.
- "Triaged" is meaningless if there is no team handoff and no campaign brief to gate against. Every captured item is for the user's own consumption.
- The AI annotation review gate creates friction the user does not want. The user's expressed goal is "capture and the AI fills in everything, I review later if I want."

Continuing to enforce the marketing framing means continuing to design and build features the user will never use.

## Decision

**1. Drop campaigns as an item type.** Remove `campaign` from the item type enum. Drop the `campaign_profiles` (and `items_campaign`, if present) extension table. Remove the campaign attachment table, the campaign reader/writer, the campaign attach UI, and the `used_in` relationship type. Rights warnings, which exist solely for campaign attachment, are removed with them.

**2. Simplify the lifecycle to two states + delete.**
- `active` — default. Captured items land here directly.
- `archived` — soft hide. Out of default views, recoverable.
- delete — hard delete. Removes the row; cascades through `relationships`, `item_tags`, `collection_items`, `ai_annotations`, `item_events`. Confirmed in UI.

Drop `inbox`, `triaged`, and `retired` from the status enum. Drop the `retired_by` relationship type.

"Inbox" survives as a **smart view** (a filter, not a status): items captured recently, or items the user has not yet opened. Implementation is a query, not a column.

**3. AI writes to canonical fields directly, with three guards.**
- **Provenance is mandatory.** Every AI-filled field renders a `ProvenanceMark` showing model, version, confidence, and timestamp. Already in the design system.
- **Banned-phrase scrubbing remains** (Hard Rule #8 stands). AI output is stripped against `docs/anti-slop/banned-phrases.md` before write.
- **Confidence threshold.** AI fills above a configurable threshold land on canonical. Below the threshold, they go to `ai_annotations` for the user to accept or reject. The threshold is a per-field config, not a global toggle.

Hard Rule #1 ("AI subagents never write to canonical fields") is replaced with: "AI subagents may write to canonical fields when (a) confidence exceeds the per-field threshold, (b) banned-phrase scrubbing has run, and (c) the write carries a ProvenanceMark."

## Consequences

**Positive:**

- The product matches how the user actually uses it. No ceremony for ceremony's sake.
- Capture-to-usable becomes a single step. No triage queue.
- The data model gets meaningfully smaller: one fewer item type, one fewer extension table, one fewer relationship type, two fewer status values, one fewer attachment table.
- Rights warnings, which were the most complex UI logic in the detail view, go away entirely.
- The constitution's framing ("creative-marketing memory") collapses into "personal archive." The polymath case named in CLAUDE.md becomes the only case.

**Negative:**

- Existing data carrying `retired`, `inbox`, `triaged`, or `campaign` types must be migrated. Single user, low volume, but real.
- The "second business workspace" extensibility named in CONSTITUTION section 1 becomes hypothetical. If a marketing use case ever returns, it would be a re-founding, not an extension.
- AI slop is now a runtime guarded thing, not a structural impossibility. If the threshold or scrubber is wrong, slop reaches canonical until the user notices.
- The CONSTITUTION and several ADRs need rewrites or supersession notes.

**Neutral:**

- `collections`, `tags`, `relationships`, `item_events`, `ai_annotations` are unchanged structurally. Their semantics shift slightly (no "promote to canonical" workflow) but the tables stay.
- The atomic-unit decision (ADR 0001) stands: items remain the atomic unit, with type discriminator and extension tables.

## Migration plan (deferred to step 2)

A separate session will handle the schema and code migration. Outline:

1. PocketBase migration: drop `campaign_profiles`, drop `campaign` from type enum, drop `retired`/`inbox`/`triaged` from status enum, default existing rows to `active` or `archived` per a mapping rule, drop `retired_by` from `relationship_types`, drop campaign attachment table.
2. Code: remove `pocketBaseItemCampaign.ts`, `pocketBaseItemRetirement.ts`. Remove campaign UI from `ItemDetail.tsx`, `App.tsx`. Remove `RightsWarning` and `getRightsWarningState`. Replace `LifecycleControls` and `RetireWithReplacementForm` with a `Delete` button + confirmation. Update type unions in `src/components/atoms/`.
3. Constitution: rewrite section 6 (lifecycle), rewrite section 8 (Hard Rules #1, #2, drop #5 if it references retired_by), drop campaign-specific language from section 1.
4. ADRs: mark this ADR as superseding 0002 in part. Note the lifecycle change in 0006 supersedes section 6 of CONSTITUTION.

## Open questions

- **Confidence thresholds.** What's the default? Per-field starting values to be set in step 2 by inspection of typical model outputs.
- **AI vision model.** Out of scope for this ADR. When added, it integrates into the existing enrichment pipeline; lifecycle does not change.
- **Auto-collections.** AI-suggested collection membership based on similarity is a desirable feature, but not part of this ADR. Build on top of canonical AI writes once the threshold model is in place.
