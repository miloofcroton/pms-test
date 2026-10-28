# Notes

The sync app syncs the Lakeside PMS into the RentLive app. These notes cover what the instructions ask for. Every case in the data, and the expected result for each day, is in [MOCK-DATA-ANALYSIS.md](MOCK-DATA-ANALYSIS.md), which is where the tests come from.

## How a run works

1. **Fetch.** The Lakeside client reads one snapshot file and returns the JSON decoded but otherwise raw. It is stored as-is in `lakeside.snapshots`.
2. **Normalize.** `modules/lakeside/normalize.ts` fixes Lakeside's format (dates, ids, empty strings, nesting, the lease interval in effect) and keeps Lakeside's values as sent, so `co-applicant` and `o1` reach the rules unchanged.
3. **Decide.** `modules/sync/` applies the instructions' rules to the normalized snapshot and what RentLive has stored, and returns one decision per resident: move in, move out or nothing, with a reason code. This part is pure, with no I/O.
4. **Apply.** The runner upserts units and residents through the RentLive contract, then makes every move-out, then every move-in.
5. **Record.** It saves the run with its counts, the latest decision per resident, the run's exceptions, and a change-log entry for each thing that changed.

The command line and the UI's run buttons run the same code. The [README](README.md) says how to run both.

## Domain model

- **Snapshot.** What Lakeside sent, kept raw and append-only. The change log compares each run's snapshot with the previous successful run's, so there is no current copy to keep in step, and old snapshots are evidence of what Lakeside said if a move-out is disputed.
- **Normalized snapshot.** A property, its units (with the raw status code), its leases (with the dates of the interval in effect) and the customers on each lease. It is recomputed from a stored snapshot whenever it is needed, never stored.
- **Resident.** One person on one unit, because RentLive identifies a resident by unit and resident together, so Mia on two units is two residents. A person on several leases of one unit is one resident, taken from their Current lease. That keeps Alice and Bob, who re-signed on day 2, from being moved out by the lease they left. A resident carries their effective status (Notice counts as Current) and whether the 14-day rule syncs them.
- **Decision.** What the rules decided for a resident, with the reason and whether it needs review. Only the latest per resident is kept, because that is what the UI explains.
- **Errors and exceptions.** An error stops a whole run. An exception concerns one record or one person, and the rest of the run goes ahead. They are described below.

The rules work on one unit at a time, because two of the instructions' rules need the whole unit: nobody from a different lease may still be moved in, and a move-out must happen before the next household's move-in.

