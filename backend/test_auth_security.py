import asyncio
import os
import re
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

import server

TEST_JWT_SECRET = "test-secret-that-is-at-least-thirty-two-bytes-long"


def _matches(document, query):
    if not query:
        return True
    if "$or" in query:
        return any(_matches(document, item) for item in query["$or"])
    for key, expected in query.items():
        if key.startswith("$"):
            continue
        actual = document.get(key)
        if isinstance(expected, dict) and "$regex" in expected:
            flags = re.IGNORECASE if "i" in expected.get("$options", "") else 0
            if re.search(expected["$regex"], str(actual or ""), flags) is None:
                return False
        elif isinstance(expected, dict) and "$ne" in expected:
            if actual == expected["$ne"]:
                return False
        elif actual != expected:
            return False
    return True


class _Cursor:
    def __init__(self, rows):
        self.rows = list(rows)

    def sort(self, key, direction):
        self.rows.sort(key=lambda row: row.get(key) or "", reverse=direction < 0)
        return self

    async def to_list(self, limit):
        return [dict(row) for row in self.rows[:limit]]


class _Collection:
    def __init__(self, rows=None):
        self.rows = [dict(row) for row in (rows or [])]

    def find(self, query=None, projection=None):
        return _Cursor([row for row in self.rows if _matches(row, query or {})])

    async def find_one(self, query=None, projection=None):
        for row in self.rows:
            if _matches(row, query or {}):
                return dict(row)
        return None

    async def insert_one(self, document):
        self.rows.append(dict(document))
        return SimpleNamespace(inserted_id=document.get("id"))

    async def update_one(self, query, update, upsert=False):
        for row in self.rows:
            if _matches(row, query):
                if "$set" in update:
                    row.update(update["$set"])
                if "$inc" in update:
                    for key, amount in update["$inc"].items():
                        row[key] = row.get(key, 0) + amount
                return SimpleNamespace(matched_count=1, modified_count=1)
        return SimpleNamespace(matched_count=0, modified_count=0)


def _fake_db(users):
    return SimpleNamespace(
        users=_Collection(users),
        roles=_Collection(),
        notification_logs=_Collection(),
    )


def _google_payload():
    return server.AuthGooglePayload(id_token="verified-google-token")


def _verified_google_identity(email="teacher@example.com", sub="google-sub-1"):
    return {"email": email, "email_verified": True, "name": "Teacher One", "sub": sub}


def test_existing_local_user_first_gmail_sign_in_is_queued_without_disabling_password_access(monkeypatch):
    fake_db = _fake_db(
        [{
            "id": "teacher-1",
            "name": "Local Teacher Name",
            "email": "teacher@example.com",
            "username": "teacher",
            "role_name": "Teacher",
            "auth_provider": "local",
            "password_hash": "existing-local-hash",
            "active": True,
            "auth_version": 0,
        }]
    )
    notify = AsyncMock()
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-id")
    monkeypatch.setattr(server, "_GOOGLE_AUTH_AVAILABLE", True)
    monkeypatch.setattr(server, "google_id_token", SimpleNamespace(verify_oauth2_token=lambda *_: _verified_google_identity()))
    monkeypatch.setattr(server, "google_requests", SimpleNamespace(Request=lambda: object()))

    with patch.object(server, "db", fake_db), patch.object(server, "_notify_gmail_approval_request", notify):
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(server.login_google(_google_payload()))

    assert exc_info.value.status_code == 403
    saved = fake_db.users.rows[0]
    assert saved["gmail_approval_status"] == "pending"
    assert saved["google_sub"] == "google-sub-1"
    assert saved["active"] is True
    assert saved["password_hash"] == "existing-local-hash"
    assert saved["name"] == "Local Teacher Name"
    notify.assert_awaited_once()
    assert notify.await_args.args[0]["name"] == "Teacher One"


