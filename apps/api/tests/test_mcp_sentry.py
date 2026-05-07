import os
import pytest

from app.mcp.sentry import is_sentry_active


def test_sentry_off_by_default(monkeypatch):
    monkeypatch.delenv('APEX_MCP_SENTRY_TOOLS', raising=False)
    assert is_sentry_active('propose_draft_edit') is False


def test_sentry_active_when_listed(monkeypatch):
    monkeypatch.setenv('APEX_MCP_SENTRY_TOOLS', 'propose_paperclip_task_comment,propose_draft_edit')
    assert is_sentry_active('propose_paperclip_task_comment') is True
    assert is_sentry_active('propose_draft_edit') is True
    assert is_sentry_active('propose_draft_create') is False


def test_sentry_handles_whitespace_and_empty(monkeypatch):
    monkeypatch.setenv('APEX_MCP_SENTRY_TOOLS', '  propose_draft_edit ,  , ')
    assert is_sentry_active('propose_draft_edit') is True
    assert is_sentry_active('') is False
