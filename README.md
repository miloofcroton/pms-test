# RentLive's Property Management System

A sync from the Lakeside PMS into RentLive, with a small web UI. The brief is in [docs/instructions.md](docs/instructions.md) and the Lakeside snapshots are in [data/](data/).

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
