# Mock data analysis

An audit of the three Lakeside snapshots in `data/`, done before writing any domain code: every oddity in the data, and what the sync does about it. Each row is a test case. People are named as in the snapshots, for example "Grace" rather than "customer 3009".

[NOTES.md](NOTES.md) has the decisions behind these answers where the instructions' rules don't settle a case, and the definitions of errors, exceptions and the counts.

## Dates and "today"

| Case | Example | Expected |
|---|---|---|
| `generated_at` is UTC, today is local | Day 1 is `2026-10-28T06:30:00Z`, the property is `America/Los_Angeles` | Today is 2026-10-27, not 10/28. Day 2 is 10/28, day 3 is 10/29 |
| Dates are `MM/DD/YYYY` with leading zeros | `09/01/2026` | `2026-09-01` |
| Empty string date | Carol's `moveOutDate: ""` | null |
| Null date | Most `moveOutDate`s | null |
| Move-in window is 14 days counting today | Day 1 | 10/14 to 10/27 inclusive. 10/13 is out (Sam). 10/28 is out because it's in the future (Erin) |
| Past cutoff is "more than 14 days before today" | Day 1 | A move-out on 10/13 (exactly 14 days) is still synced. 10/12 (Wendy, 15 days) is not |
| DST | Not crossed by the data (DST ends 11/01/2026) | Add a synthetic test with a `generated_at` in winter so the timezone code isn't only tested at UTC-7 |

## Normalizer: units

| Case | Example | Expected |
|---|---|---|
| Duplicate unit | 5003 appears twice on day 1, identically | One unit. Day 1 has 16 units, not 17. Copies that differ would leave the unit and its leases out, with a data exception |
| Numeric ids | Unit `id: 5001` while lease `unitId: "5001"`, property `id: 100` | Every id is a string |
| Known codes | `O1`, `O2`, `V1`, `V2`, `M`, `C` | Occupied, Occupied, Vacant, Vacant, Model, Common Area |
| Unknown code | `O3` (5009), `X` (5016), `D` (5015 on day 2) | Down |
| Empty and null codes | `""` (5012 on day 1), `null` (5015 on day 1) | Down |
| Lowercase code | `o1` (5008 on day 1) | Down. Match the table exactly; don't bend the contract to fit bad client data. Show the raw `o1` in the UI and list it in NOTES.md |
| Empty strings | `buildingName: ""` on every unit from 201 up, `floorplanName: ""` on CLUB | null |
| Non-numeric unit number | `CLUB` (5014, code `C`) | Kept as text. Common Area |
| Raw code kept | Every unit | The raw Lakeside code is stored next to the mapped status |

## Normalizer: leases and customers

| Case | Example | Expected |
|---|---|---|
| Lease points to a unit that isn't in the snapshot | L9015 has unit 5099 (Paul) | No unit is created. The lease is flagged, and Paul isn't synced |
| Lease with no unit | L9017 has `unitId: null` (Quinn) | Flagged, not synced |
| The interval in effect isn't the first one | L9101's `leaseIntervalId` 71010 is the second interval. The first is a `Renewal Offer` | Lease dates come from interval 71010, matched by id |
| Interval id that matches no interval | Not in the data | Synthetic test: lease dates are null and the lease is flagged |
| Customer status overrides lease status | Kim (day 1) and Henry (day 2) are Past on Current leases | Effective status is Past |
| Null customer status | Almost everyone | Effective status is the lease status |
| Notice counts as Current | Frank, and Grace on day 1 | Effective status is Current |
| Lowercase customer type | Sam is `co-applicant` | Not a lease signer, because only exact `Primary` and `Co-Applicant` match. Flag it as an unknown type. Sam is outside the window anyway, so no outcome changes |
| Guarantors and occupants | Gary (Guarantor), Uma (Occupant) | Synced as residents, never moved in |
| Contact details are nested | `addresses.address.email`, `phone.phoneNumber` | Flat `email` and `phone` |
| Missing phone | Quinn's `phone: null` | `phone` is null |
| Same person on two units | Mia (3016) on 5011 (L9011) and 5012 (L9112) on day 2 | Two RentLive residents, keyed by unit and resident id |
| Same person on two leases of one unit | Day 2: Alice, Bob and Gary on L9001 (Past, moved out 10/26) and L9101 (Current) on 5001 | One resident per unit and person. The Current lease wins for status, dates and lease id |
| Statuses not in the data | `Applicant` | Synthetic test: treated as not Current, never moved in |
| Unused field | `isMonthToMonth` is 0 everywhere | Ignored |
| A list sent as a single object | Day 1: L9010 (Liam) has `customers.customer` as one object, not a one-item list. Every other lease sends a list | Leave just that lease out, with a data exception, and accept the rest of the snapshot. Liam is never moved in. See NOTES.md |
| A lease missing from a later snapshot | L9010 (Liam on 5010) is on day 1 but not day 2, while unit 5010 is still `O1` | Nothing happens to Liam, because his lease was already left out on day 1. Had he been moved in, he would stay moved in and be flagged as missing: a missing lease never moves anyone out |

## Rules engine

