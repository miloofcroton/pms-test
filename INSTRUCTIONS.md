# Take-home: PMS sync and automatic move-in/move-out

## Context

This exercise is set at **RentLive**, a made-up company that runs apartment buildings' resident app and door access. RentLive, the Lakeside PMS and every rule below are invented for this exercise. They do not describe any real company's system.

A property management system (PMS) keeps a building's units and leases. Each night Lakeside sends RentLive a dump of one property: its units, and its leases with the people on each lease. From that dump RentLive keeps units and residents up to date. It also runs an **automatic move-in/move-out** workflow. A move-in gives the resident access to their home and to the app. A move-out takes that access away.

You will build the service that syncs Lakeside into RentLive, and a small web UI on top of it.

Plan on **1-3 hours**. We value a clear, correct, well-tested core over breadth. The sync matters more than the UI. If you run out of time, write down what you would do next.

## What you get

- `candidate/data/day1.json`: a full Lakeside snapshot of one property, taken on the first night.
- `candidate/data/day2.json`: a full snapshot of the same property, taken the next night.
- `candidate/data/day3.json`: the third night's snapshot.

There is no real Lakeside API. Read the files from disk.

The snapshots are dated for one week. If you take this exercise later, run `python3 scripts/set_dates.py` (Python 3.9 or later) to move day 1 to today. Day 2 and day 3 follow on the next nights. You can also pass a date: `python3 scripts/set_dates.py 2027-03-15`.

## Language and stack

We prefer **Elixir** for the backend, **React** for the UI and **PostgreSQL** for storage, because that is what we work in. You can use any language, framework and database you are comfortable with, including SQLite or keeping state in memory. A clear, correct solution in another stack scores the same as one in ours. The contracts below are written in Elixir; in another language, write the same contract as an interface, trait, protocol or abstract class.

## What to build

A project that:

1. **Reads** a Lakeside snapshot through the `Lakeside.Client` contract below. Write an implementation that reads the JSON files.
2. **Normalizes** the snapshot into your domain model: **units**, **residents** and **leases**. Choose the shapes yourself and explain them.
3. **Syncs** the result to RentLive through the `RentLive` contract below. This means upserting units and residents, and **triggering** move-ins and move-outs according to the rules below.
4. Can be **run once per snapshot, in order**: day 1, day 2, then day 3. Running the same snapshot twice must be safe.
5. Has a **web UI** that shows what was synced and what the sync did. See "The UI" below.

## The Lakeside client contract

Today Lakeside sends files. Later it will be an HTTP API. Code against this contract so that change touches one module:

```elixir
defmodule Lakeside.Client do
  @doc """
  Returns one full snapshot of a property, decoded from JSON but otherwise raw.
  For the file implementation, `source` is a path to a snapshot file.
  """
  @callback fetch_snapshot(source :: String.t()) :: {:ok, map()} | {:error, term()}
end
```

The client only fetches and decodes. Normalizing is a separate step.

## The RentLive contract

RentLive owns the database and the workflows. You do not have access to it. Code against this contract, and write your own in-memory implementation for tests and for running the project locally:

```elixir
defmodule RentLive do
  @type unit_remote_id :: String.t()
  @type resident_remote_id :: String.t()

  @typedoc "What RentLive has stored for a resident on a unit."
  @type resident_state :: %{
          moved_in: boolean(),
          ever_moved_out: boolean()
        }

  @callback upsert_units(property_id :: String.t(), units :: [map()]) :: :ok | {:error, term()}
  @callback upsert_residents(property_id :: String.t(), residents :: [map()]) :: :ok | {:error, term()}

  @callback get_resident_state(property_id :: String.t(), unit_remote_id(), resident_remote_id()) ::
              {:ok, resident_state()} | {:error, :not_found}

  @doc "Residents currently moved in on a unit, with the lease RentLive has stored for each."
  @callback list_moved_in(property_id :: String.t(), unit_remote_id()) ::
              {:ok, [%{resident_remote_id: resident_remote_id(), lease_remote_id: String.t()}]}

  @doc "Starts the move-in workflow. Sets moved_in to true."
  @callback move_in(property_id :: String.t(), unit_remote_id(), resident_remote_id()) :: :ok | {:error, term()}

  @doc "Starts the move-out workflow. Sets moved_in to false and ever_moved_out to true."
  @callback move_out(property_id :: String.t(), unit_remote_id(), resident_remote_id()) :: :ok | {:error, term()}
end
```

In RentLive a resident is identified by **unit and resident remote id together**. The same person on two units is two RentLive residents.

`move_in` and `move_out` act on the resident RentLive has stored. Upsert a resident before you move them in or out.

## The Lakeside snapshot format

