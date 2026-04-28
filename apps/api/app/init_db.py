import asyncio
from pathlib import Path

from sqlalchemy import text

from app.core.db import engine


SCHEMA_PATH = Path(__file__).resolve().parents[3] / 'packages' / 'db' / 'schema' / 'phase1_schema.sql'
SEED_PATH = Path(__file__).resolve().parents[3] / 'packages' / 'db' / 'seeds' / 'brands.sql'


async def init_db() -> None:
    schema_sql = SCHEMA_PATH.read_text()
    seed_sql = SEED_PATH.read_text()

    async with engine.begin() as conn:
        for statement in [s.strip() for s in schema_sql.split(';') if s.strip()]:
            await conn.execute(text(statement))
        for statement in [s.strip() for s in seed_sql.split(';') if s.strip()]:
            await conn.execute(text(statement))


if __name__ == '__main__':
    asyncio.run(init_db())
