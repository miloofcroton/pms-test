# Sync app

The sync app syncs the Lakeside PMS into the RentLive app (a smart home and access platform for apartment communities), with a small web UI for staff. The instructions are in [docs/instructions.md](docs/instructions.md) and the Lakeside snapshots are in [data/](data/).

## Quick start

Needs [mise](https://mise.jdx.dev) and Docker.

```sh
mise install        # node and the docker CLI
mise run install    # api and client dependencies
mise run app:up     # postgres, api and client in docker
```

- UI: http://localhost:8080
- API: http://localhost:4444/healthcheck

`mise run app:down` stops everything. `mise tasks` lists the rest.

## Running a sync

Each run takes one Lakeside snapshot, applies it to RentLive, and prints what it did. Run the days in order:

```sh
mise run sync data/day1.json
mise run sync data/day2.json
mise run sync data/day3.json
```

Running the same snapshot again is safe and changes nothing. An older snapshot after a newer one is refused. The command exits with 1 when a run is refused or fails. `mise run db:reset` wipes the database to start over.

## Development

```sh
mise run db:up      # postgres only
mise run api:dev    # api with hot reload on :4444
mise run client:dev # client with hot reload on :8080
```

## Tests

```sh
mise run test:unit         # pure logic, no database
mise run test:integration  # starts postgres, then runs against it
mise run test:types        # typecheck api and client
```
