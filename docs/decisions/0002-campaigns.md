# ADR 0002: Campaigns as Items

**Status:** Accepted
**Date:** 2026-04-27
**Supersedes:** an earlier draft that proposed campaigns as a separate top-level entity

---

## Context

A campaign in this archive is not just a date range and a budget. It is a node in the creative graph: it draws inspiration from earlier campaigns, references moodboards, retires assets, contradicts other concepts, accumulates use events, and may itself be retired by a successor. It carries lifecycle states identical to any other item — a campaign in `inbox` is a draft brief; a campaign in `archived` is a past initiative.

An earlier draft of the architecture treated campaigns as a separate top-level table on the grounds that "a campaign with a date range and a budget doesn't share much with a Pinterest pin." That framing was wrong. Campaigns share the most important thing: graph participation.

## Decision

Campaigns are items with `type='campaign'`. Campaign-specific fields live in `campaign_profiles`, a type extension table.

`campaign_profiles` columns:

- `phase` — `planning` | `live` | `wrapping` | `post_mortem`
- `channel` — `email` | `social` | `paid` | `web` | `multi` | `other`
- `start_at`, `end_at` — operational dates, nullable
- `brief` — the campaign brief, human-authored
- `kpi_summary` — post-mortem notes, human-authored

The `items.status` lifecycle (`inbox`, `triaged`, `active`, `archived`, `retired`) applies to campaigns. The `phase` field on `campaign_profiles` is orthogonal and tracks operational state — a campaign can be `status='active'` and `phase='wrapping'` simultaneously.

Campaign-asset linkage uses the relationships table with `type='used_in'` and `metadata.role` carrying the role (`primary`, `supporting`, `reference`, `retired_from`). No `campaign_items` junction table.

## Consequences

**Positive:**

- A query like "what campaigns reference this moodboard" is a single relationships query, not a UNION.
- AI annotations, events, tags, collections, and graph rendering all work on campaigns without special-casing.
- Retiring a campaign with `retired_by → newer campaign` is the same mechanism as retiring an image.
- A campaign can be visually similar to another campaign (when the system renders campaign covers), can inspire a campaign concept, can contradict another concept — all in the same graph language.

**Negative:**

- Some campaign-specific UI (timeline view, KPI dashboard, brief editor) requires joining `items` and `campaign_profiles`. Acceptable.
- The conceptual mismatch — "a campaign isn't really a piece of content, it's a container" — is real, but answered by the principle: anything that participates in the graph is an item. Containment is expressed via relationships.

## Alternatives considered

**Campaigns as a separate `campaigns` table.** Forces every cross-domain query into a UNION. Forces relationships to use polymorphic FKs or to be split into multiple tables. Defeats lifecycle uniformity. Rejected.

**Campaigns as collections with extra fields.** Conflates organization (collections) with participation (campaigns). Within three months, collections would be patched with campaign-only fields, and the system would have two competing primitives. Rejected.

**Campaigns as a tag.** Loses dates, brief, KPI summary, and lifecycle status. Tags are vocabulary, campaigns are entities. Rejected.

## Reversibility

Medium. Pulling campaigns out of `items` later is mechanical but requires migrating relationships, events, and annotations to a new key column. Better to commit now.
