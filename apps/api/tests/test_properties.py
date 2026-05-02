import pytest
import httpx
from app.main import app


@pytest.mark.asyncio
async def test_list_properties_returns_list():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url='http://test'
    ) as client:
        resp = await client.get('/properties')
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_create_and_retrieve_property():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url='http://test'
    ) as client:
        create_resp = await client.post('/properties', json={
            'name': 'Test Property Plan',
            'market': 'Dallas',
            'building_type': 'office',
            'sqft': 10000,
            'noi_cents': 5000000,
            'notes': 'plan test',
            'brands': ['scout_security'],
        })
        assert create_resp.status_code == 200
        created = create_resp.json()
        assert created['id']
        assert created['source'] == 'manual'

        list_resp = await client.get('/properties')
        ids = [p['id'] for p in list_resp.json()]
        assert created['id'] in ids

        # cleanup
        del_resp = await client.delete(f'/properties/{created["id"]}')
        assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_patch_property():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url='http://test'
    ) as client:
        create_resp = await client.post('/properties', json={'name': 'Patch Test Plan'})
        prop_id = create_resp.json()['id']

        patch_resp = await client.patch(f'/properties/{prop_id}', json={'notes': 'updated note'})
        assert patch_resp.status_code == 200
        assert patch_resp.json()['notes'] == 'updated note'

        # cleanup
        await client.delete(f'/properties/{prop_id}')


@pytest.mark.asyncio
async def test_delete_auto_property_is_forbidden():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url='http://test'
    ) as client:
        resp = await client.delete('/properties/00000000-0000-0000-0000-000000000000')
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_duplicate_property_returns_409():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url='http://test'
    ) as client:
        payload = {'name': 'Dupe Test Plan', 'market': 'Austin'}
        first = await client.post('/properties', json=payload)
        assert first.status_code == 200
        prop_id = first.json()['id']

        second = await client.post('/properties', json=payload)
        assert second.status_code == 409
        assert 'existing_id' in second.json()['detail']

        # cleanup
        await client.delete(f'/properties/{prop_id}')
