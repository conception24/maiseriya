# Continuous seating and pair review — 2026-10-30

## Changes

- Reserve long wall/window banquettes before optional interior bays and booth rows. A wall with a banquette cannot receive an interrupting booth row.
- Reject bench groups leaving a narrow strip (0.15–1.2 m) between their footprint and an overlapping wall segment. Wall-backed benches have about 9 cm rear clearance.
- Rank structural cores by the remaining window seating capacity. Use complete smaller interior bays, narrower reserved aisles, and connected guest-access checks instead of reserving temporary shortest paths through empty seating areas.
- Remove isolated one-table wall fillers. Keep chairs' pull-back space, service approaches and reachable seat checks.
- Generate one kitchen entrance until a shared kitchen volume can justify multiple openings.
- Add a WC screen only when it blocks at least 35% of nearby, currently visible doorway sight lines (at least two rays). Existing bench backs, columns and partitions count as occluders; cushions do not.
- Add `A・Bで配置を比較`: same-room alternatives, A/B/neither, optional notes, plan/3D views and one background worker preparing the next pair. Duplicate physical layouts are rejected.
- Export both complete layouts, seeds, planner version, choice, view, note and generation duration. No automatic upload, browser persistence or automatic preference learning. Close/reopen retains answers in the current page session; save before reloading or leaving.

## Fixed-seed comparison

Baseline: GitHub main `40f07adcf046c4215084ecd7200394e6398a422f`.
36 paired cases: 18 room shapes, seeds 21 and 137; identical outlines and starting random seeds before/after. Node measurements on the same Windows machine. Assessment runs outside the generation timer. Times are individual layout generation, not initial page loading, 3D setup or full pair preparation.

| Metric | Before | After |
| --- | ---: | ---: |
| Mean generation | 338 ms | 335 ms |
| Maximum generation | 757 ms | 737 ms |
| Mean seats | 60.89 | 68.92 |
| Blocked seats | 0 | 0 |
| Chair clearance score | 1.00 | 1.00 |
| Connected circulation score | 0.9932 | 0.9952 |
| Dead-end score (lower is better) | 0.00763 | 0.00701 |
| Wasted-space score (lower is better) | 0.1853 | 0.1727 |
| Mean largest usable empty radius | 2.55 m | 2.69 m |

These are geometric proxies, not a judgment of restaurant realism. Some plans still have conspicuous empty regions; the largest-empty-region metric did not improve. The new comparison mode is intended to capture those preferences with reproducible evidence, not to imply they are solved.

Reproduction: compile the baseline model modules in a separate checkout with `node scripts/test-builder.mjs`, then run the current `node scripts/benchmark-layout.mjs --before <baseline-model-directory> --out <report.json>` after compiling current modules. The baseline directory must remain unchanged while compiling current files.

## Verification

- `npm run test:layout`: passed. Includes 50 generated rooms, 34 mirrored room-shape plans, collision/reachability checks, robot simulations, pair replay and source immutability.
- TypeScript check and production build: passed; existing large-chunk warning remains.
- Browser: side-by-side plans, both 3D views, all three answer choices, next-pair prefetch, optional note, close/reopen retention and complete JSON export checked. A comparison session uses the room shape that was open when started.

## Feedback use

Start with roughly 10–20 pairs across a few room shapes. Export the feedback JSON and inspect preferred/rejected layout pairs before requesting more. Notes on especially bad cases help distinguish unused space, unwanted corridors, broken bench continuity and service-area problems. More clicks alone do not train the generator; explicit rule changes and another fixed-seed comparison are still required.
