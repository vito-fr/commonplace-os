# Banned Phrases

Initial blocklist for AI subagents. Loaded by every AI subagent at run start. Phrases are matched case-insensitively, as substrings of generated output. When a banned phrase appears in proposed output, the subagent must regenerate — not strip and submit.

This list mirrors the contents of the `banned_phrases` table. The table is the source of truth; this file is updated to match.

---

## Why these are banned

Generic AI descriptors flatten taste. They pass through human review unnoticed because they sound plausible, then accumulate in the archive until every item describes itself the same way. The cost is downstream: search becomes useless, the graph homogenizes, and the differentiation between curated work and slop disappears.

The list is opinionated and meant to be extended as drift is observed. Adding a phrase requires reasoning in the commit message; it is not silently extended.

---

## Initial list

Aesthetic descriptors that mean nothing:

- `aesthetic`
- `vibe`
- `vibes`
- `mood`
- `feel`
- `essence`

Modifiers that signal AI-generated text:

- `modern`
- `minimalist`
- `sleek`
- `elegant`
- `sophisticated`
- `refined`
- `timeless`
- `contemporary`
- `clean lines`
- `crisp`

Empty intensifiers:

- `stunning`
- `striking`
- `captivating`
- `eye-catching`
- `breathtaking`
- `remarkable`
- `impressive`
- `powerful` (when applied to imagery or copy as a generic descriptor)
- `dynamic`
- `vibrant`
- `bold` (when used without specific reference)

Marketing clichés:

- `compelling`
- `engaging`
- `resonates with`
- `speaks to`
- `tells a story`
- `evokes`
- `juxtaposition` (when not specific to actual visual juxtaposition)
- `interplay`
- `harmoniously`

Filler scaffolding:

- `at its core`
- `seamlessly`
- `effortlessly`
- `journey`
- `experience` (as a noun describing visual content)

---

## Adding to the list

When a phrase recurs in AI output and is contributing to slop:

1. Add it to the `banned_phrases` table with reason and `added_by`.
2. Update this file to match.
3. Note the change in the commit message.

Do not add phrases speculatively. Add only what has actually appeared in output and degraded quality. Speculative additions create regeneration thrash without clear benefit.

## Removing from the list

A phrase may be removed if context changes (e.g., a banned word becomes a domain-specific term that the user wants used). Removals require:

1. Reason in the commit message.
2. Update both the table and this file.
3. Optional: add a note here in a "Removed" section to remember the prior reasoning.

---

## What this list does not catch

Anti-slop is not solved by a blocklist alone. Two other mechanisms work alongside this list:

1. **Tag vocabulary lock** — AI may apply existing approved tags but proposes new tags as `pending`. Prevents tag explosion.
2. **Length cap** — AI-generated `description` payloads in `ai_annotations` are capped at 140 chars; `summary` at 280. Forces specificity.

A bad description with no banned phrases is still a bad description. Human review is the final gate.
