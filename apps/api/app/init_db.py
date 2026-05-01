import asyncio
from pathlib import Path

from sqlalchemy import text

from app.core.db import engine


SCHEMA_PATH = Path(__file__).resolve().parents[1] / 'db' / 'schema' / 'phase1_schema.sql'
SEED_PATH = Path(__file__).resolve().parents[1] / 'db' / 'seeds' / 'brands.sql'
MIGRATION_PATH = Path(__file__).resolve().parents[1] / 'db' / 'schema' / 'accounts_workspace_migration.sql'


async def _schema_exists(conn) -> bool:
    result = await conn.execute(
        text("SELECT 1 FROM pg_type WHERE typname = 'brand_enum' LIMIT 1")
    )
    return result.scalar() is not None


async def _migration_applied(conn) -> bool:
    result = await conn.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'properties' AND column_name = 'source' LIMIT 1"
        )
    )
    return result.scalar() is not None


async def init_db() -> None:
    schema_sql = SCHEMA_PATH.read_text()
    seed_sql = SEED_PATH.read_text()
    migration_sql = MIGRATION_PATH.read_text()

    # SQL files are split on ';' — do NOT use PL/pgSQL, dollar-quoted strings,
    # or multi-statement blocks in schema/migration files; each statement must
    # end with a single ';' and contain no embedded semicolons.
    async with engine.begin() as conn:
        if not await _schema_exists(conn):
            for statement in [s.strip() for s in schema_sql.split(';') if s.strip()]:
                await conn.execute(text(statement))
            for statement in [s.strip() for s in seed_sql.split(';') if s.strip()]:
                await conn.execute(text(statement))

        if not await _migration_applied(conn):
            for statement in [s.strip() for s in migration_sql.split(';') if s.strip()]:
                await conn.execute(text(statement))


if __name__ == '__main__':
    asyncio.run(init_db())