- `meta.generated_at`: when the snapshot was taken (UTC).
- `property`: id, name and IANA `timezone`.
- `units[]`: `id`, `unitNumber`, `buildingName`, `floorplanName`, `unitStatus`. `unitStatus` is a Lakeside code. See the mapping below.
- `leases[]`:
  - `id`, `unitId` and `leaseIntervalStatus`. Statuses are `Applicant`, `Cancelled`, `Future`, `Current`, `Notice` and `Past`.
  - `leaseIntervals.leaseInterval[]`: the lease's terms (`startDate`, `endDate`). `leaseIntervalId` points to the interval that is in effect.
  - `customers.customer[]`: the people on the lease. Each has:
    - `customerType`: `Primary`, `Co-Applicant`, `Guarantor` or `Occupant`.
    - `leaseCustomerStatus`: the person's own status. When it is null, the lease status applies.
    - `moveInDate` and `moveOutDate`.
    - contact details.
- Dates are `MM/DD/YYYY` and mean the property's **local** calendar day.

Every snapshot is a **full** snapshot of the property, not a delta.

### Unit status mapping

RentLive stores a unit status from a fixed list. Map Lakeside codes like this:

| Lakeside `unitStatus` | RentLive unit status |
|---|---|
| `O1` | Occupied |
| `O2` | Occupied |
| `V1` | Vacant |
| `V2` | Vacant |
| `M` | Model |
| `C` | Common Area |
| anything else | Down |

"Anything else" includes a missing or empty status.

## Move-in and move-out rules

These are the rules for this exercise.

- **Lease signers** are customers with type Primary or Co-Applicant. **Only lease signers are moved in.** Guarantors and occupants are never moved in.
- A person's effective status is their `leaseCustomerStatus` when it is present. Otherwise it is the lease status. **Notice counts as Current.**
- Do not sync residents whose effective status is Past and whose move-out date is more than 14 days before today.
- **Move in** a resident when all of these are true:
  - their effective status is Current
  - they are not already moved in
  - their move-in date is within the last 14 days, counting today
  - they have no move-out date, or their move-out date is still in the future
  - they have never been moved out of that unit before. A resident who was moved out is never moved in again automatically.
  - nobody from a **different lease** is still moved in on that unit. Roommates on the same lease can all be moved in.
- **Move out** a resident when all of these are true:
  - they are currently moved in
  - their effective status is not Current
  - their move-out date is today or earlier
- "Today" means **today in the property's timezone**. Use the snapshot's `generated_at` as "now" so that runs are reproducible.
- Do not move anyone in or out twice.

If the data puts you in a situation these rules do not cover, make a decision, keep it safe, and **write it down**. Moving someone out by mistake locks a real person out of their home.

## The UI

Property staff use this UI to answer "what does the system know about this unit or resident, and what happened to them?" We prefer React on top of a JSON API that your backend serves. Phoenix LiveView, server-rendered pages or any other frontend are fine too. Keep the styling simple. We look at what it shows and how the data gets there, not at how it looks.

It needs these views:

- **Sync runs.** One row per run: snapshot file, `generated_at`, when it ran, and counts of units and residents upserted, move-ins, move-outs and records skipped or flagged. A way to start a run from the UI, for example a button for each snapshot in `candidate/data/`.
- **Units.** Every unit with its number, building, floorplan and RentLive unit status. Show the raw Lakeside code next to the mapped status.
- **Unit detail.** The unit's leases with their status and dates, the people on each lease with their type, and who is moved in right now.
- **Resident detail.** One resident on one unit: type, effective status, move-in and move-out dates, contact details, whether they are moved in, and their **change log**.
- **Change log.** A timeline of what the sync did, newest first. Show it on the resident and unit pages, and as one feed for the whole property. Each entry has:
  - what happened, for example: unit created, unit status changed, resident created, resident updated (with the fields that changed), lease changed, moved in, moved out, and flagged for review (with the reason)
  - the time it was recorded, shown in the property's timezone
  - the sync run that recorded it

Record an entry only when something changed. Running the same snapshot twice must not add entries to any timeline. A run that changes nothing still shows up in the runs list.

When a resident is not moved in or out, the UI should let staff see why. For example, a resident who is Current but was never moved in should show the rule that stopped it.

Your RentLive fake holds what RentLive would store. The UI can read from it, from your own storage, or both. Explain the choice in `NOTES.md`. If you keep state in memory, the runs must happen in the same running app, for example from the UI's run buttons.

## What to submit

- The project, with tests. One command runs the tests, for example `mix test`, and they must pass.
- A way to run a sync: a command or a function you can call from a console, for example a Mix task. It takes a snapshot path and prints or logs what it did.
- The UI, started with one or two commands. If you use a database, include a way to start it, for example a `docker-compose.yml`. Say in your README how to install and start everything, how to open the UI, and how to run day 1, day 2 and day 3 from it.
- Tests for the code behind the UI, such as the change log. Browser tests are optional.
- A short `NOTES.md` that covers:
  - Your domain model, and why you chose it.
  - Where the UI reads its data from, and how the change log is recorded.
  - How you handled anything surprising in the data.
  - Every decision you made that the rules did not cover.
  - What you would change to run this in production for 5,000 properties.
  - What you skipped because of time.

## The follow-up session

We will meet for about an hour. You will walk us through your code, and then we will extend it together. Keep the project easy to change.
