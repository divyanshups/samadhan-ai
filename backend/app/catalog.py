import json
from pathlib import Path
from fastapi import HTTPException

CATALOG = json.loads(
    Path(__file__).with_name("catalog.json").read_text(encoding="utf-8")
)
CATEGORIES = {item["id"]: item for item in CATALOG["categories"]}
DEPARTMENTS = {item["id"]: item for item in CATALOG["departments"]}
DISTRICTS = {item["id"]: item for item in CATALOG["districts"]}


def validate_location(district, locality):
    if district not in DISTRICTS or locality not in {
        p["id"] for p in DISTRICTS[district]["localities"]
    }:
        raise HTTPException(422, "Choose a listed district and a locality within it.")


def suggested_categories(issue):
    words = issue.lower()
    ranked = sorted(
        CATEGORIES.values(),
        key=lambda c: sum(w in words for w in c["keywords"].split()),
        reverse=True,
    )
    return [c["id"] for c in ranked[:3]]
