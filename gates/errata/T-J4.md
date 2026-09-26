# Erratum: T-J4 superseded by T-J4d

## Measurement
"<= 0 excess similarity" had no similarity measure. T-J4d defines it: Jaccard over non-routine (event kind, area, hour band) plus the weather sequence, day d vs d + 354, against the 95th percentile of the same calendar day in another seed.

The new row is at least as strict as T-J4 on everything it does not correct. T-J4 stays in gates/thresholds.json, reads
SUPERSEDED on the board and is not evaluated once this erratum is signed.

## Signature
Proposed by the second independent critique of the plan, REVIEWS/master_plan_critique_rev2.md §3.3 (session 8). To be
countersigned by the critic of the next audit round (MASTER_PLAN T-R2), who adds a line here naming their review file; until
then both rows are evaluated.