| Case | Who | Expected |
|---|---|---|
| Current, inside the window, never moved in | Alice (day 1) | Move in |
| Current, moved in outside the window | Carol, 09/01 | Not moved in. Reason: move-in date is older than 14 days. This is the instructions' example of showing why |
| One day outside the window | Sam, 10/13 on day 1 | Not moved in |
| Move-in date in the future | Erin on day 1 (10/28) | Not moved in on day 1, moved in on day 2 |
| Current but the move-out date has passed | Ivy on day 1 (moved out 10/25) | Not moved in. Flag it, because the status contradicts the date |
| Notice with a future move-out date | Grace on day 1 (moves out 10/28) | Move in |
| Move-out date is today | Grace on day 2 | Move out |
| Customer is Past on a Current lease | Henry on day 2 | Move out |
| Past with no move-out date | Jack on day 2 | Don't move out. Flag for review |
| Future lease | Dan and Nora on day 1, Tina on day 2 | Not moved in |
| Cancelled lease | Owen on 5012 | Not moved in |
| Past and recent | Kim (moved out 10/23) on day 1 | Synced, not moved in, nothing to do |
| Past more than 14 days ago | Wendy (10/12), Rita and Victor (08/01) | Not synced at all |
| Moved out before, Current again | Synthetic | Never moved in again automatically |
| Roommates on one lease | Alice and Bob on day 1 | Both moved in |
| Someone on a different lease still moved in | Synthetic, and 5011 on day 2 if done in the wrong order | Blocked |
| Move-out frees the unit in the same run | 5011 on day 2: Mia out, Nora in | Do every move-out before any move-in. Nora is moved in |
| Re-signed lease doesn't count as "a different lease" | 5001 on day 2: Alice and Bob were moved in under L9001, they're now on L9101 | They stay moved in. Their stored lease becomes L9101. Upsert residents before checking `list_moved_in`, or Alice blocks herself |
| Re-signed lease doesn't trigger a move-out | 5001 on day 2: L9001 is Past with a move-out of 10/26 | No move-out while any lease for that person on that unit is Current |
| Not moved in twice | Every moved-in resident on rerun | Nothing happens |
| Not moved out twice | Grace, Henry and Mia (5011) on day 3 and on rerun | Nothing happens |

## Runner and change log

| Case | Example | Expected |
|---|---|---|
| Unit status changes | Day 2: 5003 V1 to O1, 5004 V2 to O1, 5006 O2 to V2, 5008 o1 to V2, 5012 `""` to O1 | "Unit status changed" entries |
| Raw code changes but the mapped status doesn't | 5015 `null` to `D`, both Down | A "unit status changed" entry for the raw code, because the UI shows it |
| Lease changed | 5001 on day 2: L9101 added, L9001 went Past. Gary's move-in date changed to 10/27 | "Lease changed" and "resident updated" entries with the fields that changed |
| New resident | Uma on 5001, Mia on 5012, Tina on 5008 (all day 2) | "Resident created" |
| Snapshot with units but no leases | Day 3 | See "Day 3" below |
| Rerun any snapshot | Day 1, 2 or 3 twice | A new row in the runs list, no new change-log entries, no RentLive calls that change anything |
| Exceptions on rerun | Paul and Quinn (data), Jack (review) | `sync.exceptions` records them again for the new run, so the latest run's rows are the current list. The change log gets one "flagged for review" entry when a review exception first appears, not one per run |
| Run fails partway | Synthetic | A `crash` error: the run is `failed`, and it can be run again safely |

## Run errors

Each error stops the whole run: nothing in the snapshot is applied, the run still shows in the runs list, and no change-log entries or exceptions are written. None of these happen in the data, so each is a synthetic test.

| Case | Error | Run status | Stored |
|---|---|---|---|
| The snapshot file doesn't exist | `fetch`, `snapshot_not_found` | `failed` | The run, with no snapshot |
| The path can't be read as a file | `fetch`, `snapshot_unreadable` | `failed` | The run, with no snapshot |
| The file isn't JSON | `fetch`, `snapshot_invalid_json` | `failed` | The run, with no snapshot |
| The JSON breaks the contract, for example no `units` list | `structure`, `invalid_structure`, with the field and value | `failed` | The run and the snapshot, without its property or `generated_at` if those can't be read |
| The snapshot is older than the last run's, for example day 1 after day 2 | `stale`, `snapshot_older_than_last_run`, with both timestamps | `refused` | The run and the snapshot |
| Something unexpected throws partway | `crash`, `run_crashed`, with the message | `failed` | The run, and whatever it had already written |
| Running again after any of these | none, if the cause is fixed | `ok` | A new run, as if the failed one hadn't happened |

## Expected outcomes per day

| Day | Today | Move-ins | Move-outs | Flags | Skipped / flagged counts |
|---|---|---|---|---|---|
| 1 | 10/27 | Alice, Bob (5001), Frank (5005), Jack (5009), Grace (5006), Henry (5007), Mia (5011). 7 total | None | Liam (lease left out: customers is not a list), Paul (unit 5099), Quinn (no unit), Ivy (Current with a past move-out), Sam (unknown customer type `co-applicant`) | 6 / 2 |
| 2 | 10/28 | Dan (5003), Erin (5004), Nora (5011), Mia (5012). 4 total | Grace (5006), Henry (5007), Mia (5011). 3 total | Paul, Quinn and Sam (unchanged, not logged again), Jack (Past, no move-out date). Ivy is no longer flagged: her lease is Past now, so her status and date agree | 5 / 2 |
| 3 | 10/29 | None | None | The run has no leases. The 8 residents still moved in are missing from the snapshot | 0 / 8 |

Moved in after day 2 (should still be moved in after day 3): Alice, Bob, Frank, Jack, Dan, Erin, Nora, Mia (5012).
