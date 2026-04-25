import os
import sys
import types

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")


class _Dummy:
    def __init__(self, *args, **kwargs):
        pass

    def __getattr__(self, name):
        return _Dummy()

    def __call__(self, *args, **kwargs):
        return _Dummy()

    def __getitem__(self, key):
        return _Dummy()


def _stub_module(name, **attrs):
    module = types.ModuleType(name)
    for key, value in attrs.items():
        setattr(module, key, value)
    sys.modules.setdefault(name, module)
    return module


_stub_module("motor", motor_asyncio=_stub_module("motor.motor_asyncio", AsyncIOMotorClient=_Dummy))
_stub_module("motor.motor_asyncio", AsyncIOMotorClient=_Dummy)
_stub_module("apscheduler", schedulers=_Dummy(), triggers=_Dummy())
_stub_module("apscheduler.schedulers", asyncio=_stub_module("apscheduler.schedulers.asyncio", AsyncIOScheduler=_Dummy))
_stub_module("apscheduler.schedulers.asyncio", AsyncIOScheduler=_Dummy)
_stub_module("apscheduler.triggers", cron=_stub_module("apscheduler.triggers.cron", CronTrigger=_Dummy))
_stub_module("apscheduler.triggers.cron", CronTrigger=_Dummy)
_stub_module("sendgrid", SendGridAPIClient=_Dummy)
_stub_module("sendgrid.helpers", mail=_Dummy())
_stub_module(
    "sendgrid.helpers.mail",
    Mail=_Dummy,
    Attachment=_Dummy,
    FileContent=_Dummy,
    FileName=_Dummy,
    FileType=_Dummy,
    Disposition=_Dummy,
    Email=_Dummy,
)
_stub_module("twilio", rest=_stub_module("twilio.rest", Client=_Dummy))
_stub_module("twilio.rest", Client=_Dummy)
_stub_module("jwt")
_stub_module("passlib", context=_stub_module("passlib.context", CryptContext=_Dummy))
_stub_module("passlib.context", CryptContext=_Dummy)


from server import include_in_need_support_list


def test_support_list_includes_approach_scores_below_on_level():
    assert include_in_need_support_list(
        {
            "performance_level": "approach",
            "total_score_normalized": 44.5,
        }
    )


def test_support_list_excludes_on_level_scores():
    assert not include_in_need_support_list(
        {
            "performance_level": "on_level",
            "total_score_normalized": 46,
        }
    )


def test_support_list_keeps_below_students_without_numeric_total():
    assert include_in_need_support_list({"performance_level": "below"})
