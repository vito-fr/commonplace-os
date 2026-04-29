# ADR 0005: Workspaces and Privacy from Day One

**Status:** Accepted
**Date:** 2026-04-27
**Supersedes:** none

---

## Context

The archive starts as a personal tool. Business use is on the roadmap. There are two ways to approach this:

1. Build single-tenant now, retrofit multi-tenancy later.
2. Build multi-tenant from day one, with a default `personal` workspace.

Single-tenant-first looks cheaper. It is not. Every tenant-scoped query that ships without `workspace_id` is a future migration. Every join that assumes a global namespace is a future bug. The retrofit cost grows with codebase age and database size.

Privacy is a related concern. Marketing work spans private mood-boards, internal references, and material destined for public posting. Per-item privacy is too granular to maintain manually; per-workspace is too coarse to express "this Pinterest source is personal-default."

## Decision

### Workspaces

Every tenant-scoped table carries `workspace_id` from the first migration. There is no path that omits it. The default workspace `personal` is seeded by the initial migration.

Tables with `workspace_id`:

- `sources`
- `items`
- `relationships`
- `tags`
- `collections`
- `collection_items` (via parent collection)
- `ai_annotations`
- `item_events`
- `banned_phrases` (per-workspace blocklist; the default `personal` workspace seeds with the canonical list)

Type-extension tables (`items_image`, `items_caption`, `items_note`, `items_link`, `campaign_profiles`) inherit workspace through their parent `item_id` and do not duplicate the column.

`item_tags` inherits through both endpoints.

### Privacy

Two-tier inheritance:

- `sources.default_privacy_level` — `private` | `personal` | `team` | `public`
- `items.privacy_level` — same enum, nullable. Null means inherit.

Resolution happens in application code, not in views. Resolution function: if `items.privacy_level` is non-null, use it; otherwise look up `sources.default_privacy_level`; if no source, default to `private`.

Privacy levels are advisory at the schema level — they shape default visibility in the UI and constrain export. They are not security boundaries. Cross-workspace access control is deferred until business workspace exists and will use a relationship type, not a permissions retrofit.

## Cross-workspace sharing — deferred

When the first business workspace is created, a `cross_workspace_reference` relationship type will be added that grants read-only visibility from one workspace to another. The receiving workspace can attach AI annotations and notes to a referenced item without modifying the source. This is deferred to its own ADR when triggered.

## Hard rule

Every query against a tenant-scoped table includes `WHERE workspace_id = ?`. There are no exceptions for "personal use," because the default workspace is still `personal` and the filter still applies. Forgetting `workspace_id` in a query is treated as a bug regardless of whether the user has only one workspace.

CLAUDE.md enforces this; reviewers enforce this; the application's data layer should expose query helpers that take `workspace_id` as a required argument.

## Consequences

**Positive:**

- The retrofit cost is paid once, at zero data volume, instead of later at scale.
- Privacy resolution is consistent and source-driven, matching how the user actually thinks about origins.
- The path to business use is mechanical: create a workspace, optionally introduce cross-workspace references when needed.
- Per-source privacy means imports automatically inherit sensible defaults — Pinterest is `personal`, journal source is `private`, public-blog source is `public`.

**Negative:**

- Slightly more verbose query layer. Query helpers in the data layer reduce the friction.
- Resolution function is a small piece of application code that must be unit-tested. Acceptable.

## Alternatives considered

**Single-tenant first, retrofit later.** Rejected on retrofit-cost grounds.

**Per-item privacy with no source default.** Forces every imported item to be reviewed for privacy. Friction at the highest-volume step in the system. Rejected.

**Per-workspace privacy only.** Cannot express the common case where a single workspace contains both private references and public-destined work. Rejected.

**Schema-level privacy enforcement (views, row-level security).** SQLite does not support row-level security in the way Postgres does, and PocketBase's API rules are sufficient at the workspace boundary. Schema-level RLS is out of scope. Privacy is application-level metadata, enforced by the data layer.

## Reversibility

Hard for workspaces (the whole point is to avoid retrofit). Easy for privacy resolution (it lives in application code).
