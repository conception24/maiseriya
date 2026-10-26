# Random dining layout planner

## Priority and construction

Hard priorities are room containment and non-overlap; clear entrance, kitchen, restroom and service approaches; connected guest access and chair pull-back; then useful columns/walls and complete seating groups. Density, variety and reduced empty space rank feasible candidates rather than override those constraints.

The planner reserves service/entry space, selects an aligned structural core, reserves a supply table and its approach, then adds complete seating banks and wall rows. A zone contains furniture and reserved circulation strips and is accepted atomically. It does not repair failures by deleting individual chairs. Columns and fixed walls support continuous bench groups; the nominal structural pitch is 4.52 m. Main strips are 1.65 m, secondary guest strips 1.15 m. These are design targets, not a building-code certification. Robots need not reach every seat.

Straight, L and shallow-room cores provide variation. Additional banks serve larger wings. Two-person rows and booths are whole modules. Supply fronts remain reachable after later placement. Infeasible cores retry within bounded limits; unexpected programming errors propagate. Arbitrarily small or narrow manually drawn rooms may not fit the required three-column core.

Existing 1.8 m fixed-wall footprints remain compatible with imported layouts. The renderer closes only aligned construction joints up to 6 cm, without enlarging unrelated walls. Room-shape generation remains separate from furnishing.

## Evaluation

Candidate ranking includes guest access, 40 cm chair pull-back, useful structural connections, connected free floor, ordered rows, coverage, large empty pockets and a local dead-end proxy. The latter samples cardinal escape directions away from useful approaches; it is not a complete topological dead-end proof. All quality values are geometric proxies, not evidence that every result looks like a real restaurant.

## Verification, 2026-10-26

Compared with c1866c71963115e92c6e4c78b412435e3456a6f7 using identical outlines and random seeds, warming both implementations and interleaving measurements on the same machine. Quality was evaluated with the same new evaluator, outside generation timing. Timings are local samples, not browser latency guarantees.

| Measure | Before | After |
| --- | ---: | ---: |
| Raw generation, 36 cases mean | 259 ms | 330 ms |
| Raw generation, maximum | 483 ms | 895 ms |
| Selected proposal, 6 representative shapes mean | 1102 ms | 1548 ms |
| Selected proposal, maximum | 1915 ms | 3429 ms |
| Selected proposal chair-clearance ratio | 0.663 | 1.000 |
| Selected proposal useful-structure ratio | 0.902 | 1.000 |
| Selected proposal unused-floor proxy | 0.200 | 0.169 |
| Selected proposal largest empty radius mean | 3.03 m | 2.40 m |
| Selected proposal dead-end proxy | 0.0109 | 0.0066 |
| Selected proposal connected-free-floor fraction | 0.9981 | 0.9954 |
| Selected proposal nominal seats mean | 52 | 64.5 |

Raw unused-floor proxy slightly worsened (0.2305 to 0.2357); ranking improved the selected results. Connected-free-floor fraction also slightly worsened for selected examples, although required customer/service destinations remained reachable. Complex wing ends can still retain excess space. More seats alone are not the success criterion.

Validation: full `npm run test:layout`, TypeScript check, production build and standalone build passed. Additional 150 generated rooms had no parsing, required-seat-access or missing-supply failures. Regression coverage includes shallow U rooms, deterministic generation, immutable inputs, unique IDs, legacy wall imports, tiny construction joints and the two previously missing-supply cases. Existing robot simulations also passed.

Visual review was separate: 2D comparisons for standard, two-room, T and U outlines; 3D walkthroughs for standard and two-room layouts; final actual UI generation and walkthrough. The new central bench banks and aligned columns read more coherently, but no claim is made that every random layout is visually ideal.

Run `npm run test:layout` first, then `npm run benchmark:layout`. To compare a prior implementation, provide its transpiled modules with `--before <directory>`; add `--ranked` to time proposal selection. Temporary comparison layouts and user reference files are not committed.