The code follows the same split. `api/src/modules/` has one folder per system: `lakeside` (the client, the normalizer, the snapshots table), `rentlive` (the contract, an in-memory mock and a Postgres mock, and the mock's tables) and `sync` (the rules, the runner and its records). `integrations/postgres.ts` is the shared connection, and `routes/` are thin HTTP handlers.

The api and the client never import from each other. What they share is types: the reason and change codes and the API's response shapes, in `shared/src/index.ts`, imported by both as `@sync-app/shared`. The api's reads are typed to return those shapes and the client's views read them, so a change on either side fails the other's typecheck. Every import of it is `import type`, enforced by lint, so neither build has to resolve it.

## Where the UI reads from

| What the UI shows | Where it comes from |
|---|---|
| Runs and their counts | `sync.runs`, joined to the snapshot each run processed |
| Units, leases, the people on each lease, contact details and dates | The latest successful run's snapshot, normalized again. A resident missing from it is shown from the newest snapshot that had them, and the page says so |
| Who is moved in now, and who was ever moved out | RentLive, through the contract (`listMovedIn`, `getResidentState`) |
| Why someone was or wasn't moved | `sync.decisions`, the latest decision per resident with its reason |
| Exceptions | `sync.exceptions`, the latest run's |
| The change log | `sync.change_log` |

The RentLive mock is in Postgres rather than in memory because the sync's own records are in Postgres. An in-memory RentLive would forget who is moved in on every restart while `sync` remembered it, and the next run would move people in twice. The in-memory mock is for unit tests, and both pass the same contract test suite. The UI only reaches RentLive through the contract, as the real RentLive would allow.

Times are stored in UTC and shown in the property's timezone. Dates from Lakeside are calendar days, so they are shown as sent.

## How the change log is recorded

`changesOf` in `modules/sync/change-log.ts` compares the previous successful run's snapshot with this one, both normalized, plus the moves RentLive actually made (not the ones planned) and any review exception the previous run didn't have.

- Units are created, change status (including a raw-code change the mapping hides, like `null` to `D`) or are updated.
- Leases are added, changed or removed.
- Residents are created or updated, with the fields that changed. Only synced residents are compared, so one who ages out under the 14-day rule simply stops being compared.
- Moves are recorded as they happened, with the lease.
- A flag for review is recorded once, when it first appears or its reason changes, never once per run.

Running the same snapshot again compares a snapshot with itself and makes no moves, so it records nothing. The run still shows in the runs list. The integration test runs each day twice on Postgres and checks this.

## Errors and exceptions

| | Error | Exception |
|---|---|---|
| Concerns | The whole run | One record or one person |
| Effect | Nothing in the snapshot is applied | The rest of the run goes ahead |
| Stored | `sync.runs.error`, at most one per run | `sync.exceptions`, recorded again on every run |
| Kinds | `fetch` (the file is missing, unreadable or not JSON), `structure` (the snapshot breaks the contract), `stale` (older than the last run, so the run is `refused`), `crash` (something unexpected) | `data` (a record left out, or kept without the broken part), `review` (the rules couldn't settle the case safely, so nobody was moved) |

The runs view counts **skipped** (records never upserted to RentLive: those a data exception left out, and residents the 14-day rule doesn't sync) and **flagged** (residents upserted but not moved, because the rules couldn't decide).

## What was surprising in the data

- **"Today" is not the UTC date.** Every snapshot is generated at 06:30Z, which is the evening before in Los Angeles. Day 1 is October 27 locally, not October 28.
- **Day 3 has every unit and no leases.** Read literally as a full snapshot, everyone left. The rules already protect people, since a move-out needs a status that isn't Current and a move-out date, and a missing resident has neither. Everyone still moved in is flagged as missing from the snapshot, so staff can see the export looks broken, and nobody is moved.
- **Alice and Bob re-sign on day 2.** Their old lease goes Past with a move-out date while a new Current lease starts. Handled one lease at a time, they would be moved out and could never be moved back in automatically.
- **Unit 5011 changes hands on day 2.** Mia's move-out and Nora's move-in happen in the same run, so every move-out runs before any move-in.
- **Liam's lease sends its one customer as an object, not a list.** It is the only lease that does, so it is one broken record rather than a format: it is left out with a data exception and the rest of the snapshot is used. Liam is never moved in, and his lease is gone on day 2 anyway.
- **Format problems in single records:** a duplicate unit (identical, so it's one unit), lowercase `o1` and `co-applicant`, unknown codes such as `O3` and `X`, `""` for null, numeric ids, a lease on a unit that doesn't exist (Paul), a lease with no unit (Quinn), and a lease whose interval in effect isn't the first one.
- **Contradictions:** Ivy is Current with a move-out date in the past, and Jack is Past with no move-out date. Both are flagged rather than moved.

## Decisions beyond the rules

The guiding rule: uphold the contract, and when the data doesn't fit, don't guess. Leave that record or person alone, flag it, and keep the rest of the run going. A wrong move-out locks a real person out of their home, so every decision here errs toward not moving anyone.

- **Unit codes are matched exactly.** `o1` is Down, not Occupied, because the table lists `O1`. The UI shows the raw code next to the status.
- **Customer types are matched exactly.** `co-applicant` is not a lease signer, so Sam is flagged instead of treated as one.
- **A date that isn't `MM/DD/YYYY` is rejected, not guessed.** The customer is left out with a data exception. Reading it as "no date" would be unsafe, since a Current resident with a broken move-out date would look like they have none and could be moved in.
- **A broken interval date keeps the lease, without dates.** Those dates are only shown, never used by the rules.
- **A list sent as an object** (Liam's lease) leaves out just that lease, as above.
- **Two copies of a unit that differ** leave the unit and its leases out, since no copy can be trusted.
- **A snapshot older than the last run is refused,** because stale data could move people. Running the same snapshot again is allowed and changes nothing.
- **A person on several leases of one unit** is taken from their Current lease, then from the lease that started last.
- **Flagged, not moved:** a Current lease signer with no move-in date; a moved-in resident who is Current but whose move-out date has passed; someone not Current with no move-out date; a move-in blocked by another lease still moved in; and signers from two different leases who could both move in on one empty unit, which would give two households the keys to one home.
- **Not moved, not flagged:** a moved-in resident who isn't Current but whose move-out date is still ahead. The rule is waiting for the date.
- **Moved-in residents missing from the snapshot** stay moved in and are flagged, still count as moved in for the different-lease rule, and are found even if the snapshot drops their unit.
- **A Past resident from more than 14 days ago who is still moved in** is flagged rather than skipped silently.
- **A raw-code change the mapping hides** (`null` to `D`, both Down) is still logged, because the UI shows the code.
- **Guarantors and occupants are synced** as RentLive residents, so their type shows in the UI, but never moved in.

## Running this for 5,000 properties

- **Fetching.** The HTTP Lakeside client is a second implementation of the same contract, so the runner doesn't change. Timeouts and failed requests become `fetch` errors, and retries happen before a run is recorded as failed.
- **Scheduling.** Runs go on a queue with one worker per property at a time, using a Postgres advisory lock or the queue's own keying, so two runs of one property can't interleave. Today `POST /runs` runs the sync inside the request.
- **A circuit breaker on move-outs.** If a run would move out more than a small share of a property's residents, it should refuse and flag instead. Day 3 shows why: one bad export could otherwise lock out a whole building.
- **Moves that fail partway.** Each move is one conditional update in the mock, and the runner reads RentLive's state fresh each run, so a rerun after a crash is safe. Against a real RentLive, moves need idempotency keys and retries, and the run should record each move as it happens.
- **Reads.** Today the reads normalize stored snapshots on every request, which is fine for one property. At scale, each run should also write a small read model (current units, leases and residents per property), the runs list and change feed should be paginated, and the UI needs a property picker and staff authentication.
- **Snapshot storage.** Raw snapshots hold personal data. Keep them for a retention window (30 to 90 days), partition the table by month, and move the bodies to object storage if they outgrow Postgres. A NoSQL store doesn't help here: snapshots are written once and read by key, and a second database would cost the transaction and foreign key between a run and its snapshot.
- **Monitoring.** Alert on run errors, on exception counts that jump between runs, and on properties whose runs stop arriving.

## What I skipped

- **Manual approval.** Staff can see why someone was flagged or left out, but can't approve a move by hand (for example, moving Liam in). That's the natural next feature.
- **Authentication, a property picker and pagination.** There is one property and little data.
- **Committed browser tests.** Each view was checked in a real browser, with a scripted walk through every view and the Playwright MCP, but no browser test is in the repo. The code behind the UI is tested against Postgres.
- **Retrying a failed move within a run.** A refused move stops the run as a `crash`, and the next run recovers by reading RentLive's state again.