def test_approved_gmail_user_receives_provider_bound_token(monkeypatch):
    fake_db = _fake_db(
        [{
            "id": "teacher-1",
            "name": "Teacher One",
            "email": "teacher@example.com",
            "username": "teacher",
            "role_name": "Teacher",
            "auth_provider": "local",
            "password_hash": "existing-local-hash",
            "google_sub": "google-sub-1",
            "gmail_approval_status": "approved",
            "active": True,
            "auth_version": 0,
        }]
    )
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-id")
    monkeypatch.setenv("JWT_SECRET", TEST_JWT_SECRET)
    monkeypatch.setattr(server, "_GOOGLE_AUTH_AVAILABLE", True)
    monkeypatch.setattr(server, "google_id_token", SimpleNamespace(verify_oauth2_token=lambda *_: _verified_google_identity()))
    monkeypatch.setattr(server, "google_requests", SimpleNamespace(Request=lambda: object()))

    with patch.object(server, "db", fake_db):
        result = asyncio.run(server.login_google(_google_payload()))

    decoded = server.jwt.decode(result.access_token, TEST_JWT_SECRET, algorithms=["HS256"])
    assert decoded["sub"] == "teacher-1"
    assert decoded["provider"] == "google"


def test_google_session_is_blocked_again_if_approval_is_not_current(monkeypatch):
    fake_db = _fake_db(
        [{
            "id": "teacher-1",
            "role_name": "Teacher",
            "active": True,
            "auth_version": 1,
            "gmail_approval_status": "pending",
        }]
    )
    monkeypatch.setenv("JWT_SECRET", TEST_JWT_SECRET)
    token = server.create_access_token(
        {"sub": "teacher-1", "role": "Teacher", "av": 1, "provider": "google"}
    )
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with patch.object(server, "db", fake_db):
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(server.get_current_user(credentials))

    assert exc_info.value.status_code == 403


def test_legacy_session_without_provider_is_invalidated(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", TEST_JWT_SECRET)
    token = server.create_access_token({"sub": "teacher-1", "role": "Teacher", "av": 1})
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(server.get_current_user(credentials))

    assert exc_info.value.status_code == 401
    assert "log in again" in exc_info.value.detail.lower()


def test_rejecting_gmail_link_preserves_existing_local_account(monkeypatch):
    fake_db = _fake_db(
        [{
            "id": "teacher-1",
            "name": "Teacher One",
            "email": "teacher@example.com",
            "role_name": "Teacher",
            "auth_provider": "local",
            "password_hash": "existing-local-hash",
            "google_sub": "google-sub-1",
            "gmail_approval_status": "pending",
            "active": True,
        }]
    )
    admin = {"id": "admin-1", "name": "Admin", "role_name": "Admin", "email": "admin@example.com"}

    with (
        patch.object(server, "db", fake_db),
        patch.object(server, "log_notification", AsyncMock()),
        patch.object(server, "log_audit", AsyncMock()),
    ):
        result = asyncio.run(
            server.reject_gmail_pending_user("teacher-1", server.GmailPendingApprovalAction(), admin)
        )

    assert result["gmail_approval_status"] == "rejected"
    assert result["active"] is True


def test_teacher_password_change_notifies_all_admin_recipients_without_password(monkeypatch):
    fake_db = _fake_db(
        [{
            "id": "teacher-1",
            "name": "Teacher One",
            "email": "teacher@example.com",
            "username": "teacher",
            "role_name": "Teacher",
            "active": True,
        }]
    )
    notification = AsyncMock()
    current_user = dict(fake_db.users.rows[0])

    with (
        patch.object(server, "db", fake_db),
        patch.object(server, "get_password_hash", return_value="new-safe-hash"),
        patch.object(server, "get_admin_notification_recipients", AsyncMock(return_value=["one@admin.test", "two@admin.test"])),
        patch.object(server, "log_notification", notification),
        patch.object(server, "log_audit", AsyncMock()),
        patch.object(server, "log_user_action", AsyncMock()),
    ):
        asyncio.run(
            server.update_user_profile(
                server.UserProfileUpdate(password="DoNotExposeThisPassword"),
                current_user,
            )
        )

    notification.assert_awaited_once()
    event_type, message, recipient, status = notification.await_args.args
    assert event_type == "password_change"
    assert recipient == "one@admin.test, two@admin.test"
    assert "Teacher One" in message
    assert "DoNotExposeThisPassword" not in message
    assert status == "info"
