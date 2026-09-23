"""Exercise the real SDK request shape without making network calls."""
import json
from unittest.mock import AsyncMock

import httpx2
import pytest
from azure.ai.projects.aio import AIProjectClient

from app.core.config import Settings
from app.integrations.foundry.client import FoundryChatBackend, FoundryError


def response_body(text='{"ok": true}', status="completed"):
    return {
        "id": "resp_test", "object": "response", "created_at": 0,
        "model": "test-model", "status": status,
        "output": [{"id": "msg_test", "type": "message", "role": "assistant",
                    "status": "completed", "content": [
                        {"type": "output_text", "text": text, "annotations": []}]}],
    }


@pytest.fixture
async def foundry(monkeypatch):
    requests, replies = [], []

    def handle(request):
        requests.append(request)
        status, body = replies.pop(0)
        return httpx2.Response(status, json=body)

    http_client = httpx2.AsyncClient(transport=httpx2.MockTransport(handle))
    get_client = AIProjectClient.get_openai_client

    def get_openai_client(project, **kwargs):
        return get_client(project, http_client=http_client, max_retries=0, **kwargs)

    monkeypatch.setattr(AIProjectClient, "get_openai_client", get_openai_client)
    backend = FoundryChatBackend(Settings(
        _env_file=None,
        AZURE_FOUNDRY_PROJECT_ENDPOINT="https://test.services.ai.azure.com/api/projects/test",
        AZURE_FOUNDRY_API_KEY="test-key",
        AZURE_FOUNDRY_MODEL_DEPLOYMENT="",  # Deployed agent owns its model.
        FOUNDRY_MAX_RETRIES=2,
    ))
    yield backend, requests, replies
    await http_client.aclose()
    if backend._project:
        await backend._project.close()


async def test_agent_uses_project_responses_route(foundry):
    backend, requests, replies = foundry
    for agent in ("question-generator", "planner"):
        replies.append((200, response_body()))
        assert await backend.complete_json(agent=agent, system="Return JSON.", user="Task") == {"ok": True}
        request = requests[-1]
        assert request.url.path == "/api/projects/test/openai/v1/responses"
        payload = json.loads(request.content)
        assert payload["agent_reference"] == {"name": agent, "type": "agent_reference"}
        assert payload["input"][0]["type"] == "message"
        assert payload["input"][0]["role"] == "system"
        assert payload["input"][0]["content"].startswith("Return JSON.")
        assert payload["input"][1] == {"type": "message", "role": "user", "content": "Task"}
        assert not {"model", "instructions", "temperature", "text"}.intersection(payload)


@pytest.mark.parametrize("text,status", [
    ('{"ok": true}', "incomplete"), ("", "failed"),
])
async def test_invalid_agent_output_fails_loudly(foundry, text, status):
    backend, requests, replies = foundry
    replies.append((200, response_body(text, status)))
    with pytest.raises(FoundryError) as exc:
        await backend.complete_json(agent="question-generator", system="s", user="u")
    assert exc.value.code == "FOUNDRY_BAD_OUTPUT"
    assert len(requests) == 1


@pytest.mark.parametrize("text", [
    '```json\n{"ok": true}\n```', '```\n{"ok": true}\n```',
    '  ```JSON\r\n{"statement": "Use ``` inside a string"}\r\n```  ',
])
async def test_fenced_json_is_decoded_without_retry(foundry, text):
    backend, requests, replies = foundry
    replies.append((200, response_body(text)))
    output = await backend.complete_json(agent="question-generator", system="s", user="u")
    assert output == ({"statement": "Use ``` inside a string"}
                      if "statement" in text else {"ok": True})
    assert len(requests) == 1


@pytest.mark.parametrize("text", [
    "not JSON", "[]", "null", "", '{"statement": "unescaped\nnewline"}',
    'Here is your question: {"ok": true}', '{"ok": true}\n{"other": true}',
])
async def test_bad_json_gets_one_repair_attempt(foundry, text):
    backend, requests, replies = foundry
    backend.settings.FOUNDRY_MAX_RETRIES = 1
    replies.extend([(200, response_body(text)), (200, response_body())])
    assert await backend.complete_json(agent="question-generator", system="s", user="u") == {"ok": True}
    assert len(requests) == 2
    payload = json.loads(requests[1].content)
    assert payload["agent_reference"]["name"] == "question-generator"
    assert payload["input"][1]["content"] == "u"
    if text:
        assert payload["input"][2] == {"type": "message", "role": "assistant", "content": text}
    assert "corrected JSON object" in payload["input"][-1]["content"]
    assert not {"model", "instructions", "temperature", "text"}.intersection(payload)


async def test_persistently_bad_json_fails_after_repair(foundry):
    backend, requests, replies = foundry
    replies.extend([(200, response_body("not JSON")), (200, response_body("[]"))])
    with pytest.raises(FoundryError) as exc:
        await backend.complete_json(agent="question-generator", system="s", user="u")
    assert exc.value.code == "FOUNDRY_BAD_OUTPUT"
    assert "after one repair attempt" in exc.value.message
    assert len(requests) == 2


async def test_json_repair_can_retry_transient_errors(foundry, monkeypatch):
    backend, requests, replies = foundry
    monkeypatch.setattr("app.integrations.foundry.client.asyncio.sleep", AsyncMock())
    replies.extend([(200, response_body("not JSON")),
                    (429, {"error": {"message": "Rate limit"}}),
                    (200, response_body())])
    assert await backend.complete_json(agent="question-generator", system="s", user="u") == {"ok": True}
    assert len(requests) == 3
    assert json.loads(requests[1].content) == json.loads(requests[2].content)


async def test_missing_agent_has_actionable_error(foundry):
    backend, requests, replies = foundry
    replies.append((404, {"error": {"message": "Agent not found"}}))
    with pytest.raises(FoundryError) as exc:
        await backend.complete_json(agent="missing-agent", system="s", user="u")
    assert exc.value.code == "FOUNDRY_AGENT_NOT_FOUND"
    assert "missing-agent" in exc.value.message
    assert "AZURE_FOUNDRY_PROJECT_ENDPOINT" in exc.value.message
    assert len(requests) == 1


async def test_transient_response_error_is_retried(foundry, monkeypatch):
    backend, requests, replies = foundry
    monkeypatch.setattr("app.integrations.foundry.client.asyncio.sleep", AsyncMock())
    replies.extend([(429, {"error": {"message": "Rate limit"}}), (200, response_body())])
    assert await backend.complete_json(agent="planner", system="s", user="u") == {"ok": True}
    assert len(requests) == 2
