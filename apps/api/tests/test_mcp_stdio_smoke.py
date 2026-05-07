import asyncio
import json
import os
import sys

import pytest


@pytest.mark.asyncio
async def test_stdio_responds_to_initialize():
    proc = await asyncio.create_subprocess_exec(
        sys.executable,
        os.path.join(os.path.dirname(__file__), '..', 'mcp_stdio.py'),
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    request = {
        'jsonrpc': '2.0',
        'id': 1,
        'method': 'initialize',
        'params': {
            'protocolVersion': '2024-11-05',
            'capabilities': {},
            'clientInfo': {'name': 'smoke', 'version': '0'},
        },
    }
    proc.stdin.write((json.dumps(request) + '\n').encode())
    await proc.stdin.drain()

    try:
        line = await asyncio.wait_for(proc.stdout.readline(), timeout=10)
    finally:
        proc.terminate()
        try:
            await asyncio.wait_for(proc.wait(), timeout=5)
        except asyncio.TimeoutError:
            proc.kill()

    assert line, 'stdio process produced no output'
    msg = json.loads(line.decode())
    assert msg.get('id') == 1
    assert 'result' in msg
