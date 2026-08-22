from calendar_pdf_import import _week_event, parse_anjal_calendar_pdf, select_calendar_for_date


def _pair(day, month, hijri_year, gregorian_day, gregorian_month, gregorian_year):
    return f"{day}/{month}/{hijri_year} هـ\n{gregorian_day}/{gregorian_month}/{gregorian_year} م"


def _page(row_count, gregorian_year, hijri_year, title=False, next_year=False):
    rows = []
    for row in range(row_count):
        rows.extend(_pair(day, 3, hijri_year, day, 8, gregorian_year) for day in range(1, 6))
    prefix = f"التقويم الدراسي لمدارس الأنجال الأهلية للعام {hijri_year} هـ\n" if title else ""
    suffix = f"\nبداية العام الدراسي {_pair(20, 3, hijri_year + 1, 22, 8, gregorian_year + 1)}" if next_year else ""
    return prefix + "\n".join(rows) + suffix


class _FakePage:
    def __init__(self, text):
        self.text = text

    def extract_text(self):
        return self.text


class _FakeReader:
    def __init__(self, _stream):
        self.pages = [
            _FakePage(_page(13, 2030, 1452, title=True)),
            _FakePage(_page(8, 2030, 1452)),
            _FakePage(_page(13, 2031, 1452)),
            _FakePage(_page(6, 2031, 1452, next_year=True)),
        ]


def test_pdf_import_derives_years_and_builds_both_semesters(monkeypatch):
    monkeypatch.setattr("calendar_pdf_import.PdfReader", _FakeReader)
    parsed = parse_anjal_calendar_pdf(b"%PDF-fake", "future-calendar.pdf")
    assert parsed["calendar"]["academic_year"] == "2030-2031"
    assert parsed["calendar"]["hijri_year"] == "1452H"
    assert parsed["calendar"]["teaching_week_count"] == 38
    assert parsed["calendar"]["event_count"] == 54
    assert {event["semester"] for event in parsed["events"] if event["event_type"] == "teaching_week"} == {1, 2}


def test_week_validation_flags_printed_date_anomalies():
    pairs = [
        {"gregorian": f"2026-12-{day:02d}", "hijri": f"1448-07-{day:02d}", "gyear": 2026, "hyear": 1448, "hmonth": 7, "hday": day, "raw": str(day)}
        for day in range(11, 14)
    ]
    pairs.extend([
        {"gregorian": "2020-12-23", "hijri": "1448-07-14", "gyear": 2020, "hyear": 1448, "hmonth": 7, "hday": 14, "raw": "23/12/2020"},
        {"gregorian": "2020-12-24", "hijri": None, "gyear": 2020, "hyear": 1448, "hmonth": 7, "hday": 79, "raw": "79/7/1448"},
    ])
    event = _week_event(
        semester=1, week_number=17, row_type="teaching_week", pairs=pairs, order="forward",
        academic_year="2026-2027", hijri_year="1448H", source_document="calendar.pdf",
    )
    assert event["verified"] is False
    assert event["gregorian_end"] is None
    assert "Gregorian year anomaly" in event["manual_review_note"]
    assert "Invalid Hijri value" in event["manual_review_note"]


def test_current_calendar_switches_automatically_and_history_remains_selectable():
    calendars = [
        {"academic_year": "2026-2027", "academic_year_start": "2026-08-16", "next_academic_year_start": "2027-08-22"},
        {"academic_year": "2027-2028", "academic_year_start": "2027-08-22", "next_academic_year_start": "2028-08-20"},
    ]
    assert select_calendar_for_date(calendars, "2027-08-21")["academic_year"] == "2026-2027"
    assert select_calendar_for_date(calendars, "2027-08-22")["academic_year"] == "2027-2028"
    assert [item["academic_year"] for item in calendars] == ["2026-2027", "2027-2028"]
