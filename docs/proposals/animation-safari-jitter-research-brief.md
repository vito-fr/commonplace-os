# Animation And Safari Jitter Research Brief

## Purpose

Define a follow-up research task for deciding which remaining UI animations should move from CSS transitions/keyframes to GSAP or another explicit motion layer.

## Questions

- Which current CSS animations create Safari compositor jitter, horizontal line shimmer, or pixel shifts?
- Where does GSAP materially improve stability because transforms, filters, and cleanup are controlled in one timeline?
- Where are CSS transitions still preferable because the interaction is tiny, declarative, and stable?
- What motion stacks and practices are common on high-end editorial and agency sites, including Locomotive-style builds?
- What project rule should govern `will-change`, transform cleanup, backdrop filters, and animated masks?

## Output

- A small animation policy for `CLAUDE.md` or `docs/component-rules.md`.
- A ranked migration list of existing CSS animations worth converting.
- A Safari verification checklist for normal zoom, page zoom, and active viewport resizing.

## Non-Scope

- No implementation during the research task unless the policy and migration list are approved first.
- No new animation dependency unless the research proves GSAP is insufficient for a specific local problem.
