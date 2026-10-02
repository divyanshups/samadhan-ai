"""Generate Vapi tool JSON using your public HTTPS endpoint and credential ID."""

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def definitions(base_url, credential_id):
    server = {
        "url": base_url.rstrip("/") + "/api/vapi/tools",
        "credentialId": credential_id,
    }
    fields = {
        name: {"type": "string", "description": description}
        for name, description in {
            "issue_description": "Issue in the citizen’s own words.",
            "house_or_landmark": "House number, house name, or public-place landmark.",
            "area": "Area or neighbourhood name.",
            "ward": "Ward number; empty string if the citizen does not know.",
            "issue_duration_or_start_date": "Preserve the stated duration, such as तीन दिन से.",
            "category_id": "An exact existing category ID explicitly selected by the citizen.",
            "remarks": "Additional remarks; empty string when declined.",
        }.items()
    }
    specs = [
        (
            "get_complaint_context",
            "Call at the beginning and when resuming. Gets saved fields and the actual category IDs. Do not ask for fields already saved.",
            {"type": "object", "properties": {}, "additionalProperties": False},
        ),
        (
            "update_complaint_draft",
            "Save only new or explicitly corrected fields. Omit other fields. Never submit. category_confirmed must be true only after the citizen explicitly chooses a category.",
            {
                "type": "object",
                "properties": {
                    "fields": {
                        "type": "object",
                        "properties": fields,
                        "additionalProperties": False,
                    },
                    "category_confirmed": {
                        "type": "boolean",
                        "description": "True only if this citizen explicitly selected or confirmed category_id.",
                    },
                },
                "required": ["fields"],
                "additionalProperties": False,
            },
        ),
        (
            "show_categories",
            "Get the available categories and their real IDs for the website selector. Ask the citizen to choose and wait for the on-screen selection or a clear spoken choice.",
            {"type": "object", "properties": {}, "additionalProperties": False},
        ),
        (
            "ready_for_preview",
            "After all required answers and category selection are saved, make Proceed to Preview available. It never submits a complaint.",
            {"type": "object", "properties": {}, "additionalProperties": False},
        ),
    ]
    return [
        {
            "type": "function",
            "function": {"name": name, "description": desc, "parameters": params},
            "server": server,
        }
        for name, desc, params in specs
    ]


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--base-url",
        required=True,
        help="Public HTTPS backend origin, without /api/vapi/tools",
    )
    parser.add_argument(
        "--credential-id",
        required=True,
        help="Vapi saved Bearer Token credential ID, not its secret value",
    )
    args = parser.parse_args()
    if not args.base_url.startswith("https://"):
        parser.error("Vapi needs a publicly reachable HTTPS URL.")
    folder = ROOT / "docs/vapi-tools"
    folder.mkdir(exist_ok=True)
    for tool in definitions(args.base_url, args.credential_id):
        path = folder / (tool["function"]["name"] + ".json")
        path.write_text(
            json.dumps(tool, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(path.relative_to(ROOT))
