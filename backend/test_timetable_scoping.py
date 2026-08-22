import asyncio
import copy

import server
from server import (
    SCHOOL_SECTION_ARABIC,
    SCHOOL_SECTION_INTERNATIONAL,
    current_academic_year,
    default_schedule,
    resolve_user_timetable,
    timetable_storage_key,
    TimetableUpdate,
)


def _schedule(value):
    schedule = default_schedule()
    schedule["Sunday"][0] = value
    return schedule


def test_legacy_schedule_is_available_to_international_only():
    user = {"schedule": _schedule("Legacy science")}
    active_year = current_academic_year()

    international, used_legacy = resolve_user_timetable(
        user, SCHOOL_SECTION_INTERNATIONAL, active_year
    )
    arabic, arabic_used_legacy = resolve_user_timetable(
        user, SCHOOL_SECTION_ARABIC, active_year
    )
    start_year = int(active_year[:4])
    future, future_used_legacy = resolve_user_timetable(
        user,
        SCHOOL_SECTION_INTERNATIONAL,
        f"{start_year + 1}-{start_year + 2}",
    )

    assert international["Sunday"][0] == "Legacy science"
    assert used_legacy is True
    assert arabic["Sunday"][0] == ""
    assert arabic_used_legacy is False
    assert future["Sunday"][0] == ""
    assert future_used_legacy is False


def test_section_and_academic_year_records_are_independent():
    international_key = timetable_storage_key(SCHOOL_SECTION_INTERNATIONAL, "2026-2027")
    arabic_key = timetable_storage_key(SCHOOL_SECTION_ARABIC, "2026-2027")
    future_arabic_key = timetable_storage_key(SCHOOL_SECTION_ARABIC, "2027-2028")
    user = {
        "schedule": _schedule("Legacy"),
        "timetable_records": {
            international_key: {"schedule": _schedule("International")},
            arabic_key: {"schedule": _schedule("Arabic")},
            future_arabic_key: {"schedule": _schedule("Future Arabic")},
        },
    }

    assert resolve_user_timetable(user, "international", "2026-2027")[0]["Sunday"][0] == "International"
    assert resolve_user_timetable(user, "arabic", "2026-2027")[0]["Sunday"][0] == "Arabic"
    assert resolve_user_timetable(user, "arabic", "2027-2028")[0]["Sunday"][0] == "Future Arabic"
    assert len({international_key, arabic_key, future_arabic_key}) == 3


class _UpdateResult:
    matched_count = 1


class _FakeUsers:
    def __init__(self, user):
        self.user = user

    async def find_one(self, query, projection=None):
        return copy.deepcopy(self.user) if query.get("id") == self.user["id"] else None

    async def update_one(self, query, update):
        assert query.get("id") == self.user["id"]
        for dotted_key, value in update["$set"].items():
            target = self.user
            parts = dotted_key.split(".")
            for part in parts[:-1]:
                target = target.setdefault(part, {})
            target[parts[-1]] = copy.deepcopy(value)
        return _UpdateResult()


class _FakeDb:
    def __init__(self, user):
        self.users = _FakeUsers(user)


def test_profile_timetable_endpoints_save_sections_and_years_without_mixing(monkeypatch):
    user = {"id": "teacher-1", "schedule": _schedule("Legacy")}
    monkeypatch.setattr(server, "db", _FakeDb(user))

    async def _ignore_log(*_args, **_kwargs):
        return None

    monkeypatch.setattr(server, "log_user_action", _ignore_log)
    current_user = {"id": "teacher-1", "role_name": "Teacher"}
    active_year = current_academic_year()
    active_start = int(active_year[:4])
    future_year = f"{active_start + 1}-{active_start + 2}"

    asyncio.run(
        server.update_profile_timetable(
            TimetableUpdate(schedule=_schedule("Arabic 2026")),
            SCHOOL_SECTION_ARABIC,
            active_year,
            current_user,
        )
    )
    asyncio.run(
        server.update_profile_timetable(
            TimetableUpdate(schedule=_schedule("Arabic 2027")),
            SCHOOL_SECTION_ARABIC,
            future_year,
            current_user,
        )
    )

    international = asyncio.run(
        server.get_profile_timetable(
            SCHOOL_SECTION_INTERNATIONAL, active_year, current_user
        )
    )
    arabic = asyncio.run(
        server.get_profile_timetable(SCHOOL_SECTION_ARABIC, active_year, current_user)
    )
    future_arabic = asyncio.run(
        server.get_profile_timetable(SCHOOL_SECTION_ARABIC, future_year, current_user)
    )

    assert international["schedule"]["Sunday"][0] == "Legacy"
    assert arabic["schedule"]["Sunday"][0] == "Arabic 2026"
    assert future_arabic["schedule"]["Sunday"][0] == "Arabic 2027"
    assert user["schedule"]["Sunday"][0] == "Legacy"

    asyncio.run(
        server.update_profile_timetable(
            TimetableUpdate(schedule=_schedule("Updated International")),
            SCHOOL_SECTION_INTERNATIONAL,
            active_year,
            current_user,
        )
    )
    updated_international = asyncio.run(
        server.get_profile_timetable(
            SCHOOL_SECTION_INTERNATIONAL, active_year, current_user
        )
    )
    unchanged_arabic = asyncio.run(
        server.get_profile_timetable(SCHOOL_SECTION_ARABIC, active_year, current_user)
    )

    assert updated_international["schedule"]["Sunday"][0] == "Updated International"
    assert updated_international["legacy_fallback"] is False
    assert user["schedule"]["Sunday"][0] == "Updated International"
    assert unchanged_arabic["schedule"]["Sunday"][0] == "Arabic 2026"

    asyncio.run(
        server.update_profile_timetable(
            TimetableUpdate(schedule=_schedule("Future International")),
            SCHOOL_SECTION_INTERNATIONAL,
            future_year,
            current_user,
        )
    )
    future_international = asyncio.run(
        server.get_profile_timetable(
            SCHOOL_SECTION_INTERNATIONAL, future_year, current_user
        )
    )
    current_international = asyncio.run(
        server.get_profile_timetable(
            SCHOOL_SECTION_INTERNATIONAL, active_year, current_user
        )
    )
    assert future_international["schedule"]["Sunday"][0] == "Future International"
    assert current_international["schedule"]["Sunday"][0] == "Updated International"
    assert user["schedule"]["Sunday"][0] == "Updated International"
