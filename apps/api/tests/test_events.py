import pytest
import httpx
from app.main import app


@pytest.mark.asyncio
async def test_list_events_returns_list():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url='http://test'
    ) as client:
        resp = await client.get('/events')
    assert resp.status_code == 200
    assert 'events' in resp.json()
    assert isinstance(resp.json()['events'], list)


@pytest.mark.asyncio
async def test_since_future_timestamp_returns_empty():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url='http://test'
    ) as client:
        resp = await client.get('/events?since=2099-01-01T00:00:00Z')
    assert resp.status_code == 200
    assert resp.json()['events'] == []


@pytest.mark.asyncio
async def test_since_past_timestamp_returns_events():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url='http://test'
    ) as client:
        since_resp = await client.get('/events?since=2000-01-01T00:00:00Z')
        no_filter_resp = await client.get('/events')
    assert since_resp.status_code == 200
    data = since_resp.json()
    assert 'events' in data
    assert len(data['events']) == len(no_filter_resp.json()['events'])
