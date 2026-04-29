# Subagent: hygiene

**Status:** In scope, active
**Last updated:** 2026-04-27

---

## Purpose

Surface the conditions that turn an archive into a junk drawer: stale items, duplicates, inbox debt, broken lifecycle states, retired items without replacements, overuse. Read-only. Produces reports. Never edits.

The hygiene subagent is the system's check on rot. Without it, the archive degrades silently. With it, rot becomes visible work.

## When invoked

- Scheduled nightly run, results delivered as a digest in the UI
- On-demand run for a specific report type
- Pre-export check (warn before exporting an item with hygiene flags)

The subagent is not invoked autonomously to take action. Action is always a human follow-up.

## Files it can read

- All tables. The hygiene subagent has full read access.
- The schema and event log are its primary inputs.

## Files it can write

- None. It produces reports, not data.
- It may write its report output to a `hygiene_reports` artifact location (filesystem, not database) for the UI to render.

## Decisions it is forbidden to make

- Cannot delete, archive, retire, merge, deduplicate, or modify any item.
- Cannot remove relationships, even ones it identifies as inconsistent.
- Cannot supersede annotations.
- Cannot prune the graph.
- Cannot decide that a flag is "false positive" and silently suppress it.

## Reports

Each report is a named query with a fixed shape, produced on every run. The user resolves flagged items by acting through the normal UI; the subagent's job is to surface, not to fix.

### `inbox_debt`

Items in `status='inbox'` for longer than a threshold (default: 14 days).

Output: list of `(item_id, type, source_id, days_in_inbox, last_event)`.

### `stale_active`

Items in `status='active'` with no events in longer than a threshold (default: 90 days).

Output: list of `(item_id, type, last_event_type, days_since_last_event)`.

### `retired_without_replacement`

Items in `status='retired'` with no outbound `retired_by` relationship.

Output: list of `(item_id, type, retired_at)`.

Note: not every retirement has a replacement, but the system flags so the user can decide whether to add one.

### `retired_by_inconsistency`

Either:
- Items linked by `retired_by` whose source is not in `status='retired'`
- Items in `status='retired'` whose `retired_by` target is itself retired

Output: list of `(from_item_id, to_item_id, inconsistency_type)`.

### `cross_source_duplicates`

Items with matching `perceptual_hash` (for images) or matching content hash (for files) across different `(source_id, source_external_id)` tuples.

Output: list of `[item_id, ...]` clusters.

The subagent does not merge them. It surfaces the cluster.

### `tag_vocabulary_drift`

- Tags with `status='pending'` older than 30 days (the user has not reviewed them)
- Tags with `status='approved'` not applied to any item in 180 days (vocabulary that may be obsolete)

Output: two lists.

### `overused`

Items appearing as `from_id` in `used_in` relationships more than a threshold count in a recent window (default: 8 attachments in 90 days).

Marketing concern: an asset that's been used too many times has lost surprise and may need retirement.

Output: list of `(item_id, type, use_count_window, attachment_list)`.

### `orphaned`

Items with no relationships, no collection memberships, no tags, and no campaign attachments, that are not in `status='inbox'`.

Output: list of `(item_id, type, status, age_days)`.

### `dangling_annotations`

`ai_annotations` rows in `status='pending'` older than 30 days.

The user has not approved or rejected. Approval debt accumulating.

Output: count and oldest-pending list.

### `banned_phrase_audit`

Approved AI annotations whose payload, after the fact, contains a phrase added to `banned_phrases` after the annotation was approved.

The blocklist evolves; this report catches old AI output that no longer meets the current standard.

Output: list of `(annotation_id, item_id, field_name, matched_phrases)`.

## Output format

A run produces a `HygieneReport`:

```
{
  "run_id": "...",
  "workspace_id": "...",
  "ran_at": "...",
  "summary": {
    "inbox_debt_count": N,
    "stale_active_count": N,
    "retired_without_replacement_count": N,
    "retired_by_inconsistency_count": N,
    "cross_source_duplicate_clusters": N,
    "tag_pending_old_count": N,
    "tag_approved_unused_count": N,
    "overused_count": N,
    "orphaned_count": N,
    "dangling_annotations_count": N,
    "banned_phrase_audit_count": N
  },
  "reports": {
    "inbox_debt": [...],
    "stale_active": [...],
    ...
  }
}
```

The UI renders the digest with one-click triage actions per item: "review now," "extend grace period," "open in detail."

## Thresholds

Defaults are listed inline. All thresholds are configurable per workspace via a `hygiene_config` JSON column on `workspaces` (deferred until configurability is needed; defaults are fine for a long time).

## Failure modes

- A query fails (e.g., a column referenced does not exist) → report errors and proceed with remaining queries. Partial reports are acceptable; partial action is not.
- The subagent is read-only, so it has no destructive failure modes.

## What this subagent is not

- Not an autonomous cleanup agent. It does not retire items, even ones it has 100% confidence are stale.
- Not a curator. Curatorial decisions are human.
- Not a graph editor. It identifies inconsistency; resolution is human.
- Not a merger. It clusters duplicates; merge decisions are human.

The discipline matters: the moment a hygiene subagent starts taking action autonomously, the user loses the ability to trust the archive's content as their own. The cost of manual resolution is the price of trust.
