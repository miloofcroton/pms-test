# Mock data analysis

An audit of the three Lakeside snapshots in `data/`, done before writing any domain code. It lists every oddity in the data, what the sync should do about it, and the decisions we made where the brief's rules don't cover a case. Each row becomes a test, so this is where the test cases come from. People are named as in the snapshots, for example "Grace" rather than "customer 3009".

The snapshots are the originals moved back exactly one day by `scripts/set_dates.py`. The relationships between dates are unchanged, and day 1 is property-local 2026-10-27.

We treat the brief's mappings and rules as a contract. Bad data from Lakeside never bends them. When the data doesn't fit, the sync follows the contract, flags the record, and the case is written down here.

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
| Duplicate unit | 5003 appears twice on day 1, identically | One unit. Day 1 has 16 units, not 17. Copies that differ would leave the unit and its leases out, with a record exception |
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
| A list sent as a single object | Day 1: L9010 (Liam) has `customers.customer` as one object, not a one-item list. Every other lease sends a list | Leave just that lease out, with a record exception, and accept the rest of the snapshot. Liam is never moved in. See the decisions below |
| A lease missing from a later snapshot | L9010 (Liam on 5010) is on day 1 but not day 2, while unit 5010 is still `O1` | Nothing happens to Liam, because his lease was already left out on day 1. Had he been moved in, he would stay moved in and be flagged as missing: a missing lease never moves anyone out |

## Rules engine

| Case | Who | Expected |
|---|---|---|
| Current, inside the window, never moved in | Alice (day 1) | Move in |
| Current, moved in outside the window | Carol, 09/01 | Not moved in. Reason: move-in date is older than 14 days. This is the brief's example of showing why |
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
| Raw code changes but the mapped status doesn't | 5015 `null` to `D`, both Down | Pending decision: log the raw change or not |
| Lease changed | 5001 on day 2: L9101 added, L9001 went Past. Gary's move-in date changed to 10/27 | "Lease changed" and "resident updated" entries with the fields that changed |
| New resident | Uma on 5001, Mia on 5012, Tina on 5008 (all day 2) | "Resident created" |
| Snapshot with units but no leases | Day 3 | See "Day 3" below |
| Rerun any snapshot | Day 1, 2 or 3 twice | A new row in the runs list, no new change-log entries, no RentLive calls that change anything |
| Flags on rerun | Paul, Quinn and Jack | The flag is written once, not once per run |
| Run fails partway | Synthetic | The run is marked failed with its error, and it can be run again safely |

## Expected outcomes per day

| Day | Today | Move-ins | Move-outs | Flags |
|---|---|---|---|---|
| 1 | 10/27 | Alice, Bob (5001), Frank (5005), Jack (5009), Grace (5006), Henry (5007), Mia (5011). 7 total | None | Liam (lease left out: customers is not a list), Paul (unit 5099), Quinn (no unit), Ivy (Current with a past move-out), Sam (unknown customer type `co-applicant`) |
| 2 | 10/28 | Dan (5003), Erin (5004), Nora (5011), Mia (5012). 4 total | Grace (5006), Henry (5007), Mia (5011). 3 total | Paul, Quinn and Sam (unchanged, not logged again), Jack (Past, no move-out date). Ivy is no longer flagged: her lease is Past now, so her status and date agree |
| 3 | 10/29 | None | None | The run has no leases. The 8 residents still moved in are missing from the snapshot |

Moved in after day 2 (should still be moved in after day 3): Alice, Bob, Frank, Jack, Dan, Erin, Nora, Mia (5012).

## Day 3

Day 3 lists every unit but has zero leases. Read literally as a full snapshot, it says nobody lives anywhere.

The rules already protect people here. A move-out needs an effective status that isn't Current and a move-out date of today or earlier. A resident who is missing from the snapshot has neither, so nobody can be moved out. The run should still make this visible instead of passing silently:
- Upsert the units. They are present and unchanged.
- Flag every resident who is moved in but missing from the snapshot. That's 8 people, so staff can see the export looks broken.
- Leave everything else alone.

## Decisions beyond the rules (agreed 2026-10-27)

- Raw-only status change (5015 `null` to `D`): log it, because the UI shows the raw code.
- A snapshot older than the last run (for example day 1 after day 2): refuse it, because stale data could move people in or out. The refused run still appears in the runs list. Rerunning the same snapshot is allowed and changes nothing.
- A Past resident from more than 14 days ago who is still moved in on RentLive: not in the data. Flag them for review rather than skipping them silently.
- A date that isn't `MM/DD/YYYY` (for example `10/1/2026`, `2026-10-17` or `02/30/2026`): not in the data. Reject it rather than guess, and flag the customer. Reading it as "no date" would be unsafe, because a Current resident with a broken move-out date would look like they have none and could be moved in. (Agreed 2026-10-28.)
- A list sent as a single object (L9010's `customers.customer` on day 1, the only lease that does it): leave just that lease out with a record exception, and accept the rest of the snapshot. It is one inconsistent record, not a systematic format, since every other single-customer lease sends a one-item list. Failing the whole run would stop the sync for everyone over one record. Liam is never moved in, which is the safe direction. (Agreed 2026-10-28.)
- A lease whose interval in effect has a broken date: keep the lease without dates, with a record exception. Those dates are only shown in the UI, never used by the rules. (Agreed 2026-10-28.)
- Later, not in v1: a way in the UI for staff to approve a flagged or left-out record by hand, such as moving Liam in.

## Decisions made while building the rules (2026-10-28, for review)

Each one takes the safe side: when the rules don't settle a case, nobody is moved, and the case is flagged so staff can see it.

- Three kinds of exception, so the client can sort them. A **snapshot exception** (`SnapshotException`) means the structure breaks the contract, for example no `units` list, a unit or lease with no id, or a `generated_at` that isn't a timestamp: it is thrown, the whole run fails, and nobody is moved. A **record exception** (`RecordException`, in `snapshot.exceptions`) means one record's values break it: that record is left out, or kept without the broken part, and the rest of the snapshot is used. A **review exception** is a decision the rules flagged, like Jack's on day 2: the data is valid, but the case can't be settled safely, so nobody is moved. Every run records all three in `sync.exceptions`, so the latest run's rows are the current list. An exception doesn't have to stop the code.
- Two copies of a unit that differ: an exception, not a choice. The unit is left out with a record exception, and so are its leases, since no copy can be trusted. Anyone already moved in there is flagged as missing from the snapshot and stays moved in. Identical copies (5003 on day 1) are one unit, with no record exception.
- A person on several leases of one unit: their Current lease wins, whichever order the leases arrive in. If two are Current, the lease that started last wins.
- A Current lease signer with no move-in date: not moved in, flagged. There is no date to check against the window.
- A moved-in resident who is still Current but whose move-out date is today or earlier: left moved in, flagged. The move-out rule needs them not to be Current, so the status and the date contradict each other, like Ivy on day 1.
- A moved-in resident who is not Current and whose move-out date is still in the future: left moved in, not flagged. The move-out rule is simply waiting for the date.
- A move-in blocked because someone from a different lease is still moved in: not moved in, flagged, because it usually means the previous household's move-out is missing.
- Lease signers from two different leases who could both move in on the same empty unit: neither is moved in, both are flagged. The rules allow it, but it would give two households the keys to one home.
- A moved-in resident missing from the snapshot still counts as moved in for the different-lease rule, so a new lease can't move in over them.
- Units RentLive has residents on are checked even if the snapshot no longer lists the unit, so a moved-in resident there is flagged as missing rather than forgotten.
