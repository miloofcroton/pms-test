#!/usr/bin/env python3
"""Move the snapshot dates so that day 1 is today.

Usage:
    python3 scripts/set_dates.py              # day 1 = today in the property's timezone
    python3 scripts/set_dates.py 2027-03-15   # day 1 = the given date

Every date in every snapshot moves by the same number of days, so the gaps between dates stay
the same. Day 2 and day 3 follow on the next nights. Running it again is safe.
"""
import datetime as dt
import json
import re
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

DATA = Path(__file__).resolve().parent.parent / "data"
FILES = ["day1.json", "day2.json", "day3.json"]
DATE = re.compile(r"^\d{2}/\d{2}/\d{4}$")


def local_today(snapshot):
    tz = ZoneInfo(snapshot["property"]["timezone"])
    generated_at = dt.datetime.fromisoformat(snapshot["meta"]["generated_at"].replace("Z", "+00:00"))
    return generated_at.astimezone(tz).date()


def shift(value, delta):
    if isinstance(value, dict):
        return {k: shift(v, delta) for k, v in value.items()}
    if isinstance(value, list):
        return [shift(v, delta) for v in value]
    if isinstance(value, str) and DATE.match(value):
        return (dt.datetime.strptime(value, "%m/%d/%Y") + delta).strftime("%m/%d/%Y")
    return value


def main():
    snapshots = {name: json.loads((DATA / name).read_text()) for name in FILES}
    tz = ZoneInfo(snapshots["day1.json"]["property"]["timezone"])
    target = dt.date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else dt.datetime.now(tz).date()
    delta = dt.timedelta(days=(target - local_today(snapshots["day1.json"])).days)

    for name, snapshot in snapshots.items():
        snapshot = shift(snapshot, delta)
        generated_at = dt.datetime.fromisoformat(snapshot["meta"]["generated_at"].replace("Z", "+00:00"))
        snapshot["meta"]["generated_at"] = (generated_at + delta).strftime("%Y-%m-%dT%H:%M:%SZ")
        (DATA / name).write_text(json.dumps(snapshot, indent=2))
        print(f"{name}: generated_at {snapshot['meta']['generated_at']}, local day {local_today(snapshot)}")


if __name__ == "__main__":
    main()
