# Sync app

The sync app syncs the Lakeside PMS into the RentLive app (a smart home and access platform for apartment communities), with a small web UI for staff. The instructions are in [INSTRUCTIONS.md](INSTRUCTIONS.md) and the Lakeside snapshots are in [data/](data/).

- [NOTES.md](NOTES.md): the domain model, where the UI reads from, the surprising data, every decision beyond the rules, production at scale, and what was skipped.
- [MOCK-DATA-ANALYSIS.md](MOCK-DATA-ANALYSIS.md): every case in the data and the expected result of each day, which the tests are written from.

## Quick start

Needs [mise](https://mise.jdx.dev) and Docker.

```sh
mise install        # node and the docker CLI
mise run install    # root, api and client dependencies
mise run app:up     # postgres, api and client in docker
```

Then open the UI at http://localhost:8080. The API is at http://localhost:4444, for example http://localhost:4444/runs.

`mise run app:down` stops everything. `mise tasks` lists the rest.

## Running day 1, day 2 and day 3 from the UI

1. Open http://localhost:8080. The runs view has a button for each snapshot in `data/`.
2. Click **Run day1.json**, then **Run day2.json**, then **Run day3.json**. Each run appears in the table with what it did.
3. Click a run to see its exceptions, or use **Units** and **Change log** in the navigation. From a unit you can open each resident, whose page explains why they were or weren't moved.

Running the same snapshot again is safe and changes nothing. Running an older snapshot after a newer one is refused. To start over, run `mise run app:reset`, which wipes the database and restarts the api so it applies the migrations again.

## Running a sync from the command line

Each run takes one Lakeside snapshot, applies it to RentLive, and prints what it did:

```sh
mise run sync data/day1.json
mise run sync data/day2.json
mise run sync data/day3.json
```

The command exits with 1 when a run is refused or fails. It uses the same database as the UI, so runs from either show up in both.

## Development

```sh
mise run db:up      # postgres only
mise run api:dev    # api with hot reload on :4444
mise run client:dev # client with hot reload on :8080
```

Stop the docker api and client first (`docker compose -f operations/docker-compose.yml stop api client`), since they use the same ports.

## Tests

```sh
mise run test:unit         # pure logic, no database
mise run test:integration  # starts postgres, then runs against it
mise run test:types        # typecheck api and client
mise run test:lint         # lint the whole repo
```

The integration tests use their own database, `sync_app_test`, in the same postgres as the app's `sync_app`, so running them never touches what the UI shows. It's created on the first run and emptied before every test file.

## Snapshot dates

The snapshots are dated so that day 1 is October 27, 2026 in the property's timezone. To move day 1 to today, run `python3 scripts/set_dates.py`, or pass a date: `python3 scripts/set_dates.py 2027-03-15`. Then run `mise run app:reset`, since older runs would make the new snapshots look stale.
