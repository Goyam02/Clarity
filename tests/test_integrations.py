"""Integration surfaces: judge sandbox, external APIs, backend contract."""
import pytest

from app.integrations.foundry.client import FoundryError, FoundryChatBackend
from app.services.judge import LocalJudge


@pytest.mark.asyncio
async def test_judge_python_pass_fail():
    j = LocalJudge()
    ok = await j.execute("python", "print(int(input())*2)", [{"input": "21", "output": "42"}])
    assert ok.compile_status == "ok" and ok.passed == 1
    bad = await j.execute("python", "print('nope')", [{"input": "21", "output": "42"}])
    assert bad.passed == 0


@pytest.mark.asyncio
async def test_judge_timeout_and_unsupported():
    j = LocalJudge()
    t = await j.execute("python", "while True: pass", [{"input": "", "output": ""}],
                        timeout_seconds=1)
    assert t.compile_status == "timeout"
    u = await j.execute("brainfuck", "+", [])
    assert u.compile_status == "unsupported"


@pytest.mark.asyncio
async def test_codeforces_github_graceful():
    from app.services import codeforces_service, github_service
    cf = await codeforces_service.get_user_info("this_handle_should_not_exist_xyz123")
    assert "error" in cf or "handle" in cf  # offline OR not-found both acceptable
    gh = await github_service.get_user_summary("this-user-should-not-exist-xyz123")
    assert "error" in gh or "username" in gh


def test_foundry_backend_requires_configuration():
    with pytest.raises(FoundryError) as exc:
        FoundryChatBackend()
    assert exc.value.code == "FOUNDRY_NOT_CONFIGURED"


@pytest.mark.asyncio
async def test_stub_satisfies_backend_contract(stub):
    out = await stub.complete_json(agent="planner", system="s", user="{}")
    assert "tasks" in out
