"""Read-only audit for Arabic records created under the former four-exam model."""

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from server import SCHOOL_SECTION_ARABIC, classify_legacy_arabic_practical, client, db  # noqa: E402


async def main() -> None:
    await client.admin.command("ping")
    records = await db.arabic_quarter_scores.find(
        {
            "school_section": SCHOOL_SECTION_ARABIC,
            "$or": [
                {"practical_test_1": {"$ne": None}},
                {"practical_test_2": {"$ne": None}},
                {"legacy_exam_model": "four_exam_v1"},
            ],
        },
        {"_id": 0, "practical_test": 1, "practical_test_1": 1, "practical_test_2": 1, "legacy_migration_status": 1},
    ).to_list(100000)
    summary = {
        "legacy_records": len(records),
        "migrated_unambiguous": 0,
        "manual_review": 0,
        "resolved_manual_review": 0,
        "already_new": 0,
    }
    for record in records:
        status = classify_legacy_arabic_practical(record)["status"]
        if status in summary:
            summary[status] += 1
    print(json.dumps(summary, sort_keys=True))


if __name__ == "__main__":
    asyncio.run(main())
